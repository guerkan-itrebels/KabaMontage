import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { parseZahl, zahlEingabe } from '../lib/format';
import { IconX, IconZurueck } from './icons';
import { zurueck } from './router';

/* ---------- Buttons ---------- */

type Variante = 'primaer' | 'sekundaer' | 'gefahr' | 'leise';

const VARIANTEN: Record<Variante, string> = {
  primaer: 'bg-akzent text-auf-akzent hover:bg-akzent-hover font-bold shadow-sm',
  sekundaer: 'bg-karte text-text border-2 border-rand hover:border-leise font-semibold',
  gefahr: 'bg-karte text-gefahr border-2 border-gefahr/60 hover:bg-gefahr/10 font-semibold',
  leise: 'text-text hover:bg-karte-2 font-semibold',
};

export function Button({
  variante = 'sekundaer',
  gross,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; gross?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 transition-colors disabled:opacity-40 disabled:pointer-events-none select-none ${
        gross ? 'min-h-14 text-lg' : 'min-h-12'
      } ${VARIANTEN[variante]} ${className}`}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl text-leise hover:text-text hover:bg-karte-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Layout ---------- */

export function Seite({
  titel,
  zurueckZu,
  aktionen,
  children,
}: {
  titel: string;
  zurueckZu?: string;
  aktionen?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8">
      <header className="flex items-center gap-2 py-4">
        {zurueckZu !== undefined && (
          <IconButton label="Zurück" onClick={() => zurueck(zurueckZu)} className="-ml-2 text-text">
            <IconZurueck />
          </IconButton>
        )}
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight truncate">{titel}</h1>
        {aktionen}
      </header>
      {children}
    </div>
  );
}

export function Karte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-karte border border-rand/70 p-4 ${className}`}>{children}</section>;
}

export function Abschnitt({ titel, children, rechts }: { titel: string; children: ReactNode; rechts?: ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-end justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-leise">{titel}</h2>
        {rechts}
      </div>
      {children}
    </div>
  );
}

export function Hinweis({ children, art = 'warn' }: { children: ReactNode; art?: 'warn' | 'fehler' | 'info' }) {
  const cls =
    art === 'fehler'
      ? 'bg-gefahr/10 text-gefahr border-gefahr/40'
      : art === 'info'
        ? 'bg-karte-2 text-text border-rand'
        : 'bg-warn-bg text-warn-text border-akzent/50';
  return <div className={`rounded-xl border-2 px-4 py-3 ${cls}`}>{children}</div>;
}

export function Leer({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-rand p-6 text-center text-leise">{children}</p>;
}

/* ---------- Formularfelder ---------- */

const EINGABE =
  'w-full min-h-12 rounded-xl border-2 border-rand bg-karte px-3 text-text placeholder:text-leise/70 focus:border-akzent focus:outline-none';

export function Feld({
  label,
  fehler,
  hilfe,
  children,
  className = '',
}: {
  label: string;
  fehler?: string;
  hilfe?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-leise">
        {label}
      </label>
      {children(id)}
      {fehler ? (
        <p className="mt-1 text-sm font-semibold text-gefahr">{fehler}</p>
      ) : hilfe ? (
        <p className="mt-1 text-sm text-leise">{hilfe}</p>
      ) : null}
    </div>
  );
}

export function TextFeld({
  label,
  wert,
  onWert,
  fehler,
  hilfe,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  label: string;
  wert: string | undefined;
  onWert: (v: string) => void;
  fehler?: string;
  hilfe?: string;
}) {
  return (
    <Feld label={label} fehler={fehler} hilfe={hilfe} className={className}>
      {(id) => (
        <input id={id} className={`${EINGABE} ${fehler ? 'border-gefahr' : ''}`} value={wert ?? ''}
          onChange={(e) => onWert(e.target.value)} {...rest} />
      )}
    </Feld>
  );
}

export function TextBereich({
  label,
  wert,
  onWert,
  zeilen = 3,
  className,
  placeholder,
  disabled,
}: {
  label: string;
  wert: string;
  onWert: (v: string) => void;
  zeilen?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Feld label={label} className={className}>
      {(id) => (
        <textarea id={id} rows={zeilen} className={`${EINGABE} py-2 leading-snug`} value={wert}
          placeholder={placeholder} disabled={disabled} onChange={(e) => onWert(e.target.value)} />
      )}
    </Feld>
  );
}

/**
 * Zahlenfeld mit numerischer Tastatur. Hält den Eingabetext lokal,
 * damit "12," beim Tippen nicht sofort weggeparst wird.
 */
export function ZahlFeld({
  label,
  wert,
  onWert,
  einheit,
  fehler,
  hilfe,
  className,
  min,
  ganzzahl,
  placeholder,
  autoFocus,
}: {
  label: string;
  wert: number | undefined;
  onWert: (v: number | undefined) => void;
  einheit?: string;
  fehler?: string;
  hilfe?: string;
  className?: string;
  min?: number;
  ganzzahl?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(zahlEingabe(wert));
  const [lokalerFehler, setLokalerFehler] = useState<string>();
  const fokus = useRef(false);

  useEffect(() => {
    if (!fokus.current) setText(zahlEingabe(wert));
  }, [wert]);

  const uebernehmen = (t: string) => {
    setText(t);
    if (t.trim() === '') {
      setLokalerFehler(undefined);
      onWert(undefined);
      return;
    }
    const n = parseZahl(t);
    if (Number.isNaN(n)) return setLokalerFehler('Bitte nur Zahlen eingeben, z. B. 12,5');
    if (min !== undefined && n < min) return setLokalerFehler(`Mindestens ${zahlEingabe(min)}`);
    if (ganzzahl && !Number.isInteger(n)) return setLokalerFehler('Bitte eine ganze Zahl eingeben');
    setLokalerFehler(undefined);
    onWert(n);
  };

  const f = lokalerFehler ?? fehler;
  return (
    <Feld label={label} fehler={f} hilfe={hilfe} className={className}>
      {(id) => (
        <div className="relative">
          <input
            id={id}
            inputMode={ganzzahl ? 'numeric' : 'decimal'}
            autoComplete="off"
            enterKeyHint="done"
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`${EINGABE} zahlen text-right ${einheit ? 'pr-12' : ''} ${f ? 'border-gefahr' : ''}`}
            value={text}
            onFocus={(e) => {
              fokus.current = true;
              e.target.select();
            }}
            onBlur={() => {
              fokus.current = false;
              if (!lokalerFehler) setText(zahlEingabe(wert));
            }}
            onChange={(e) => uebernehmen(e.target.value)}
          />
          {einheit && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-leise font-semibold">
              {einheit}
            </span>
          )}
        </div>
      )}
    </Feld>
  );
}

export function Auswahl<T extends string | number>({
  label,
  wert,
  onWert,
  optionen,
  className,
}: {
  label: string;
  wert: T;
  onWert: (v: T) => void;
  optionen: { wert: T; text: string }[];
  className?: string;
}) {
  return (
    <Feld label={label} className={className}>
      {(id) => (
        <select id={id} className={`${EINGABE} pr-8`} value={String(wert)}
          onChange={(e) => {
            const o = optionen.find((x) => String(x.wert) === e.target.value);
            if (o) onWert(o.wert);
          }}>
          {optionen.map((o) => (
            <option key={String(o.wert)} value={String(o.wert)}>{o.text}</option>
          ))}
        </select>
      )}
    </Feld>
  );
}

export function Schalter({
  label,
  beschreibung,
  an,
  onAn,
  disabled,
}: {
  label: string;
  beschreibung?: ReactNode;
  an: boolean;
  onAn: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={an} disabled={disabled} onClick={() => onAn(!an)}
      className="flex w-full min-h-12 items-center gap-3 rounded-xl py-2 text-left disabled:opacity-50">
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        {beschreibung && <span className="block text-sm text-leise">{beschreibung}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${an ? 'bg-akzent' : 'bg-rand'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${an ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  );
}

export function Chips<T extends string>({
  optionen,
  wert,
  onWert,
}: {
  optionen: { wert: T; text: string }[];
  wert: T | undefined;
  onWert: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {optionen.map((o) => (
        <button key={o.wert} type="button" onClick={() => onWert(o.wert)}
          className={`min-h-11 rounded-full border-2 px-4 font-semibold ${
            wert === o.wert ? 'border-akzent bg-akzent text-auf-akzent' : 'border-rand bg-karte text-text'
          }`}>
          {o.text}
        </button>
      ))}
    </div>
  );
}

/* ---------- Dialog ---------- */

export function Dialog({
  offen,
  titel,
  onSchliessen,
  children,
  fuss,
}: {
  offen: boolean;
  titel: string;
  onSchliessen: () => void;
  children: ReactNode;
  fuss?: ReactNode;
}) {
  useEffect(() => {
    if (!offen) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen();
    window.addEventListener('keydown', k);
    const alt = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = alt;
    };
  }, [offen, onSchliessen]);
  if (!offen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onSchliessen()}>
      <div role="dialog" aria-modal="true" aria-label={titel}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-bg sm:max-w-lg sm:rounded-3xl shadow-2xl">
        <div className="flex items-center gap-2 border-b border-rand px-4 py-2">
          <h2 className="flex-1 text-xl font-extrabold">{titel}</h2>
          <IconButton label="Schließen" onClick={onSchliessen}><IconX /></IconButton>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {fuss && <div className="sicher-unten border-t border-rand px-4 py-3">{fuss}</div>}
      </div>
    </div>
  );
}

/* ---------- Bestätigen ---------- */

type Frage = { titel: string; text: ReactNode; ja: string; gefahr?: boolean; resolve: (b: boolean) => void };
let frage: Frage | null = null;
const frageHoerer = new Set<() => void>();
const frageSetzen = (f: Frage | null) => {
  frage = f;
  frageHoerer.forEach((h) => h());
};

export function bestaetigen(titel: string, text: ReactNode, ja = 'Ja', gefahr = false): Promise<boolean> {
  return new Promise((resolve) => frageSetzen({ titel, text, ja, gefahr, resolve }));
}

export function BestaetigenHost() {
  const f = useSyncExternalStore(
    (h) => (frageHoerer.add(h), () => frageHoerer.delete(h)),
    () => frage,
  );
  const antwort = (b: boolean) => {
    f?.resolve(b);
    frageSetzen(null);
  };
  return (
    <Dialog offen={!!f} titel={f?.titel ?? ''} onSchliessen={() => antwort(false)}
      fuss={
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => antwort(false)}>Abbrechen</Button>
          <Button className="flex-1" variante={f?.gefahr ? 'gefahr' : 'primaer'} onClick={() => antwort(true)}>{f?.ja}</Button>
        </div>
      }>
      <div className="text-lg">{f?.text}</div>
    </Dialog>
  );
}

/* ---------- Toast mit Rückgängig ---------- */

type Toast = { id: number; text: string; aktion?: { text: string; fn: () => void }; art?: 'ok' | 'fehler' };
let toasts: Toast[] = [];
const toastHoerer = new Set<() => void>();
let toastZaehler = 0;

export function meldung(text: string, opt: Omit<Toast, 'id' | 'text'> = {}) {
  const t = { id: ++toastZaehler, text, ...opt };
  toasts = [...toasts.slice(-2), t];
  toastHoerer.forEach((h) => h());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastHoerer.forEach((h) => h());
  }, opt.aktion ? 7000 : 3500);
}

export function ToastHost() {
  const liste = useSyncExternalStore(
    (h) => (toastHoerer.add(h), () => toastHoerer.delete(h)),
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {liste.map((t) => (
        <div key={t.id} role="status"
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-xl ${
            t.art === 'fehler' ? 'bg-gefahr text-white' : 'bg-marke text-white'
          }`}>
          <span className="flex-1 font-semibold">{t.text}</span>
          {t.aktion && (
            <button type="button" className="min-h-11 rounded-lg px-3 font-bold text-akzent"
              onClick={() => {
                t.aktion!.fn();
                toasts = toasts.filter((x) => x.id !== t.id);
                toastHoerer.forEach((h) => h());
              }}>
              {t.aktion.text}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Status-Badge ---------- */

export function Badge({ children, farbe = 'neutral' }: { children: ReactNode; farbe?: 'neutral' | 'ok' | 'warn' | 'gefahr' | 'akzent' }) {
  const cls = {
    neutral: 'bg-karte-2 text-leise border-rand',
    ok: 'bg-ok/15 text-ok border-ok/40',
    warn: 'bg-warn-bg text-warn-text border-akzent/50',
    gefahr: 'bg-gefahr/12 text-gefahr border-gefahr/40',
    akzent: 'bg-akzent text-auf-akzent border-akzent',
  }[farbe];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}
