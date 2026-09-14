import type { Firmenprofil } from '../lib/typen';
import { db, neueId } from './db';

export function standardFirma(): Firmenprofil {
  return {
    id: 'firma',
    firmenname: '',
    inhaber: '',
    strasse: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    telefon: '',
    email: '',
    web: '',
    steuernummer: '',
    ustId: '',
    bank: '',
    iban: '',
    bic: '',
    stundensaetze: [
      { id: neueId(), bezeichnung: 'Meister', preis: 0 },
      { id: neueId(), bezeichnung: 'Geselle', preis: 0 },
      { id: neueId(), bezeichnung: 'Helfer', preis: 0 },
      { id: neueId(), bezeichnung: 'Azubi', preis: 0 },
    ],
    standardSteuersatz: 19,
    zahlungszielTage: 14,
    skontoProzent: 0,
    skontoTage: 0,
    einleitungRechnung:
      'Sehr geehrte Damen und Herren,\nvielen Dank für Ihren Auftrag. Für die ausgeführten Arbeiten erlauben wir uns, wie folgt abzurechnen:',
    schlussRechnung: 'Wir bedanken uns für die gute Zusammenarbeit.\nMit freundlichen Grüßen',
    einleitungAngebot:
      'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen folgende Leistungen an:',
    schlussAngebot:
      'Wir freuen uns auf Ihren Auftrag. Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.\nMit freundlichen Grüßen',
    praefixRechnung: 'RE',
    praefixAngebot: 'AN',
    startnummerRechnung: 1,
    startnummerAngebot: 1,
    nummerMitJahr: true,
    kleinunternehmer: false,
    bauleistung13b: false,
  };
}

export async function ladeFirma(): Promise<Firmenprofil> {
  const f = await db.firma.get('firma');
  if (f) return { ...standardFirma(), ...f };
  const neu = standardFirma();
  await db.firma.put(neu);
  return neu;
}
