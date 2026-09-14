import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { standardFirma } from '../db/firma';
import type { Firmenprofil } from '../lib/typen';

export function useFirma(): Firmenprofil | undefined {
  return useLiveQuery(async () => {
    const f = await db.firma.get('firma');
    return f ? { ...standardFirma(), ...f } : standardFirma();
  });
}
