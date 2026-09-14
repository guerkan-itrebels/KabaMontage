import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  angebotZuRechnung, duplizieren, entwurfLoeschen, festschreiben, nummerVorschau, setzeBezahlt, speichereEntwurf, stornieren,
} from '../db/belege';
import { db, neueId } from '../db/db';
import { belegSummen, mitAktuellerSteuer } from '../lib/berechnung';
import { datum, euro, heute, plusTage } from '../lib/format';
import { belegHinweise, belegTitel, faelligAm, zahlungsText } from '../lib/texte';
import type { Beleg, Kunde, Position } from '../lib/typen';

// jsPDF ist groß – erst bei Bedarf laden (wird vom Service Worker trotzdem offline vorgehalten)
const pdfModul = () => import('../pdf/belegPdf');
import { useFirma } from '../ui/hooks';
import { IconBeleg, IconKopie, IconPlus, IconStift, IconTeilen, IconZurueck } from '../ui/icons';
import { geheZu, zurueck } from '../ui/router';
import {
  Abschnitt, bestaetigen, Button, Hinweis, IconButton, Karte, Leer, meldung, Schalter, TextBereich, TextFeld, ZahlFeld,
} from '../ui/ui';
import { KundenAuswahl, PositionHinzufuegen } from './editor/Dialoge';
import { PositionKarte } from './editor/PositionKarte';
import { StatusBadge } from './gemeinsam';

export function BelegEditor({ id }: { id: string }) {
  const firma = useFirma();
  const [b, setB] = useState<Beleg | null | undefined>(undefined);
  const kunde = useLiveQuery(() => (b?.kundeId ? db.kunden.get(b.kundeId) : undefined), [b?.kundeId]);
  const [offenePos, setOffenePos] = useState<string | null>(null);
  const [kundeWahl, setKundeWahl] = useState(false);
  const [hinzu, setHinzu] = useState(false);
  const [fehler, setFehler] = useState<string[]>([]);
  const [summeDetails, setSummeDetails] = useState(false);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [ziehId, setZiehId] = useState<string | null>(null);
  const [zeitraum, setZeitraum] = useState(false);

  const aktuell = useRef<Beleg | null>(null);
  const ungespeichert = useRef(false);
  const posRefs = useRef(new Map<string, HTMLDivElement>());

  const laden = useCallback(async () => {
    const x = await db.belege.get(id);
    aktuell.current = x ?? null;
    setB(x ?? null);
    if (x?.leistungsdatumBis) setZeitraum(true);
  }, [id]);

  useEffect(() => { laden(); }, [laden]);

  const gesperrt = !!b && b.typ === 'rechnung' && b.status !== 'entwurf';

  // Autosave (verzögert) + beim Verlassen sofort speichern; leere Entwürfe verwerfen
  useEffect(() => {
    if (!b || gesperrt || !ungespeichert.current) return;
    const t = setTimeout(() => {
      ungespeichert.current = false;
      speichereEntwurf(b);
    }, 400);
    return () => clearTimeout(t);
  }, [b, gesperrt]);

  useEffect(() => () => {
    const x = aktuell.current;
    if (!x || x.status !== 'entwurf') {
      if (x && ungespeichert.current) speichereEntwurf(x);
      return;
    }
    if (!x.positionen.length && !x.kundeId) entwurfLoeschen(x.id);
    else if (ungespeichert.current) speichereEntwurf(x);
  }, []);

  const aendern = (f: (x: Beleg) => Beleg) => {
    setB((alt) => {
      if (!alt) return alt;
      const neu = f(alt);
      aktuell.current = neu;
      ungespeichert.current = true;
      return neu;
    });
    setFehler([]);
  };
  const setPositionen = (f: (p: Position[]) => Position[]) => aendern((x) => ({ ...x, positionen: f(x.positionen) }));

  // Kleinunternehmer-Einstellung auf änderbare Belege übertragen (auch nachträglich umgeschaltet)
  useEffect(() => {
    if (!b || !firma) return;
    if (mitAktuellerSteuer(b, firma.kleinunternehmer) !== b) {
      aendern((x) => mitAktuellerSteuer(x, firma.kleinunternehmer));
    }
  }, [b, firma?.kleinunternehmer]);

  if (b === undefined || !firma) return null;
  if (b === null) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Leer>Dieser Beleg existiert nicht (mehr).</Leer>
        <Button className="mt-4" onClick={() => geheZu('/belege', true)}>Zu den Belegen</Button>
      </div>
    );
  }

  const s = belegSummen(b);
  const modus = { kleinunternehmer: b.kleinunternehmer, reverseCharge: b.reverseCharge };
  const zeigeSteuer = !b.kleinunternehmer && !b.reverseCharge;
  const titel = belegTitel(b);
  const hinweise = belegHinweise(b, kunde, s);

  /* ---------- Aktionen ---------- */

  const sofortSpeichern = async () => {
    if (ungespeichert.current && aktuell.current) {
      ungespeichert.current = false;
      await speichereEntwurf(aktuell.current);
    }
  };

  const fertigstellen = async () => {
    await sofortSpeichern();
    const nr = await nummerVorschau(b.typ, b.datum);
    const text = b.typ === 'rechnung'
      ? <>Die Rechnung bekommt die Nummer <b>{nr}</b>.<br /><br />Danach kann sie <b>nicht mehr geändert</b> werden (gesetzliche Vorgabe). Fehler lassen sich nur noch per Storno korrigieren.</>
      : <>Das Angebot bekommt die Nummer <b>{nr}</b>. Sie können es danach weiterhin anpassen.</>;
    if (!(await bestaetigen(`${titel} fertigstellen?`, text, 'Fertigstellen'))) return;
    setBeschaeftigt(true);
    const r = await festschreiben(b.id);
    setBeschaeftigt(false);
    if (!r.ok) {
      setFehler(r.fehler);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    ungespeichert.current = false;
    await laden();
    meldung(`${titel} ${r.nummer} ist fertig – jetzt teilen`, { art: 'ok' });
  };

  const pdfTeilen = async () => {
    await sofortSpeichern();
    setBeschaeftigt(true);
    try {
      const x = (await db.belege.get(b.id))!;
      const r = await (await pdfModul()).belegPdfTeilen(x, kunde, firma);
      if (r === 'heruntergeladen') meldung('PDF wurde heruntergeladen');
    } catch (e) {
      meldung(`PDF konnte nicht erstellt werden: ${(e as Error).message}`, { art: 'fehler' });
    } finally {
      setBeschaeftigt(false);
    }
  };

  const pdfAnsehen = async () => {
    await sofortSpeichern();
    try {
      await (await pdfModul()).belegPdfOeffnen((await db.belege.get(b.id))!, kunde, firma);
    } catch (e) {
      meldung(`PDF konnte nicht erstellt werden: ${(e as Error).message}`, { art: 'fehler' });
    }
  };

  const kundeGewaehlt = (k: Kunde) => {
    aendern((x) => ({
      ...x,
      kundeId: k.id,
      reverseCharge: x.kleinunternehmer ? false : firma.bauleistung13b && k.istUnternehmen,
    }));
    setKundeWahl(false);
  };

  const positionLoeschen = (p: Position) => {
    const index = b.positionen.findIndex((x) => x.id === p.id);
    setPositionen((ps) => ps.filter((x) => x.id !== p.id));
    meldung('Position gelöscht', {
      aktion: {
        text: 'Rückgängig',
        fn: () => setPositionen((ps) => [...ps.slice(0, index), p, ...ps.slice(index)]),
      },
    });
  };

  const alsVorlage = async (p: Position) => {
    if (!p.bezeichnung.trim()) return meldung('Bitte zuerst eine Bezeichnung eingeben', { art: 'fehler' });
    await db.vorlagen.put({ id: neueId(), bezeichnung: p.bezeichnung.trim(), einheit: p.einheit, einzelpreis: p.einzelpreis, steuersatz: p.steuersatz, istArbeitsleistung: p.istArbeitsleistung });
    meldung('Als Vorlage gespeichert', { art: 'ok' });
  };

  /* ---------- Drag & Drop (Touch + Maus) ---------- */
  const griffProps = (p: Position): React.HTMLAttributes<HTMLButtonElement> => ({
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setZiehId(p.id);
      setOffenePos(null);
    },
    onPointerMove: (e) => {
      if (ziehId !== p.id) return;
      const y = e.clientY;
      const ps = aktuell.current?.positionen ?? [];
      const von = ps.findIndex((x) => x.id === p.id);
      let nach = von;
      ps.forEach((x, i) => {
        const el = posRefs.current.get(x.id);
        if (!el || x.id === p.id) return;
        const r = el.getBoundingClientRect();
        if (i < von && y < r.top + r.height / 2) nach = Math.min(nach, i);
        if (i > von && y > r.top + r.height / 2) nach = Math.max(nach, i);
      });
      if (nach !== von) {
        setPositionen((alt) => {
          const neu = [...alt];
          const [el] = neu.splice(von, 1);
          neu.splice(nach, 0, el);
          return neu;
        });
      }
      if (y < 80) window.scrollBy(0, -12);
      if (y > window.innerHeight - 160) window.scrollBy(0, 12);
    },
    onPointerUp: () => setZiehId(null),
    onPointerCancel: () => setZiehId(null),
    onKeyDown: (e) => {
      const i = b.positionen.findIndex((x) => x.id === p.id);
      const ziel = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
      if (ziel < 0 || ziel >= b.positionen.length) return;
      e.preventDefault();
      setPositionen((alt) => {
        const neu = [...alt];
        [neu[i], neu[ziel]] = [neu[ziel], neu[i]];
        return neu;
      });
    },
  });

  /* ---------- Darstellung ---------- */

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-72">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-bg/95 px-4 py-3 backdrop-blur sicher-oben">
        <IconButton label="Zurück" className="-ml-2 text-text" onClick={async () => { await sofortSpeichern(); zurueck('/belege'); }}>
          <IconZurueck />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{titel} {b.nummer}</h1>
          <div className="flex items-center gap-2 text-sm text-leise">
            <StatusBadge beleg={b} />
            {!gesperrt && <span>Wird automatisch gespeichert</span>}
          </div>
        </div>
      </header>

      {fehler.length > 0 && (
        <div className="mb-4">
          <Hinweis art="fehler">
            <p className="font-bold">Bitte noch ergänzen:</p>
            <ul className="list-disc pl-5">{fehler.map((f) => <li key={f}>{f}</li>)}</ul>
            {fehler.some((f) => /Firmen|Steuernummer|IBAN/.test(f)) && (
              <Button className="mt-2" onClick={() => geheZu('/einstellungen')}>Firmendaten öffnen</Button>
            )}
          </Hinweis>
        </div>
      )}

      {gesperrt && (
        <div className="mb-4">
          <Hinweis art="info">
            {b.stornoVonId
              ? <>Stornorechnung zu <b>{b.stornoVonNummer}</b>. Festgeschrieben am {datum(b.festgeschriebenAm)}.</>
              : b.storniertDurchId
                ? <>Diese Rechnung wurde storniert.</>
                : <>Festgeschrieben am {datum(b.festgeschriebenAm)} – Inhalt kann nicht mehr geändert werden. {b.status === 'bezahlt' ? `Bezahlt am ${datum(b.bezahltAm)}.` : `Fällig am ${datum(faelligAm(b))}.`}</>}
          </Hinweis>
        </div>
      )}

      {/* Kunde */}
      <Karte>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-wider text-leise">Kunde</p>
            {kunde ? (
              <>
                <p className="text-lg font-bold">{kunde.name}</p>
                <p className="text-leise">{kunde.strasse}, {kunde.plz} {kunde.ort} · {kunde.istUnternehmen ? 'Firma' : 'Privatkunde'}</p>
              </>
            ) : <p className="text-lg text-leise">Noch kein Kunde gewählt</p>}
          </div>
          {!gesperrt && (
            <Button variante={kunde ? 'sekundaer' : 'primaer'} onClick={() => setKundeWahl(true)}>
              {kunde ? <><IconStift /> Ändern</> : 'Wählen'}
            </Button>
          )}
        </div>
      </Karte>

      {/* Kopfdaten */}
      {!gesperrt && (
        <Karte className="mt-3 grid grid-cols-1 gap-3">
          <TextFeld label="Baustelle / Leistungsort (falls abweichend)" wert={b.baustelle}
            onWert={(v) => aendern((x) => ({ ...x, baustelle: v }))} placeholder="z. B. Musterstraße 4, 2. OG" />
          <div className="grid grid-cols-2 gap-3">
            <TextFeld label={b.typ === 'rechnung' ? 'Rechnungsdatum' : 'Angebotsdatum'} type="date" wert={b.datum}
              onWert={(v) => aendern((x) => ({ ...x, datum: v }))} />
            <TextFeld label={zeitraum ? 'Leistung von' : b.typ === 'rechnung' ? 'Leistungsdatum' : 'Ausführung ca.'} type="date" wert={b.leistungsdatum}
              onWert={(v) => aendern((x) => ({ ...x, leistungsdatum: v }))} />
          </div>
          {zeitraum && (
            <div className="grid grid-cols-2 gap-3">
              <div />
              <TextFeld label="Leistung bis" type="date" wert={b.leistungsdatumBis}
                onWert={(v) => aendern((x) => ({ ...x, leistungsdatumBis: v || undefined }))} />
            </div>
          )}
          <Schalter label="Leistung über mehrere Tage" an={zeitraum}
            onAn={(v) => { setZeitraum(v); if (!v) aendern((x) => ({ ...x, leistungsdatumBis: undefined })); else aendern((x) => ({ ...x, leistungsdatumBis: x.leistungsdatumBis ?? x.leistungsdatum })); }} />
          {firma.bauleistung13b && !b.kleinunternehmer && (
            <Schalter label="Bauleistung nach § 13b UStG" an={b.reverseCharge}
              onAn={(v) => aendern((x) => ({ ...x, reverseCharge: v }))}
              beschreibung={kunde && !kunde.istUnternehmen ? 'Nur bei Firmenkunden (Bauunternehmen) möglich.' : 'Kunde schuldet die Umsatzsteuer – Rechnung ohne MwSt.'} />
          )}
        </Karte>
      )}

      {/* Positionen */}
      <Abschnitt titel={`Positionen (${b.positionen.length})`}>
        <div className="grid grid-cols-1 gap-2">
          {b.positionen.map((p, i) => (
            <div key={p.id} className="min-w-0" ref={(el) => { if (el) posRefs.current.set(p.id, el); else posRefs.current.delete(p.id); }}>
              <PositionKarte
                p={p} nr={i + 1} offen={offenePos === p.id} gesperrt={gesperrt} modus={modus}
                stundensaetze={firma.stundensaetze} zeigeSteuer={zeigeSteuer} zieht={ziehId === p.id}
                onToggle={() => setOffenePos(offenePos === p.id ? null : p.id)}
                onChange={(np) => setPositionen((ps) => ps.map((x) => (x.id === p.id ? np : x)))}
                onDuplizieren={() => {
                  const kopie = { ...p, id: neueId(), zeiteintragIds: undefined };
                  setPositionen((ps) => [...ps.slice(0, i + 1), kopie, ...ps.slice(i + 1)]);
                  setOffenePos(kopie.id);
                }}
                onLoeschen={() => positionLoeschen(p)}
                onVorlage={() => alsVorlage(p)}
                griffProps={griffProps(p)}
              />
            </div>
          ))}
          {b.positionen.length === 0 && <Leer>Noch keine Positionen.</Leer>}
          {!gesperrt && (
            <Button variante={b.positionen.length ? 'sekundaer' : 'primaer'} gross className="border-dashed" onClick={() => setHinzu(true)}>
              <IconPlus /> Position hinzufügen
            </Button>
          )}
        </div>
      </Abschnitt>

      {/* Zahlung + Texte */}
      {!gesperrt && (
        <Abschnitt titel="Zahlung & Texte">
          <Karte className="grid grid-cols-1 gap-3">
            {b.typ === 'rechnung' && (
              <div className="grid grid-cols-3 gap-3">
                <ZahlFeld label="Zahlungsziel" einheit="Tage" ganzzahl min={0} wert={b.zahlungszielTage}
                  onWert={(v) => aendern((x) => ({ ...x, zahlungszielTage: v ?? 0 }))} />
                <ZahlFeld label="Skonto" einheit="%" min={0} wert={b.skonto?.prozent}
                  onWert={(v) => aendern((x) => ({ ...x, skonto: v ? { prozent: v, tage: x.skonto?.tage || 7 } : undefined }))} />
                <ZahlFeld label="Skonto bis" einheit="Tage" ganzzahl min={0} wert={b.skonto?.tage}
                  onWert={(v) => aendern((x) => ({ ...x, skonto: x.skonto ? { ...x.skonto, tage: v ?? 0 } : undefined }))} />
              </div>
            )}
            <p className="rounded-xl bg-karte-2 p-3 text-sm">{zahlungsText(b, s)}</p>
            <TextBereich label="Einleitungstext" wert={b.einleitungstext} onWert={(v) => aendern((x) => ({ ...x, einleitungstext: v }))} />
            <TextBereich label="Schlusstext" wert={b.schlusstext} onWert={(v) => aendern((x) => ({ ...x, schlusstext: v }))} zeilen={2} />
          </Karte>
        </Abschnitt>
      )}

      {hinweise.length > 0 && (
        <Abschnitt titel="Hinweise auf dem Beleg (automatisch)">
          <Karte className="grid grid-cols-1 gap-2 text-sm">
            {hinweise.map((h) => <p key={h}>{h}</p>)}
          </Karte>
        </Abschnitt>
      )}

      {/* Weitere Aktionen */}
      <Abschnitt titel="Weitere Aktionen">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={pdfAnsehen}><IconBeleg /> PDF ansehen{b.status === 'entwurf' ? ' (Vorschau)' : ''}</Button>
          {b.typ === 'angebot' && b.positionen.length > 0 && (
            b.inRechnungId
              ? <Button onClick={() => geheZu(`/beleg/${b.inRechnungId}`)}>Zur Rechnung</Button>
              : <Button onClick={async () => { await sofortSpeichern(); geheZu(`/beleg/${await angebotZuRechnung(b.id)}`); }}>In Rechnung umwandeln</Button>
          )}
          {b.status !== 'entwurf' && (
            <Button onClick={async () => { const nid = await duplizieren(b.id); meldung('Kopie als neuer Entwurf angelegt'); geheZu(`/beleg/${nid}`); }}>
              <IconKopie /> Als Vorlage für neuen Beleg
            </Button>
          )}
          {b.typ === 'rechnung' && gesperrt && !b.stornoVonId && b.status !== 'storniert' && (
            b.status === 'bezahlt'
              ? <Button onClick={async () => { await setzeBezahlt(b.id, undefined); await laden(); }}>Als unbezahlt markieren</Button>
              : <Button variante="primaer" onClick={async () => { await setzeBezahlt(b.id, heute()); await laden(); meldung('Als bezahlt markiert', { art: 'ok' }); }}>Als bezahlt markieren</Button>
          )}
          {b.typ === 'rechnung' && gesperrt && !b.stornoVonId && !b.storniertDurchId && (
            <Button variante="gefahr" onClick={async () => {
              if (!(await bestaetigen('Rechnung stornieren?', <>Es wird eine <b>Stornorechnung</b> mit negativen Beträgen erzeugt, die auf {b.nummer} verweist. Das kann nicht rückgängig gemacht werden.</>, 'Stornieren', true))) return;
              try {
                const sid = await stornieren(b.id);
                meldung('Stornorechnung erstellt');
                geheZu(`/beleg/${sid}`, true);
              } catch (e) { meldung((e as Error).message, { art: 'fehler' }); }
            }}>Stornieren</Button>
          )}
          {b.storniertDurchId && <Button onClick={() => geheZu(`/beleg/${b.storniertDurchId}`)}>Zur Stornorechnung</Button>}
          {b.stornoVonId && <Button onClick={() => geheZu(`/beleg/${b.stornoVonId}`)}>Zur Originalrechnung</Button>}
          {b.status === 'entwurf' && (
            <Button variante="gefahr" onClick={async () => {
              if (!(await bestaetigen('Entwurf löschen?', 'Der Entwurf wird endgültig gelöscht.', 'Löschen', true))) return;
              aktuell.current = null;
              await entwurfLoeschen(b.id);
              meldung('Entwurf gelöscht');
              geheZu('/belege', true);
            }}>Entwurf löschen</Button>
          )}
        </div>
      </Abschnitt>

      {/* Summenleiste */}
      <div className="sicher-unten fixed inset-x-0 bottom-0 z-40 border-t-2 border-akzent bg-marke text-white lg:left-60">
        <div className="mx-auto max-w-3xl px-4 pt-2 pb-3">
          <button type="button" className="w-full text-left" onClick={() => setSummeDetails(!summeDetails)} aria-expanded={summeDetails}>
            {summeDetails && (
              <div className="zahlen mb-2 grid grid-cols-1 gap-0.5 border-b border-white/15 pb-2 text-[15px]">
                {s.rabattCent !== 0 && <>
                  <Zeile k="Zwischensumme" v={euro(s.zwischensummeCent)} />
                  <Zeile k="Rabatt" v={euro(-s.rabattCent)} />
                </>}
                <Zeile k="Netto" v={euro(s.nettoCent)} />
                {b.kleinunternehmer ? <Zeile k="Keine MwSt (§ 19 UStG)" v="" /> : s.steuern.map((st) => (
                  <Zeile key={st.satz} k={b.reverseCharge ? 'MwSt 0 % (§ 13b)' : `MwSt ${st.satz} % auf ${euro(st.nettoCent)}`} v={euro(st.steuerCent)} />
                ))}
                {kunde && !kunde.istUnternehmen && s.arbeitskostenBruttoCent > 0 && (
                  <Zeile k="davon Arbeitskosten § 35a" v={euro(s.arbeitskostenBruttoCent)} />
                )}
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white/75">{summeDetails ? 'Gesamt (brutto)' : 'Gesamt · Details antippen'}</span>
              <span className="zahlen text-2xl font-extrabold">{euro(s.bruttoCent)}</span>
            </div>
          </button>
          <div className="mt-2 flex gap-2">
            {b.status === 'entwurf' ? (
              <Button variante="primaer" gross className="flex-1" disabled={beschaeftigt} onClick={fertigstellen}>
                {b.typ === 'rechnung' ? 'Rechnung fertigstellen' : 'Angebot fertigstellen'}
              </Button>
            ) : (
              <Button variante="primaer" gross className="flex-1" disabled={beschaeftigt} onClick={pdfTeilen}>
                <IconTeilen /> {beschaeftigt ? 'PDF wird erstellt …' : 'PDF teilen / senden'}
              </Button>
            )}
          </div>
          {b.status === 'entwurf' && b.typ === 'rechnung' && b.zahlungszielTage > 0 && (
            <p className="mt-1 text-center text-xs text-white/60">Fällig bei heutigem Datum: {datum(plusTage(b.datum, b.zahlungszielTage))}</p>
          )}
        </div>
      </div>

      <KundenAuswahl offen={kundeWahl} onSchliessen={() => setKundeWahl(false)} onWahl={kundeGewaehlt} />
      <PositionHinzufuegen offen={hinzu} onSchliessen={() => setHinzu(false)} firma={firma} kundeId={b.kundeId}
        belegZeitIds={b.positionen.flatMap((p) => p.zeiteintragIds ?? [])}
        onHinzu={(neu, oeffnen) => {
          setPositionen((ps) => [...ps, ...neu]);
          if (oeffnen && neu[0]) {
            setOffenePos(neu[0].id);
            setTimeout(() => posRefs.current.get(neu[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
          }
        }} />
    </div>
  );
}

function Zeile({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/80">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
