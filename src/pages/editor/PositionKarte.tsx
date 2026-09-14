import { useState } from 'react';
import { berechnePosition, flaecheSumme, type SteuerModus } from '../../lib/berechnung';
import { euro, zahl } from '../../lib/format';
import { euroZuCent } from '../../lib/geld';
import { EINHEITEN, einheitKurz, type Position, type Stundensatz, type Teilflaeche } from '../../lib/typen';
import { IconGriff, IconKopie, IconLineal, IconMuell, IconPlus, IconStern, IconX } from '../../ui/icons';
import { Auswahl, Button, Dialog, IconButton, Schalter, TextBereich, ZahlFeld } from '../../ui/ui';

export const EINHEIT_OPTIONEN = EINHEITEN.map((e) => ({ wert: e.wert, text: e.lang }));

export function PositionKarte({
  p, nr, offen, gesperrt, modus, stundensaetze, zeigeSteuer,
  onToggle, onChange, onDuplizieren, onLoeschen, onVorlage, griffProps, zieht,
}: {
  p: Position;
  nr: number;
  offen: boolean;
  gesperrt: boolean;
  modus: SteuerModus;
  stundensaetze: Stundensatz[];
  zeigeSteuer: boolean;
  onToggle: () => void;
  onChange: (p: Position) => void;
  onDuplizieren: () => void;
  onLoeschen: () => void;
  onVorlage: () => void;
  griffProps: React.HTMLAttributes<HTMLButtonElement>;
  zieht: boolean;
}) {
  const [flaecheOffen, setFlaecheOffen] = useState(false);
  const e = berechnePosition(p, modus);
  const set = <K extends keyof Position>(k: K, v: Position[K]) => onChange({ ...p, [k]: v });

  const kopfzeile = (
    <div className="flex items-stretch">
      {!gesperrt && (
        <button type="button" aria-label={`Position ${nr} verschieben`} {...griffProps}
          className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center text-leise active:cursor-grabbing">
          <IconGriff />
        </button>
      )}
      <button type="button" onClick={onToggle} className={`flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-4 text-left ${gesperrt ? 'pl-4' : ''}`}>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${p.bezeichnung ? '' : 'text-leise italic'}`}>
            {nr}. {p.bezeichnung || 'Neue Position – bitte beschreiben'}
          </p>
          <p className="zahlen text-sm text-leise">
            {zahl(p.menge)} {einheitKurz(p.einheit)} × {euro(euroZuCent(p.einzelpreis))}
            {p.rabattProzent ? ` − ${zahl(p.rabattProzent)} %` : ''}
            {p.istArbeitsleistung ? ' · Arbeit' : ''}
          </p>
        </div>
        <span className="zahlen font-bold">{euro(e.nettoCent)}</span>
      </button>
    </div>
  );

  return (
    <div className={`rounded-2xl border-2 bg-karte transition-shadow ${zieht ? 'border-akzent shadow-xl' : offen ? 'border-akzent/70' : 'border-rand/70'}`}>
      {kopfzeile}
      {offen && !gesperrt && (
        <div className="grid grid-cols-1 gap-3 border-t border-rand/60 px-4 pb-4 pt-3">
          <TextBereich label="Was wurde gemacht?" wert={p.bezeichnung} onWert={(v) => set('bezeichnung', v)} zeilen={2}
            placeholder="z. B. Montage Trennwand" />
          <Auswahl label="Abrechnung nach" wert={p.einheit} optionen={EINHEIT_OPTIONEN}
            onWert={(v) => onChange({ ...p, einheit: v, flaeche: v === 'm2' ? p.flaeche : undefined })} />

          {p.einheit === 'std' && stundensaetze.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-leise">Stundensatz antippen</p>
              <div className="flex flex-wrap gap-2">
                {stundensaetze.map((s) => (
                  <button key={s.id} type="button"
                    onClick={() => onChange({ ...p, einzelpreis: s.preis, bezeichnung: p.bezeichnung.trim() ? p.bezeichnung : `Arbeitszeit ${s.bezeichnung}` })}
                    className={`min-h-11 rounded-full border-2 px-3 font-semibold ${p.einzelpreis === s.preis ? 'border-akzent bg-akzent text-auf-akzent' : 'border-rand'}`}>
                    {s.bezeichnung} <span className="zahlen">{euro(euroZuCent(s.preis))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ZahlFeld label="Menge" wert={p.menge} einheit={einheitKurz(p.einheit)} onWert={(v) => set('menge', v ?? 0)} />
            <ZahlFeld label={`Preis je ${einheitKurz(p.einheit)} (netto)`} wert={p.einzelpreis} einheit="€" onWert={(v) => set('einzelpreis', v ?? 0)} />
          </div>

          {p.einheit === 'm2' && (
            <Button onClick={() => setFlaecheOffen(true)}>
              <IconLineal /> {p.flaeche?.length ? `Flächenrechner (${p.flaeche.length} Teilflächen)` : 'Fläche ausrechnen (Länge × Breite)'}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ZahlFeld label="Rabatt (optional)" wert={p.rabattProzent} einheit="%" min={0}
              onWert={(v) => set('rabattProzent', v || undefined)} />
            {zeigeSteuer ? (
              <Auswahl label="MwSt-Satz" wert={p.steuersatz} onWert={(v) => set('steuersatz', v)}
                optionen={[{ wert: 19, text: '19 %' }, { wert: 7, text: '7 %' }, { wert: 0, text: '0 %' }]} />
            ) : <div />}
          </div>

          <Schalter label="Arbeitsleistung" an={p.istArbeitsleistung} onAn={(v) => set('istArbeitsleistung', v)}
            beschreibung="Lohn, Anfahrt, Maschinen – kein Material. Wird Privatkunden für § 35a EStG ausgewiesen." />

          <div className="flex flex-wrap items-center gap-1 border-t border-rand/60 pt-3">
            <IconButton label="Duplizieren" onClick={onDuplizieren}><IconKopie /></IconButton>
            <IconButton label="Als Vorlage speichern" onClick={onVorlage}><IconStern /></IconButton>
            <IconButton label="Löschen" onClick={onLoeschen} className="text-gefahr hover:text-gefahr"><IconMuell /></IconButton>
            <div className="flex-1" />
            <Button variante="primaer" onClick={onToggle}>Fertig</Button>
          </div>
        </div>
      )}
      {flaecheOffen && (
        <FlaechenRechner start={p.flaeche} onSchliessen={() => setFlaecheOffen(false)}
          onUebernehmen={(teile) => {
            onChange({ ...p, flaeche: teile.length ? teile : undefined, menge: teile.length ? flaecheSumme(teile) : p.menge });
            setFlaecheOffen(false);
          }} />
      )}
    </div>
  );
}

function FlaechenRechner({ start, onSchliessen, onUebernehmen }: {
  start?: Teilflaeche[];
  onSchliessen: () => void;
  onUebernehmen: (t: Teilflaeche[]) => void;
}) {
  const [teile, setTeile] = useState<Teilflaeche[]>(start?.length ? start : [{ laenge: 0, breite: 0, anzahl: 1 }]);
  const setTeil = (i: number, t: Partial<Teilflaeche>) => setTeile(teile.map((x, j) => (j === i ? { ...x, ...t } : x)));
  const gueltig = teile.filter((t) => t.laenge > 0 && t.breite > 0 && t.anzahl > 0);
  return (
    <Dialog offen titel="Flächenrechner" onSchliessen={onSchliessen}
      fuss={
        <div className="grid grid-cols-1 gap-2">
          <p className="zahlen text-center text-2xl font-extrabold">{zahl(flaecheSumme(gueltig))} m²</p>
          <Button variante="primaer" gross onClick={() => onUebernehmen(gueltig)}>Fläche übernehmen</Button>
        </div>
      }>
      <p className="mb-3 text-leise">Maße in Metern. Jede Teilfläche (z. B. eine Wand) als eigene Zeile.</p>
      <div className="grid grid-cols-1 gap-3">
        {teile.map((t, i) => (
          <div key={i} className="rounded-2xl border-2 border-rand bg-karte p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-bold">Teilfläche {i + 1}</span>
              <span className="zahlen text-sm text-leise">= {zahl(flaecheSumme([t]))} m²</span>
              {teile.length > 1 && (
                <IconButton label="Teilfläche entfernen" onClick={() => setTeile(teile.filter((_, j) => j !== i))}><IconX /></IconButton>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ZahlFeld label="Länge" einheit="m" wert={t.laenge || undefined} onWert={(v) => setTeil(i, { laenge: v ?? 0 })} autoFocus={i === teile.length - 1 && !t.laenge} />
              <ZahlFeld label="Breite" einheit="m" wert={t.breite || undefined} onWert={(v) => setTeil(i, { breite: v ?? 0 })} />
              <ZahlFeld label="Anzahl" einheit="×" wert={t.anzahl} onWert={(v) => setTeil(i, { anzahl: v ?? 0 })} />
            </div>
          </div>
        ))}
        <Button onClick={() => setTeile([...teile, { laenge: 0, breite: 0, anzahl: 1 }])}><IconPlus /> Weitere Teilfläche</Button>
      </div>
    </Dialog>
  );
}
