import type { SVGProps } from 'react';

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  pin: 'M9 4h6l-1 6 4 4H6l4-4zM12 14v7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  cloud: 'M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  cloudOff: 'M3 3l18 18M7 18a5 5 0 0 1-1.7-9.7M9.5 5.5A6 6 0 0 1 18 9a4.5 4.5 0 0 1 2.4 8.3M17 18H7',
  sync: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  todo: 'M4 5h6v6H4zM5.5 8l1.5 1.5L9.5 6.5M13 8h7M4 14h6v6H4zM13 17h7',
  code: 'M9 8l-4 4 4 4M15 8l4 4-4 4',
  text: 'M5 6h14M12 6v13M9 19h6',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  numbered: 'M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M4 13.5a1.5 1.5 0 0 1 3 0c0 1.5-3 2-3 3.5h3',
  heading: 'M6 4v16M18 4v16M6 12h12',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  folder: 'M3 6h6l2 2h10v11H3z',
  drive: 'M3 7h18v10H3zM7 12h.01M11 12h6',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M11 5h6M7 19h6M14 5l-4 14',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  strike: 'M5 12h14M16 7a4 3 0 0 0-8 0c0 4 8 2 8 6a4 3 0 0 1-8 0',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
