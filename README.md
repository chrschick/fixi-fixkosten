# Fixi – Local-First Fixed Costs Tracker

Fixi ist eine moderne, lokale Web-App zur Verwaltung von regelmäßigen Ausgaben und Einnahmen. Die Anwendung speichert alle Daten direkt in einer JSON-Datei auf deinem OneDrive oder lokalen Laufwerk und bietet eine intuitive Benutzeroberfläche zur Visualisierung und Analyse deiner Fixkosten.

## 🎯 Features

### Kern-Funktionen

- ✅ **Fixkosten-Management**: Verwalte wiederkehrende Ausgaben mit verschiedenen Turnustypen (monatlich, quartalsweise, halbjährlich, jährlich)
- ✅ **Hierarchische Kategorisierung**: Organisiere Ausgaben in Metakategorien und globalen Subkategorien
- ✅ **Einnahmen-Tracking**: Erfasse regelmäßige Einnahmen
- ✅ **Automatische Berechnung**: Monatliche Äquivalente, Stichtage, Gesamtbeträge

### Visualisierung & Dashboard

- 📊 **Übersicht mit Charts**:
  - Pie-Chart zur Verteilung nach Subkategorie
  - Bar-Chart zum Vergleich der Hauptkategorien
  - KPI-Boxes (Einnahmen, Ausgaben, Ersparnisse)
- 🎴 **Kachel-Masonry-Layout**: Metakategorien als responsive Kacheln (max. 3 Spalten)
- 🖱️ **Ein-/Ausklappbar**: Alle Meta- und Subkategorien können kollabiert werden
- 🎯 **Drag & Drop**: Sortiere Metakategorien per Drag & Drop (wird gespeichert)

### Vorschau & Planung

- 📅 **Vorgemerkte Umsätze**: Sieh auf einen Blick, welche Zahlungen in den nächsten 3 Monaten fällig sind
- 🔄 **Toggle für Turnustypen**: Filtere monatliche Umsätze aus (z. B. nur Spar-Zertifikate sehen)

### Benutzerfreundlichkeit

- 🎨 **Light & Dark Mode**: Umschalter im Header (Präferenz wird gespeichert)
- ⚡ **Offline-First**: Alle Daten lokal, Synchronisation im Hintergrund
- 📱 **Responsive Design**: Optimiert für Mobile & Desktop
- ✏️ **Inline-Bearbeitung**: Bearbeite Einträge direkt in der Tabelle
- 📌 **Pin-New-Items**: Neue Einträge werden oben fixiert, bis sie bestätigt werden

### Import & Export

- 📥 **Excel-Import**: Importiere Daten aus Excel-Dateien (Node-Skript)
- 💾 **JSON-Export**: Backup-Kopie herunterladen

## 🚀 Installation & Setup

### Anforderungen

- Node.js >= 16
- Yarn >= 1.22
- Moderner Browser mit File System Access API (Chrome, Firefox, Safari, Edge)

### Entwicklung

```bash
# Abhängigkeiten installieren
yarn install

# Dev-Server starten (Port 5173 mit Hot-Reload)
yarn dev

# Production-Build erstellen (Single-File Bundle)
yarn build

# TypeScript-Typen prüfen
yarn tsc -b

# Fixi starten (Windows mit Node Server)
./Fixi\ starten.bat
```

### Start der Anwendung

Nach dem Build:

- Öffne `dist/index.html` direkt im Browser, oder
- Starten über `Fixi starten.bat` (Windows) für integrierte Node-Umgebung

Die App nutzt die File System Access API zur Dateiverwaltung und synchronisiert im Hintergrund mit der JSON-Datei.

## 📂 Projektstruktur

```
src/
├── components/
│   ├── MetaSection.tsx       # Fixkosten-Sektion pro Meta-Kategorie (inline-Edit, Sort)
│   ├── Overview.tsx          # Dashboard mit Charts, Kachel-Layout, Drag & Drop
│   ├── Upcoming.tsx          # Vorgemerkte Umsätze (nächste 3 Monate)
│   ├── CategoryManager.tsx    # Modal: Kategorien verwalten
│   ├── IncomeList.tsx        # Einnahmen-Verwaltung
│   ├── ItemRow.tsx           # Einzelne Item-Zeile mit Inline-Edit
│   ├── IconPicker.tsx        # Icon-Auswahl aus Lucide-React
│   ├── metaColors.ts         # Hilfsfunktionen für Farben (hexToRgba, metaSoftBg)
│   └── ...
├── types.ts                  # TypeScript-Definitionen (AppData, Item, Category, etc.)
├── storage.ts                # File System Access & Daten-Persistierung (mit Migration)
├── utils.ts                  # Hilfsfunktionen (Datum, Betrag, Turnus-Labels)
├── styles.css                # Global Styles (CSS-Variablen für Light/Dark Mode)
├── App.tsx                   # Haupt-App mit Tab-Navigation & Theme-Schalter
└── main.tsx                  # Einstiegspunkt & React-Root

scripts/
├── import-xlsx.mjs           # Excel-Import-Skript
├── inspect-xlsx.mjs          # Debug-Hilfsprogramm für xlsx
└── dump-cells.mjs            # Zellexport für Debugging

dist/
└── index.html                # Single-File-Bundle (nach Build)
```

## 💾 Datenformat

Die App speichert Daten im JSON-Format (aktuelle Version: 3):

```json
{
  "version": 3,
  "metaCategories": [
    {
      "id": "meta-haus",
      "name": "Haus",
      "icon": "Home",
      "color": "#6366f1"
    }
  ],
  "categories": [
    {
      "id": "cat-miete",
      "name": "Miete",
      "icon": "Building",
      "color": "#ec4899"
    }
  ],
  "items": [
    {
      "id": "itm-abc123",
      "name": "Wohnungsmiete",
      "turnus": "monthly",
      "day": 1,
      "month": 1,
      "amount": 1235,
      "info": "Mietvertrag gültig",
      "metaCategoryId": "meta-haus",
      "categoryId": "cat-miete"
    }
  ],
  "incomes": [
    {
      "id": "inc-gehalt",
      "name": "Gehalt",
      "turnus": "monthly",
      "day": 25,
      "month": 1,
      "amount": 3500,
      "info": ""
    }
  ]
}
```

### Turnus-Typen

| Typ           | Beispiel                | Berechnung                   |
| ------------- | ----------------------- | ---------------------------- |
| `monthly`     | Monatlich am 15.        | Jeden Monat am selben Tag    |
| `quarterly`   | Quartal (alle 3 Monate) | 1.1. → 1.4. → 1.7. → 1.10.   |
| `half-yearly` | Halbjährlich            | Alle 6 Monate ab Basis-Monat |
| `yearly`      | Jährlich                | Einmal im Jahr (z. B. 15.7.) |

### Wichtige Konstanten

- `META_SONSTIGES_ID` = `'meta-sonstiges'`: Default-Meta-Kategorie (nicht löschbar)
- `SONSTIGES_ID` = `'cat-sonstiges'`: Default-Subkategorie (nicht löschbar)

Beim Löschen werden Items automatisch auf diese Standard-Kategorien verschoben.

### Betrag-Berechnung

- **Monatlicher Betrag**: `ceil(amount / TURNUS_MONTHS[turnus])` (aufgerundet)
- **Stichtag**: Der nächste Fälligkeitstermin wird automatisch berechnet
- **In "Vorgemerkte Umsätze"**: Der volle `amount` wird angezeigt (z. B. 1.250 € für Quartal), nicht die monatliche Äquivalente

## 📖 Verwendung

### 1️⃣ Willkommensbildschirm

- **Bestehende Datei öffnen**: Wähle eine `fixi.json` Datei (z. B. auf OneDrive)
- **Neue Datei erstellen**: Startet mit Standard-Kategorien und Default-Items
- **Sicherungskopie importieren**: Lade eine zuvor exportierte JSON-Datei hoch

### 2️⃣ Fixkosten-Tab

- **Pro Metakategorie eine Sektion** mit allen Subkategorien
- **„Eintrag"-Button**: Fügt neues Item am Anfang ein (pinned, wird nach Speichern sortiert)
- **Sortierung**: Nach Name (aufsteigend), Monatsbetrag oder Subkategorie
- **Inline-Bearbeitung**: Klick auf Felder zum Ändern
- **Löschen**: Mit Trash-Icon oder Häkchen zum Speichern

### 3️⃣ Einnahmen-Tab

- Erfasse regelmäßige Einnahmen
- Gleiche Struktur wie Fixkosten
- Berechnung: Monatliche Äquivalente + Gesamtbetrag für Stichtag

### 4️⃣ Übersicht-Tab

- **KPIs**: Gesamt-Einnahmen, Ausgaben, Ersparnisse, verfügbar
- **Charts**:
  - Pie-Chart mit Subkategorien-Verteilung (Tooltip zeigt Namen & Betrag)
  - Bar-Chart Metakategorien-Vergleich (Gesamtbetrag/Monat, Tooltip zeigt Namen)
- **Kachel-Masonry**:
  - Bis zu 3 Metakategorien pro Zeile (responsive)
  - Chevron zum Ein-/Ausklappen
  - Drag & Drop zum Neuordnen (Reihenfolge persistent)
  - Subkategorien & Items in der Kachel
- **Pro Kategorie**: Detaillierte Auflistung aller Items mit Betrag/Turnus/Info

### 5️⃣ Vorgemerkte Umsätze-Tab

- Zeigt **3 Monatsblöcke** mit aktuellen Terminen
- **Toggle**: „Monatliche Umsätze einbeziehen" (default: an)
- **Tabelle**: Stichtag · Name · Betrag · Turnus · Hauptkategorie · Subkategorie
- **Gesamtsumme pro Monat**: Volle Beträge (nicht monatliche Äquivalente)
- Sortierung nach Stichtag innerhalb jeden Monats

### ⚙️ Kategorien verwalten

Klick auf **„Kategorien"** im Header:

- **Hauptkategorien (Metakategorien)**: Oben mit Icon, Name, Farbe
- **Subkategorien**: Global für alle Metas
- 🔒 **Lock-Icon**: Sonstiges-Kategorien können nicht gelöscht werden
- **Beim Löschen**: Items verschieben sich automatisch zu Sonstiges

## 🎨 Theme & Styling

- **Standard**: Light Mode
- **Umschalten**: Sun/Moon-Icon im Header (rechts neben Refresh)
- **Speicherung**: `localStorage` unter `fixi-theme`
- **CSS-Variablen**: `--bg`, `--panel`, `--text`, `--primary`, etc.
- **Dark Mode**: Automatisch angewendet mit `[data-theme="dark"]`

## 📥 Excel-Import

Ein Node-Skript ermöglicht den Import von Excel-Dateien:

```bash
node scripts/import-xlsx.mjs input.xlsx output.json
```

Das Skript:

- Parst „Fixkosten"-Sheet
- Identifiziert Kategorien aus Tabellenüberschriften
- Extrahiert Beträge und Turnusmuster
- Generiert `output.json` mit vollständigem AppData-Schema

Anschließend in der App: **„Sicherungskopie importieren"** → `output.json` wählen

## 🛠️ Technologie-Stack

| Layer             | Technologie                       |
| ----------------- | --------------------------------- |
| **Frontend**      | React 18 + TypeScript 5.6         |
| **Build**         | Vite 5 + vite-plugin-singlefile   |
| **Styling**       | CSS Variables + Responsive Design |
| **Charts**        | Recharts (Pie & Bar)              |
| **Icons**         | Lucide-React                      |
| **State**         | React Hooks + File Storage API    |
| **Persistierung** | File System Access API + JSON     |
| **Excel**         | xlsx (Node-Skript)                |

## 🌐 Browser-Kompatibilität

| Browser         | Min. Version | Notizen                                     |
| --------------- | ------------ | ------------------------------------------- |
| Chrome/Chromium | 86+          | ✅ Vollständig unterstützt                  |
| Firefox         | 127+         | ⚠️ Benötigt `dom.filesystem.enabled = true` |
| Safari          | 13.1+        | ✅ Vollständig unterstützt                  |
| Edge            | 79+          | ✅ Vollständig unterstützt                  |

## 📝 Lizenz

Privates Projekt. Nicht für öffentliche Nutzung freigegeben.

---

**Fixi** – Deine volle Kontrolle über Fixkosten. 💰
