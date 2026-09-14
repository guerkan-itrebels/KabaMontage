import { useEffect, useRef, useState } from 'react';
import { db, neueId } from '../db/db';
import { ladeFirma } from '../db/firma';
import { formatiereNummer } from '../lib/texte';
import type { Firmenprofil } from '../lib/typen';
import { pruefeFirma, pruefeIban } from '../lib/validierung';
import { IconMuell, IconPlus } from '../ui/icons';
import {
  Abschnitt, Auswahl, Button, Hinweis, IconButton, Karte, meldung, Schalter, Seite, TextBereich, TextFeld, ZahlFeld,
} from '../ui/ui';

async function bildVerkleinern(datei: File): Promise<string> {
  const url = URL.createObjectURL(datei);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 1200;
    const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * f) || 900;
    c.height = Math.round(img.naturalHeight * f) || 340;
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Einstellungen() {
  const [f, setF] = useState<Firmenprofil | null>(null);
  const geaendert = useRef(false);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => { ladeFirma().then(setF); }, []);

  const aktuell = useRef<Firmenprofil | null>(null);
  aktuell.current = f;

  useEffect(() => {
    if (!f || !geaendert.current) return;
    const t = setTimeout(() => { db.firma.put(f); geaendert.current = false; }, 400);
    return () => clearTimeout(t);
  }, [f]);

  // beim Verlassen der Seite den letzten Stand sofort sichern
  useEffect(() => () => {
    if (geaendert.current && aktuell.current) db.firma.put(aktuell.current);
  }, []);

  if (!f) return null;
  const set = <K extends keyof Firmenprofil>(k: K, v: Firmenprofil[K]) => {
    geaendert.current = true;
    setF({ ...f, [k]: v });
  };
  const fehlt = pruefeFirma(f);
  const jahr = new Date().getFullYear();

  return (
    <Seite titel="Einstellungen" zurueckZu="/mehr">
      <p className="mb-3 text-leise">Änderungen werden automatisch gespeichert. Bereits fertiggestellte Rechnungen behalten die Daten von damals.</p>
      {fehlt.length > 0 && (
        <Hinweis>
          <p className="font-bold">Für gültige Rechnungen fehlt noch:</p>
          <ul className="list-disc pl-5">{fehlt.map((x) => <li key={x}>{x}</li>)}</ul>
        </Hinweis>
      )}

      <Abschnitt titel="Firma">
        <Karte className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-20 flex-1 items-center justify-center rounded-xl border-2 border-rand bg-white p-2">
              <img src={f.logo || 'logo.svg'} alt="Logo" className="max-h-full max-w-full" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const d = e.target.files?.[0];
                e.target.value = '';
                if (!d) return;
                try { set('logo', await bildVerkleinern(d)); meldung('Logo übernommen', { art: 'ok' }); }
                catch { meldung('Bild konnte nicht gelesen werden', { art: 'fehler' }); }
              }} />
              <Button onClick={() => logoInput.current?.click()}>Logo ändern</Button>
              {f.logo && <Button variante="leise" onClick={() => set('logo', undefined)}>Standard-Logo</Button>}
            </div>
          </div>
          <TextFeld label="Firmenname" wert={f.firmenname} onWert={(v) => set('firmenname', v)} />
          <TextFeld label="Inhaber (Vor- und Nachname)" wert={f.inhaber} onWert={(v) => set('inhaber', v)} />
          <TextFeld label="Straße und Hausnummer" wert={f.strasse} onWert={(v) => set('strasse', v)} />
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <TextFeld label="PLZ" inputMode="numeric" wert={f.plz} onWert={(v) => set('plz', v)} />
            <TextFeld label="Ort" wert={f.ort} onWert={(v) => set('ort', v)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextFeld label="Telefon" inputMode="tel" wert={f.telefon} onWert={(v) => set('telefon', v)} />
            <TextFeld label="E-Mail" inputMode="email" wert={f.email} onWert={(v) => set('email', v)} />
          </div>
          <TextFeld label="Webseite (optional)" wert={f.web} onWert={(v) => set('web', v)} />
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Steuer">
        <Karte className="grid grid-cols-1 gap-3">
          <TextFeld label="Steuernummer" wert={f.steuernummer} onWert={(v) => set('steuernummer', v)} hilfe="Vom Finanzamt, z. B. 123/456/78901" />
          <TextFeld label="USt-IdNr. (falls vorhanden)" wert={f.ustId} onWert={(v) => set('ustId', v.toUpperCase())} hilfe="Beginnt mit DE. Eine der beiden Nummern muss auf jeder Rechnung stehen." />
          <Schalter label="Kleinunternehmer (§ 19 UStG)" an={f.kleinunternehmer} onAn={(v) => set('kleinunternehmer', v)}
            beschreibung="Keine Umsatzsteuer auf Rechnungen. Nur einschalten, wenn das mit dem Steuerberater so abgestimmt ist." />
          <Schalter label="Bauleistungen nach § 13b UStG anbieten" an={f.bauleistung13b} onAn={(v) => set('bauleistung13b', v)} disabled={f.kleinunternehmer}
            beschreibung="Bei Rechnungen an Bauunternehmen schuldet der Kunde die Umsatzsteuer. Im Beleg pro Rechnung schaltbar." />
          {!f.kleinunternehmer && (
            <Auswahl label="Standard-MwSt-Satz" wert={f.standardSteuersatz} onWert={(v) => set('standardSteuersatz', v)}
              optionen={[{ wert: 19, text: '19 %' }, { wert: 7, text: '7 %' }, { wert: 0, text: '0 %' }]} />
          )}
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Bankverbindung">
        <Karte className="grid grid-cols-1 gap-3">
          <TextFeld label="Bank" wert={f.bank} onWert={(v) => set('bank', v)} />
          <TextFeld label="IBAN" wert={f.iban} onWert={(v) => set('iban', v.toUpperCase())} autoComplete="off"
            fehler={f.iban.trim() && !pruefeIban(f.iban) ? 'Diese IBAN ist ungültig – bitte Ziffern prüfen.' : undefined} />
          <TextFeld label="BIC" wert={f.bic} onWert={(v) => set('bic', v.toUpperCase())} />
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Stundensätze (netto)">
        <Karte className="grid grid-cols-1 gap-3">
          {f.stundensaetze.map((s, i) => (
            <div key={s.id} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
              <TextFeld label="Bezeichnung" wert={s.bezeichnung}
                onWert={(v) => set('stundensaetze', f.stundensaetze.map((x, j) => (j === i ? { ...x, bezeichnung: v } : x)))} />
              <ZahlFeld label="€ / Std." wert={s.preis} min={0}
                onWert={(v) => set('stundensaetze', f.stundensaetze.map((x, j) => (j === i ? { ...x, preis: v ?? 0 } : x)))} />
              <IconButton label="Entfernen" className="mb-0.5" onClick={() => set('stundensaetze', f.stundensaetze.filter((_, j) => j !== i))}><IconMuell /></IconButton>
            </div>
          ))}
          <Button onClick={() => set('stundensaetze', [...f.stundensaetze, { id: neueId(), bezeichnung: '', preis: 0 }])}><IconPlus /> Stundensatz</Button>
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Zahlungsbedingungen">
        <Karte className="grid grid-cols-3 gap-3">
          <ZahlFeld label="Zahlungsziel" einheit="Tage" ganzzahl min={0} wert={f.zahlungszielTage} onWert={(v) => set('zahlungszielTage', v ?? 0)} />
          <ZahlFeld label="Skonto" einheit="%" min={0} wert={f.skontoProzent || undefined} onWert={(v) => set('skontoProzent', v ?? 0)} placeholder="kein" />
          <ZahlFeld label="Skonto-Frist" einheit="Tage" ganzzahl min={0} wert={f.skontoTage || undefined} onWert={(v) => set('skontoTage', v ?? 0)} />
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Standardtexte">
        <Karte className="grid grid-cols-1 gap-3">
          <TextBereich label="Rechnung – Einleitung" wert={f.einleitungRechnung} onWert={(v) => set('einleitungRechnung', v)} />
          <TextBereich label="Rechnung – Schluss" wert={f.schlussRechnung} onWert={(v) => set('schlussRechnung', v)} zeilen={2} />
          <TextBereich label="Angebot – Einleitung" wert={f.einleitungAngebot} onWert={(v) => set('einleitungAngebot', v)} />
          <TextBereich label="Angebot – Schluss" wert={f.schlussAngebot} onWert={(v) => set('schlussAngebot', v)} zeilen={2} />
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Nummernkreise">
        <Karte className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <TextFeld label="Präfix Rechnungen" wert={f.praefixRechnung} onWert={(v) => set('praefixRechnung', v)} />
            <ZahlFeld label="Startnummer" ganzzahl min={1} wert={f.startnummerRechnung} onWert={(v) => set('startnummerRechnung', v ?? 1)} />
            <TextFeld label="Präfix Angebote" wert={f.praefixAngebot} onWert={(v) => set('praefixAngebot', v)} />
            <ZahlFeld label="Startnummer" ganzzahl min={1} wert={f.startnummerAngebot} onWert={(v) => set('startnummerAngebot', v ?? 1)} />
          </div>
          <Schalter label="Jahr in der Nummer" an={f.nummerMitJahr} onAn={(v) => set('nummerMitJahr', v)} beschreibung="Zählt jedes Jahr wieder bei der Startnummer los." />
          <p className="rounded-xl bg-karte-2 p-3 text-sm">
            Beispiel: <b>{formatiereNummer(f.praefixRechnung, f.nummerMitJahr ? jahr : null, f.startnummerRechnung || 1)}</b> ·{' '}
            <b>{formatiereNummer(f.praefixAngebot, f.nummerMitJahr ? jahr : null, f.startnummerAngebot || 1)}</b><br />
            Nummern werden erst beim Fertigstellen vergeben – lückenlos und nie doppelt. Eine Startnummer kleiner als die zuletzt vergebene wird ignoriert.
          </p>
        </Karte>
      </Abschnitt>
    </Seite>
  );
}
