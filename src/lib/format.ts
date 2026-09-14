const euroFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const zahlFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });
const betragFmt = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123456 → "1.234,56 €" (mit geschütztem Leerzeichen durch Intl ersetzt durch normales) */
export function euro(cent: number): string {
  return euroFmt.format(cent / 100).replace(/ /g, ' ');
}

/** 123456 → "1.234,56" */
export function betrag(cent: number): string {
  return betragFmt.format(cent / 100);
}

export function zahl(n: number): string {
  return zahlFmt.format(n);
}

/** "2026-09-14" → "14.09.2026" */
export function datum(iso?: string): string {
  if (!iso) return '';
  const [j, m, t] = iso.slice(0, 10).split('-');
  if (!j || !m || !t) return iso;
  return `${t}.${m}.${j}`;
}

/** Heutiges Datum als YYYY-MM-DD in lokaler Zeit */
export function heute(): string {
  return isoDatum(new Date());
}

export function isoDatum(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function plusTage(iso: string, tage: number): string {
  const [j, m, t] = iso.split('-').map(Number);
  return isoDatum(new Date(j, m - 1, t + tage));
}

/** Deutsche Zahleneingabe ("1.234,5" oder "1234.5") → number. Ungültig → NaN */
export function parseZahl(text: string): number {
  const s = text.trim().replace(/\s/g, '');
  if (s === '') return NaN;
  let norm = s;
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d*\.?\d*$/.test(norm) || norm === '-' || norm === '.') return NaN;
  return Number(norm);
}

/** number → Eingabetext im deutschen Format ohne Tausenderpunkte */
export function zahlEingabe(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  return String(Number(n.toFixed(4))).replace('.', ',');
}

export function dauer(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = Math.round(minuten % 60);
  return `${h}:${String(m).padStart(2, '0')} Std.`;
}

export function dateinameSicher(s: string): string {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
