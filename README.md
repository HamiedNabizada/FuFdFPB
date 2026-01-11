# XSD Review Tool

Web-Plattform zur kollaborativen Diskussion von XML-Schema (XSD) Dateien im Rahmen der VDI/VDE 3682 Standardisierung.

**Live:** https://fufdfpb.fpbjs.net

## Features

- **Schema-Upload**: XSD-Dateien hochladen und versionieren (v1.0, v1.1, etc.)
- **Interaktive Navigation**: Schema-Struktur als Baum mit Expand/Collapse
- **Element-Details**: Attribute, Dokumentation, XPath für jedes Element
- **Kommentar-System**: Diskussionen pro Element mit Antworten
- **Status-Tracking**: Kommentare als "erledigt" markieren
- **Gast-Kommentare**: Auch ohne Login kommentieren (mit Namen)

## Tech Stack

**Backend:**
- Node.js + Express
- Prisma ORM + MySQL
- JWT Authentication
- fast-xml-parser

**Frontend:**
- React + TypeScript
- Vite (Build Tool)
- TailwindCSS
- React Router
- Lucide Icons

## Installation

### Voraussetzungen

- Node.js 16.13+ (getestet mit 16.20.2)
- MySQL 8.0+ oder MariaDB 10.5+
- npm oder yarn

> **Hinweis:** MariaDB ist vollständig kompatibel. Prisma verwendet den `mysql` Provider für beide Datenbanken.

### 1. Repository klonen

```bash
cd Richtlinien-Arbeit/XSD-Review-Tool
```

### 2. Backend einrichten

```bash
cd backend

# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# Dann .env bearbeiten mit MySQL-Zugangsdaten
```

Inhalt von `.env`:
```env
DATABASE_URL="mysql://username:password@localhost:3306/xsd_review"
JWT_SECRET="ein-sicherer-geheimer-schluessel"
PORT=3001
```

```bash
# Datenbank initialisieren
npx prisma migrate dev --name init

# Server starten
npm run dev
```

### 3. Frontend einrichten

```bash
cd ../frontend

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev
```

Frontend läuft auf http://localhost:5173
Backend läuft auf http://localhost:3001

## Produktions-Deployment (Plesk ohne Terminal)

### Schritt 1: MySQL-Datenbank in Plesk anlegen

1. Plesk öffnen → **Datenbanken** → **Datenbank hinzufügen**
2. Datenbankname: `xsd_review`
3. Benutzer und Passwort erstellen
4. Die Zugangsdaten notieren für später

### Schritt 2: Backend lokal vorbereiten

Auf deinem lokalen PC mit Terminal:

```bash
cd Richtlinien-Arbeit/XSD-Review-Tool/backend

# Dependencies installieren
npm install

# TypeScript kompilieren
npm run build

# Prisma Client generieren
npx prisma generate
```

### Schritt 3: Backend-Dateien hochladen

Folgende Dateien/Ordner per FTP oder Plesk Dateimanager hochladen:

```
backend/
├── dist/                  # Kompilierter Code
├── node_modules/          # Dependencies (komplett!)
├── prisma/
│   └── schema.prisma
└── package.json
```

### Schritt 4: Node.js App in Plesk einrichten

1. Plesk → **Node.js** (unter "Websites & Domains")
2. **Node.js aktivieren**
3. Einstellungen:
   - **Document Root**: `/backend`
   - **Application Startup File**: `dist/index.js`
   - **Application Mode**: `production`
4. **Umgebungsvariablen** hinzufügen:
   ```
   DATABASE_URL=mysql://USER:PASSWORT@localhost:3306/xsd_review
   JWT_SECRET=ein-langer-zufaelliger-string-hier
   NODE_ENV=production
   PORT=3000
   ```
   > Bei MariaDB ist die URL identisch - Prisma erkennt MariaDB automatisch.
5. **NPM install** Button klicken (falls vorhanden)
6. **Restart App** klicken

### Schritt 5: Datenbank-Tabellen erstellen

Da kein Terminal verfügbar ist, SQL manuell ausführen:

1. Plesk → **Datenbanken** → **phpMyAdmin**
2. Datenbank `xsd_review` auswählen
3. **SQL** Tab → Folgendes SQL ausführen:

```sql
-- Benutzer-Tabelle
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Schema-Tabelle (Backticks wegen reserviertem Wort in MariaDB!)
CREATE TABLE `schemas` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  content LONGTEXT NOT NULL,
  uploaded_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_schema_version (name, version),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Kommentar-Tabelle
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_id INT NOT NULL,
  xpath VARCHAR(500) NOT NULL,
  element_name VARCHAR(255),
  comment_text TEXT NOT NULL,
  author_id INT,
  author_name VARCHAR(255),
  status ENUM('open', 'resolved') DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (schema_id) REFERENCES `schemas`(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Antworten-Tabelle
CREATE TABLE replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_id INT NOT NULL,
  reply_text TEXT NOT NULL,
  author_id INT,
  author_name VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
```

### Schritt 6: Frontend bauen und hochladen

Lokal:
```bash
cd Richtlinien-Arbeit/XSD-Review-Tool/frontend

# API-URL anpassen (siehe unten)
# Dann bauen:
npm install
npm run build
```

**Vor dem Build** in `vite.config.ts` die API-URL setzen:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  // Für Produktion: API-Pfad anpassen
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://api.deine-domain.de')
  }
});
```

**Oder einfacher**: Frontend und Backend unter gleicher Domain laufen lassen (dann funktioniert `/api` automatisch).

Den `frontend/dist/` Ordner in das Webroot hochladen (z.B. `httpdocs/`).

### Alternative: Alles unter einer Domain

Einfachste Variante - alles unter einer Domain:

```
httpdocs/
├── api/          # Backend (Node.js App zeigt hierhin)
└── index.html    # Frontend (statische Dateien)
```

In Plesk die Node.js App so konfigurieren, dass sie unter `/api` erreichbar ist.

## Projektstruktur

```
XSD-Review-Tool/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Datenbank-Schema
│   ├── src/
│   │   ├── index.ts           # Express Server
│   │   ├── routes/
│   │   │   ├── auth.ts        # Login/Register
│   │   │   ├── schemas.ts     # Schema CRUD
│   │   │   └── comments.ts    # Kommentar API
│   │   └── middleware/
│   │       └── auth.ts        # JWT Middleware
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Hauptkomponente
│   │   ├── lib/
│   │   │   └── xsd-parser.ts  # XSD zu Baum-Konverter
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── SchemaTree.tsx
│   │   │   ├── ElementDetails.tsx
│   │   │   ├── CommentList.tsx
│   │   │   └── CommentForm.tsx
│   │   └── pages/
│   │       ├── HomePage.tsx   # Schema-Liste
│   │       ├── SchemaPage.tsx # Schema-Ansicht
│   │       └── LoginPage.tsx  # Authentifizierung
│   └── package.json
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Benutzer registrieren
- `POST /api/auth/login` - Anmelden
- `GET /api/auth/me` - Aktueller Benutzer

### Schemas
- `GET /api/schemas` - Alle Schemas (gruppiert nach Name)
- `GET /api/schemas/:id` - Einzelnes Schema mit Kommentaren
- `POST /api/schemas` - Neues Schema hochladen

### Comments
- `POST /api/schemas/:id/comments` - Kommentar hinzufügen
- `PATCH /api/comments/:id/resolve` - Als erledigt markieren
- `POST /api/comments/:id/reply` - Antwort hinzufügen
- `DELETE /api/comments/:id` - Kommentar löschen

## Datenbank-Schema

```
User (id, email, password, name)
  └── Schema (id, name, version, content, uploadedBy)
        └── Comment (id, schemaId, xpath, elementName, commentText, status)
              └── Reply (id, commentId, replyText)
```

## Lizenz

Intern - VDI/VDE Fachausschuss
