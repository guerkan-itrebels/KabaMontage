import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { backupTeilen, leseBackupDatei, spieleBackupEin, type ImportVorschau } from '../db/backup';
import { db } from '../db/db';
import { datum } from '../lib/format';
import { IconSchild, IconTeilen } from '../ui/icons';
import { Abschnitt, Button, Dialog, Hinweis, Karte, meldung, Seite } from '../ui/ui';

export function Sichern() {
  const letztes = useLiveQuery(() => db.meta.get('letztesBackup'), []);
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  const [fehler, setFehler] = useState('');
  const datei = useRef<HTMLInputElement>(null);

  return (
    <Seite titel="Daten sichern" zurueckZu="/mehr">
      <Hinweis art="info">
        <div className="flex gap-3">
          <IconSchild className="shrink-0" />
          <p>Alle Kunden, Rechnungen und Zeiten liegen <b>nur auf diesem Gerät</b> – nichts wird ins Internet übertragen. Legen Sie deshalb regelmäßig eine Sicherung an und speichern Sie die Datei z. B. per Mail an sich selbst, in Google Drive oder iCloud.</p>
        </div>
      </Hinweis>

      <Abschnitt titel="Sicherung anlegen">
        <Karte>
          <p className="mb-3">Letzte Sicherung: <b>{letztes ? datum(letztes.wert.slice(0, 10)) : 'noch nie'}</b></p>
          <Button variante="primaer" gross className="w-full" onClick={async () => {
            const r = await backupTeilen();
            if (r !== 'abgebrochen') meldung('Sicherung erstellt', { art: 'ok' });
          }}>
            <IconTeilen /> Sicherung erstellen
          </Button>
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Sicherung zurückspielen">
        <Karte>
          <p className="mb-3 text-leise">Z. B. auf einem neuen Handy. Die Daten auf diesem Gerät werden dabei ersetzt.</p>
          <input ref={datei} type="file" accept="application/json,.json" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                setFehler('');
                setVorschau(await leseBackupDatei(f));
              } catch (err) {
                setFehler((err as Error).message);
              }
            }} />
          <Button gross className="w-full" onClick={() => datei.current?.click()}>Sicherungsdatei auswählen</Button>
          {fehler && <p className="mt-2 font-semibold text-gefahr">{fehler}</p>}
        </Karte>
      </Abschnitt>

      <Dialog offen={!!vorschau} titel="Sicherung zurückspielen?" onSchliessen={() => setVorschau(null)}
        fuss={
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setVorschau(null)}>Abbrechen</Button>
            <Button className="flex-1" variante="gefahr" onClick={async () => {
              await spieleBackupEin(vorschau!.backup);
              setVorschau(null);
              meldung('Sicherung wurde eingespielt', { art: 'ok' });
            }}>Ersetzen</Button>
          </div>
        }>
        {vorschau && (
          <div className="grid grid-cols-1 gap-3">
            <p>Sicherung vom <b>{datum(vorschau.backup.exportiertAm.slice(0, 10))}</b> enthält:</p>
            <ul className="grid grid-cols-2 gap-2">
              {[
                ['Kunden', vorschau.anzahl.kunden], ['Belege', vorschau.anzahl.belege],
                ['Vorlagen', vorschau.anzahl.vorlagen], ['Zeiten', vorschau.anzahl.zeiten],
              ].map(([k, n]) => (
                <li key={k} className="rounded-xl bg-karte p-3"><span className="block text-2xl font-extrabold">{n}</span>{k}</li>
              ))}
            </ul>
            <Hinweis>Alle aktuellen Daten auf diesem Gerät werden <b>durch die Sicherung ersetzt</b>.</Hinweis>
          </div>
        )}
      </Dialog>
    </Seite>
  );
}
