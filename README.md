# CorpEMD — Enterprise Android MDM Platform

A production-ready Android Enterprise MDM system built on Google's Android Management API (AMAPI).

```
Stack: Node.js 20 · Fastify · TypeScript · PostgreSQL · Redis · BullMQ · React · Vite · Docker
```

---

## Quick start — local dev (no Docker)

### Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 20 | https://nodejs.org |
| PostgreSQL | 14 | https://postgresql.org |
| Redis | 6 | https://redis.io |
| Git | any | https://git-scm.com |

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Create your .env file

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
POSTGRES_PASSWORD=any_local_password
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
```

For local dev you can leave the Google / AMAPI fields empty — the API will start but enrollment and remote commands won't work until you connect AMAPI (see Step 6).

### Step 3 — Create the database

```bash
# macOS / Linux
psql -U postgres -c "CREATE DATABASE corpemd;"
psql -U postgres -d corpemd -f apps/api/schema.sql

# Windows (PowerShell)
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE corpemd;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d corpemd -f apps/api/schema.sql
```

Set DATABASE_URL in .env:
```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/corpemd
```

### Step 4 — Start Redis

```bash
# macOS
brew services start redis

# Windows — download from https://github.com/tporadowski/redis/releases
# or use WSL2: sudo service redis-server start
```

### Step 5 — Run in dev mode

```bash
npm run dev
```

This starts:
- API on http://localhost:3000
- Web UI on http://localhost:5173

Open http://localhost:5173 and log in with:
```
Email:    admin@corp.local
Password: changeme123
```

**Change this password immediately** — run:
```sql
UPDATE users SET password_hash = '$2a$12$<new hash>' WHERE email = 'admin@corp.local';
```
Generate a hash: `node -e "const b=require('bcryptjs');b.hash('newpassword',12).then(console.log)"`

---

## Step 6 — Connect Google AMAPI (required for real devices)

This is the only complex step. You need a Google Cloud project and a bound Android Enterprise.

### 6a. Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Click **New Project** — name it e.g. `corpemd-prod`
3. Note your **Project ID** (e.g. `corpemd-prod-123456`)

### 6b. Enable the Android Management API

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable androidmanagement.googleapis.com pubsub.googleapis.com
```

Or do it in the console: APIs & Services → Library → search "Android Management API" → Enable.

### 6c. Create a service account

```bash
gcloud iam service-accounts create corpemd-sa \
  --display-name="CorpEMD Service Account"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:corpemd-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/androidmanagement.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:corpemd-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"

# Download key
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=corpemd-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Minify the key for .env:
```bash
# macOS / Linux
cat sa-key.json | jq -c . 

# Windows PowerShell
(Get-Content sa-key.json | ConvertFrom-Json | ConvertTo-Json -Compress)
```

Paste the single-line JSON into .env as `GOOGLE_SERVICE_ACCOUNT_JSON`.

### 6d. Bind an Android Enterprise

```bash
# Get signup URL
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://androidmanagement.googleapis.com/v1/enterprises?projectId=YOUR_PROJECT_ID&signupUrlName=signupUrls/SIGNUP_URL"
```

Or use the AMAPI quickstart: https://developers.google.com/android/management/quickstart

Set `AMAPI_ENTERPRISE_ID` in .env to the `enterprises/LC0xxxxxxxxxx` value.

### 6e. Create a Pub/Sub subscription

```bash
gcloud pubsub topics create corpemd-device-events
gcloud pubsub subscriptions create corpemd-device-events-sub \
  --topic=corpemd-device-events \
  --push-endpoint=https://YOUR_DOMAIN/api/v1/pubsub

# Set in .env:
# PUBSUB_SUBSCRIPTION=corpemd-device-events-sub
```

---

## Production — Docker Compose

### Prerequisites
- Docker Desktop or Docker Engine + Compose plugin
- A server with a public IP (or just run locally)

### Step 1 — Clone and configure

```bash
git clone <your-repo-url> corpemd
cd corpemd
cp .env.example .env
# Edit .env — fill in POSTGRES_PASSWORD, JWT_SECRET, all Google fields
```

### Step 2 — Build and start

```bash
docker compose up -d --build
```

This starts: PostgreSQL, Redis, and the API. The schema runs automatically on first boot.

### Step 3 — Check it's running

```bash
docker compose ps
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{ "status": "healthy", "services": { "postgres": "ok", "redis": "ok" } }
```

### Step 4 — Run the web UI (development mode against Docker API)

```bash
# In a separate terminal
npm run dev -w apps/web
# Open http://localhost:5173
```

Or build the web app and serve via nginx:
```bash
npm run build -w apps/web
# Copy apps/web/dist to your web server / nginx root
```

### Useful commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f postgres

# Restart API after code change
docker compose restart api

# Connect to DB
docker compose exec postgres psql -U corpemd -d corpemd

# Stop everything
docker compose down

# Wipe data and start fresh
docker compose down -v
```

---

## Project structure

```
corpemd/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts        # Bootstrap: DB, Redis, BullMQ, AMAPI, routes
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts     # JWT verify + RBAC requireRole()
│   │   │   ├── services/
│   │   │   │   ├── audit.ts    # logAudit() helper
│   │   │   │   └── amapi.ts    # buildAmapiPolicy(), evaluateCompliance()
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts     # POST /login, /refresh
│   │   │   │   ├── devices.ts  # GET/PATCH/DELETE + POST /:id/commands
│   │   │   │   ├── enrollment.ts # POST /token, GET /tokens
│   │   │   │   ├── policies.ts # CRUD + /versions + /rollback
│   │   │   │   ├── groups.ts   # CRUD + /devices bulk assign
│   │   │   │   ├── audit.ts    # GET + /export.csv
│   │   │   │   ├── webhooks.ts # CRUD + /test
│   │   │   │   ├── users.ts    # CRUD (super_admin only)
│   │   │   │   └── health.ts   # GET /health
│   │   │   └── workers/
│   │   │       ├── pubsub.ts   # Google Pub/Sub consumer (device events)
│   │   │       ├── webhook.ts  # BullMQ webhook dispatcher (HMAC-SHA256)
│   │   │       └── commands.ts # BullMQ AMAPI command issuer
│   │   ├── schema.sql          # PostgreSQL schema (auto-runs in Docker)
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                    # React + Vite frontend
│       └── src/
│           ├── App.tsx         # Root: auth state, page routing
│           ├── lib/api.ts      # All fetch calls to backend
│           ├── components/
│           │   └── Layout.tsx  # Sidebar + topbar shell
│           └── pages/
│               ├── Login.tsx
│               ├── Dashboard.tsx
│               ├── Devices.tsx
│               └── AllPages.tsx  # Enroll, Policies, Groups, Audit,
│                                 # Webhooks, Users, Health
├── packages/
│   └── shared-types/           # TypeScript interfaces shared by API + Web
├── docker-compose.yml
├── .env.example
└── README.md  ← you are here
```

---

## Default credentials

```
Email:    admin@corp.local
Password: changeme123
Role:     super_admin
```

**Change the password before exposing to any network.**

---

## API quick reference

All endpoints: `http://localhost:3000/api/v1/`

```
POST   /auth/login                  → { token, refresh, user }
POST   /auth/refresh                → { token }

GET    /devices                     → { devices[], total }
GET    /devices/:id                 → { device }
PATCH  /devices/:id                 → { device }
POST   /devices/:id/commands        → 202 { jobId, status, type }
DELETE /devices/:id                 → 204

POST   /enrollment/token            → { tokenValue, shortCode, qrPayload, ... }
GET    /enrollment/tokens           → { tokens[] }

GET    /policies                    → { policies[] }
POST   /policies                    → 201 { policy }
PATCH  /policies/:id                → { policy }
GET    /policies/:id/versions       → { versions[] }
POST   /policies/:id/rollback       → { version }

GET    /groups                      → { groups[] }
POST   /groups                      → 201 { group }
POST   /groups/:id/devices          → { assigned }

GET    /audit-logs                  → { logs[], total }
GET    /audit-logs/export.csv       → CSV file

GET    /webhooks                    → { webhooks[] }
POST   /webhooks                    → 201 { id, secret }
POST   /webhooks/:id/test           → { queued }

GET    /users                       → { users[] }
POST   /users                       → 201 { user }

GET    /health                      → { status, services }
```

Full docs: `docs/API.md`
