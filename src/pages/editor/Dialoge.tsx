import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { zeitenZuPositionen } from '../../db/belege';
import { db, neueId } from '../../db/db';
import { euroZuCent } from '../../lib/geld';
import { datum, dauer, euro } from '../../lib/format';
import { einheitKurz, type Einheit, type Firmenprofil, type Kunde, type Position } from '../../lib/typen';
import { IconHaken, IconPlus, IconSuche } from '../../ui/icons';
import { Button, Dialog, Leer } from '../../ui/ui';
import { KundeDialog } from '../Kunden';

const ARTEN: { text: string; einheit: Einheit; arbeit: boolean; bezeichnung?: string; hinweis: string }[] = [
  { text: 'Stunden', einheit: 'std', arbeit: true, hinweis: 'nach Zeit' },
  { text: 'Fläche m²', einheit: 'm2', arbeit: true, hinweis: 'mit Flächenrechner' },
  { text: 'Laufende Meter', einheit: 'lfm', arbeit: true, hinweis: 'lfm' },
  { text: 'Stück', einheit: 'stk', arbeit: true, hinweis: 'z. B. Türen montieren' },
  { text: 'Pauschale', einheit: 'psch', arbeit: true, hinweis: 'Festpreis' },
  { text: 'Anfahrt', einheit: 'km', arbeit: true, bezeichnung: 'Anfahrt', hinweis: 'nach km' },
  { text: 'Tagessatz', einheit: 'tag', arbeit: true, hinweis: 'pro Tag' },
  { text: 'Material', einheit: 'stk', arbeit: false, hinweis: 'kein Lohnanteil' },
];

export function PositionHinzufuegen({
  offen, onSchliessen, onHinzu, firma, kundeId, belegZeitIds,
}: {
  offen: boolean;
  onSchliessen: () => void;
  onHinzu: (p: Position[], oeffnen: boolean) => void;
  firma: Firmenprofil;
  kundeId: string;
  belegZeitIds: string[];
}) {
  const [ansicht, setAnsicht] = useState<'start' | 'zeiten'>('start');
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const vorlagen = useLiveQuery(() => db.vorlagen.orderBy('bezeichnung').toArray(), []);
  const kunden = useLiveQuery(() => db.kunden.toArray(), []);
  const zeiten = useLiveQuery(
    () => db.zeiten.filter((z) => !z.laeuft && !z.abgerechnetInBelegId && !belegZeitIds.includes(z.id)).toArray(),
    [belegZeitIds.join(',')],
  );
  const zeitenSortiert = [...(zeiten ?? [])].sort(
    (a, b) => Number(b.kundeId === kundeId) - Number(a.kundeId === kundeId) || b.datum.localeCompare(a.datum),
  );
  const zeitenKunde = zeitenSortiert.filter((z) => z.kundeId === kundeId).length;

  const schliessen = () => {
    setAnsicht('start');
    setSuche('');
    setAuswahl([]);
    onSchliessen();
  };

  const neu = (a: (typeof ARTEN)[number]) => {
    const satz = a.einheit === 'std' ? firma.stundensaetze[0] : undefined;
    onHinzu([{
      id: neueId(),
      bezeichnung: a.bezeichnung ?? '',
      einheit: a.einheit,
      menge: a.einheit === 'psch' ? 1 : 0,
      einzelpreis: satz?.preis ?? 0,
      steuersatz: firma.standardSteuersatz,
      istArbeitsleistung: a.arbeit,
    }], true);
    schliessen();
  };

  const q = suche.trim().toLowerCase();
  const gefiltert = (vorlagen ?? []).filter((v) => !q || v.bezeichnung.toLowerCase().includes(q));

  if (ansicht === 'zeiten') {
    return (
      <Dialog offen={offen} titel="Erfasste Zeiten übernehmen" onSchliessen={schliessen}
        fuss={
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setAnsicht('start')}>Zurück</Button>
            <Button className="flex-1" variante="primaer" disabled={!auswahl.length}
              onClick={() => {
                onHinzu(zeitenZuPositionen(zeitenSortiert.filter((z) => auswahl.includes(z.id)), firma), false);
                schliessen();
              }}>
              {auswahl.length} übernehmen
            </Button>
          </div>
        }>
        {zeitenSortiert.length === 0 ? <Leer>Keine offenen Zeiten vorhanden.</Leer> : (
          <div className="grid grid-cols-1 gap-2">
            {zeitenSortiert.map((z) => {
              const an = auswahl.includes(z.id);
              const k = kunden?.find((x) => x.id === z.kundeId);
              return (
                <button key={z.id} type="button" onClick={() => setAuswahl(an ? auswahl.filter((x) => x !== z.id) : [...auswahl, z.id])}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-karte p-3 text-left ${an ? 'border-akzent' : 'border-rand'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${an ? 'border-akzent bg-akzent text-auf-akzent' : 'border-rand'}`}>
                    {an && <IconHaken width={18} height={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{z.taetigkeit || 'Arbeitszeit'}</span>
                    <span className="block truncate text-sm text-leise">{datum(z.datum)} · {k?.name ?? 'ohne Kunde'}{z.baustelle ? ` · ${z.baustelle}` : ''}</span>
                  </span>
                  <span className="zahlen font-bold">{dauer(z.minuten)}</span>
                </button>
              );
            })}
          </div>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog offen={offen} titel="Position hinzufügen" onSchliessen={schliessen}>
      {zeitenSortiert.length > 0 && (
        <Button variante="primaer" gross className="mb-4 w-full" onClick={() => {
          setAuswahl(zeitenSortiert.filter((z) => z.kundeId === kundeId).map((z) => z.id));
          setAnsicht('zeiten');
        }}>
          Erfasste Zeiten übernehmen ({zeitenKunde || zeitenSortiert.length})
        </Button>
      )}
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-leise">Neu – abrechnen nach</p>
      <div className="grid grid-cols-2 gap-2">
        {ARTEN.map((a) => (
          <button key={a.text} type="button" onClick={() => neu(a)}
            className="min-h-16 rounded-2xl border-2 border-rand bg-karte px-3 py-2 text-left hover:border-akzent">
            <span className="block font-bold">{a.text}</span>
            <span className="block text-sm text-leise">{a.hinweis}</span>
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-leise">Aus Vorlage</p>
      {vorlagen && vorlagen.length > 4 && (
        <div className="relative mb-2">
          <IconSuche className="pointer-events-none absolute left-3 top-3.5 text-leise" />
          <input className="w-full min-h-12 rounded-xl border-2 border-rand bg-karte pl-11 pr-3 focus:border-akzent focus:outline-none"
            placeholder="Vorlage suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        </div>
      )}
      {vorlagen?.length === 0 ? (
        <Leer>Noch keine Vorlagen. Bei einer Position auf den Stern tippen, um sie als Vorlage zu speichern.</Leer>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {gefiltert.map((v) => (
            <button key={v.id} type="button"
              onClick={() => {
                onHinzu([{ id: neueId(), bezeichnung: v.bezeichnung, einheit: v.einheit, menge: v.einheit === 'psch' ? 1 : 0, einzelpreis: v.einzelpreis, steuersatz: v.steuersatz, istArbeitsleistung: v.istArbeitsleistung }], true);
                schliessen();
              }}
              className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-rand bg-karte px-3 py-2 text-left hover:border-akzent">
              <span className="min-w-0 flex-1 font-semibold">{v.bezeichnung}</span>
              <span className="zahlen whitespace-nowrap text-sm text-leise">{euro(euroZuCent(v.einzelpreis))} / {einheitKurz(v.einheit)}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

export function KundenAuswahl({ offen, onSchliessen, onWahl }: { offen: boolean; onSchliessen: () => void; onWahl: (k: Kunde) => void }) {
  const [suche, setSuche] = useState('');
  const [neu, setNeu] = useState(false);
  const kunden = useLiveQuery(() => db.kunden.orderBy('name').toArray(), []);
  const q = suche.trim().toLowerCase();
  const liste = (kunden ?? []).filter((k) => !q || `${k.name} ${k.ort}`.toLowerCase().includes(q));

  return (
    <>
      <Dialog offen={offen && !neu} titel="Kunde wählen" onSchliessen={onSchliessen}>
        <Button variante="primaer" gross className="mb-3 w-full" onClick={() => setNeu(true)}><IconPlus /> Neuen Kunden anlegen</Button>
        <div className="relative mb-3">
          <IconSuche className="pointer-events-none absolute left-3 top-3.5 text-leise" />
          <input className="w-full min-h-12 rounded-xl border-2 border-rand bg-karte pl-11 pr-3 focus:border-akzent focus:outline-none"
            placeholder="Name oder Ort suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2">
          {liste.map((k) => (
            <button key={k.id} type="button" onClick={() => onWahl(k)}
              className="min-h-14 rounded-2xl border-2 border-rand bg-karte px-3 py-2 text-left hover:border-akzent">
              <span className="block font-bold">{k.name}</span>
              <span className="block text-sm text-leise">{k.strasse}, {k.plz} {k.ort} · {k.istUnternehmen ? 'Firma' : 'Privat'}</span>
            </button>
          ))}
          {kunden && liste.length === 0 && <Leer>Kein Kunde gefunden.</Leer>}
        </div>
      </Dialog>
      <KundeDialog offen={offen && neu} onSchliessen={() => setNeu(false)} onGespeichert={(k) => { setNeu(false); onWahl(k); }} />
    </>
  );
}
