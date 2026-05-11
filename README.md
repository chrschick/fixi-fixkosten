# Fixi – Fixkosten lokal verwalten

Web-App in React + TypeScript, gebaut zu einer einzigen HTML-Datei. Die Daten liegen in einer **gemeinsam genutzten JSON-Datei** (z.B. auf OneDrive / Netzlaufwerk), die jeder Nutzer in seinem Browser öffnet. Kein Webserver erforderlich.

## Erstmalig einrichten

```
yarn install
yarn build
```

Daraus entsteht `dist/index.html` – eine einzige Datei mit allem drin. Diese kannst du:

- direkt doppelklicken (öffnet `file://`), oder
- auf einem geteilten Laufwerk ablegen.

## Verwendung

1. **Browser:** Chrome oder Edge (File-System-API wird benötigt).
2. Beim ersten Start auf **„Neue Datei anlegen"** klicken und z.B. `OneDrive/Fixi/fixi.json` wählen.
3. Andere Nutzer wählen bei sich **„Bestehende Datei öffnen"** und zeigen auf dieselbe Datei.
4. Änderungen werden automatisch gespeichert. Externe Änderungen anderer Nutzer werden alle 5 Sekunden eingelesen.

## Funktionen

- **Kategorien**: Icon (Lucide), Farbe, Name – inline editierbar. "Sonstiges" ist immer vorhanden und nicht löschbar; gelöschte Kategorien verschieben ihre Items automatisch nach "Sonstiges".
- **Items pro Kategorie**: Name, Turnus (Monat/Quartal/Halbjahr/Jahr) mit Tag (+Monat), Betrag, automatisch hochgerundeter Monatsbetrag, Info.
- **Stichtag**: Nächster fälliger Termin wird automatisch berechnet.
- **Einnahmen**: Liste mit Art, Tag, Betrag, Info.
- **Übersicht**: Einnahmen, Ausgaben, Wegsparen, Übrig + Verteilungschart und Aufstellung pro Kategorie.
- **Responsiv** für Mobile/Desktop.
- **Backup**: Manueller Export/Import als JSON über die Header-Buttons.

## Entwicklung

```
yarn dev
```

## Hinweise

- Beim Bearbeiten zur selben Zeit überschreibt der zuletzt speichernde Nutzer. Nacheinander arbeiten.
- Bei OneDrive: Datei sollte lokal synchronisiert sein (nicht „nur online").
