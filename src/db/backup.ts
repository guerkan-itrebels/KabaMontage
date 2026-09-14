import { heute } from '../lib/format';
import { db, getMeta, setMeta } from './db';

const TABELLEN = ['kunden', 'belege', 'vorlagen', 'zeiten', 'firma', 'zaehler', 'meta'] as const;
type TabellenName = (typeof TABELLEN)[number];

export interface BackupDatei {
  app: 'kabamontage';
  version: 1;
  exportiertAm: string;
  daten: Record<TabellenName, unknown[]>;
}

export async function erstelleBackup(): Promise<BackupDatei> {
  const daten = {} as BackupDatei['daten'];
  for (const t of TABELLEN) {
    const rows = await db.table(t).toArray();
    daten[t] = t === 'meta' ? rows.filter((r: { key: string }) => r.key !== 'letztesBackup') : rows;
  }
  return { app: 'kabamontage', version: 1, exportiertAm: new Date().toISOString(), daten };
}

export async function backupTeilen(): Promise<'geteilt' | 'heruntergeladen' | 'abgebrochen'> {
  const backup = await erstelleBackup();
  const name = `KabaMontage-Sicherung_${heute()}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const ergebnis = await dateiAusgeben(blob, name, 'KabaMontage Datensicherung');
  if (ergebnis !== 'abgebrochen') await setMeta('letztesBackup', new Date().toISOString());
  return ergebnis;
}

/** Teilen per Web Share API (Handy), sonst Download */
export async function dateiAusgeben(
  blob: Blob,
  dateiname: string,
  titel: string,
): Promise<'geteilt' | 'heruntergeladen' | 'abgebrochen'> {
  const datei = new File([blob], dateiname, { type: blob.type });
  const istMobil = matchMedia('(pointer: coarse)').matches;
  if (istMobil && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: titel });
      return 'geteilt';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'abgebrochen';
      // sonst: Download als Fallback
    }
  }
  herunterladen(blob, dateiname);
  return 'heruntergeladen';
}

export function herunterladen(blob: Blob, dateiname: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ImportVorschau {
  backup: BackupDatei;
  anzahl: Record<TabellenName, number>;
}

export async function leseBackupDatei(file: File): Promise<ImportVorschau> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei konnte nicht gelesen werden. Ist es wirklich eine KabaMontage-Sicherung (.json)?');
  }
  const b = json as Partial<BackupDatei>;
  if (!b || b.app !== 'kabamontage' || typeof b.daten !== 'object' || !b.daten) {
    throw new Error('Das ist keine KabaMontage-Sicherung.');
  }
  if (b.version !== 1) throw new Error('Diese Sicherung stammt aus einer neueren App-Version.');
  const anzahl = {} as ImportVorschau['anzahl'];
  for (const t of TABELLEN) {
    const rows = (b.daten as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(rows)) throw new Error(`Die Sicherung ist beschädigt (${t}).`);
    anzahl[t] = rows.length;
  }
  return { backup: b as BackupDatei, anzahl };
}

/** Ersetzt alle Daten auf dem Gerät durch die Sicherung */
export async function spieleBackupEin(backup: BackupDatei) {
  const letztes = await getMeta('letztesBackup');
  await db.transaction('rw', TABELLEN.map((t) => db.table(t)), async () => {
    for (const t of TABELLEN) {
      await db.table(t).clear();
      const rows = backup.daten[t] ?? [];
      if (rows.length) await db.table(t).bulkPut(rows);
    }
  });
  await setMeta('letztesBackup', letztes ?? new Date().toISOString());
}

/** Erster Start oder seit 30 Tagen weder gesichert noch den Hinweis weggeklickt */
export async function backupHinweisFaellig(): Promise<boolean> {
  const zeitpunkte = [await getMeta('letztesBackup'), await getMeta('backupHinweisGesehen')]
    .filter(Boolean)
    .map((d) => new Date(d!).getTime());
  if (!zeitpunkte.length) return true;
  return (Date.now() - Math.max(...zeitpunkte)) / 86_400_000 >= 30;
}

export async function backupHinweisSpaeter() {
  await setMeta('backupHinweisGesehen', new Date().toISOString());
}
