export type IconName =
  | 'dashboard'
  | 'plus'
  | 'cases'
  | 'scan'
  | 'worklist'
  | 'search'
  | 'users'
  | 'protocols'
  | 'settings'
  | 'audit'
  | 'logout'
  | 'menu'
  | 'close'
  | 'sun'
  | 'moon'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'arrow-left'
  | 'arrow-right'
  | 'print'
  | 'download'
  | 'file'
  | 'lock'
  | 'alert'
  | 'check'
  | 'x'
  | 'clock'
  | 'user'
  | 'flask'
  | 'block'
  | 'slide'
  | 'microscope'
  | 'archive'
  | 'calendar'
  | 'filter'
  | 'refresh'
  | 'eye'
  | 'edit'
  | 'save'
  | 'external'
  | 'pin'
  | 'wifi-off'
  | 'volume'
  | 'volume-off'
  | 'keyboard'
  | 'trash'
  | 'send'
  | 'clipboard'
  | 'shield'
  | 'stethoscope'
  | 'beaker'
  | 'scale'
  | 'qr'
  | 'billing';

export const iconPaths: Record<IconName, readonly string[]> = {
  dashboard: ['M3 3h7v7H3z', 'M14 3h7v4h-7z', 'M14 11h7v10h-7z', 'M3 14h7v7H3z'],
  plus: ['M12 5v14', 'M5 12h14'],
  cases: ['M3 6.5h7l2 2h9v11H3z', 'M3 6.5v-2h7l2 2h9v2'],
  scan: ['M4 5v14', 'M7 8v8', 'M10 4v16', 'M13 8v8', 'M16 6v12', 'M19 9v6'],
  worklist: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3.5 6l1.2 1.2L7 5',
    'M3.5 12l1.2 1.2L7 11',
    'M3.5 18l1.2 1.2L7 17',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.6-4.6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  protocols: ['M4 3h10l6 6v12H4z', 'M14 3v6h6', 'M8 13h8', 'M8 17h5'],
  settings: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z',
  ],
  audit: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 7v5l3 2'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 1v2',
    'M12 21v2',
    'M4.2 4.2l1.4 1.4',
    'M18.4 18.4l1.4 1.4',
    'M1 12h2',
    'M21 12h2',
    'M4.2 19.8l1.4-1.4',
    'M18.4 5.6l1.4-1.4',
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'chevron-up': ['M18 15l-6-6-6 6'],
  'arrow-left': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'M12 5l7 7-7 7'],
  print: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h8',
  ],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  alert: ['M12 3 2.5 20h19z', 'M12 9v5', 'M12 17.5v.5'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
  flask: ['M9 2h6', 'M10 2v6L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V2', 'M7 15h10'],
  block: ['M12 2 3 7v10l9 5 9-5V7z', 'M3 7l9 5 9-5', 'M12 12v10'],
  slide: ['M3 7h18v10H3z', 'M7 7v10', 'M7 12h10'],
  microscope: [
    'M6 18h12',
    'M9 18v-3',
    'M12 15V8',
    'M9 8V5a3 3 0 0 1 6 0v3',
    'M6 22h12',
    'M16 9a6 6 0 0 1-4 9',
  ],
  archive: ['M3 3h18v5H3z', 'M5 8v13h14V8', 'M10 12h4'],
  calendar: ['M3 5h18v16H3z', 'M8 2v6', 'M16 2v6', 'M3 10h18'],
  filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
  refresh: [
    'M21 12a9 9 0 0 1-15.5 6.2L3 16',
    'M3 12a9 9 0 0 1 15.5-6.2L21 8',
    'M3 21v-5h5',
    'M21 3v5h-5',
  ],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  external: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3',
  ],
  pin: [
    'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z',
    'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  'wifi-off': [
    'M2 2l20 20',
    'M8.5 8.5A10 10 0 0 1 22 9',
    'M2 9a15 15 0 0 1 4.2-1.6',
    'M5 12.5a10 10 0 0 1 4-1.3',
    'M8.5 16a6 6 0 0 1 7 0',
    'M12 20h.01',
  ],
  volume: ['M11 5 6 9H2v6h4l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  'volume-off': ['M11 5 6 9H2v6h4l5 4z', 'M22 9l-6 6', 'M16 9l6 6'],
  keyboard: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M19 10h.01', 'M7 14h10'],
  trash: ['M3 6h18', 'M8 6V3h8v3', 'M19 6l-1 15H6L5 6', 'M10 11v6', 'M14 11v6'],
  send: ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4z'],
  clipboard: ['M9 2h6v4H9z', 'M8 4H4v18h16V4h-4', 'M8 11h8', 'M8 15h5'],
  shield: ['M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z', 'M9 12l2 2 4-4'],
  stethoscope: [
    'M6 3v6a4 4 0 0 0 8 0V3',
    'M4 3h4',
    'M12 3h4',
    'M10 13v3a5 5 0 0 0 10 0v-2',
    'M20 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  beaker: ['M6 2h12', 'M7 2v7L4 20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L17 9V2', 'M6 14h12'],
  scale: ['M12 3v18', 'M5 6h14', 'M5 6l-3 7h6z', 'M19 6l-3 7h6z', 'M8 21h8'],
  billing: ['M3 7h18v10H3z', 'M3 10h18', 'M7 14h3', 'M16 13.5h1.5'],
  qr: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M3 14h7v7H3z',
    'M14 14h3v3h-3z',
    'M20 14h1',
    'M14 20h1',
    'M20 20h1',
  ],
};
