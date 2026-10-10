import type { ReactNode } from 'react';
import type { LinkKind } from '../data/profile.ts';

// Line icons drawn on a 24 px grid. No brand logos: LinkedIn and GitHub get generic glyphs
// (a profile card and code brackets) and always carry a text label or aria-label.

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const MailIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
  </Svg>
);

export const PhoneIcon = () => (
  <Svg>
    <path d="M6.6 3.5h2.8l1.4 4.2-1.9 1.4a11.5 11.5 0 0 0 6 6l1.4-1.9 4.2 1.4v2.8a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.6 5.5a2 2 0 0 1 2-2z" />
  </Svg>
);

export const ProfileIcon = () => (
  <Svg>
    <rect x="3" y="4.5" width="18" height="15" rx="3" />
    <circle cx="9" cy="10.5" r="2.3" />
    <path d="M5.8 16.5a3.3 3.3 0 0 1 6.4 0" />
    <path d="M15 10h3M15 13.5h3" />
  </Svg>
);

export const CodeIcon = () => (
  <Svg>
    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />
  </Svg>
);

export const GlobeIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9M12 3C9.5 5.6 8.3 8.6 8.3 12s1.2 6.4 3.7 9" />
  </Svg>
);

export const DemoIcon = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="13" rx="2.5" />
    <path d="M8.5 21h7M12 17v4" />
    <path d="m10.3 8 4.2 2.5-4.2 2.5z" />
  </Svg>
);

export const PaperIcon = () => (
  <Svg>
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Svg>
);

export const AwardIcon = () => (
  <Svg>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m8.8 13.5-1.3 7 4.5-2.6 4.5 2.6-1.3-7" />
  </Svg>
);

export const ClassicIcon = () => (
  <Svg>
    <rect x="4.5" y="3" width="15" height="18" rx="3" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </Svg>
);

export const SoundOnIcon = () => (
  <Svg>
    <path d="M4 9.5v5h3.5l5 4v-13l-5 4z" />
    <path d="M16 9.2a4 4 0 0 1 0 5.6M18.6 6.6a7.6 7.6 0 0 1 0 10.8" />
  </Svg>
);

export const SoundOffIcon = () => (
  <Svg>
    <path d="M4 9.5v5h3.5l5 4v-13l-5 4z" />
    <path d="m16.5 9.5 5 5M21.5 9.5l-5 5" />
  </Svg>
);

export const MoonIcon = () => (
  <Svg>
    <path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z" />
  </Svg>
);

export const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Svg>
);

export const HelpIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9.4a2.7 2.7 0 1 1 3.8 2.5c-.7.3-1.2 1-1.2 1.8v.5" />
    <circle cx="12" cy="17.2" r=".6" fill="currentColor" />
  </Svg>
);

export const SettingsIcon = () => (
  <Svg>
    <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
    <circle cx="16" cy="7" r="2.5" />
    <circle cx="10" cy="17" r="2.5" />
  </Svg>
);

export const CloseIcon = () => (
  <Svg>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);

export const ArrowIcon = () => (
  <Svg>
    <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
  </Svg>
);

export const ExternalIcon = () => (
  <Svg className="icon--small">
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

export const PrintIcon = () => (
  <Svg>
    <path d="M7 9V3.5h10V9" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v6.5H7z" />
  </Svg>
);

export const CarIcon = () => (
  <Svg>
    <path d="M3 15.5v-3.2a1 1 0 0 1 .6-.9L6 10.2l2.2-3.6a1 1 0 0 1 .9-.5h5.6a1 1 0 0 1 .8.4l2.9 3.7h1.8a1 1 0 0 1 1 1v4.3" />
    <path d="M8.2 10.2h10" />
    <circle cx="7.5" cy="16" r="2.2" />
    <circle cx="16.5" cy="16" r="2.2" />
    <path d="M9.7 16h4.6" />
  </Svg>
);

export const MapIcon = () => (
  <Svg>
    <path d="M9 4 3.5 6.2v13.6L9 17.6l6 2.4 5.5-2.2V4.2L15 6.4z" />
    <path d="M9 4v13.6M15 6.4V20" />
  </Svg>
);

export const ChevronIcon = () => (
  <Svg>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const KeyboardIcon = () => (
  <Svg>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
  </Svg>
);

export const TouchIcon = () => (
  <Svg>
    <path d="M9 11.5V5.2a1.7 1.7 0 0 1 3.4 0V11l4.4.9a2.2 2.2 0 0 1 1.7 2.5l-.7 4.4a2.5 2.5 0 0 1-2.5 2.2H11a2.5 2.5 0 0 1-2-1l-3.4-4.6a1.6 1.6 0 0 1 2.4-2.1z" />
  </Svg>
);

export function LinkIcon({ kind }: { kind: LinkKind }) {
  switch (kind) {
    case 'mail':
      return <MailIcon />;
    case 'phone':
      return <PhoneIcon />;
    case 'linkedin':
      return <ProfileIcon />;
    case 'github':
      return <CodeIcon />;
    case 'demo':
      return <DemoIcon />;
    case 'paper':
      return <PaperIcon />;
    case 'profile':
      return <AwardIcon />;
    default:
      return <GlobeIcon />;
  }
}
