# Fixi – Fixkosten-Tracker

Fixi ist eine Web-App zur Verwaltung von regelmäßigen Ausgaben und Einnahmen.
Die Daten liegen in einer **MariaDB**; ein Node/Express-Server liefert das
React-Frontend aus und stellt die API bereit.

- **Ein Account = ein System = eine Fixkostenliste.** Es gibt keine
  Registrierung: Accounts legt ausschließlich der Superadmin an.
- **Superadmin** meldet sich unter `/sa` an und verwaltet die Systeme
  (anlegen, Passwort setzen, Daten exportieren/importieren, löschen).
- **Benutzer** melden sich auf der Startseite an und sehen nur ihre eigene
  Liste.

## 🎯 Features

### Kern-Funktionen

- ✅ **Fixkosten-Management**: Wiederkehrende Ausgaben mit Turnus (monatlich, quartalsweise, halbjährlich, jährlich)
- ✅ **Hierarchische Kategorisierung**: Hauptkategorien (Meta) und globale Subkategorien
- ✅ **Einnahmen-Tracking**
- ✅ **Automatische Berechnung**: Monatliche Äquivalente, Stichtage, Gesamtbeträge

### Visualisierung & Dashboard

- 📊 Pie-Chart (Subkategorien), Bar-Chart (Hauptkategorien), KPI-Boxen
- 🎴 Kachel-Layout der Hauptkategorien, ein-/ausklappbar, per Drag & Drop sortierbar (Reihenfolge wird gespeichert)
- 📅 **Vorgemerkte Umsätze**: Fälligkeiten der nächsten 3 Monate

### Benutzerfreundlichkeit

- 🎨 Light & Dark Mode (Umschalter im Header, Präferenz im Browser gespeichert)
- ✏️ Inline-Bearbeitung direkt in der Tabelle, neue Einträge werden oben fixiert
- 💾 **Automatisches Speichern**: Änderungen landen nach 400 ms in der Datenbank; andere Geräte/Tabs holen sich den neuen Stand alle 5 s
- 📱 Responsive für Mobile & Desktop

### Import & Export

- 💾 **Export**: Sicherungskopie als JSON herunterladen (Download-Icon im Header)
- 📥 **Import**: JSON-Sicherung einspielen (Upload-Icon) – ersetzt die Daten des Accounts in der Datenbank
- 📊 **Excel-Import**: Node-Skript erzeugt aus `Fixkosten.xlsx` eine importierbare JSON

## 🚀 Installation & Setup

### Anforderungen

- Node.js ≥ 20 (für `yarn dev:server` ≥ 22.18 bzw. 23.6, weil der Server dort direkt als TypeScript läuft)
- Yarn ≥ 1.22
- MariaDB ≥ 10.4 (MySQL 8 funktioniert ebenfalls)

### 1. Datenbank anlegen

```sql
CREATE DATABASE fixi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fixi'@'localhost' IDENTIFIED BY 'geheim';
GRANT ALL PRIVILEGES ON fixi.* TO 'fixi'@'localhost';
FLUSH PRIVILEGES;
```

Die Tabellen legt der Server beim ersten Start selbst an (`CREATE TABLE IF NOT EXISTS`).

### 2. Konfiguration

```bash
cp .env.example .env
```

| Variable              | Bedeutung                                                                          | Standard    |
| --------------------- | ---------------------------------------------------------------------------------- | ----------- |
| `PORT`                | HTTP-Port des Servers                                                              | `5174`      |
| `HOST`                | Bind-Adresse (`127.0.0.1` hinter Reverse-Proxy, `0.0.0.0` für alle)                | `127.0.0.1` |
| `TRUST_PROXY`         | Anzahl vertrauenswürdiger Proxy-Hops (Express `trust proxy`) oder `false`          | `1`         |
| `COOKIE_SECURE`       | Session-Cookie nur über HTTPS: `auto` (nach `X-Forwarded-Proto`), `true`, `false`  | `auto`      |
| `SESSION_TTL_DAYS`    | Gültigkeit einer Anmeldung in Tagen                                                | `30`        |
| `DB_HOST` … `DB_NAME` | Zugangsdaten der MariaDB                                                           |             |
| `SA_USERNAME`         | Benutzername des Superadmins (Login unter `/sa`)                                   |             |
| `SA_PASSWORD`         | Passwort des Superadmins                                                           |             |

Die `.env` ist die Quelle der Wahrheit für den Superadmin: Existiert der Account
noch nicht, wird er beim Start angelegt; ein geändertes `SA_PASSWORD` wird beim
nächsten Start übernommen (bestehende Superadmin-Sessions werden dabei beendet).
Die `.env` ist per `.gitignore` vom Repository ausgeschlossen.

### 3. Bauen und starten

```bash
yarn install
yarn build        # Frontend (dist/) + Server-Bundle (dist-server/index.mjs)
yarn start        # node dist-server/index.mjs
```

Danach: `http://localhost:5174/` (Benutzer) bzw. `http://localhost:5174/sa` (Superadmin).
Unter Windows geht das auch per Doppelklick auf `Fixi starten.bat`.

### Entwicklung

```bash
yarn dev:server   # API mit Auto-Reload auf :5174 (Node ≥ 22.18)
yarn dev          # Vite-Dev-Server auf :5173, proxied /api → :5174
yarn typecheck    # tsc für Frontend + Server
```

Wer eine ältere Node-Version hat, nutzt statt `yarn dev:server` einfach
`yarn build:server && yarn start`.

## 🔐 Superadmin (`/sa`)

1. Mit `SA_USERNAME` / `SA_PASSWORD` anmelden.
2. **Neues System anlegen**: Benutzername + Passwort (Generator vorhanden). Das Passwort wird nur einmal angezeigt – an den Benutzer weitergeben.
3. Pro System: Daten **exportieren** (JSON), **importieren** (JSON, überschreibt), **Passwort neu setzen** (beendet dessen Sessions), **löschen** (entfernt alle Daten).

Ein Superadmin hat keine eigene Fixkostenliste; die Rollen sind strikt getrennt
(ein Superadmin kann sich nicht auf der Startseite anmelden und umgekehrt).

## 🌐 Deployment: Docker, Portainer, Cloudflare Tunnel

Produktiv läuft Fixi als Container. GitHub Actions baut das Image bei jedem Push
(`.github/workflows/docker.yml`) für `linux/amd64` und `linux/arm64`:

| Branch    | Image                                      |
| --------- | ------------------------------------------ |
| `master`  | `ghcr.io/chrschick/fixi-fixkosten:latest`  |
| `develop` | `ghcr.io/chrschick/fixi-fixkosten:develop` |

Ein Reverse-Proxy ist nicht nötig. cloudflared stellt Domain und HTTPS bereit
und leitet über das Docker-Netzwerk an den Fixi-Container weiter.

### 1. Datenbank in der vorhandenen MariaDB anlegen

```sql
CREATE DATABASE fixi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fixi'@'%' IDENTIFIED BY 'geheim';
GRANT ALL PRIVILEGES ON fixi.* TO 'fixi'@'%';
FLUSH PRIVILEGES;
```

Der Host `%` ist nötig, weil sich die IP des Fixi-Containers ändern kann. Die
Tabellen legt Fixi beim Start selbst an.

### 2. Image-Tag wählen

Das Image ist öffentlich und lässt sich ohne Registry-Zugang ziehen. `latest`
existiert erst nach dem ersten Push auf `master`. Bis dahin im Stack
`FIXI_TAG=develop` setzen.

Meldet Portainer beim Pull „denied“ oder „unauthorized“, unter GitHub → Packages →
`fixi-fixkosten` → Package settings die Sichtbarkeit auf Public stellen.

### 3. Stack in Portainer anlegen

Stacks → Add stack → Web editor → Inhalt von
[`deploy/portainer-stack.yml`](deploy/portainer-stack.yml) einfügen. Unter
„Environment variables“ setzen:

| Variable       | Beispiel  | Bedeutung                                              |
| -------------- | --------- | ------------------------------------------------------ |
| `FIXI_NETWORK` | `proxy`   | Docker-Netzwerk, in dem cloudflared und MariaDB hängen |
| `DB_HOST`      | `mariadb` | Container-Name der MariaDB                             |
| `DB_PASSWORD`  |           | Passwort des DB-Benutzers                              |
| `SA_PASSWORD`  |           | Superadmin-Passwort                                    |
| `FIXI_TAG`     | `develop` | optional, Standard `latest`                            |

`DB_PORT`, `DB_NAME`, `DB_USER` und `SA_USERNAME` haben Standardwerte
(`3306`, `fixi`, `fixi`, `schick`). Den Netzwerknamen zeigt Portainer unter
Networks. Varianten für getrennte Netzwerke oder für cloudflared bzw. MariaDB
direkt auf dem Host stehen als Kommentar in der YAML.

### 4. Tunnel einrichten

Cloudflare Zero Trust → Networks → Tunnels → Tunnel bearbeiten → Public Hostname:
`fixi.schick.digital` mit Service-Typ `HTTP` und URL `fixi:5174`.

### 5. Erster Start und Updates

- Portainer zeigt den Container nach kurzer Zeit als „healthy“ (`GET /api/health`).
- Superadmin-Login unter `https://fixi.schick.digital/sa`.
- Ist die Datenbank beim Start noch nicht erreichbar, wartet Fixi bis zu 2 Minuten und protokolliert „warte auf Datenbank…“.
- Update: Stack → „Update the stack“ mit „Re-pull image and redeploy“.

Der Stack setzt `COOKIE_SECURE=true`, weil Cloudflare immer HTTPS ausliefert.
Ein direkter Aufruf über `http://<server-ip>:5174` kann sich deshalb nicht anmelden.

### Ohne Docker

`yarn build` und `node dist-server/index.mjs` mit `.env` funktionieren genauso.
Dann gehört ein Reverse-Proxy mit TLS davor, der `X-Forwarded-Proto` setzt
(`TRUST_PROXY=1`, `COOKIE_SECURE=auto`).

Sicherheitsmaßnahmen: Passwörter mit scrypt gehasht, Sessions in der DB mit
httpOnly/SameSite=Lax-Cookie, Login-Limiter (10 Fehlversuche pro 15 Minuten
und IP+Benutzername), Body-Limit 5 MB, alle Eingaben werden serverseitig
normalisiert (`shared/sanitize.ts`).

## 🔌 API (JSON, Session-Cookie)

| Methode  | Pfad                         | Rolle      | Zweck                                   |
| -------- | ---------------------------- | ---------- | --------------------------------------- |
| `GET`    | `/api/health`                | –          | Healthcheck (Datenbank erreichbar)      |
| `POST`   | `/api/auth/login`            | –          | Benutzer-Login (`username`, `password`) |
| `POST`   | `/api/sa/login`              | –          | Superadmin-Login                        |
| `POST`   | `/api/auth/logout`           | beide      | Abmelden                                |
| `GET`    | `/api/auth/me`               | –          | Aktuelle Session (`user` oder `null`)   |
| `GET`    | `/api/data`                  | user       | Komplette Fixkostendaten + `version`    |
| `GET`    | `/api/data/version`          | user       | Nur die Versionsnummer (Polling)        |
| `PUT`    | `/api/data`                  | user       | Daten komplett ersetzen (`{ data }`)    |
| `GET`    | `/api/sa/users`              | superadmin | Systeme auflisten                       |
| `POST`   | `/api/sa/users`              | superadmin | System anlegen                          |
| `DELETE` | `/api/sa/users/:id`          | superadmin | System löschen                          |
| `PUT`    | `/api/sa/users/:id/password` | superadmin | Passwort setzen                         |
| `GET`    | `/api/sa/users/:id/data`     | superadmin | Daten exportieren                       |
| `PUT`    | `/api/sa/users/:id/data`     | superadmin | Daten importieren                       |

Jede Änderung im Frontend schreibt die kompletten Daten des Accounts in einer
Transaktion (löschen + neu einfügen) und erhöht `users.data_version`. Die
Listen sind klein, daher ist das einfacher und robuster als Einzel-Updates.
Gleichzeitiges Bearbeiten auf zwei Geräten wird nicht zusammengeführt – der
letzte Schreibzugriff gewinnt.

## 💾 Datenmodell

### Tabellen

| Tabelle           | Inhalt                                                        |
| ----------------- | ------------------------------------------------------------- |
| `users`           | Accounts (`role` = `user` / `superadmin`), `data_version`     |
| `sessions`        | Login-Sessions (Token, Ablauf)                                |
| `meta_categories` | Hauptkategorien pro Benutzer (`sort_order` = Reihenfolge)     |
| `categories`      | Subkategorien pro Benutzer                                    |
| `items`           | Fixkosten pro Benutzer (FK auf Meta + Subkategorie)           |
| `incomes`         | Einnahmen pro Benutzer                                        |

Alle Datentabellen hängen per `ON DELETE CASCADE` am Benutzer.

### JSON-Format (Export/Import, Version 3)

```json
{
  "version": 3,
  "metaCategories": [
    { "id": "meta-haus", "name": "Haus", "icon": "Home", "color": "#6366f1" }
  ],
  "categories": [
    { "id": "cat-miete", "name": "Miete", "icon": "Building", "color": "#ec4899" }
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
    { "id": "inc-gehalt", "name": "Gehalt", "day": 25, "amount": 3500, "info": "" }
  ]
}
```

Ältere Exporte (Version 1/2, Subkategorien mit `metaCategoryId`) werden beim
Import automatisch migriert. Ungültige Referenzen landen in „Sonstiges“,
doppelte IDs bekommen neue.

### Turnus-Typen

| Typ           | Beispiel                | Berechnung                   |
| ------------- | ----------------------- | ---------------------------- |
| `monthly`     | Monatlich am 15.        | Jeden Monat am selben Tag    |
| `quarterly`   | Quartal (alle 3 Monate) | 1.1. → 1.4. → 1.7. → 1.10.   |
| `half-yearly` | Halbjährlich            | Alle 6 Monate ab Basis-Monat |
| `yearly`      | Jährlich                | Einmal im Jahr (z. B. 15.7.) |

### Wichtige Konstanten

- `META_SONSTIGES_ID` = `'meta-sonstiges'`: Default-Hauptkategorie (nicht löschbar)
- `SONSTIGES_ID` = `'cat-sonstiges'`: Default-Subkategorie (nicht löschbar)

Beim Löschen einer Kategorie wandern die Items automatisch nach „Sonstiges“.

### Betrag-Berechnung

- **Monatlicher Betrag**: `ceil(amount / TURNUS_MONTHS[turnus])` (aufgerundet)
- **Stichtag**: Der nächste Fälligkeitstermin wird automatisch berechnet
- **Vorgemerkte Umsätze**: zeigen den vollen `amount` (z. B. 1.250 € fürs Quartal)

## 📂 Projektstruktur

```text
server/                      Express-API (läuft in Node)
├── index.ts                 App, Static-Serving, Fehlerbehandlung, Start
├── config.ts                .env / Umgebungsvariablen
├── db.ts                    mysql2-Pool, Transaktionen, Schema (CREATE TABLE)
├── auth.ts                  scrypt-Hashing, Sessions, Cookie, Middleware, Login-Limiter
├── repo.ts                  Benutzer- und Datenzugriff
└── routes.ts                API-Endpunkte

shared/                      Von Frontend UND Server genutzt
├── types.ts                 AppData, Item, Category, … + Defaults
└── sanitize.ts              Normalisierung/Migration importierter Daten

src/                         React-Frontend
├── App.tsx                  Routing (/ → Benutzer-App, /sa → Superadmin), Header, Tabs
├── api.ts                   fetch-Wrapper für /api
├── useSession.ts            Login-Zustand
├── useDataStore.ts          Daten laden/speichern (Debounce, Polling)
├── useTheme.ts              Light/Dark
├── storage.ts               Export/Import-Hilfen (Download, Datei lesen)
├── components/
│   ├── LoginScreen.tsx      Anmeldeformular
│   ├── AdminApp.tsx         Superadmin-Panel
│   ├── MetaSection.tsx      Fixkosten-Sektion pro Hauptkategorie
│   ├── Overview.tsx         Dashboard mit Charts und Kacheln
│   ├── Upcoming.tsx         Vorgemerkte Umsätze
│   ├── CategoryManager.tsx  Modal: Kategorien verwalten
│   ├── IncomeList.tsx       Einnahmen
│   ├── ItemRow.tsx          Zeile mit Inline-Edit
│   └── IconPicker.tsx       Icon-Auswahl (Lucide)
├── utils.ts                 Datum, Betrag, Turnus-Labels
└── styles.css               Globale Styles (CSS-Variablen für Light/Dark)

Dockerfile                   Image: Build-Stage (vite, esbuild) + schlanke Runtime
deploy/portainer-stack.yml   Stack-YAML für Portainer
.github/workflows/docker.yml Image-Build nach ghcr.io bei Push auf master/develop
scripts/import-xlsx.mjs      Excel → JSON (danach in der App importieren)
dist/, dist-server/          Build-Ausgaben (nicht im Git)
```

## 📖 Verwendung

1. **Anmelden** mit den Zugangsdaten, die der Superadmin angelegt hat.
2. **Fixkosten**: pro Hauptkategorie eine Sektion; „Eintrag“ fügt oben eine neue Zeile ein (fixiert bis zum Häkchen); Sortierung nach Name, Monatsbetrag oder Subkategorie.
3. **Einnahmen**, **Übersicht** (KPIs, Charts, Kacheln mit Drag & Drop) und **Vorgemerkte Umsätze** (3 Monate, Toggle für monatliche Umsätze).
4. **Kategorien**: Button im Header – Hauptkategorien mit Icon/Farbe, globale Subkategorien; „Sonstiges“ ist gesperrt.
5. **Export/Import** über die Icons im Header. Der Import ersetzt nach Rückfrage alle Daten des Accounts.

Der Status-Badge im Header zeigt „speichere…“, „gespeichert“ oder „Fehler“
(Tooltip mit Details). Bei Verbindungsproblemen wird alle 5 s erneut versucht,
ausstehende Änderungen werden auch beim Schließen des Tabs noch gesendet.

### Umzug von der alten JSON-Datei

Die frühere Fixi-Version speicherte eine `fixi.json` lokal/auf OneDrive. Diese
Datei lässt sich unverändert importieren: als Benutzer anmelden → Upload-Icon →
Datei wählen (oder im Superadmin-Panel beim jeweiligen System „importieren“).

## 📥 Excel-Import

```bash
node scripts/import-xlsx.mjs
```

Liest `Fixkosten.xlsx` (Sheet „Fixkosten“), erkennt die Sektionen an den
Überschriften und schreibt `fixi.json` im Schema v3. Anschließend in der App
importieren.

## 🛠️ Technologie-Stack

| Layer             | Technologie                          |
| ----------------- | ------------------------------------ |
| **Frontend**      | React 18 + TypeScript 5.6, Vite 5    |
| **Charts**        | Recharts                             |
| **Icons**         | Lucide-React                         |
| **Server**        | Node.js, Express 5, TypeScript       |
| **Datenbank**     | MariaDB (mysql2)                     |
| **Auth**          | scrypt (Node crypto), DB-Sessions    |
| **Deployment**    | Docker, GitHub Actions, GHCR         |
| **Excel**         | xlsx (Node-Skript)                   |

## 📝 Lizenz

Privates Projekt. Nicht für öffentliche Nutzung freigegeben.

---

**Fixi** – Deine volle Kontrolle über Fixkosten. 💰
