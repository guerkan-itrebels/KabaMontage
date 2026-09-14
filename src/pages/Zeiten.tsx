import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { neuerBeleg, zeitenZuPositionen } from '../db/belege';
import { db, neueId } from '../db/db';
import { datum, dauer, heute, isoDatum } from '../lib/format';
import type { Zeiteintrag } from '../lib/typen';
import { useFirma } from '../ui/hooks';
import { IconMuell, IconPlay, IconPlus, IconStop } from '../ui/icons';
import { geheZu } from '../ui/router';
import {
  Abschnitt, Auswahl, Badge, bestaetigen, Button, Chips, Dialog, IconButton, Karte, Leer, meldung, Seite, TextFeld, ZahlFeld,
} from '../ui/ui';
import { KundenAuswahl } from './editor/Dialoge';

function laufzeitMinuten(z: Zeiteintrag, jetzt: number) {
  return z.minuten + (z.laeuft && z.start ? (jetzt - new Date(z.start).getTime()) / 60000 : 0);
}

export function Zeiten() {
  const firma = useFirma();
  const zeiten = useLiveQuery(() => db.zeiten.orderBy('datum').reverse().toArray(), []);
  const kunden = useLiveQuery(() => db.kunden.toArray(), []);
  const [jetzt, setJetzt] = useState(Date.now());
  const [bearbeiten, setBearbeiten] = useState<Zeiteintrag | null>(null);
  const [filter, setFilter] = useState<'offen' | 'abgerechnet'>('offen');

  const laufend = zeiten?.find((z) => z.laeuft);
  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [laufend]);

  const kundeName = (id?: string) => kunden?.find((k) => k.id === id)?.name;

  const neuerEintrag = (laeuft: boolean): Zeiteintrag => ({
    id: neueId(), taetigkeit: '', datum: heute(), laeuft, minuten: 0,
    start: laeuft ? new Date().toISOString() : undefined,
    stundensatzId: firma?.stundensaetze[1]?.id ?? firma?.stundensaetze[0]?.id,
    kundeId: zeiten?.[0]?.kundeId, baustelle: zeiten?.[0]?.baustelle,
  });

  const stoppen = async (z: Zeiteintrag) => {
    const minuten = Math.max(1, Math.round(laufzeitMinuten(z, Date.now())));
    await db.zeiten.update(z.id, { laeuft: false, start: undefined, minuten });
    meldung(`Gestoppt: ${dauer(minuten)}`, { art: 'ok' });
    setBearbeiten({ ...z, laeuft: false, start: undefined, minuten });
  };

  const offen = (zeiten ?? []).filter((z) => !z.abgerechnetInBelegId && !z.laeuft);
  const liste = filter === 'offen' ? offen : (zeiten ?? []).filter((z) => z.abgerechnetInBelegId);
  const offenMinuten = offen.reduce((s, z) => s + z.minuten, 0);

  const sekunden = laufend ? Math.floor(laufzeitMinuten(laufend, jetzt) * 60) : 0;
  const uhr = `${Math.floor(sekunden / 3600)}:${String(Math.floor((sekunden % 3600) / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`;

  return (
    <Seite titel="Zeiterfassung">
      <Karte className={laufend ? 'border-2 border-akzent' : ''}>
        {laufend ? (
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-leise">Uhr läuft</p>
            <p className="zahlen my-2 text-5xl font-extrabold">{uhr}</p>
            <p className="font-semibold">{laufend.taetigkeit || 'Arbeitszeit'}{kundeName(laufend.kundeId) ? ` · ${kundeName(laufend.kundeId)}` : ''}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => setBearbeiten(laufend)}>Angaben ändern</Button>
              <Button variante="primaer" gross onClick={() => stoppen(laufend)}><IconStop /> Stopp</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variante="primaer" gross className="min-h-20 text-xl" onClick={async () => {
              const z = neuerEintrag(true);
              await db.zeiten.add(z);
              setBearbeiten(z);
            }}><IconPlay width={28} height={28} /> Start</Button>
            <Button gross className="min-h-20" onClick={() => setBearbeiten(neuerEintrag(false))}><IconPlus /> Zeit nachtragen</Button>
          </div>
        )}
      </Karte>

      <Abschnitt titel="Erfasste Zeiten" rechts={filter === 'offen' && offen.length > 0 ? <span className="zahlen font-bold">{dauer(offenMinuten)} offen</span> : undefined}>
        <div className="mb-3">
          <Chips wert={filter} onWert={setFilter} optionen={[{ wert: 'offen', text: 'Noch nicht abgerechnet' }, { wert: 'abgerechnet', text: 'Abgerechnet' }]} />
        </div>
        {liste.length === 0 ? <Leer>{filter === 'offen' ? 'Keine offenen Zeiten.' : 'Noch nichts abgerechnet.'}</Leer> : (
          <Karte className="overflow-hidden p-0">
            {liste.map((z) => (
              <div key={z.id} className="flex min-h-16 items-center gap-2 border-b border-rand/60 px-4 py-2 last:border-0">
                <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => !z.abgerechnetInBelegId ? setBearbeiten(z) : geheZu(`/beleg/${z.abgerechnetInBelegId}`)}>
                  <p className="truncate font-bold">{z.taetigkeit || 'Arbeitszeit'}</p>
                  <p className="truncate text-sm text-leise">{datum(z.datum)} · {kundeName(z.kundeId) ?? 'ohne Kunde'}{z.baustelle ? ` · ${z.baustelle}` : ''}</p>
                </button>
                {z.abgerechnetInBelegId && <Badge farbe="ok">Abgerechnet</Badge>}
                <span className="zahlen font-bold">{dauer(z.minuten)}</span>
              </div>
            ))}
          </Karte>
        )}
        {filter === 'offen' && offen.length > 0 && (
          <Button variante="primaer" className="mt-3 w-full" onClick={async () => {
            const kundeId = offen[0].kundeId;
            const auswahl = offen.filter((z) => z.kundeId === kundeId);
            const id = await neuerBeleg('rechnung', kundeId ?? '');
            await db.belege.update(id, { positionen: zeitenZuPositionen(auswahl, firma!), baustelle: auswahl[0].baustelle });
            meldung(`${auswahl.length} Zeiten übernommen`, { art: 'ok' });
            geheZu(`/beleg/${id}`);
          }}>Rechnung aus Zeiten erstellen{kundeName(offen[0].kundeId) ? ` (${kundeName(offen[0].kundeId)})` : ''}</Button>
        )}
      </Abschnitt>

      {bearbeiten && firma && (
        <ZeitDialog eintrag={bearbeiten} stundensaetze={firma.stundensaetze} kundeName={kundeName}
          onSchliessen={() => setBearbeiten(null)} />
      )}
    </Seite>
  );
}

function ZeitDialog({ eintrag, stundensaetze, kundeName, onSchliessen }: {
  eintrag: Zeiteintrag;
  stundensaetze: { id: string; bezeichnung: string; preis: number }[];
  kundeName: (id?: string) => string | undefined;
  onSchliessen: () => void;
}) {
  const [z, setZ] = useState(eintrag);
  const [kundeWahl, setKundeWahl] = useState(false);
  const [std, setStd] = useState<number | undefined>(Math.floor(eintrag.minuten / 60));
  const [min, setMin] = useState<number | undefined>(eintrag.minuten % 60);
  const [fehler, setFehler] = useState<string>();
  const vorhanden = useLiveQuery(() => db.zeiten.get(eintrag.id), [eintrag.id]);

  const speichern = async () => {
    const minuten = (std ?? 0) * 60 + (min ?? 0);
    if (!z.laeuft && minuten <= 0) return setFehler('Bitte die Dauer eingeben.');
    if (!z.datum) return setFehler('Bitte ein Datum wählen.');
    await db.zeiten.put({ ...z, minuten: z.laeuft ? z.minuten : minuten, datum: z.datum || isoDatum(new Date()) });
    meldung('Zeit gespeichert', { art: 'ok' });
    onSchliessen();
  };

  return (
    <>
      <Dialog offen={!kundeWahl} titel={z.laeuft ? 'Laufende Zeit' : vorhanden ? 'Zeit bearbeiten' : 'Zeit nachtragen'} onSchliessen={onSchliessen}
        fuss={
          <div className="flex gap-2">
            {vorhanden && !z.laeuft && (
              <IconButton label="Löschen" className="text-gefahr" onClick={async () => {
                if (!(await bestaetigen('Zeit löschen?', 'Der Eintrag wird gelöscht.', 'Löschen', true))) return;
                await db.zeiten.delete(z.id);
                onSchliessen();
              }}><IconMuell /></IconButton>
            )}
            <Button variante="primaer" gross className="flex-1" onClick={speichern}>Speichern</Button>
          </div>
        }>
        <div className="grid grid-cols-1 gap-3">
          <TextFeld label="Tätigkeit" wert={z.taetigkeit} onWert={(v) => setZ({ ...z, taetigkeit: v })} placeholder="z. B. Trockenbau Wohnzimmer" />
          <div>
            <p className="mb-1 text-sm font-semibold text-leise">Kunde</p>
            <Button className="w-full justify-start" onClick={() => setKundeWahl(true)}>{kundeName(z.kundeId) ?? 'Kunde wählen (optional)'}</Button>
          </div>
          <TextFeld label="Baustelle (optional)" wert={z.baustelle} onWert={(v) => setZ({ ...z, baustelle: v })} />
          {stundensaetze.length > 0 && (
            <Auswahl label="Wer hat gearbeitet?" wert={z.stundensatzId ?? stundensaetze[0].id}
              onWert={(v) => setZ({ ...z, stundensatzId: v })}
              optionen={stundensaetze.map((s) => ({ wert: s.id, text: `${s.bezeichnung} (${String(s.preis).replace('.', ',')} €/Std.)` }))} />
          )}
          {!z.laeuft && (
            <>
              <TextFeld label="Datum" type="date" wert={z.datum} onWert={(v) => setZ({ ...z, datum: v })} />
              <div className="grid grid-cols-2 gap-3">
                <ZahlFeld label="Stunden" einheit="Std." ganzzahl min={0} wert={std} onWert={setStd} />
                <ZahlFeld label="Minuten" einheit="Min." ganzzahl min={0} wert={min} onWert={setMin} />
              </div>
              <div className="flex flex-wrap gap-2">
                {[30, 60, 120, 240, 480].map((m) => (
                  <button key={m} type="button" className="min-h-11 rounded-full border-2 border-rand px-3 font-semibold"
                    onClick={() => { setStd(Math.floor(m / 60)); setMin(m % 60); }}>
                    {m < 60 ? `${m} Min.` : `${m / 60} Std.`}
                  </button>
                ))}
              </div>
            </>
          )}
          {fehler && <p className="font-semibold text-gefahr">{fehler}</p>}
        </div>
      </Dialog>
      <KundenAuswahl offen={kundeWahl} onSchliessen={() => setKundeWahl(false)}
        onWahl={(k) => { setZ({ ...z, kundeId: k.id }); setKundeWahl(false); }} />
    </>
  );
}
