import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { neuerBeleg } from '../db/belege';
import { db } from '../db/db';
import { heute } from '../lib/format';
import { effektiverStatus } from '../lib/texte';
import type { BelegTyp } from '../lib/typen';
import { IconPlus, IconSuche } from '../ui/icons';
import { geheZu, queryParam } from '../ui/router';
import { Button, Chips, Karte, Leer, Seite } from '../ui/ui';
import { BelegZeile } from './gemeinsam';

type Filter = 'alle' | 'entwurf' | 'offen' | 'ueberfaellig' | 'bezahlt';

export function BelegListe({ pfad }: { pfad: string }) {
  const typ = (queryParam(pfad, 'typ') as BelegTyp) || 'rechnung';
  const [filter, setFilter] = useState<Filter>('alle');
  const [suche, setSuche] = useState('');
  const belege = useLiveQuery(() => db.belege.where('typ').equals(typ).toArray(), [typ]);
  const kunden = useLiveQuery(() => db.kunden.toArray(), []);
  const t = heute();

  const liste = (belege ?? [])
    .filter((b) => filter === 'alle' || effektiverStatus(b, t) === filter)
    .filter((b) => {
      if (!suche.trim()) return true;
      const k = kunden?.find((x) => x.id === b.kundeId);
      const heu = `${b.nummer} ${k?.name ?? ''} ${b.baustelle ?? ''}`.toLowerCase();
      return heu.includes(suche.trim().toLowerCase());
    })
    .sort((a, b) => (b.datum + b.nummer).localeCompare(a.datum + a.nummer));

  return (
    <Seite titel="Belege" aktionen={
      <Button variante="primaer" onClick={async () => geheZu(`/beleg/${await neuerBeleg(typ)}`)}>
        <IconPlus /> Neu
      </Button>
    }>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-karte-2 p-1">
        {(['rechnung', 'angebot'] as const).map((x) => (
          <button key={x} type="button" onClick={() => geheZu(`/belege?typ=${x}`, true)}
            className={`min-h-12 rounded-xl font-bold ${typ === x ? 'bg-marke text-white' : 'text-leise'}`}>
            {x === 'rechnung' ? 'Rechnungen' : 'Angebote'}
          </button>
        ))}
      </div>
      <div className="relative mb-3">
        <IconSuche className="pointer-events-none absolute left-3 top-3.5 text-leise" />
        <input className="w-full min-h-12 rounded-xl border-2 border-rand bg-karte pl-11 pr-3 focus:border-akzent focus:outline-none"
          placeholder="Nummer, Kunde oder Baustelle suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
      </div>
      {typ === 'rechnung' && (
        <div className="mb-4 overflow-x-auto">
          <Chips<Filter> wert={filter} onWert={setFilter} optionen={[
            { wert: 'alle', text: 'Alle' }, { wert: 'entwurf', text: 'Entwürfe' }, { wert: 'offen', text: 'Offen' },
            { wert: 'ueberfaellig', text: 'Überfällig' }, { wert: 'bezahlt', text: 'Bezahlt' },
          ]} />
        </div>
      )}
      {liste.length === 0 ? (
        <Leer>Keine {typ === 'rechnung' ? 'Rechnungen' : 'Angebote'} gefunden.</Leer>
      ) : (
        <Karte className="overflow-hidden p-0">
          {liste.map((b) => <BelegZeile key={b.id} beleg={b} kunde={kunden?.find((k) => k.id === b.kundeId)} />)}
        </Karte>
      )}
    </Seite>
  );
}
