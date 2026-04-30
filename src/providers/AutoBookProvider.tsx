import { use, useCallback, useEffect, useRef, useState } from 'react';

import { isLLMP } from '@/api/itinerary';
import { FlexExperience, Guest, OfferError, OfferExperience } from '@/api/ll';
import AutoBookContext, {
  AUTO_BOOK_KEY,
  AutoBookConfig,
  AutoBookStatus,
  DEFAULT_AUTO_BOOK_CONFIG,
} from '@/contexts/AutoBookContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ClientsContext from '@/contexts/ClientsContext';
import ParkContext from '@/contexts/ParkContext';
import PlansContext from '@/contexts/PlansContext';
import ResortContext from '@/contexts/ResortContext';
import { DateTime, formatTime, parkDate } from '@/datetime';
import kvdb from '@/kvdb';

function loadConfig(): AutoBookConfig {
  const config = kvdb.get<Partial<AutoBookConfig>>(AUTO_BOOK_KEY) ?? {};
  return {
    ...DEFAULT_AUTO_BOOK_CONFIG,
    ...config,
    targetIds: Array.isArray(config.targetIds) ? config.targetIds : [],
    intervalSeconds: Math.max(1, Math.min(30, config.intervalSeconds ?? 3)),
    maxMinutesFromNow: Math.max(1, config.maxMinutesFromNow ?? 120),
    webhookUrl: typeof config.webhookUrl === 'string' ? config.webhookUrl : '',
  };
}

function isFlexExperience(exp: OfferExperience): exp is FlexExperience {
  return !!exp.flex;
}

function isCloseEnough(
  time: { date: string; time: { valueOf(): number } },
  maxMinutes: number
) {
  if (time.date !== parkDate()) return true;
  const secondsFromNow = +time.time - +DateTime.now().time;
  return secondsFromNow >= 0 && secondsFromNow <= maxMinutes * 60;
}

async function sendWebhook(
  url: string,
  message: {
    experienceName: string;
    startTime: string;
    date: string;
    guestCount: number;
    resortId: string;
  }
) {
  if (!url.trim()) return;
  await fetch(url.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: [
        `Booked ${message.experienceName}`,
        `${formatTime(message.startTime)} on ${message.date}`,
        `${message.guestCount} guest${message.guestCount === 1 ? '' : 's'}`,
        message.resortId,
      ].join(' | '),
    }),
  });
}

export default function AutoBookProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ll } = use(ClientsContext);
  const resort = use(ResortContext);
  const { park } = use(ParkContext);
  const { bookingDate } = use(BookingDateContext);
  const { plans, refreshPlans } = use(PlansContext);
  const [config, setConfig] = useState(loadConfig);
  const [status, setStatus] = useState<AutoBookStatus>({
    message: config.enabled ? 'Starting' : 'Off',
    running: false,
  });
  const checking = useRef(false);

  const saveConfig = useCallback((newConfig: AutoBookConfig) => {
    newConfig = {
      ...newConfig,
      intervalSeconds: Math.max(1, Math.min(30, newConfig.intervalSeconds)),
      maxMinutesFromNow: Math.max(1, newConfig.maxMinutesFromNow),
    };
    kvdb.set<AutoBookConfig>(AUTO_BOOK_KEY, newConfig);
    setConfig(newConfig);
  }, []);

  useEffect(() => {
    if (!config.enabled) {
      setStatus(status => ({
        ...status,
        message: status.message.startsWith('Booked ') ? status.message : 'Off',
        running: false,
      }));
      return;
    }
    if (config.targetIds.length === 0) {
      setStatus({
        message: 'Choose at least one target attraction',
        running: false,
      });
      return;
    }

    let cancelled = false;
    const bookedIds = new Set(
      plans
        .filter(isLLMP)
        .filter(b => b.start.date === bookingDate)
        .map(b => b.experience.id)
    );

    async function checkOnce() {
      if (checking.current || cancelled) return;
      checking.current = true;
      const lastChecked = DateTime.now().toString();
      setStatus({ lastChecked, message: 'Checking', running: true });

      try {
        const targetIds = new Set(config.targetIds);
        const experiences = (await ll.experiences(park, bookingDate))
          .filter(isFlexExperience)
          .filter(exp => targetIds.has(exp.id))
          .filter(exp => !bookedIds.has(exp.id));

        for (const experience of experiences) {
          if (
            experience.flex.nextAvailableTime &&
            !isCloseEnough(
              { date: bookingDate, time: experience.flex.nextAvailableTime },
              config.maxMinutesFromNow
            )
          ) {
            continue;
          }

          let guests: Guest[];
          try {
            guests = (await ll.guests(experience, bookingDate)).eligible.slice(
              0,
              ll.rules.maxPartySize
            );
          } catch (error) {
            console.error(error);
            continue;
          }
          if (guests.length === 0) continue;

          try {
            const offer = await ll.offer(experience, guests, {
              date: bookingDate,
            });
            if (!isCloseEnough(offer.start, config.maxMinutesFromNow)) {
              continue;
            }
            const booking = await ll.book(offer);
            refreshPlans();
            await sendWebhook(config.webhookUrl, {
              experienceName: booking.experience.name,
              startTime: booking.start.time.toString(),
              date: booking.start.date,
              guestCount: booking.guests.length,
              resortId: resort.id,
            });
            saveConfig({ ...config, enabled: false });
            setStatus({
              lastChecked,
              message: `Booked ${booking.experience.name} for ${formatTime(
                booking.start.time
              )}`,
              running: false,
            });
            return;
          } catch (error: any) {
            if (
              error instanceof OfferError ||
              error?.response?.status === 410
            ) {
              continue;
            }
            throw error;
          }
        }

        setStatus({
          lastChecked,
          message: experiences.length
            ? 'No matching slot yet'
            : 'No targets available',
          running: true,
        });
      } catch (error: any) {
        console.error(error);
        setStatus({
          lastChecked,
          message: error?.name ?? 'Auto-book check failed',
          running: false,
        });
      } finally {
        checking.current = false;
      }
    }

    checkOnce();
    const intervalId = setInterval(checkOnce, config.intervalSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [bookingDate, config, ll, park, plans, refreshPlans, resort, saveConfig]);

  return (
    <AutoBookContext value={{ config, saveConfig, status }}>
      {children}
    </AutoBookContext>
  );
}
