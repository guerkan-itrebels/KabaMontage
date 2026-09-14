import { flaecheSumme } from './berechnung';
import type { Beleg, Firmenprofil, Kunde, Position } from './typen';

export type Fehler = Record<string, string>;

const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

export function pruefeIban(iban: string): boolean {
  const s = iban.replace(/\s/g, '').toUpperCase();
  if (!IBAN_RE.test(s)) return false;
  const umgestellt = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of umgestellt) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

export function pruefeKunde(k: Partial<Kunde>): Fehler {
  const f: Fehler = {};
  if (!k.name?.trim()) f.name = 'Bitte einen Namen eingeben.';
  if (!k.strasse?.trim()) f.strasse = 'Bitte Straße und Hausnummer eingeben.';
  if (!k.plz?.trim()) f.plz = 'Bitte die Postleitzahl eingeben.';
  else if ((k.land ?? 'Deutschland') === 'Deutschland' && !/^\d{5}$/.test(k.plz.trim()))
    f.plz = 'Eine deutsche Postleitzahl hat 5 Ziffern.';
  if (!k.ort?.trim()) f.ort = 'Bitte den Ort eingeben.';
  if (k.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k.email.trim()))
    f.email = 'Diese E-Mail-Adresse sieht nicht richtig aus.';
  return f;
}

export function pruefeFirma(firma: Firmenprofil | undefined): string[] {
  if (!firma) return ['Firmendaten fehlen.'];
  const f: string[] = [];
  if (!firma.firmenname.trim()) f.push('Firmenname fehlt.');
  if (!firma.strasse.trim() || !firma.plz.trim() || !firma.ort.trim())
    f.push('Firmenanschrift ist unvollständig.');
  if (!firma.steuernummer.trim() && !firma.ustId.trim())
    f.push('Steuernummer oder USt-IdNr. fehlt (Pflichtangabe auf Rechnungen).');
  if (!firma.iban.trim()) f.push('IBAN fehlt – Kunden wissen sonst nicht, wohin sie zahlen sollen.');
  else if (!pruefeIban(firma.iban)) f.push('Die IBAN ist ungültig. Bitte prüfen.');
  return f;
}

export function pruefePosition(p: Position, nr: number): string[] {
  const f: string[] = [];
  if (!p.bezeichnung.trim()) f.push(`Position ${nr}: Bitte beschreiben, was gemacht wurde.`);
  const menge = p.einheit === 'm2' && p.flaeche?.length ? flaecheSumme(p.flaeche) : p.menge;
  if (!Number.isFinite(menge) || menge === 0) f.push(`Position ${nr}: Menge fehlt.`);
  if (!Number.isFinite(p.einzelpreis)) f.push(`Position ${nr}: Preis ist ungültig.`);
  if (p.rabattProzent !== undefined && (p.rabattProzent < 0 || p.rabattProzent > 100))
    f.push(`Position ${nr}: Rabatt muss zwischen 0 und 100 % liegen.`);
  return f;
}

/** Prüft, ob ein Beleg festgeschrieben (fertiggestellt) werden darf */
export function pruefeBeleg(b: Beleg, kunde: Kunde | undefined, firma: Firmenprofil | undefined): string[] {
  const f: string[] = [];
  if (!kunde) f.push('Bitte einen Kunden auswählen.');
  if (!b.positionen.length) f.push('Bitte mindestens eine Position hinzufügen.');
  b.positionen.forEach((p, i) => f.push(...pruefePosition(p, i + 1)));
  if (!b.datum) f.push('Rechnungsdatum fehlt.');
  if (b.typ === 'rechnung') {
    if (!b.leistungsdatum) f.push('Leistungsdatum fehlt (Pflichtangabe).');
    if (b.leistungsdatumBis && b.leistungsdatumBis < b.leistungsdatum)
      f.push('Das Ende des Leistungszeitraums liegt vor dem Beginn.');
    f.push(...pruefeFirma(firma));
    if (b.reverseCharge && kunde && !kunde.istUnternehmen)
      f.push('§ 13b gilt nur für Unternehmer als Kunden – der gewählte Kunde ist Privatkunde.');
  } else if (firma && !firma.firmenname.trim()) {
    f.push('Firmenname fehlt.');
  }
  return f;
}
