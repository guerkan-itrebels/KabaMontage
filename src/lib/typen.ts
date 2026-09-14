export type Einheit = 'std' | 'm2' | 'lfm' | 'stk' | 'psch' | 'km' | 'tag' | 'kg' | 'l';
export type Steuersatz = 19 | 7 | 0;

export const EINHEITEN: { wert: Einheit; kurz: string; lang: string }[] = [
  { wert: 'std', kurz: 'Std.', lang: 'Stunden' },
  { wert: 'm2', kurz: 'm²', lang: 'Quadratmeter' },
  { wert: 'lfm', kurz: 'lfm', lang: 'Laufende Meter' },
  { wert: 'stk', kurz: 'Stk.', lang: 'Stück / Material' },
  { wert: 'psch', kurz: 'psch.', lang: 'Pauschale' },
  { wert: 'km', kurz: 'km', lang: 'Anfahrt (km)' },
  { wert: 'tag', kurz: 'Tag', lang: 'Tagessatz' },
  { wert: 'kg', kurz: 'kg', lang: 'Kilogramm' },
  { wert: 'l', kurz: 'l', lang: 'Liter' },
];

export const einheitKurz = (e: Einheit) => EINHEITEN.find((x) => x.wert === e)?.kurz ?? e;

export interface Teilflaeche {
  laenge: number;
  breite: number;
  anzahl: number;
}

export interface Position {
  id: string;
  bezeichnung: string;
  einheit: Einheit;
  menge: number;
  einzelpreis: number; // netto pro Einheit in Euro
  rabattProzent?: number;
  steuersatz: Steuersatz;
  istArbeitsleistung: boolean; // § 35a EStG
  flaeche?: Teilflaeche[];
  zeiteintragIds?: string[];
}

export type BelegTyp = 'angebot' | 'rechnung';
export type BelegStatus = 'entwurf' | 'offen' | 'bezahlt' | 'ueberfaellig' | 'storniert';

export interface Kunde {
  id: string;
  name: string;
  ansprechpartner?: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  email?: string;
  telefon?: string;
  ustId?: string;
  istUnternehmen: boolean;
  notiz?: string;
  angelegtAm: string;
}

export interface Stundensatz {
  id: string;
  bezeichnung: string;
  preis: number;
}

export interface Firmenprofil {
  id: 'firma';
  firmenname: string;
  inhaber: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  telefon: string;
  email: string;
  web: string;
  steuernummer: string;
  ustId: string;
  bank: string;
  iban: string;
  bic: string;
  logo?: string; // Data-URL (PNG/JPEG). Leer = mitgeliefertes Logo
  stundensaetze: Stundensatz[];
  standardSteuersatz: Steuersatz;
  zahlungszielTage: number;
  skontoProzent: number;
  skontoTage: number;
  einleitungRechnung: string;
  schlussRechnung: string;
  einleitungAngebot: string;
  schlussAngebot: string;
  praefixRechnung: string;
  praefixAngebot: string;
  startnummerRechnung: number;
  startnummerAngebot: number;
  nummerMitJahr: boolean;
  kleinunternehmer: boolean; // § 19 UStG
  bauleistung13b: boolean; // § 13b UStG anbieten
}

export interface Beleg {
  id: string;
  typ: BelegTyp;
  nummer: string; // leer, solange Entwurf
  kundeId: string;
  baustelle?: string;
  datum: string;
  leistungsdatum: string;
  leistungsdatumBis?: string;
  positionen: Position[];
  zahlungszielTage: number;
  skonto?: { prozent: number; tage: number };
  einleitungstext: string;
  schlusstext: string;
  status: BelegStatus;
  bezahltAm?: string;
  reverseCharge: boolean;
  kleinunternehmer: boolean;
  /** Festgeschriebene Daten: Absender/Empfänger zum Zeitpunkt der Ausstellung */
  festgeschriebenAm?: string;
  kundeSnapshot?: Kunde;
  firmaSnapshot?: Firmenprofil;
  stornoVonId?: string;
  stornoVonNummer?: string;
  storniertDurchId?: string;
  ausAngebotId?: string;
  inRechnungId?: string;
  geaendertAm: string;
}

export interface Leistungsvorlage {
  id: string;
  bezeichnung: string;
  einheit: Einheit;
  einzelpreis: number;
  steuersatz: Steuersatz;
  istArbeitsleistung: boolean;
}

export interface Zeiteintrag {
  id: string;
  kundeId?: string;
  baustelle?: string;
  taetigkeit: string;
  datum: string; // YYYY-MM-DD
  start?: string; // ISO, bei laufendem Timer
  laeuft: boolean;
  minuten: number;
  stundensatzId?: string;
  abgerechnetInBelegId?: string;
}
