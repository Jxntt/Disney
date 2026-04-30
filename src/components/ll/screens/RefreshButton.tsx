import { useEffect, useRef, useState } from 'react';

import Button from '@/components/Button';
import RefreshIcon from '@/icons/RefreshIcon';

interface Props extends Omit<React.HTMLProps<HTMLButtonElement>, 'type'> {
  auto?: boolean;
  intervals?: number[];
  name: string;
  onClick: () => void | Promise<void>;
}

export default function RefreshButton({
  auto = true,
  intervals = [1, 2, 3],
  name,
  onClick,
  ...props
}: Props) {
  const [autoSeconds, setAutoSeconds] = useState(0);
  const loading = useRef(false);

  useEffect(() => {
    if (!autoSeconds) return;
    const refresh = async () => {
      if (loading.current) return;
      loading.current = true;
      try {
        await onClick();
      } finally {
        loading.current = false;
      }
    };
    refresh();
    const intervalId = setInterval(refresh, autoSeconds * 1000);
    return () => clearInterval(intervalId);
  }, [autoSeconds, onClick]);

  return (
    <>
      <Button {...props} title={`Refresh ${name}`} onClick={onClick}>
        <RefreshIcon />
      </Button>
      {auto && (
        <>
          <Button
            title={`${autoSeconds ? 'Stop' : 'Start'} auto-refresh ${name}`}
            onClick={() =>
              setAutoSeconds(autoSeconds ? 0 : (intervals[0] ?? 3))
            }
            color={autoSeconds ? 'bg-green-700 text-white' : undefined}
          >
            {autoSeconds ? `${autoSeconds}s` : 'Auto'}
          </Button>
          {autoSeconds > 0 && (
            <select
              aria-label={`Auto-refresh ${name} interval`}
              className="h-9 rounded-lg border border-black/20 bg-white px-1 text-sm text-black"
              value={autoSeconds}
              onChange={event =>
                setAutoSeconds(Number(event.currentTarget.value))
              }
            >
              {intervals.map(seconds => (
                <option value={seconds} key={seconds}>
                  {seconds}s
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </>
  );
}
