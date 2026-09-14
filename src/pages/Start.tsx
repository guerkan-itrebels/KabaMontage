import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { backupHinweisFaellig, backupHinweisSpaeter } from '../db/backup';
import { neuerBeleg } from '../db/belege';
import { db } from '../db/db';
import { belegSummen } from '../lib/berechnung';
import { euro, heute } from '../lib/format';
import { effektiverStatus } from '../lib/texte';
import { pruefeFirma } from '../lib/validierung';
import { useFirma } from '../ui/hooks';
import { IconBeleg, IconPlus, IconSchild, IconUhr } from '../ui/icons';
import { geheZu } from '../ui/router';
import { Abschnitt, Button, Hinweis, Karte, Leer } from '../ui/ui';
import { BelegZeile, offenerBetragCent } from './gemeinsam';

export function Start() {
  const firma = useFirma();
  const belege = useLiveQuery(() => db.belege.orderBy('geaendertAm').reverse().toArray(), []);
  const kunden = useLiveQuery(() => db.kunden.toArray(), []);
  const laufend = useLiveQuery(() => db.zeiten.filter((z) => z.laeuft).first(), []);
  const [backupHinweis, setBackupHinweis] = useState(false);

  useEffect(() => {
    backupHinweisFaellig().then(setBackupHinweis);
  }, []);

  const kundeVon = (id: string) => kunden?.find((k) => k.id === id);
  const t = heute();
  const ueberfaellig = (belege ?? []).filter((b) => effektiverStatus(b, t) === 'ueberfaellig');
  const offenCent = offenerBetragCent(belege ?? []);
  const ueberfaelligCent = ueberfaellig.reduce((s, b) => s + belegSummen(b).bruttoCent, 0);
  const firmaFehler = firma ? pruefeFirma(firma) : [];

  const neu = async (typ: 'rechnung' | 'angebot') => geheZu(`/beleg/${await neuerBeleg(typ)}`);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8">
      <header className="flex items-center justify-between py-4 lg:hidden">
        <div className="rounded-xl bg-white px-3 py-2">
          <img src="logo.svg" alt="KabaMontage" className="h-10" />
        </div>
      </header>
      <h1 className="mb-4 hidden text-2xl font-extrabold lg:block">Übersicht</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button variante="primaer" gross className="min-h-20 text-xl sm:col-span-3" onClick={() => neu('rechnung')}>
          <IconPlus width={28} height={28} /> Neue Rechnung
        </Button>
        <Button gross className="min-h-16" onClick={() => neu('angebot')}>
          <IconBeleg /> Neues Angebot
        </Button>
        <Button gross className="min-h-16 sm:col-span-2" onClick={() => geheZu('/zeiten')}>
          <IconUhr /> {laufend ? 'Uhr läuft – ansehen' : 'Zeit erfassen'}
        </Button>
      </div>

      {backupHinweis && (
        <div className="mt-4">
          <Hinweis>
            <div className="flex items-start gap-3">
              <IconSchild className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold">Denken Sie an eine Datensicherung</p>
                <p className="text-sm">Ihre Rechnungen liegen nur auf diesem Gerät. Geht das Handy verloren, sind sie weg. Eine Sicherung dauert 10 Sekunden.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variante="primaer" onClick={() => geheZu('/sichern')}>Jetzt sichern</Button>
                  <Button variante="leise" onClick={async () => { await backupHinweisSpaeter(); setBackupHinweis(false); }}>Später</Button>
                </div>
              </div>
            </div>
          </Hinweis>
        </div>
      )}

      {firma && firmaFehler.length > 0 && (
        <div className="mt-4">
          <Hinweis art="info">
            <p className="font-bold">Vor der ersten Rechnung: Firmendaten ergänzen</p>
            <ul className="mt-1 list-disc pl-5 text-sm">{firmaFehler.map((f) => <li key={f}>{f}</li>)}</ul>
            <Button className="mt-2" onClick={() => geheZu('/einstellungen')}>Zu den Einstellungen</Button>
          </Hinweis>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Karte>
          <p className="text-sm font-bold uppercase tracking-wide text-leise">Offen</p>
          <p className="zahlen mt-1 text-2xl font-extrabold">{euro(offenCent)}</p>
        </Karte>
        <Karte className={ueberfaellig.length ? 'border-gefahr/60' : ''}>
          <p className="text-sm font-bold uppercase tracking-wide text-leise">Überfällig</p>
          <p className={`zahlen mt-1 text-2xl font-extrabold ${ueberfaellig.length ? 'text-gefahr' : ''}`}>{euro(ueberfaelligCent)}</p>
          <p className="text-sm text-leise">{ueberfaellig.length} {ueberfaellig.length === 1 ? 'Rechnung' : 'Rechnungen'}</p>
        </Karte>
      </div>

      {ueberfaellig.length > 0 && (
        <Abschnitt titel="Überfällige Rechnungen">
          <Karte className="p-0 overflow-hidden">
            {ueberfaellig.map((b) => <BelegZeile key={b.id} beleg={b} kunde={kundeVon(b.kundeId)} />)}
          </Karte>
        </Abschnitt>
      )}

      <Abschnitt titel="Zuletzt bearbeitet" rechts={<a href="#/belege" className="font-semibold text-sm underline underline-offset-4">Alle Belege</a>}>
        {belege && belege.length === 0 ? (
          <Leer>
            Noch keine Belege. Tippen Sie oben auf „Neue Rechnung“.
          </Leer>
        ) : (
          <Karte className="p-0 overflow-hidden">
            {(belege ?? []).slice(0, 6).map((b) => <BelegZeile key={b.id} beleg={b} kunde={kundeVon(b.kundeId)} />)}
          </Karte>
        )}
      </Abschnitt>
    </div>
  );
}
