import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { neuerBeleg } from '../db/belege';
import { db, neueId } from '../db/db';
import { euro, heute } from '../lib/format';
import type { Kunde } from '../lib/typen';
import { pruefeKunde, type Fehler } from '../lib/validierung';
import { IconPlus, IconStift, IconSuche, IconWeiter } from '../ui/icons';
import { geheZu } from '../ui/router';
import {
  Abschnitt, Badge, bestaetigen, Button, Chips, Dialog, Karte, Leer, meldung, Seite, TextBereich, TextFeld,
} from '../ui/ui';
import { BelegZeile, offenerBetragCent } from './gemeinsam';

export function leererKunde(): Kunde {
  return {
    id: neueId(), name: '', strasse: '', plz: '', ort: '', land: 'Deutschland',
    istUnternehmen: false, angelegtAm: heute(),
  };
}

export function KundeFormular({ kunde, onChange, fehler }: { kunde: Kunde; onChange: (k: Kunde) => void; fehler: Fehler }) {
  const set = <K extends keyof Kunde>(k: K, v: Kunde[K]) => onChange({ ...kunde, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-3">
      <Chips<'privat' | 'firma'>
        wert={kunde.istUnternehmen ? 'firma' : 'privat'}
        onWert={(v) => set('istUnternehmen', v === 'firma')}
        optionen={[{ wert: 'privat', text: 'Privatkunde' }, { wert: 'firma', text: 'Firma / Gewerbe' }]}
      />
      <TextFeld label={kunde.istUnternehmen ? 'Firmenname' : 'Name'} wert={kunde.name} onWert={(v) => set('name', v)}
        fehler={fehler.name} autoComplete="off" />
      {kunde.istUnternehmen && (
        <TextFeld label="Ansprechpartner (optional)" wert={kunde.ansprechpartner} onWert={(v) => set('ansprechpartner', v)} />
      )}
      <TextFeld label="Straße und Hausnummer" wert={kunde.strasse} onWert={(v) => set('strasse', v)} fehler={fehler.strasse} />
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <TextFeld label="PLZ" wert={kunde.plz} onWert={(v) => set('plz', v)} fehler={fehler.plz} inputMode="numeric" />
        <TextFeld label="Ort" wert={kunde.ort} onWert={(v) => set('ort', v)} fehler={fehler.ort} />
      </div>
      <TextFeld label="Land" wert={kunde.land} onWert={(v) => set('land', v)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextFeld label="Telefon (optional)" wert={kunde.telefon} onWert={(v) => set('telefon', v)} inputMode="tel" />
        <TextFeld label="E-Mail (optional)" wert={kunde.email} onWert={(v) => set('email', v)} fehler={fehler.email} inputMode="email" />
      </div>
      {kunde.istUnternehmen && (
        <TextFeld label="USt-IdNr. des Kunden (optional)" wert={kunde.ustId} onWert={(v) => set('ustId', v.toUpperCase())}
          hilfe="Bei § 13b-Rechnungen empfehlenswert." />
      )}
      <TextBereich label="Notiz (erscheint nicht auf Belegen)" wert={kunde.notiz ?? ''} onWert={(v) => set('notiz', v)} zeilen={2} />
    </div>
  );
}

export function KundeDialog({
  offen, start, onSchliessen, onGespeichert,
}: { offen: boolean; start?: Kunde; onSchliessen: () => void; onGespeichert?: (k: Kunde) => void }) {
  const [kunde, setKunde] = useState<Kunde>(start ?? leererKunde());
  const [fehler, setFehler] = useState<Fehler>({});
  const [zuletztStart, setZuletztStart] = useState(start);
  if (start !== zuletztStart) {
    setZuletztStart(start);
    setKunde(start ?? leererKunde());
    setFehler({});
  }
  const speichern = async () => {
    const f = pruefeKunde(kunde);
    setFehler(f);
    if (Object.keys(f).length) return;
    const k = { ...kunde, name: kunde.name.trim(), plz: kunde.plz.trim() };
    await db.kunden.put(k);
    meldung('Kunde gespeichert', { art: 'ok' });
    onGespeichert?.(k);
    setKunde(leererKunde());
    onSchliessen();
  };
  return (
    <Dialog offen={offen} titel={start ? 'Kunde bearbeiten' : 'Neuer Kunde'} onSchliessen={onSchliessen}
      fuss={<Button variante="primaer" gross className="w-full" onClick={speichern}>Kunde speichern</Button>}>
      <KundeFormular kunde={kunde} onChange={setKunde} fehler={fehler} />
    </Dialog>
  );
}

export function KundenListe() {
  const [suche, setSuche] = useState('');
  const [neu, setNeu] = useState(false);
  const kunden = useLiveQuery(() => db.kunden.orderBy('name').toArray(), []);
  const belege = useLiveQuery(() => db.belege.toArray(), []);
  const q = suche.trim().toLowerCase();
  const liste = (kunden ?? []).filter((k) => !q || `${k.name} ${k.ort} ${k.ansprechpartner ?? ''}`.toLowerCase().includes(q));

  return (
    <Seite titel="Kunden" aktionen={<Button variante="primaer" onClick={() => setNeu(true)}><IconPlus /> Neu</Button>}>
      <div className="relative mb-4">
        <IconSuche className="pointer-events-none absolute left-3 top-3.5 text-leise" />
        <input className="w-full min-h-12 rounded-xl border-2 border-rand bg-karte pl-11 pr-3 focus:border-akzent focus:outline-none"
          placeholder="Kunden suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
      </div>
      {kunden && liste.length === 0 ? (
        <Leer>{kunden.length ? 'Kein Kunde gefunden.' : 'Noch keine Kunden angelegt.'}</Leer>
      ) : (
        <Karte className="overflow-hidden p-0">
          {liste.map((k) => {
            const offen = offenerBetragCent((belege ?? []).filter((b) => b.kundeId === k.id));
            return (
              <a key={k.id} href={`#/kunde/${k.id}`} className="flex min-h-16 items-center gap-3 border-b border-rand/60 px-4 py-3 last:border-0 hover:bg-karte-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{k.name}</p>
                  <p className="truncate text-sm text-leise">{k.plz} {k.ort} · {k.istUnternehmen ? 'Firma' : 'Privat'}</p>
                </div>
                {offen > 0 && <span className="zahlen text-sm font-bold">{euro(offen)} offen</span>}
                <IconWeiter className="text-leise" />
              </a>
            );
          })}
        </Karte>
      )}
      <KundeDialog offen={neu} onSchliessen={() => setNeu(false)} />
    </Seite>
  );
}

export function KundeDetail({ id }: { id: string }) {
  const kunde = useLiveQuery(() => db.kunden.get(id).then((k) => k ?? null), [id]);
  const belege = useLiveQuery(() => db.belege.where('kundeId').equals(id).toArray(), [id]);
  const [bearbeiten, setBearbeiten] = useState(false);

  if (kunde === undefined) return null;
  if (kunde === null) return <Seite titel="Kunde" zurueckZu="/kunden"><Leer>Kunde nicht gefunden.</Leer></Seite>;

  const offen = offenerBetragCent(belege ?? []);
  const loeschen = async () => {
    if (belege?.some((b) => b.status !== 'entwurf')) {
      meldung('Kunde hat bereits Belege und kann nicht gelöscht werden (Aufbewahrungspflicht).', { art: 'fehler' });
      return;
    }
    if (!(await bestaetigen('Kunde löschen?', `„${kunde.name}“ wird von diesem Gerät gelöscht.`, 'Löschen', true))) return;
    await db.transaction('rw', db.kunden, db.belege, async () => {
      await db.belege.where('kundeId').equals(id).delete();
      await db.kunden.delete(id);
    });
    meldung('Kunde gelöscht');
    geheZu('/kunden', true);
  };

  return (
    <Seite titel={kunde.name} zurueckZu="/kunden"
      aktionen={<Button onClick={() => setBearbeiten(true)}><IconStift /> Bearbeiten</Button>}>
      <Karte>
        <div className="flex items-start justify-between gap-2">
          <div>
            {kunde.ansprechpartner && <p>{kunde.ansprechpartner}</p>}
            <p>{kunde.strasse}</p>
            <p>{kunde.plz} {kunde.ort}</p>
            {kunde.land !== 'Deutschland' && <p>{kunde.land}</p>}
          </div>
          <Badge>{kunde.istUnternehmen ? 'Firma' : 'Privat'}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {kunde.telefon && <a className="inline-flex min-h-11 items-center rounded-xl border-2 border-rand px-3 font-semibold" href={`tel:${kunde.telefon}`}>Anrufen</a>}
          {kunde.email && <a className="inline-flex min-h-11 items-center rounded-xl border-2 border-rand px-3 font-semibold" href={`mailto:${kunde.email}`}>E-Mail</a>}
        </div>
        {kunde.notiz && <p className="mt-3 rounded-xl bg-karte-2 p-3 text-sm">{kunde.notiz}</p>}
      </Karte>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variante="primaer" onClick={async () => geheZu(`/beleg/${await neuerBeleg('rechnung', id)}`)}><IconPlus /> Rechnung</Button>
        <Button onClick={async () => geheZu(`/beleg/${await neuerBeleg('angebot', id)}`)}><IconPlus /> Angebot</Button>
      </div>

      <Abschnitt titel="Belege" rechts={<span className="zahlen font-bold">{euro(offen)} offen</span>}>
        {belege?.length ? (
          <Karte className="overflow-hidden p-0">
            {[...belege].sort((a, b) => b.datum.localeCompare(a.datum)).map((b) => <BelegZeile key={b.id} beleg={b} kunde={kunde} />)}
          </Karte>
        ) : <Leer>Noch keine Belege für diesen Kunden.</Leer>}
      </Abschnitt>

      <div className="mt-8">
        <Button variante="gefahr" onClick={loeschen}>Kunde löschen</Button>
      </div>
      <KundeDialog offen={bearbeiten} start={kunde} onSchliessen={() => setBearbeiten(false)} />
    </Seite>
  );
}
