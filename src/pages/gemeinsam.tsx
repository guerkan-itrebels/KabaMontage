import { belegSummen } from '../lib/berechnung';
import { datum, euro, heute } from '../lib/format';
import { belegTitel, effektiverStatus, STATUS_TEXT } from '../lib/texte';
import type { Beleg, Kunde } from '../lib/typen';
import { IconWeiter } from '../ui/icons';
import { Badge } from '../ui/ui';

export function StatusBadge({ beleg }: { beleg: Beleg }) {
  const s = effektiverStatus(beleg, heute());
  if (beleg.stornoVonId) return <Badge>Storno</Badge>;
  if (beleg.typ === 'angebot' && beleg.inRechnungId) return <Badge farbe="ok">Beauftragt</Badge>;
  if (beleg.typ === 'angebot' && s === 'offen') return <Badge>Verschickt</Badge>;
  const farbe = { entwurf: 'warn', offen: 'neutral', bezahlt: 'ok', ueberfaellig: 'gefahr', storniert: 'neutral' } as const;
  return <Badge farbe={farbe[s]}>{STATUS_TEXT[s]}</Badge>;
}

export function BelegZeile({ beleg, kunde }: { beleg: Beleg; kunde?: Kunde }) {
  const s = belegSummen(beleg);
  return (
    <a href={`#/beleg/${beleg.id}`}
      className="flex min-h-16 items-center gap-3 border-b border-rand/60 px-4 py-3 last:border-0 hover:bg-karte-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold">{kunde?.name ?? beleg.kundeSnapshot?.name ?? 'Ohne Kunde'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-leise">
          <span>{belegTitel(beleg)} {beleg.nummer || '(noch ohne Nummer)'}</span>
          <span>· {datum(beleg.datum)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="zahlen font-bold">{euro(s.bruttoCent)}</span>
        <StatusBadge beleg={beleg} />
      </div>
      <IconWeiter className="shrink-0 text-leise" />
    </a>
  );
}

/** Offener Betrag (offen + überfällig, ohne Stornos) */
export function offenerBetragCent(belege: Beleg[]): number {
  return belege
    .filter((b) => b.typ === 'rechnung' && b.status === 'offen' && !b.stornoVonId)
    .reduce((s, b) => s + belegSummen(b).bruttoCent, 0);
}
