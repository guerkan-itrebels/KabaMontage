import { IconSchild, IconStern, IconWeiter, IconZahnrad } from '../ui/icons';
import { Karte, Seite } from '../ui/ui';

const EINTRAEGE = [
  { pfad: '/einstellungen', titel: 'Einstellungen', text: 'Firmendaten, Logo, Bank, Steuern, Nummern', icon: IconZahnrad },
  { pfad: '/vorlagen', titel: 'Vorlagen', text: 'Häufige Leistungen mit Preis', icon: IconStern },
  { pfad: '/sichern', titel: 'Daten sichern', text: 'Sicherung anlegen, zurückspielen', icon: IconSchild },
];

export function Mehr() {
  return (
    <Seite titel="Mehr">
      <Karte className="overflow-hidden p-0">
        {EINTRAEGE.map((e) => (
          <a key={e.pfad} href={`#${e.pfad}`} className="flex min-h-20 items-center gap-4 border-b border-rand/60 px-4 last:border-0 hover:bg-karte-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-marke text-akzent"><e.icon /></span>
            <span className="flex-1">
              <span className="block text-lg font-bold">{e.titel}</span>
              <span className="block text-sm text-leise">{e.text}</span>
            </span>
            <IconWeiter className="text-leise" />
          </a>
        ))}
      </Karte>
      <p className="mt-6 text-center text-sm text-leise">KabaMontage · Alle Daten bleiben auf diesem Gerät.</p>
    </Seite>
  );
}
