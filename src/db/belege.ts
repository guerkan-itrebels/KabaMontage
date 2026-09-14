import { rundeAuf } from '../lib/geld';
import { datum as datumText, heute } from '../lib/format';
import { formatiereNummer } from '../lib/texte';
import type { Beleg, BelegTyp, Firmenprofil, Position, Zeiteintrag } from '../lib/typen';
import { pruefeBeleg } from '../lib/validierung';
import { db, neueId } from './db';
import { ladeFirma } from './firma';

const jetzt = () => new Date().toISOString();

export async function neuerBeleg(typ: BelegTyp, kundeId = ''): Promise<string> {
  const firma = await ladeFirma();
  const kunde = kundeId ? await db.kunden.get(kundeId) : undefined;
  const b: Beleg = {
    id: neueId(),
    typ,
    nummer: '',
    kundeId,
    datum: heute(),
    leistungsdatum: heute(),
    positionen: [],
    zahlungszielTage: firma.zahlungszielTage,
    skonto:
      firma.skontoProzent > 0 && firma.skontoTage > 0
        ? { prozent: firma.skontoProzent, tage: firma.skontoTage }
        : undefined,
    einleitungstext: typ === 'rechnung' ? firma.einleitungRechnung : firma.einleitungAngebot,
    schlusstext: typ === 'rechnung' ? firma.schlussRechnung : firma.schlussAngebot,
    status: 'entwurf',
    reverseCharge: !!(firma.bauleistung13b && kunde?.istUnternehmen),
    kleinunternehmer: firma.kleinunternehmer,
    geaendertAm: jetzt(),
  };
  await db.belege.add(b);
  return b.id;
}

export async function speichereEntwurf(b: Beleg) {
  const alt = await db.belege.get(b.id);
  // Festgeschriebene Rechnungen sind unveränderlich
  if (alt && alt.typ === 'rechnung' && alt.status !== 'entwurf') return;
  await db.belege.put({ ...b, geaendertAm: jetzt() });
}

function zaehlerSchluessel(typ: BelegTyp, firma: Firmenprofil, datumIso: string) {
  const jahr = firma.nummerMitJahr ? Number(datumIso.slice(0, 4)) : null;
  return { id: `${typ}-${jahr ?? 'alle'}`, jahr };
}

/** Zieht die nächste freie Nummer (innerhalb einer laufenden Transaktion aufrufen) */
async function naechsteNummer(typ: BelegTyp, firma: Firmenprofil, datumIso: string): Promise<string> {
  const { id, jahr } = zaehlerSchluessel(typ, firma, datumIso);
  const praefix = typ === 'rechnung' ? firma.praefixRechnung : firma.praefixAngebot;
  const start = typ === 'rechnung' ? firma.startnummerRechnung : firma.startnummerAngebot;
  const z = await db.zaehler.get(id);
  let laufend = Math.max((z?.letzte ?? 0) + 1, start || 1);
  let nummer = formatiereNummer(praefix, jahr, laufend);
  // Sicherheitsnetz: eine bereits vorhandene Nummer (z. B. nach Import) wird nie erneut vergeben
  while (await db.belege.where('nummer').equals(nummer).count()) {
    laufend++;
    nummer = formatiereNummer(praefix, jahr, laufend);
  }
  await db.zaehler.put({ id, letzte: laufend });
  return nummer;
}

/** Vorschau der nächsten Nummer (ohne sie zu vergeben) */
export async function nummerVorschau(typ: BelegTyp, datumIso: string): Promise<string> {
  const firma = await ladeFirma();
  const { id, jahr } = zaehlerSchluessel(typ, firma, datumIso);
  const z = await db.zaehler.get(id);
  const start = typ === 'rechnung' ? firma.startnummerRechnung : firma.startnummerAngebot;
  return formatiereNummer(
    typ === 'rechnung' ? firma.praefixRechnung : firma.praefixAngebot,
    jahr,
    Math.max((z?.letzte ?? 0) + 1, start || 1),
  );
}

/**
 * Schreibt einen Beleg fest: vergibt die fortlaufende Nummer, friert Absender-
 * und Kundendaten ein und markiert übernommene Zeiten als abgerechnet.
 */
export async function festschreiben(id: string): Promise<{ ok: true; nummer: string } | { ok: false; fehler: string[] }> {
  return db.transaction('rw', [db.belege, db.zaehler, db.kunden, db.firma, db.zeiten], async () => {
    const b = await db.belege.get(id);
    if (!b) return { ok: false as const, fehler: ['Beleg nicht gefunden.'] };
    if (b.status !== 'entwurf') return { ok: false as const, fehler: ['Dieser Beleg ist bereits fertiggestellt.'] };
    const firma = await ladeFirma();
    const kunde = await db.kunden.get(b.kundeId);
    const fehler = pruefeBeleg(b, kunde, firma);
    if (fehler.length) return { ok: false as const, fehler };

    const nummer = await naechsteNummer(b.typ, firma, b.datum);
    const zeitIds = b.positionen.flatMap((p) => p.zeiteintragIds ?? []);
    if (zeitIds.length) {
      await db.zeiten.where('id').anyOf(zeitIds).modify({ abgerechnetInBelegId: b.id });
    }
    await db.belege.put({
      ...b,
      nummer,
      status: 'offen',
      kleinunternehmer: firma.kleinunternehmer,
      reverseCharge: firma.kleinunternehmer ? false : b.reverseCharge,
      festgeschriebenAm: jetzt(),
      kundeSnapshot: kunde,
      firmaSnapshot: firma,
      geaendertAm: jetzt(),
    });
    if (b.ausAngebotId) await db.belege.update(b.ausAngebotId, { inRechnungId: b.id });
    return { ok: true as const, nummer };
  });
}

/** Storniert eine festgeschriebene Rechnung durch eine Stornorechnung mit negativen Beträgen */
export async function stornieren(id: string): Promise<string> {
  return db.transaction('rw', [db.belege, db.zaehler, db.firma, db.zeiten], async () => {
    const o = await db.belege.get(id);
    if (!o || o.typ !== 'rechnung' || o.status === 'entwurf') throw new Error('Nur fertiggestellte Rechnungen können storniert werden.');
    if (o.stornoVonId) throw new Error('Eine Stornorechnung kann nicht storniert werden.');
    if (o.storniertDurchId) throw new Error('Diese Rechnung wurde bereits storniert.');
    const firma = await ladeFirma();
    const datum = heute();
    const nummer = await naechsteNummer('rechnung', firma, datum);
    const storno: Beleg = {
      ...o,
      id: neueId(),
      nummer,
      datum,
      positionen: o.positionen.map((p) => ({ ...p, id: neueId(), menge: -p.menge, zeiteintragIds: undefined })),
      einleitungstext: `Hiermit stornieren wir unsere Rechnung Nr. ${o.nummer} vom ${datumText(o.datum)} in voller Höhe.`,
      schlusstext: 'Mit freundlichen Grüßen',
      status: 'storniert',
      bezahltAm: undefined,
      skonto: undefined,
      zahlungszielTage: 0,
      stornoVonId: o.id,
      stornoVonNummer: o.nummer,
      storniertDurchId: undefined,
      ausAngebotId: undefined,
      inRechnungId: undefined,
      festgeschriebenAm: jetzt(),
      firmaSnapshot: o.firmaSnapshot ?? firma,
      geaendertAm: jetzt(),
    };
    await db.belege.add(storno);
    await db.belege.update(o.id, { status: 'storniert', storniertDurchId: storno.id, geaendertAm: jetzt() });
    // Zeiten wieder freigeben, damit sie neu abgerechnet werden können
    await db.zeiten.where('abgerechnetInBelegId').equals(o.id).modify({ abgerechnetInBelegId: undefined });
    return storno.id;
  });
}

export async function angebotZuRechnung(angebotId: string): Promise<string> {
  const a = await db.belege.get(angebotId);
  if (!a) throw new Error('Angebot nicht gefunden.');
  const id = await neuerBeleg('rechnung', a.kundeId);
  const b = (await db.belege.get(id))!;
  await db.belege.put({
    ...b,
    baustelle: a.baustelle,
    positionen: a.positionen.map((p) => ({ ...p, id: neueId() })),
    reverseCharge: a.reverseCharge,
    ausAngebotId: a.id,
    einleitungstext: a.nummer
      ? `${b.einleitungstext}\nGrundlage ist unser Angebot Nr. ${a.nummer}.`
      : b.einleitungstext,
  });
  return id;
}

export async function duplizieren(belegId: string): Promise<string> {
  const a = await db.belege.get(belegId);
  if (!a) throw new Error('Beleg nicht gefunden.');
  const typ = a.stornoVonId ? 'rechnung' : a.typ;
  const id = await neuerBeleg(typ, a.kundeId);
  const b = (await db.belege.get(id))!;
  await db.belege.put({
    ...b,
    baustelle: a.baustelle,
    positionen: a.positionen.map((p) => ({
      ...p,
      id: neueId(),
      menge: Math.abs(p.menge),
      zeiteintragIds: undefined,
    })),
    reverseCharge: a.reverseCharge,
  });
  return id;
}

export async function setzeBezahlt(id: string, bezahltAm: string | undefined) {
  const b = await db.belege.get(id);
  if (!b || b.typ !== 'rechnung' || b.status === 'entwurf' || b.status === 'storniert') return;
  await db.belege.update(id, {
    status: bezahltAm ? 'bezahlt' : 'offen',
    bezahltAm,
    geaendertAm: jetzt(),
  });
}

export async function entwurfLoeschen(id: string) {
  const b = await db.belege.get(id);
  if (b?.status === 'entwurf') await db.belege.delete(id);
}

/** Erfasste Zeiten → Stundenpositionen */
export function zeitenZuPositionen(zeiten: Zeiteintrag[], firma: Firmenprofil): Position[] {
  return zeiten.map((z) => {
    const satz = firma.stundensaetze.find((s) => s.id === z.stundensatzId) ?? firma.stundensaetze[0];
    const d = z.datum.split('-').reverse().join('.');
    const zusatz = [d, z.baustelle].filter(Boolean).join(', ');
    return {
      id: neueId(),
      bezeichnung: `${z.taetigkeit || 'Arbeitszeit'}${satz ? `, ${satz.bezeichnung}` : ''} (${zusatz})`,
      einheit: 'std' as const,
      menge: rundeAuf(z.minuten / 60, 2),
      einzelpreis: satz?.preis ?? 0,
      steuersatz: firma.standardSteuersatz,
      istArbeitsleistung: true,
      zeiteintragIds: [z.id],
    };
  });
}
