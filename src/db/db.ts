import Dexie, { type Table } from 'dexie';
import type { Beleg, Firmenprofil, Kunde, Leistungsvorlage, Zeiteintrag } from '../lib/typen';

export interface Zaehler {
  id: string; // z. B. "rechnung-2026"
  letzte: number;
}

export interface Meta {
  key: string;
  wert: string;
}

class KabaDB extends Dexie {
  kunden!: Table<Kunde, string>;
  belege!: Table<Beleg, string>;
  vorlagen!: Table<Leistungsvorlage, string>;
  zeiten!: Table<Zeiteintrag, string>;
  firma!: Table<Firmenprofil, string>;
  zaehler!: Table<Zaehler, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('kabamontage');
    this.version(1).stores({
      kunden: 'id, name',
      belege: 'id, typ, nummer, kundeId, status, datum, geaendertAm',
      vorlagen: 'id, bezeichnung',
      zeiten: 'id, kundeId, datum, abgerechnetInBelegId',
      firma: 'id',
      zaehler: 'id',
      meta: 'key',
    });
  }
}

export const db = new KabaDB();

export const neueId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.wert;
}

export async function setMeta(key: string, wert: string) {
  await db.meta.put({ key, wert });
}

// Speicher als "dauerhaft" anfragen, damit der Browser die Daten nicht bei Platzmangel löscht
export async function dauerhaftenSpeicherAnfragen() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* nicht unterstützt */
  }
}
