export type IconName =
  | 'power'
  | 'live'
  | 'agents'
  | 'tasks'
  | 'terminal'
  | 'files'
  | 'git'
  | 'deploy'
  | 'analytics'
  | 'replay'
  | 'settings'
  | 'chevron'
  | 'close'
  | 'pause'
  | 'play'
  | 'clock'
  | 'check'
  | 'layers'
  | 'external'
  | 'search';
const paths: Record<IconName, string> = {
  power: 'M12 2v10M6 5a9 9 0 1 0 12 0',
  live: 'M7 4h10l3 3v12H4V7l3-3ZM9 4V2h6v2M8 10h8v6H8Z',
  agents:
    'M15 8a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM5 20v-3c0-3 3-4 7-4s7 1 7 4v3M4 9a2 2 0 0 0 0 4M20 9a2 2 0 0 1 0 4',
  tasks: 'M9 3h6v4H9ZM7 5H4v16h16V5h-3M8 12l2 2 5-5M8 18h8',
  terminal: 'm5 7 4 4-4 4M12 17h7M3 3h18v18H3Z',
  files: 'M4 3h7l3 4h6v14H4ZM4 7h10',
  git: 'M7 3v12a4 4 0 0 0 8 0V9M7 7h0M15 5h0M5 3a2 2 0 1 0 4 0a2 2 0 1 0-4 0M13 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  deploy: 'm12 2 9 10-9 10L3 12 12 2ZM12 2v20M3 12h18',
  analytics: 'M4 21V10h4v11M10 21V4h4v17M16 21V7h4v14',
  replay: 'M4 8V3M4 8h5M4 8a9 9 0 1 1-1 7M12 7v5l3 2',
  settings:
    'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0',
  chevron: 'm8 5 7 7-7 7',
  close: 'm6 6 12 12M6 18 18 6',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8V4Z',
  clock: 'M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0ZM12 7v5l3 2',
  check: 'm5 12 4 4L19 6',
  layers: 'm12 2 10 6-10 6L2 8 12 2ZM2 12l10 6 10-6M2 16l10 6 10-6',
  external: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
  search: 'M17 10a7 7 0 1 1-14 0a7 7 0 0 1 14 0Zm-2 5 6 6',
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
