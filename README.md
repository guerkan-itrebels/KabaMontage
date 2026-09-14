# KabaMontage – Rechnungen & Angebote

Rechnungs-App für KabaMontage: Angebote, Rechnungen und Zeiterfassung direkt auf dem Handy – **auch ohne Internet**.

- **Keine laufenden Kosten:** kein Server, keine Cloud, kein Konto.
- **Datenschutz:** Alle Daten bleiben auf dem Gerät (im Browser-Speicher). Nichts wird übertragen.
- **Funktioniert offline** und lässt sich wie eine normale App auf den Home-Bildschirm legen.

Technik: Vite, React, TypeScript, Tailwind CSS, Dexie (IndexedDB), jsPDF, vite-plugin-pwa, Vitest.

---

## 1. Lokal starten (für Entwickler)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
npm run dev
```

Dann im Browser <http://localhost:5173> öffnen.

Weitere Befehle:

| Befehl | Zweck |
| --- | --- |
| `npm test` | Tests der Rechenlogik (Summen, Rundung, MwSt, § 13b, § 19, § 35a) |
| `npm run build` | Fertige App in den Ordner `dist` bauen |
| `npm run preview` | Den Build lokal ansehen (inkl. Offline-Funktion) |
| `npm run icons` | App-Icons neu erzeugen |

---

## 2. Auf GitHub Pages veröffentlichen (kostenlos)

1. Auf <https://github.com> ein Konto anlegen (kostenlos) und ein **neues Repository** erstellen, z. B. mit dem Namen `KabaMontage`.
2. Den Projektordner hochladen:
   ```bash
   git init
   git add .
   git commit -m "KabaMontage App"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/KabaMontage.git
   git push -u origin main
   ```
3. Im Repository auf **Settings → Pages** gehen und bei **Source** „**GitHub Actions**“ auswählen.
4. Unter **Actions** läuft jetzt „Auf GitHub Pages veröffentlichen“. Nach 1–2 Minuten ist die App erreichbar unter
   `https://DEIN-NAME.github.io/KabaMontage/`

Jede weitere Änderung, die nach `main` hochgeladen wird, wird automatisch neu veröffentlicht. Der Basispfad wird automatisch aus dem Repository-Namen gesetzt – heißt das Repository anders, muss nichts angepasst werden.

> Hinweis: Die veröffentlichte Seite enthält **keine Kundendaten** – nur die leere App. Die Daten entstehen erst auf dem jeweiligen Handy.

---

## 3. App auf den Home-Bildschirm legen

Die Adresse der App (siehe oben) einmal **mit Internet** öffnen. Danach funktioniert sie auch im Flugmodus.

### iPhone / iPad

1. Die Adresse in **Safari** öffnen (nicht Chrome – nur Safari kann Apps installieren).
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben).
3. Nach unten scrollen und **„Zum Home-Bildschirm“** wählen.
4. Oben rechts auf **„Hinzufügen“** tippen.

### Android

1. Die Adresse in **Chrome** öffnen.
2. Oben rechts auf die **drei Punkte** tippen.
3. **„App installieren“** bzw. **„Zum Startbildschirm hinzufügen“** wählen und bestätigen.

Die App erscheint jetzt mit dem KabaMontage-Symbol auf dem Startbildschirm.

> **Wichtig (iPhone):** Die Daten der installierten App und die Daten in Safari sind getrennt. Immer über das Symbol auf dem Home-Bildschirm arbeiten.

---

## 4. Datensicherung (Backup)

Die Daten liegen **nur auf dem Handy**. Wird das Handy gewechselt, verloren oder der Browser-Speicher gelöscht, sind sie ohne Sicherung weg. Die App erinnert beim ersten Start und danach alle 30 Tage daran.

### Sicherung anlegen

1. In der App unten auf **Mehr → Daten sichern**.
2. **„Sicherung erstellen“** antippen.
3. Am Handy öffnet sich das Teilen-Menü: z. B. **per E-Mail an sich selbst** schicken oder in **Google Drive / iCloud Drive / Dateien** speichern. Am Computer wird die Datei heruntergeladen.

Die Datei heißt z. B. `KabaMontage-Sicherung_2026-09-14.json`.

### Sicherung zurückspielen (z. B. neues Handy)

1. App auf dem neuen Gerät installieren (siehe Abschnitt 3).
2. Die Sicherungsdatei auf dem Gerät speichern (z. B. aus der E-Mail).
3. In der App **Mehr → Daten sichern → „Sicherungsdatei auswählen“**.
4. Die Vorschau zeigt, wie viele Kunden, Belege usw. enthalten sind. Mit **„Ersetzen“** bestätigen.

> Achtung: Beim Zurückspielen werden die Daten auf dem Gerät **vollständig durch die Sicherung ersetzt**.

---

## Wichtige Regeln in der App

- **Rechnungsnummern** werden erst beim **Fertigstellen** vergeben – fortlaufend, lückenlos und nie doppelt (z. B. `RE-2026-0001`). Entwürfe haben noch keine Nummer.
- Eine **fertiggestellte Rechnung** kann nicht mehr geändert werden. Fehler werden per **Storno** korrigiert: Es entsteht eine Stornorechnung mit negativen Beträgen und Verweis auf das Original. Danach einfach „Als Vorlage für neuen Beleg“ nutzen und korrigiert neu stellen.
- **Privatkunden** bekommen automatisch den Hinweis zur Aufbewahrungspflicht (§ 14b UStG) und den ausgewiesenen **Arbeitskostenanteil für § 35a EStG**. Dafür bei jeder Position richtig einstellen, ob es eine **Arbeitsleistung** (Lohn, Anfahrt, Maschinen) oder **Material** ist.
- **Kleinunternehmer (§ 19 UStG)** und **Bauleistungen (§ 13b UStG)** werden in den Einstellungen eingeschaltet.

Die App ersetzt keine Steuerberatung. Bitte die Einstellungen einmal mit dem Steuerberater abstimmen.

## Projektstruktur

```
src/lib/      Rechenlogik (Cent-genau), Formate, Hinweistexte, Validierung + Tests
src/db/       Datenbank (Dexie), Nummernkreise, Storno, Backup
src/pdf/      PDF nach DIN 5008 (jsPDF)
src/ui/       Bedienelemente, Router, Icons
src/pages/    Bildschirme (Start, Belege, Editor, Zeiten, Kunden, Vorlagen, Einstellungen, Sichern)
public/       Logo, App-Icons
scripts/      Icon-Generator
```
