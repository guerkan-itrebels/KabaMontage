import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dateiAusgeben, herunterladen } from '../db/backup';
import { belegSummen, mitAktuellerSteuer } from '../lib/berechnung';
import { euroZuCent } from '../lib/geld';
import { betrag, dateinameSicher, datum, euro, zahl } from '../lib/format';
import { belegHinweise, belegTitel, leistungszeitraumText, zahlungsText } from '../lib/texte';
import { einheitKurz, type Beleg, type Firmenprofil, type Kunde } from '../lib/typen';

// DIN 5008, Form B (Maße in mm)
const RAND_LINKS = 25;
const RAND_RECHTS = 20;
const SEITE_B = 210;
const SEITE_H = 297;
const INHALT_B = SEITE_B - RAND_LINKS - RAND_RECHTS;
const FUSS_Y = 270;
const MARKE = [15, 28, 46] as const;
const GRAU = [90, 98, 110] as const;

let standardLogoCache: { daten: string; b: number; h: number } | null = null;

async function bildMasse(src: string): Promise<{ img: HTMLImageElement; b: number; h: number }> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return { img, b: img.naturalWidth || 900, h: img.naturalHeight || 340 };
}

/** Logo als PNG-Data-URL: hochgeladenes Logo oder mitgeliefertes SVG gerastert */
export async function ladeLogo(firma: Firmenprofil): Promise<{ daten: string; b: number; h: number } | null> {
  try {
    if (firma.logo) {
      const { b, h } = await bildMasse(firma.logo);
      return { daten: firma.logo, b, h };
    }
    if (standardLogoCache) return standardLogoCache;
    const { img, b, h } = await bildMasse(`${import.meta.env.BASE_URL}logo.svg`);
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = Math.round((1800 * h) / b);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    standardLogoCache = { daten: canvas.toDataURL('image/png'), b: canvas.width, h: canvas.height };
    return standardLogoCache;
  } catch {
    return null;
  }
}

export function pdfDateiname(b: Beleg, kunde?: Kunde): string {
  const k = kunde ?? b.kundeSnapshot;
  let name = k?.name ?? 'Kunde';
  if (k && !k.istUnternehmen) name = name.trim().split(/\s+/).pop() ?? name;
  const nr = b.nummer || 'Entwurf';
  return `${belegTitel(b)}_${nr}_${dateinameSicher(name) || 'Kunde'}.pdf`;
}

export async function erzeugeBelegPdf(belegRoh: Beleg, kundeAktuell: Kunde | undefined, firmaAktuell: Firmenprofil): Promise<Blob> {
  const beleg = mitAktuellerSteuer(belegRoh, firmaAktuell.kleinunternehmer);
  // Festgeschriebene Belege nutzen die eingefrorenen Daten
  const firma = beleg.firmaSnapshot ?? firmaAktuell;
  const kunde = beleg.kundeSnapshot ?? kundeAktuell;
  const s = belegSummen(beleg);
  const entwurf = beleg.status === 'entwurf';
  const titel = belegTitel(beleg);
  const ohneUst = beleg.kleinunternehmer;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `${titel} ${beleg.nummer}`, author: firma.firmenname, creator: 'KabaMontage App' });
  doc.setLineHeightFactor(1.3);

  const text = (t: string | string[], x: number, y: number, opt: { groesse?: number; fett?: boolean; farbe?: readonly number[]; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', opt.fett ? 'bold' : 'normal');
    doc.setFontSize(opt.groesse ?? 10);
    const f = opt.farbe ?? [20, 24, 30];
    doc.setTextColor(f[0], f[1], f[2]);
    doc.text(t, x, y, { align: opt.align ?? 'left' });
  };

  /* ---------- Briefkopf (Seite 1) ---------- */
  const logo = await ladeLogo(firma);
  if (logo) {
    const breite = 70;
    const hoehe = Math.min((breite * logo.h) / logo.b, 30);
    const b2 = (hoehe * logo.b) / logo.h;
    doc.addImage(logo.daten, logo.daten.startsWith('data:image/jp') ? 'JPEG' : 'PNG', SEITE_B - RAND_RECHTS - b2, 12, b2, hoehe, undefined, 'FAST');
  } else {
    text(firma.firmenname, SEITE_B - RAND_RECHTS, 25, { groesse: 20, fett: true, align: 'right', farbe: MARKE });
  }

  // Falt- und Lochmarken
  doc.setDrawColor(150);
  doc.setLineWidth(0.2);
  doc.line(3, 105, 8, 105);
  doc.line(3, 210, 8, 210);
  doc.line(3, 148.5, 10, 148.5);

  // Anschriftfeld (Form B: 45 mm von oben, 85 × 45 mm)
  const absender = [firma.firmenname, firma.strasse, `${firma.plz} ${firma.ort}`].filter((x) => x.trim()).join(' · ');
  text(absender, RAND_LINKS, 50, { groesse: 7, farbe: GRAU });
  doc.setDrawColor(...GRAU);
  doc.line(RAND_LINKS, 51, RAND_LINKS + Math.min(doc.getTextWidth(absender), 85), 51);

  if (kunde) {
    const zeilen = [
      kunde.name,
      kunde.istUnternehmen && kunde.ansprechpartner ? `z. Hd. ${kunde.ansprechpartner}` : '',
      kunde.strasse,
      `${kunde.plz} ${kunde.ort}`,
      kunde.land && kunde.land !== 'Deutschland' ? kunde.land.toUpperCase() : '',
    ].filter(Boolean);
    text(zeilen, RAND_LINKS, 60, { groesse: 11 });
  }

  // Informationsblock rechts
  const infoX = 125;
  const info: [string, string][] = [
    [beleg.typ === 'angebot' ? 'Angebotsnr.' : 'Rechnungsnr.', entwurf ? 'ENTWURF' : beleg.nummer],
    ['Datum', datum(beleg.datum)],
    [beleg.typ === 'angebot' ? 'Ausführung ca.' : 'Leistungsdatum', leistungszeitraumText(beleg)],
  ];
  if (beleg.stornoVonNummer) info.push(['Storno zu', beleg.stornoVonNummer]);
  if (kunde?.ustId && kunde.istUnternehmen) info.push(['Ihre USt-IdNr.', kunde.ustId]);
  if (firma.inhaber) info.push(['Ansprechpartner', firma.inhaber]);
  if (firma.telefon) info.push(['Telefon', firma.telefon]);
  if (firma.email) info.push(['E-Mail', firma.email]);
  info.forEach(([k, v], i) => {
    const y = 55 + i * 5;
    text(k, infoX, y, { groesse: 8.5, farbe: GRAU });
    text(v, SEITE_B - RAND_RECHTS, y, { groesse: 9, fett: i === 0, align: 'right' });
  });

  /* ---------- Betreff + Einleitung ---------- */
  let y = Math.max(105, 55 + info.length * 5 + 8);
  text(`${titel} ${entwurf ? '(Entwurf)' : beleg.nummer}`, RAND_LINKS, y, { groesse: 15, fett: true, farbe: MARKE });
  y += 6;
  if (beleg.baustelle?.trim()) {
    text(`Baustelle / Leistungsort: ${beleg.baustelle.trim()}`, RAND_LINKS, y, { groesse: 10, fett: true });
    y += 6;
  }
  y += 2;
  if (beleg.einleitungstext.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const zeilen = doc.splitTextToSize(beleg.einleitungstext.trim(), INHALT_B);
    text(zeilen, RAND_LINKS, y);
    y += zeilen.length * 4.6 + 3;
  }

  /* ---------- Positionstabelle ---------- */
  const saetze = new Set(s.positionen.map((p) => p.steuersatz));
  const ustSpalte = !ohneUst && !beleg.reverseCharge && saetze.size > 1;

  const koerper = beleg.positionen.map((p, i) => {
    const e = s.positionen[i];
    const unter: string[] = [];
    if (p.einheit === 'm2' && p.flaeche?.length) {
      unter.push(
        p.flaeche
          .map((f) => `${zahl(f.laenge)} × ${zahl(f.breite)} m${f.anzahl !== 1 ? ` × ${zahl(f.anzahl)}` : ''}`)
          .join('  +  ') + ` = ${zahl(Math.abs(p.menge))} m²`,
      );
    }
    if (e.rabattCent) unter.push(`abzgl. ${zahl(p.rabattProzent!)} % Rabatt (${betrag(-e.rabattCent)} €)`);
    const zeile = [
      String(i + 1),
      unter.length ? `${p.bezeichnung}\n${unter.join('\n')}` : p.bezeichnung,
      zahl(p.menge),
      einheitKurz(p.einheit),
      betrag(euroZuCent(p.einzelpreis)),
    ];
    if (ustSpalte) zeile.push(`${e.steuersatz} %`);
    zeile.push(betrag(e.nettoCent));
    return zeile;
  });

  const kopf = ['Pos.', 'Bezeichnung', 'Menge', 'Einheit', 'Einzelpreis', ...(ustSpalte ? ['USt'] : []), 'Gesamt €'];
  const spalten: Record<number, { cellWidth?: number | 'auto'; halign?: 'left' | 'right' | 'center' }> = {
    0: { cellWidth: 10, halign: 'left' },
    1: { cellWidth: 'auto' },
    2: { cellWidth: 16, halign: 'right' },
    3: { cellWidth: 14, halign: 'left' },
    4: { cellWidth: 24, halign: 'right' },
  };
  if (ustSpalte) spalten[5] = { cellWidth: 12, halign: 'right' };
  spalten[kopf.length - 1] = { cellWidth: 25, halign: 'right' };

  autoTable(doc, {
    startY: y,
    head: [kopf],
    body: koerper,
    margin: { left: RAND_LINKS, right: RAND_RECHTS, top: 25, bottom: SEITE_H - FUSS_Y + 6 },
    theme: 'plain',
    showHead: 'everyPage',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 }, textColor: [20, 24, 30], valign: 'top', overflow: 'linebreak' },
    headStyles: { fontStyle: 'bold', fillColor: [MARKE[0], MARKE[1], MARKE[2]], textColor: [255, 255, 255] },
    columnStyles: spalten,
    alternateRowStyles: { fillColor: [245, 245, 242] },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index >= 2 && d.column.index !== 3) d.cell.styles.halign = 'right';
    },
  });

  // @ts-expect-error lastAutoTable wird vom Plugin gesetzt
  y = (doc.lastAutoTable?.finalY as number) + 4;

  const platzPruefen = (bedarf: number) => {
    if (y + bedarf > FUSS_Y - 4) {
      doc.addPage();
      y = 25;
    }
  };

  /* ---------- Summenblock ---------- */
  const summen: { k: string; v: string; fett?: boolean; linie?: boolean }[] = [];
  if (s.rabattCent) {
    summen.push({ k: 'Zwischensumme', v: euro(s.zwischensummeCent) });
    summen.push({ k: 'abzgl. Rabatt', v: euro(-s.rabattCent) });
  }
  if (ohneUst) {
    summen.push({ k: 'Gesamtbetrag', v: euro(s.bruttoCent), fett: true, linie: true });
  } else {
    summen.push({ k: 'Nettobetrag', v: euro(s.nettoCent) });
    for (const st of s.steuern) {
      if (beleg.reverseCharge) summen.push({ k: 'Umsatzsteuer 0 % (§ 13b UStG)', v: euro(0) });
      else summen.push({ k: `zzgl. ${st.satz} % USt auf ${euro(st.nettoCent)}`, v: euro(st.steuerCent) });
    }
    summen.push({ k: beleg.typ === 'angebot' ? 'Angebotssumme' : 'Gesamtbetrag', v: euro(s.bruttoCent), fett: true, linie: true });
  }
  platzPruefen(summen.length * 6 + 6);
  const sx = 105;
  summen.forEach((z) => {
    if (z.linie) {
      y += 2.5;
      doc.setDrawColor(...MARKE);
      doc.setLineWidth(0.5);
      doc.line(sx, y, SEITE_B - RAND_RECHTS, y);
      y += 6;
    } else y += 5;
    text(z.k, sx, y, { groesse: z.fett ? 11.5 : 9.5, fett: z.fett });
    text(z.v, SEITE_B - RAND_RECHTS, y, { groesse: z.fett ? 11.5 : 9.5, fett: z.fett, align: 'right' });
  });
  y += 9;

  /* ---------- Zahlungsbedingungen, Hinweise, Schluss ---------- */
  const absatz = (t: string, fett = false, groesse = 9.5) => {
    if (!t.trim()) return;
    doc.setFont('helvetica', fett ? 'bold' : 'normal');
    doc.setFontSize(groesse);
    const zeilen = doc.splitTextToSize(t.trim(), INHALT_B);
    platzPruefen(zeilen.length * 4.4 + 2);
    text(zeilen, RAND_LINKS, y, { groesse, fett });
    y += zeilen.length * 4.4 + 3;
  };

  absatz(zahlungsText(beleg, s));
  if (beleg.typ === 'rechnung' && !beleg.stornoVonId && firma.iban && s.bruttoCent > 0) {
    absatz(`Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer ${entwurf ? '' : beleg.nummer} auf das unten genannte Konto.`.replace('  ', ' '));
  }
  for (const h of belegHinweise(beleg, kunde, s)) absatz(h, h.includes('§ 19') || h.includes('§ 13b'));
  if (beleg.typ === 'angebot' && kunde && !kunde.istUnternehmen && s.arbeitskostenBruttoCent) {
    absatz(`Im Angebot enthaltene Arbeitskosten (§ 35a EStG): ${euro(s.arbeitskostenBruttoCent)}${ohneUst ? '' : ' inkl. USt'}.`);
  }
  y += 2;
  absatz(beleg.schlusstext);
  if (firma.inhaber) absatz(firma.inhaber);

  /* ---------- Fußzeile + Seitenzahlen auf allen Seiten ---------- */
  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    doc.setPage(i);
    if (entwurf) {
      doc.saveGraphicsState();
      // @ts-expect-error GState ist zur Laufzeit vorhanden
      doc.setGState(new doc.GState({ opacity: 0.08 }));
      text('ENTWURF', SEITE_B / 2, 175, { groesse: 90, fett: true, align: 'center', farbe: MARKE });
      doc.restoreGraphicsState();
    }
    if (i > 1) {
      text(`${titel} ${entwurf ? '(Entwurf)' : beleg.nummer} · ${kunde?.name ?? ''}`, RAND_LINKS, 14, { groesse: 8.5, farbe: GRAU });
    }
    doc.setDrawColor(...MARKE);
    doc.setLineWidth(0.4);
    doc.line(RAND_LINKS, FUSS_Y, SEITE_B - RAND_RECHTS, FUSS_Y);
    const spalteB = INHALT_B / 3;
    const fuss = [
      [firma.firmenname, firma.inhaber ? `Inh. ${firma.inhaber}` : '', firma.strasse, `${firma.plz} ${firma.ort}`.trim()],
      [firma.telefon ? `Tel. ${firma.telefon}` : '', firma.email, firma.web, firma.steuernummer ? `St.-Nr. ${firma.steuernummer}` : '', firma.ustId ? `USt-IdNr. ${firma.ustId}` : ''],
      [firma.bank, firma.iban ? `IBAN ${firma.iban}` : '', firma.bic ? `BIC ${firma.bic}` : ''],
    ].map((sp) => sp.filter((z) => z && z.trim()));
    fuss.forEach((sp, k) => text(sp, RAND_LINKS + k * spalteB, FUSS_Y + 4, { groesse: 7.5, farbe: GRAU }));
    text(`Seite ${i} von ${seiten}`, SEITE_B - RAND_RECHTS, SEITE_H - 6, { groesse: 7.5, farbe: GRAU, align: 'right' });
  }

  return doc.output('blob');
}

export async function belegPdfTeilen(beleg: Beleg, kunde: Kunde | undefined, firma: Firmenprofil) {
  const blob = await erzeugeBelegPdf(beleg, kunde, firma);
  return dateiAusgeben(blob, pdfDateiname(beleg, kunde), `${belegTitel(beleg)} ${beleg.nummer}`);
}

export async function belegPdfOeffnen(beleg: Beleg, kunde: Kunde | undefined, firma: Firmenprofil) {
  const blob = await erzeugeBelegPdf(beleg, kunde, firma);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) herunterladen(blob, pdfDateiname(beleg, kunde));
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
