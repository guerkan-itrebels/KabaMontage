import { centMal, euroZuCent, prozentVon, rundeAuf } from './geld';
import type { Beleg, Position, Steuersatz, Teilflaeche } from './typen';

export interface PositionsErgebnis {
  id: string;
  bruttoCent: number; // Menge × Einzelpreis (vor Rabatt), netto
  rabattCent: number;
  nettoCent: number;
  steuersatz: Steuersatz; // tatsächlich angewandter Satz
}

export interface SteuerZeile {
  satz: Steuersatz;
  nettoCent: number;
  steuerCent: number;
}

export interface BelegSummen {
  positionen: PositionsErgebnis[];
  zwischensummeCent: number; // vor Rabatt
  rabattCent: number;
  nettoCent: number;
  steuern: SteuerZeile[];
  steuerCent: number;
  bruttoCent: number;
  /** Arbeitskosten nach § 35a EStG (inkl. darauf entfallender USt) */
  arbeitskostenNettoCent: number;
  arbeitskostenSteuerCent: number;
  arbeitskostenBruttoCent: number;
}

export interface SteuerModus {
  kleinunternehmer: boolean;
  reverseCharge: boolean;
}

/** Summe der Teilflächen in m², auf 2 Nachkommastellen */
export function flaecheSumme(teile: Teilflaeche[] | undefined): number {
  if (!teile?.length) return 0;
  const summe = teile.reduce(
    (s, t) => s + (t.laenge || 0) * (t.breite || 0) * (t.anzahl || 0),
    0,
  );
  return rundeAuf(summe, 2);
}

export function effektiverSteuersatz(p: Position, modus: SteuerModus): Steuersatz {
  if (modus.kleinunternehmer || modus.reverseCharge) return 0;
  return p.steuersatz;
}

export function berechnePosition(p: Position, modus: SteuerModus): PositionsErgebnis {
  const preisCent = euroZuCent(p.einzelpreis || 0);
  const bruttoCent = centMal(preisCent, p.menge || 0);
  const rabattCent = p.rabattProzent ? prozentVon(bruttoCent, p.rabattProzent) : 0;
  return {
    id: p.id,
    bruttoCent,
    rabattCent,
    nettoCent: bruttoCent - rabattCent,
    steuersatz: effektiverSteuersatz(p, modus),
  };
}

const SATZ_REIHENFOLGE: Steuersatz[] = [19, 7, 0];

export function berechneSummen(positionen: Position[], modus: SteuerModus): BelegSummen {
  const ergebnisse = positionen.map((p) => berechnePosition(p, modus));

  const nettoJeSatz = new Map<Steuersatz, number>();
  const arbeitJeSatz = new Map<Steuersatz, number>();
  ergebnisse.forEach((e, i) => {
    nettoJeSatz.set(e.steuersatz, (nettoJeSatz.get(e.steuersatz) ?? 0) + e.nettoCent);
    if (positionen[i].istArbeitsleistung) {
      arbeitJeSatz.set(e.steuersatz, (arbeitJeSatz.get(e.steuersatz) ?? 0) + e.nettoCent);
    }
  });

  // USt je Satz auf die Nettosumme des Satzes (nicht je Position)
  const steuern: SteuerZeile[] = SATZ_REIHENFOLGE.filter((s) => nettoJeSatz.has(s)).map(
    (satz) => {
      const nettoCent = nettoJeSatz.get(satz)!;
      return { satz, nettoCent, steuerCent: prozentVon(nettoCent, satz) };
    },
  );

  const summe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const zwischensummeCent = summe(ergebnisse.map((e) => e.bruttoCent));
  const rabattCent = summe(ergebnisse.map((e) => e.rabattCent));
  const nettoCent = summe(ergebnisse.map((e) => e.nettoCent));
  const steuerCent = summe(steuern.map((s) => s.steuerCent));

  let arbeitskostenNettoCent = 0;
  let arbeitskostenSteuerCent = 0;
  arbeitJeSatz.forEach((netto, satz) => {
    arbeitskostenNettoCent += netto;
    arbeitskostenSteuerCent += prozentVon(netto, satz);
  });

  return {
    positionen: ergebnisse,
    zwischensummeCent,
    rabattCent,
    nettoCent,
    steuern,
    steuerCent,
    bruttoCent: nettoCent + steuerCent,
    arbeitskostenNettoCent,
    arbeitskostenSteuerCent,
    arbeitskostenBruttoCent: arbeitskostenNettoCent + arbeitskostenSteuerCent,
  };
}

export function belegSummen(b: Pick<Beleg, 'positionen' | 'kleinunternehmer' | 'reverseCharge'>) {
  return berechneSummen(b.positionen, {
    kleinunternehmer: b.kleinunternehmer,
    reverseCharge: b.reverseCharge,
  });
}

export function skontoBetragCent(bruttoCent: number, prozent: number): number {
  return prozentVon(bruttoCent, prozent);
}
