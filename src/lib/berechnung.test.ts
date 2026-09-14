import { describe, expect, it } from 'vitest';
import { berechnePosition, berechneSummen, flaecheSumme, mitAktuellerSteuer, skontoBetragCent } from './berechnung';
import { euroZuCent, prozentVon, rundeKaufmaennisch } from './geld';
import { dateinameSicher, euro, parseZahl } from './format';
import { belegHinweise, effektiverStatus, formatiereNummer, HINWEIS_13B, HINWEIS_19, zahlungsText } from './texte';
import { pruefeIban } from './validierung';
import type { Beleg, Kunde, Position } from './typen';

let n = 0;
const pos = (p: Partial<Position>): Position => ({
  id: String(++n),
  bezeichnung: 'Test',
  einheit: 'stk',
  menge: 1,
  einzelpreis: 0,
  steuersatz: 19,
  istArbeitsleistung: false,
  ...p,
});
const normal = { kleinunternehmer: false, reverseCharge: false };

describe('Rundung', () => {
  it('rundet kaufmännisch, auch bei Binär-Artefakten', () => {
    expect(rundeKaufmaennisch(100.5)).toBe(101);
    expect(rundeKaufmaennisch(100.49)).toBe(100);
    expect(rundeKaufmaennisch(-100.5)).toBe(-101);
    expect(euroZuCent(1.005)).toBe(101);
    expect(euroZuCent(0.1 + 0.2)).toBe(30);
    expect(euroZuCent(19.99)).toBe(1999);
  });
  it('Prozent auf Cent', () => {
    expect(prozentVon(1050, 19)).toBe(200); // 199,5 → 200
    expect(prozentVon(1049, 19)).toBe(199); // 199,31
    expect(prozentVon(-1050, 19)).toBe(-200);
  });
});

describe('Positionen', () => {
  it('Menge × Einzelpreis ohne Float-Fehler', () => {
    const r = berechnePosition(pos({ menge: 3, einzelpreis: 0.1 }), normal);
    expect(r.nettoCent).toBe(30);
    const r2 = berechnePosition(pos({ menge: 7.5, einzelpreis: 58.9 }), normal);
    expect(r2.nettoCent).toBe(44175);
  });
  it('Menge mit Nachkommastellen wird auf Cent gerundet', () => {
    // 2,335 × 10,05 = 23,46675 → 23,47
    expect(berechnePosition(pos({ menge: 2.335, einzelpreis: 10.05 }), normal).nettoCent).toBe(2347);
  });
  it('Rabatt wird abgezogen und gerundet', () => {
    const r = berechnePosition(pos({ menge: 1, einzelpreis: 99.99, rabattProzent: 10 }), normal);
    expect(r.bruttoCent).toBe(9999);
    expect(r.rabattCent).toBe(1000); // 999,9 → 1000
    expect(r.nettoCent).toBe(8999);
  });
  it('Flächenrechner summiert Teilflächen', () => {
    expect(
      flaecheSumme([
        { laenge: 4.25, breite: 2.6, anzahl: 2 },
        { laenge: 3.1, breite: 2.6, anzahl: 1 },
      ]),
    ).toBe(30.16);
    expect(flaecheSumme(undefined)).toBe(0);
  });
});

describe('Belegsummen', () => {
  it('gemischte Steuersätze werden je Satz auf die Nettosumme berechnet', () => {
    const s = berechneSummen(
      [
        pos({ menge: 1, einzelpreis: 10.5, steuersatz: 19 }),
        pos({ menge: 1, einzelpreis: 10.5, steuersatz: 19 }),
        pos({ menge: 2, einzelpreis: 12.35, steuersatz: 7 }),
        pos({ menge: 1, einzelpreis: 5, steuersatz: 0 }),
      ],
      normal,
    );
    // je Satz: 21,00 × 19 % = 3,99 (je Position gerundet wären es 2 × 2,00 = 4,00)
    expect(s.steuern).toEqual([
      { satz: 19, nettoCent: 2100, steuerCent: 399 },
      { satz: 7, nettoCent: 2470, steuerCent: 173 },
      { satz: 0, nettoCent: 500, steuerCent: 0 },
    ]);
    expect(s.nettoCent).toBe(5070);
    expect(s.steuerCent).toBe(572);
    expect(s.bruttoCent).toBe(5642);
  });

  it('Rabatte erscheinen getrennt, Netto ist nach Rabatt', () => {
    const s = berechneSummen(
      [
        pos({ menge: 10, einzelpreis: 50, rabattProzent: 5 }),
        pos({ menge: 1, einzelpreis: 200 }),
      ],
      normal,
    );
    expect(s.zwischensummeCent).toBe(70000);
    expect(s.rabattCent).toBe(2500);
    expect(s.nettoCent).toBe(67500);
    expect(s.steuerCent).toBe(12825);
    expect(s.bruttoCent).toBe(80325);
  });

  it('Kleinunternehmer: keine Umsatzsteuer', () => {
    const s = berechneSummen(
      [pos({ menge: 2, einzelpreis: 100, steuersatz: 19 }), pos({ menge: 1, einzelpreis: 50, steuersatz: 7 })],
      { kleinunternehmer: true, reverseCharge: false },
    );
    expect(s.steuerCent).toBe(0);
    expect(s.bruttoCent).toBe(25000);
    expect(s.steuern).toEqual([{ satz: 0, nettoCent: 25000, steuerCent: 0 }]);
  });

  it('§ 13b: Steuersatz 0 %, Brutto = Netto', () => {
    const s = berechneSummen([pos({ menge: 40, einzelpreis: 65, istArbeitsleistung: true })], {
      kleinunternehmer: false,
      reverseCharge: true,
    });
    expect(s.steuern).toEqual([{ satz: 0, nettoCent: 260000, steuerCent: 0 }]);
    expect(s.bruttoCent).toBe(260000);
  });

  it('Arbeitskosten § 35a nur aus Arbeitsleistungen, inkl. USt', () => {
    const s = berechneSummen(
      [
        pos({ einheit: 'std', menge: 8, einzelpreis: 58, istArbeitsleistung: true }),
        pos({ einheit: 'km', menge: 30, einzelpreis: 0.5, istArbeitsleistung: true }),
        pos({ menge: 12, einzelpreis: 14.9, istArbeitsleistung: false }),
      ],
      normal,
    );
    expect(s.arbeitskostenNettoCent).toBe(47900);
    expect(s.arbeitskostenSteuerCent).toBe(9101);
    expect(s.arbeitskostenBruttoCent).toBe(57001);
    expect(s.nettoCent).toBe(65780);
  });

  it('Storno: negative Mengen spiegeln exakt', () => {
    const positionen = [pos({ menge: 2.335, einzelpreis: 10.05, rabattProzent: 3 }), pos({ menge: 1, einzelpreis: 10.5, steuersatz: 7 })];
    const original = berechneSummen(positionen, normal);
    const storno = berechneSummen(positionen.map((p) => ({ ...p, menge: -p.menge })), normal);
    expect(storno.bruttoCent).toBe(-original.bruttoCent);
    expect(storno.steuerCent).toBe(-original.steuerCent);
  });

  it('Kleinunternehmer nachträglich eingeschaltet: Entwurf folgt, festgeschriebene Rechnung nicht', () => {
    const alt = { typ: 'rechnung' as const, status: 'entwurf' as const, kleinunternehmer: false, reverseCharge: true };
    expect(mitAktuellerSteuer(alt, true)).toMatchObject({ kleinunternehmer: true, reverseCharge: false });
    const fertig = { ...alt, status: 'offen' as const };
    expect(mitAktuellerSteuer(fertig, true)).toBe(fertig);
    const angebot = { ...alt, typ: 'angebot' as const, status: 'offen' as const };
    expect(mitAktuellerSteuer(angebot, true).kleinunternehmer).toBe(true);
  });

  it('leerer Beleg', () => {
    const s = berechneSummen([], normal);
    expect(s.bruttoCent).toBe(0);
    expect(s.steuern).toEqual([]);
  });

  it('Skonto', () => {
    expect(skontoBetragCent(80325, 2)).toBe(1607); // 1606,5 → 1607
  });
});

const kunde = (istUnternehmen: boolean): Kunde => ({
  id: 'k', name: 'Max Mustermann', strasse: 'A 1', plz: '12345', ort: 'B', land: 'Deutschland',
  istUnternehmen, angelegtAm: '2026-01-01',
});
const beleg = (b: Partial<Beleg>): Beleg => ({
  id: 'b', typ: 'rechnung', nummer: 'RE-2026-0001', kundeId: 'k', datum: '2026-09-14',
  leistungsdatum: '2026-09-10', positionen: [], zahlungszielTage: 14, einleitungstext: '',
  schlusstext: '', status: 'offen', reverseCharge: false, kleinunternehmer: false, geaendertAm: '', ...b,
});

describe('Hinweise und Texte', () => {
  const positionen = [pos({ menge: 8, einzelpreis: 58, istArbeitsleistung: true })];

  it('Privatkunde: § 35a-Arbeitskosten und Aufbewahrungspflicht', () => {
    const b = beleg({ positionen });
    const h = belegHinweise(b, kunde(false), berechneSummen(positionen, normal));
    expect(h.some((x) => x.includes('§ 35a EStG') && x.includes(euro(55216)))).toBe(true);
    expect(h.some((x) => x.includes('§ 14b'))).toBe(true);
  });
  it('Unternehmen: keine Privatkunden-Hinweise', () => {
    const b = beleg({ positionen });
    expect(belegHinweise(b, kunde(true), berechneSummen(positionen, normal))).toEqual([]);
  });
  it('§ 19 und § 13b', () => {
    const s = berechneSummen(positionen, normal);
    expect(belegHinweise(beleg({ kleinunternehmer: true }), kunde(true), s)).toEqual([HINWEIS_19]);
    expect(belegHinweise(beleg({ reverseCharge: true }), kunde(true), s)).toEqual([HINWEIS_13B]);
  });
  it('Zahlungstext mit Skonto', () => {
    const s = berechneSummen([pos({ menge: 1, einzelpreis: 100 })], normal);
    const t = zahlungsText(beleg({ skonto: { prozent: 2, tage: 7 } }), s);
    expect(t).toContain('21.09.2026');
    expect(t).toContain('28.09.2026');
    expect(t).toContain('2 % Skonto');
    expect(t).toContain('116,62');
  });
  it('Überfällig wird automatisch erkannt', () => {
    expect(effektiverStatus(beleg({}), '2026-09-28')).toBe('offen');
    expect(effektiverStatus(beleg({}), '2026-09-29')).toBe('ueberfaellig');
    expect(effektiverStatus(beleg({ status: 'bezahlt' }), '2027-01-01')).toBe('bezahlt');
  });
  it('Nummernformat', () => {
    expect(formatiereNummer('RE-', 2026, 1)).toBe('RE-2026-0001');
    expect(formatiereNummer('AN', null, 12345)).toBe('AN-12345');
  });
});

describe('Hilfsfunktionen', () => {
  it('deutsche Zahleneingabe', () => {
    expect(parseZahl('1.234,56')).toBe(1234.56);
    expect(parseZahl('12,5')).toBe(12.5);
    expect(parseZahl('12.5')).toBe(12.5);
    expect(parseZahl('abc')).toBeNaN();
    expect(parseZahl('')).toBeNaN();
  });
  it('IBAN-Prüfung', () => {
    expect(pruefeIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(pruefeIban('DE89 3704 0044 0532 0130 01')).toBe(false);
  });
  it('Dateiname', () => {
    expect(dateinameSicher('Müller & Söhne GmbH')).toBe('Mueller_Soehne_GmbH');
  });
});
