import { useEffect, useState } from 'react';

// Hash-Routing: funktioniert auf GitHub Pages und offline ohne Server-Konfiguration
const lesen = () => window.location.hash.replace(/^#/, '') || '/';

export function useRoute(): string {
  const [pfad, setPfad] = useState(lesen);
  useEffect(() => {
    const f = () => {
      setPfad(lesen());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return pfad;
}

export function geheZu(pfad: string, ersetzen = false) {
  if (ersetzen) {
    history.replaceState(null, '', `#${pfad}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = pfad;
  }
}

export function zurueck(fallback = '/') {
  if (history.length > 1) history.back();
  else geheZu(fallback);
}

/** "/beleg/abc" gegen "/beleg/:id" → { id: "abc" } */
export function passt(muster: string, pfad: string): Record<string, string> | null {
  const [p] = pfad.split('?');
  const a = muster.split('/');
  const b = p.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function queryParam(pfad: string, name: string): string | null {
  const q = pfad.split('?')[1];
  return q ? new URLSearchParams(q).get(name) : null;
}
