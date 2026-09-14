import type { SVGProps } from 'react';

const basis = (d: React.ReactNode) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2.2}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {d}
      </svg>
    );
  };

export const IconHaus = basis(<><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></>);
export const IconBeleg = basis(<><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5M9 13h7M9 17h7M9 9h2" /></>);
export const IconUhr = basis(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconLeute = basis(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.1 2.4 3.5 5.2" /></>);
export const IconMehr = basis(<><path d="M4 6h16M4 12h16M4 18h16" /></>);
export const IconPlus = basis(<path d="M12 5v14M5 12h14" />);
export const IconZurueck = basis(<path d="m15 5-7 7 7 7" />);
export const IconWeiter = basis(<path d="m9 5 7 7-7 7" />);
export const IconMuell = basis(<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>);
export const IconKopie = basis(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>);
export const IconGriff = basis(<><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>);
export const IconTeilen = basis(<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v8h14v-8" /></>);
export const IconSuche = basis(<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>);
export const IconPlay = basis(<path d="M7 4v16l13-8z" fill="currentColor" />);
export const IconStop = basis(<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />);
export const IconHaken = basis(<path d="m4 12 5 5L20 6" />);
export const IconStift = basis(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m14 6 4 4" /></>);
export const IconX = basis(<path d="M6 6l12 12M18 6 6 18" />);
export const IconLineal = basis(<><path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></>);
export const IconStern = basis(<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />);
export const IconSchild = basis(<><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>);
export const IconZahnrad = basis(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
