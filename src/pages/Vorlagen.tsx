import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, neueId } from '../db/db';
import { euro } from '../lib/format';
import { euroZuCent } from '../lib/geld';
import { einheitKurz, type Leistungsvorlage } from '../lib/typen';
import { useFirma } from '../ui/hooks';
import { IconPlus, IconSuche } from '../ui/icons';
import { Auswahl, bestaetigen, Button, Dialog, Karte, Leer, meldung, Schalter, Seite, TextBereich, ZahlFeld } from '../ui/ui';
import { EINHEIT_OPTIONEN } from './editor/PositionKarte';

export function Vorlagen() {
  const firma = useFirma();
  const vorlagen = useLiveQuery(() => db.vorlagen.orderBy('bezeichnung').toArray(), []);
  const [suche, setSuche] = useState('');
  const [aktiv, setAktiv] = useState<Leistungsvorlage | null>(null);
  const q = suche.trim().toLowerCase();
  const liste = (vorlagen ?? []).filter((v) => !q || v.bezeichnung.toLowerCase().includes(q));

  return (
    <Seite titel="Vorlagen" zurueckZu="/mehr" aktionen={
      <Button variante="primaer" onClick={() => setAktiv({ id: neueId(), bezeichnung: '', einheit: 'std', einzelpreis: 0, steuersatz: firma?.standardSteuersatz ?? 19, istArbeitsleistung: true })}>
        <IconPlus /> Neu
      </Button>
    }>
      <p className="mb-3 text-leise">Häufige Leistungen mit Preis – im Beleg mit einem Tipp einfügen.</p>
      <div className="relative mb-4">
        <IconSuche className="pointer-events-none absolute left-3 top-3.5 text-leise" />
        <input className="w-full min-h-12 rounded-xl border-2 border-rand bg-karte pl-11 pr-3 focus:border-akzent focus:outline-none"
          placeholder="Vorlage suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
      </div>
      {vorlagen && liste.length === 0 ? <Leer>Keine Vorlagen gefunden.</Leer> : (
        <Karte className="overflow-hidden p-0">
          {liste.map((v) => (
            <button key={v.id} type="button" onClick={() => setAktiv(v)}
              className="flex min-h-16 w-full items-center gap-3 border-b border-rand/60 px-4 py-3 text-left last:border-0 hover:bg-karte-2">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{v.bezeichnung}</span>
                <span className="block text-sm text-leise">{v.istArbeitsleistung ? 'Arbeitsleistung' : 'Material'} · {v.steuersatz} % MwSt</span>
              </span>
              <span className="zahlen whitespace-nowrap font-bold">{euro(euroZuCent(v.einzelpreis))} / {einheitKurz(v.einheit)}</span>
            </button>
          ))}
        </Karte>
      )}
      {aktiv && <VorlageDialog start={aktiv} onSchliessen={() => setAktiv(null)} />}
    </Seite>
  );
}

function VorlageDialog({ start, onSchliessen }: { start: Leistungsvorlage; onSchliessen: () => void }) {
  const [v, setV] = useState(start);
  const [fehler, setFehler] = useState('');
  const vorhanden = useLiveQuery(() => db.vorlagen.get(start.id), [start.id]);
  return (
    <Dialog offen titel={vorhanden ? 'Vorlage bearbeiten' : 'Neue Vorlage'} onSchliessen={onSchliessen}
      fuss={
        <div className="flex gap-2">
          {vorhanden && (
            <Button variante="gefahr" onClick={async () => {
              if (!(await bestaetigen('Vorlage löschen?', v.bezeichnung, 'Löschen', true))) return;
              await db.vorlagen.delete(v.id);
              onSchliessen();
            }}>Löschen</Button>
          )}
          <Button variante="primaer" gross className="flex-1" onClick={async () => {
            if (!v.bezeichnung.trim()) return setFehler('Bitte eine Bezeichnung eingeben.');
            await db.vorlagen.put({ ...v, bezeichnung: v.bezeichnung.trim() });
            meldung('Vorlage gespeichert', { art: 'ok' });
            onSchliessen();
          }}>Speichern</Button>
        </div>
      }>
      <div className="grid grid-cols-1 gap-3">
        <TextBereich label="Bezeichnung" wert={v.bezeichnung} onWert={(x) => { setV({ ...v, bezeichnung: x }); setFehler(''); }} zeilen={2} />
        {fehler && <p className="font-semibold text-gefahr">{fehler}</p>}
        <Auswahl label="Abrechnung nach" wert={v.einheit} optionen={EINHEIT_OPTIONEN} onWert={(x) => setV({ ...v, einheit: x })} />
        <div className="grid grid-cols-2 gap-3">
          <ZahlFeld label="Preis (netto)" einheit="€" min={0} wert={v.einzelpreis} onWert={(x) => setV({ ...v, einzelpreis: x ?? 0 })} />
          <Auswahl label="MwSt-Satz" wert={v.steuersatz} onWert={(x) => setV({ ...v, steuersatz: x })}
            optionen={[{ wert: 19, text: '19 %' }, { wert: 7, text: '7 %' }, { wert: 0, text: '0 %' }]} />
        </div>
        <Schalter label="Arbeitsleistung (§ 35a)" an={v.istArbeitsleistung} onAn={(x) => setV({ ...v, istArbeitsleistung: x })} />
      </div>
    </Dialog>
  );
}
