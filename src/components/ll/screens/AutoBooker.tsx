import { use, useEffect, useState } from 'react';

import { FlexExperience } from '@/api/ll';
import FloatingButton from '@/components/FloatingButton';
import Screen from '@/components/Screen';
import { Time } from '@/components/Time';
import AutoBookContext, { AutoBookConfig } from '@/contexts/AutoBookContext';
import BookingDateContext from '@/contexts/BookingDateContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import ParkContext from '@/contexts/ParkContext';
import { DateTime, formatTime } from '@/datetime';

import RefreshButton from './RefreshButton';

function isFlexExperience(exp: unknown): exp is FlexExperience {
  return !!(exp as FlexExperience).flex;
}

export default function AutoBooker() {
  const { config, saveConfig, status } = use(AutoBookContext);
  const { bookingDate } = use(BookingDateContext);
  const { park } = use(ParkContext);
  const { experiences, refreshExperiences, loaderElem } =
    use(ExperiencesContext);
  const [draft, setDraft] = useState<AutoBookConfig>(config);
  const targetIds = new Set(draft.targetIds);
  const targetOrder = new Map(draft.targetIds.map((id, i) => [id, i]));
  const targetExperiences = experiences
    .filter(isFlexExperience)
    .filter(exp => exp.park.id === park.id)
    .sort(
      (a, b) =>
        +!targetIds.has(a.id) - +!targetIds.has(b.id) ||
        (targetOrder.get(a.id) ?? Infinity) -
          (targetOrder.get(b.id) ?? Infinity) ||
        a.name.localeCompare(b.name)
    );

  useEffect(() => setDraft(config), [config]);
  useEffect(() => {
    if (targetExperiences.length === 0) refreshExperiences();
  }, [refreshExperiences, targetExperiences.length]);

  const update = (patch: Partial<AutoBookConfig>) => {
    setDraft(draft => ({ ...draft, ...patch }));
  };

  const toggleTarget = (id: string) => {
    const ids = new Set(draft.targetIds);
    ids[ids.has(id) ? 'delete' : 'add'](id);
    update({ targetIds: [...ids] });
  };

  const now = DateTime.now().time;

  return (
    <Screen
      title="Auto Booker"
      theme={park.theme}
      buttons={
        <RefreshButton name="Experiences" onClick={refreshExperiences} />
      }
    >
      <div className="py-3">
        <label className="flex items-center gap-x-2 font-semibold">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={event => update({ enabled: event.currentTarget.checked })}
          />
          Auto book matching Lightning Lanes
        </label>
        <p className="mt-2 text-sm text-gray-600">
          Status: {status.message}
          {status.lastChecked && (
            <> at {formatTime(status.lastChecked.split('T')[1] ?? '')}</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <label>
          <span className="block text-xs font-semibold uppercase text-gray-500">
            Poll every
          </span>
          <select
            className="w-full mt-1 border rounded px-2 py-1"
            value={draft.intervalSeconds}
            onChange={event =>
              update({ intervalSeconds: Number(event.currentTarget.value) })
            }
          >
            {[1, 2, 3].map(seconds => (
              <option value={seconds} key={seconds}>
                {seconds} sec
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="block text-xs font-semibold uppercase text-gray-500">
            Max from now
          </span>
          <input
            className="w-full mt-1 border rounded px-2 py-1"
            type="number"
            min="1"
            step="5"
            value={draft.maxMinutesFromNow}
            onChange={event =>
              update({ maxMinutesFromNow: Number(event.currentTarget.value) })
            }
          />
        </label>
      </div>

      <label className="block mt-4">
        <span className="block text-xs font-semibold uppercase text-gray-500">
          Discord webhook
        </span>
        <input
          className="w-full mt-1 border rounded px-2 py-1"
          type="url"
          value={draft.webhookUrl}
          onChange={event => update({ webhookUrl: event.currentTarget.value })}
          placeholder="https://discord.com/api/webhooks/..."
        />
      </label>

      <h2>Targets</h2>
      <p className="text-sm text-gray-600">
        Booking date: {bookingDate}. Today&apos;s cutoff is within{' '}
        {draft.maxMinutesFromNow} minutes of <Time time={now} />. Selected
        targets are checked first, in the order you add them.
      </p>

      {targetExperiences.length === 0 ? (
        <p>No Lightning Lane experiences loaded for this park yet.</p>
      ) : (
        <ul className="dividers mt-3">
          {targetExperiences.map(exp => (
            <li key={exp.id}>
              <label className="flex items-center gap-x-3 py-2">
                <input
                  type="checkbox"
                  checked={targetIds.has(exp.id)}
                  onChange={() => toggleTarget(exp.id)}
                />
                <span className="flex-1 leading-tight">
                  <span className="block font-semibold">{exp.name}</span>
                  <span className="text-sm text-gray-600">
                    {targetOrder.has(exp.id) && (
                      <>
                        Priority {(targetOrder.get(exp.id) ?? 0) + 1}
                        {' | '}
                      </>
                    )}
                    Next LL:{' '}
                    {exp.flex.nextAvailableTime ? (
                      <Time time={exp.flex.nextAvailableTime} />
                    ) : (
                      'none'
                    )}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {loaderElem}
      <FloatingButton
        disabled={draft.enabled && draft.targetIds.length === 0}
        onClick={() => {
          saveConfig(draft);
          history.back();
        }}
      >
        Save Auto Booker
      </FloatingButton>
    </Screen>
  );
}
