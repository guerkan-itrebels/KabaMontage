import type { ReactNode } from 'react';
import { BelegEditor } from './pages/BelegEditor';
import { BelegListe } from './pages/BelegListe';
import { Einstellungen } from './pages/Einstellungen';
import { KundeDetail, KundenListe } from './pages/Kunden';
import { Mehr } from './pages/Mehr';
import { Sichern } from './pages/Sichern';
import { Start } from './pages/Start';
import { Vorlagen } from './pages/Vorlagen';
import { Zeiten } from './pages/Zeiten';
import { IconBeleg, IconHaus, IconLeute, IconMehr, IconUhr } from './ui/icons';
import { passt, useRoute } from './ui/router';
import { BestaetigenHost, ToastHost } from './ui/ui';

const NAV = [
  { pfad: '/', text: 'Start', icon: IconHaus, aktiv: (p: string) => p === '/' },
  { pfad: '/belege', text: 'Belege', icon: IconBeleg, aktiv: (p: string) => p.startsWith('/beleg') },
  { pfad: '/zeiten', text: 'Zeiten', icon: IconUhr, aktiv: (p: string) => p.startsWith('/zeiten') },
  { pfad: '/kunden', text: 'Kunden', icon: IconLeute, aktiv: (p: string) => p.startsWith('/kunde') },
  { pfad: '/mehr', text: 'Mehr', icon: IconMehr, aktiv: (p: string) => ['/mehr', '/vorlagen', '/einstellungen', '/sichern'].some((x) => p.startsWith(x)) },
];

function seiteFuer(pfad: string): { el: ReactNode; ohneNav?: boolean } {
  let m;
  if ((m = passt('/beleg/:id', pfad))) return { el: <BelegEditor key={m.id} id={m.id} />, ohneNav: true };
  if ((m = passt('/kunde/:id', pfad))) return { el: <KundeDetail key={m.id} id={m.id} /> };
  const p = pfad.split('?')[0];
  switch (p) {
    case '/belege': return { el: <BelegListe pfad={pfad} /> };
    case '/zeiten': return { el: <Zeiten /> };
    case '/kunden': return { el: <KundenListe /> };
    case '/vorlagen': return { el: <Vorlagen /> };
    case '/einstellungen': return { el: <Einstellungen /> };
    case '/sichern': return { el: <Sichern /> };
    case '/mehr': return { el: <Mehr /> };
    default: return { el: <Start /> };
  }
}

export default function App() {
  const pfad = useRoute();
  const { el, ohneNav } = seiteFuer(pfad);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Seitenleiste am Desktop */}
      <nav className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-r lg:border-rand lg:bg-marke lg:p-4 lg:sticky lg:top-0 lg:h-dvh">
        <div className="mb-6 rounded-xl bg-white p-3">
          <img src="logo.svg" alt="KabaMontage" className="w-full" />
        </div>
        {NAV.map((n) => (
          <a key={n.pfad} href={`#${n.pfad}`}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold ${
              n.aktiv(pfad) ? 'bg-akzent text-auf-akzent' : 'text-white/85 hover:bg-white/10'
            }`}>
            <n.icon /> {n.text === 'Mehr' ? 'Vorlagen & Einstellungen' : n.text}
          </a>
        ))}
      </nav>

      <main className={`flex-1 sicher-oben ${ohneNav ? '' : 'pb-24 lg:pb-0'}`}>{el}</main>

      {/* Untere Leiste am Handy */}
      {!ohneNav && (
        <nav className="sicher-unten fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-marke lg:hidden">
          <div className="mx-auto flex max-w-3xl">
            {NAV.map((n) => (
              <a key={n.pfad} href={`#${n.pfad}`}
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold ${
                  n.aktiv(pfad) ? 'text-akzent' : 'text-white/75'
                }`}>
                <n.icon width={26} height={26} />
                {n.text}
              </a>
            ))}
          </div>
        </nav>
      )}
      <ToastHost />
      <BestaetigenHost />
    </div>
  );
}
