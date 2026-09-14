/**
 * Geldbeträge werden intern als ganze Cent (number, Integer) geführt.
 * Rundung: kaufmännisch (ab 0,5 vom Betrag weg), auch für negative Beträge (Storno).
 */

/** Rundet einen beliebigen Wert kaufmännisch auf eine ganze Zahl. */
export function rundeKaufmaennisch(wert: number): number {
  if (!Number.isFinite(wert)) return 0;
  const betrag = Math.abs(wert);
  // Toleranz gleicht Binär-Artefakte wie 100.49999999999999 (= 1.005 * 100) aus
  const gerundet = Math.floor(betrag + 0.5 + 1e-9);
  return wert < 0 ? -gerundet : gerundet;
}

/** Euro (Zahl mit Nachkommastellen) → Cent */
export function euroZuCent(euro: number): number {
  // über String gehen, damit 0.1 + 0.2-Artefakte keine Rolle spielen
  if (!Number.isFinite(euro)) return 0;
  return rundeKaufmaennisch(Number((euro * 100).toPrecision(15)));
}

export function centZuEuro(cent: number): number {
  return cent / 100;
}

/** Cent × Faktor (z. B. Menge oder Prozent/100), kaufmännisch auf Cent gerundet */
export function centMal(cent: number, faktor: number): number {
  return rundeKaufmaennisch(Number((cent * faktor).toPrecision(15)));
}

/** Prozentanteil von Cent-Betrag */
export function prozentVon(cent: number, prozent: number): number {
  return rundeKaufmaennisch(Number(((cent * prozent) / 100).toPrecision(15)));
}

/** Rundet eine Menge (z. B. m²) auf n Nachkommastellen */
export function rundeAuf(wert: number, stellen: number): number {
  const f = 10 ** stellen;
  return rundeKaufmaennisch(Number((wert * f).toPrecision(15))) / f;
}
