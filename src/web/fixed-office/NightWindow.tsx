import { useEffect, useRef, useState } from 'react';
import { ART } from './scene-layout.ts';
import { DAY_WINDOW_ASSET, NIGHT_WINDOW_ASSET, type OfficeTheme } from './office-theme.ts';

export const OFFICE_WINDOW_PATH =
  'M 833 35 L 908 30 L 900 262 L 827 252 Z M 922 30 L 1053 25 L 1040 289 L 911 272 Z M 1069 26 L 1151 21 L 1136 300 L 1053 286 Z';
type WindowTheme = Exclude<OfficeTheme, 'sunset'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';
const assets = { day: DAY_WINDOW_ASSET, night: NIGHT_WINDOW_ASSET };
export function useOfficeWindow(theme: OfficeTheme) {
  const [states, setStates] = useState<Partial<Record<WindowTheme, Status>>>({});
  const loaded = useRef(new Set<WindowTheme>());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (theme === 'sunset' || loaded.current.has(theme)) return;
    let cancelled = false;
    const image = new Image();
    const finish = (status: 'ready' | 'error') => {
      clearTimeout(deadline);
      if (cancelled) return;
      if (status === 'ready') loaded.current.add(theme);
      setStates((current) => ({ ...current, [theme]: status }));
    };
    const deadline = window.setTimeout(() => finish('error'), 12_000);
    setStates((current) => ({ ...current, [theme]: 'loading' }));
    image.onload = () => finish('ready');
    image.onerror = () => finish('error');
    image.src = assets[theme];
    return () => {
      cancelled = true;
      clearTimeout(deadline);
      image.onload = null;
      image.onerror = null;
    };
  }, [theme, retry]);
  return {
    status: theme === 'sunset' ? 'ready' : (states[theme] ?? 'idle'),
    loaded: Array.from(loaded.current),
    retry: () => setRetry((value) => value + 1),
    failed: (failedTheme: WindowTheme) => {
      loaded.current.delete(failedTheme);
      setStates((current) => ({ ...current, [failedTheme]: 'error' }));
    },
  };
}
export function OfficeWindow({
  id,
  theme,
  loaded,
  onError,
}: {
  id: string;
  theme: OfficeTheme;
  loaded: WindowTheme[];
  onError: (theme: WindowTheme) => void;
}) {
  return (
    <g data-layer="window-scenery">
      <defs>
        <clipPath id={`${id}-office-window`}>
          <path d={OFFICE_WINDOW_PATH} />
        </clipPath>
      </defs>
      {loaded.map((view) => (
        <g key={view} data-layer={`${view}-window`} display={theme === view ? 'inline' : 'none'}>
          <image
            href={assets[view]}
            x={ART.x}
            y={0}
            width={ART.widthOfRoom}
            height={ART.heightOfRoom}
            preserveAspectRatio="none"
            clipPath={`url(#${id}-office-window)`}
            onError={() => onError(view)}
          />
        </g>
      ))}
    </g>
  );
}
