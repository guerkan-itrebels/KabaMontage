import type { BelegSummen } from './berechnung';
import { skontoBetragCent } from './berechnung';
import { datum, euro, plusTage } from './format';
import type { Beleg, Kunde } from './typen';

export const HINWEIS_19 = 'Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.';
export const HINWEIS_13B = 'Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG).';
export const HINWEIS_AUFBEWAHRUNG =
  'Hinweis: Als Privatperson sind Sie gemäß § 14b Abs. 1 S. 5 UStG verpflichtet, diese Rechnung zwei Jahre lang aufzubewahren.';

export function hinweis35a(s: BelegSummen, kleinunternehmer: boolean): string {
  const ust = kleinunternehmer ? '' : ` (darin enthaltene Umsatzsteuer: ${euro(s.arbeitskostenSteuerCent)})`;
  return (
    `In der Rechnungssumme sind Arbeitskosten in Höhe von ${euro(s.arbeitskostenBruttoCent)}${ust} enthalten. ` +
    'Diese können im Rahmen der Steuerermäßigung für Handwerkerleistungen nach § 35a EStG geltend gemacht werden. ' +
    'Voraussetzung ist die unbare Zahlung auf unser Konto.'
  );
}

/** Rechtliche und kontextabhängige Hinweise für einen Beleg */
export function belegHinweise(b: Beleg, kunde: Kunde | undefined, s: BelegSummen): string[] {
  const h: string[] = [];
  if (b.kleinunternehmer) h.push(HINWEIS_19);
  else if (b.reverseCharge) h.push(HINWEIS_13B);
  if (b.typ === 'rechnung' && kunde && !kunde.istUnternehmen) {
    if (s.arbeitskostenBruttoCent !== 0) h.push(hinweis35a(s, b.kleinunternehmer));
    h.push(HINWEIS_AUFBEWAHRUNG);
  }
  return h;
}

export function leistungszeitraumText(b: Pick<Beleg, 'leistungsdatum' | 'leistungsdatumBis'>): string {
  if (b.leistungsdatumBis && b.leistungsdatumBis !== b.leistungsdatum) {
    return `${datum(b.leistungsdatum)} – ${datum(b.leistungsdatumBis)}`;
  }
  return datum(b.leistungsdatum);
}

/** Zahlungsbedingungen, automatisch aus Zahlungsziel und Skonto formuliert */
export function zahlungsText(b: Beleg, s: BelegSummen): string {
  if (b.typ === 'angebot') {
    return `Dieses Angebot ist 30 Tage gültig (bis ${datum(plusTage(b.datum, 30))}).`;
  }
  if (b.stornoVonId) return 'Der Betrag wird mit der ursprünglichen Rechnung verrechnet bzw. erstattet.';
  const teile: string[] = [];
  if (!b.zahlungszielTage) {
    teile.push('Zahlbar sofort ohne Abzug.');
  } else {
    const faellig = datum(plusTage(b.datum, b.zahlungszielTage));
    if (b.skonto && b.skonto.prozent > 0 && b.skonto.tage > 0) {
      const skontoCent = skontoBetragCent(s.bruttoCent, b.skonto.prozent);
      const bis = datum(plusTage(b.datum, b.skonto.tage));
      teile.push(
        `Bei Zahlung bis zum ${bis} gewähren wir ${String(b.skonto.prozent).replace('.', ',')} % Skonto ` +
          `(${euro(skontoCent)}), zu zahlen sind dann ${euro(s.bruttoCent - skontoCent)}.`,
      );
      teile.push(`Ohne Abzug zahlbar bis zum ${faellig}.`);
    } else {
      teile.push(`Zahlbar ohne Abzug bis zum ${faellig} (${b.zahlungszielTage} Tage).`);
    }
  }
  return teile.join(' ');
}

export function faelligAm(b: Beleg): string {
  return plusTage(b.datum, b.zahlungszielTage || 0);
}

/** Status inkl. automatisch erkannter Überfälligkeit */
export function effektiverStatus(b: Beleg, heuteIso: string): Beleg['status'] {
  if (b.status === 'offen' && b.typ === 'rechnung' && !b.stornoVonId && faelligAm(b) < heuteIso) {
    return 'ueberfaellig';
  }
  return b.status;
}

export const STATUS_TEXT: Record<Beleg['status'], string> = {
  entwurf: 'Entwurf',
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  ueberfaellig: 'Überfällig',
  storniert: 'Storniert',
};

export function belegTitel(b: Pick<Beleg, 'typ' | 'stornoVonId'>): string {
  if (b.stornoVonId) return 'Stornorechnung';
  return b.typ === 'rechnung' ? 'Rechnung' : 'Angebot';
}

/** Nummer formatieren, z. B. RE-2026-0001 */
export function formatiereNummer(praefix: string, jahr: number | null, laufend: number): string {
  const nr = String(laufend).padStart(4, '0');
  const p = praefix.trim().replace(/-+$/, '');
  return [p, jahr ?? undefined, nr].filter((x) => x !== undefined && x !== '').join('-');
}
