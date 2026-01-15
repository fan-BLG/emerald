# Emerald Deployment Guide

Komplet guide til at deploye Emerald på gratis tiers.

## Oversigt

| Service | Formål | Pris |
|---------|--------|------|
| [Neon](https://neon.tech) | PostgreSQL database | Gratis |
| [Upstash](https://upstash.com) | Redis cache (optional) | Gratis |
| [Railway](https://railway.app) | Backend API | Gratis ($5 credit/måned) |
| [Vercel](https://vercel.com) | Frontend | Gratis |

**Total pris: $0/måned** (inden for gratis tiers)

---

## Trin 1: Database (Neon)

1. Gå til [neon.tech](https://neon.tech) og opret en konto
2. Klik **"Create Project"**
3. Vælg:
   - **Project name**: `emerald`
   - **Region**: `eu-central-1` (eller nærmest dig)
4. Kopier **Connection string** (ligner):
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

⚠️ **Vigtigt**: Gem denne connection string - du skal bruge den senere!

---

## Trin 2: Redis Cache (Upstash) - Optional

Redis bruges til caching og rate limiting. Kan springes over til start.

1. Gå til [upstash.com](https://upstash.com) og opret en konto
2. Klik **"Create Database"**
3. Vælg:
   - **Name**: `emerald-cache`
   - **Region**: Samme som Neon (eu-central-1)
   - **Type**: Regional
4. Kopier **REDIS_URL** fra dashboard

---

## Trin 3: Backend til Railway

### 3.1 Opret projekt

1. Gå til [railway.app](https://railway.app) og login med GitHub
2. Klik **"New Project"** → **"Deploy from GitHub repo"**
3. Vælg dit `emerald` repository
4. **VIGTIGT**: Under "Configure" sæt:
   - **Root Directory**: `apps/api`
   - **Watch Paths**: `/apps/api/**`, `/packages/shared/**`

### 3.2 Tilføj Environment Variables

Gå til **Variables** tab og tilføj:

| Variable | Værdi | Beskrivelse |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://...` | Fra Neon (trin 1) |
| `JWT_SECRET` | (generer) | 64+ random chars |
| `FRONTEND_URL` | `https://din-app.vercel.app` | Din Vercel URL |
| `STEAM_API_KEY` | Din Steam key | Fra [Steam Developer](https://steamcommunity.com/dev/apikey) |
| `NODE_ENV` | `production` | Production mode |
| `PORT` | `4000` | Railway sætter automatisk |

**Generer JWT_SECRET**:
```bash
openssl rand -hex 32
# eller brug: https://generate-secret.vercel.app/64
```

### 3.3 Deploy

1. Klik **"Deploy"**
2. Vent på build (2-5 min)
3. Gå til **Settings** → **Networking** → **Generate Domain**
4. Kopier din Railway URL (f.eks. `emerald-api.up.railway.app`)

### 3.4 Verificer

Tjek at API'et kører:
```bash
curl https://din-api.up.railway.app/health
# Skal returnere: {"status":"ok","timestamp":"..."}
```

---

## Trin 4: Frontend til Vercel

### 4.1 Opret projekt

1. Gå til [vercel.com](https://vercel.com) og login med GitHub
2. Klik **"Add New"** → **"Project"**
3. Vælg dit `emerald` repository
4. Under **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`

### 4.2 Environment Variables

Tilføj under **Environment Variables**:

| Variable | Værdi |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://din-api.up.railway.app` |
| `NEXT_PUBLIC_WS_URL` | `wss://din-api.up.railway.app` |
| `NEXT_PUBLIC_SITE_URL` | `https://din-app.vercel.app` |

### 4.3 Deploy

1. Klik **"Deploy"**
2. Vent på build (2-3 min)
3. Din frontend er live på Vercel URL!

---

## Trin 5: Opdater CORS

Efter du har din Vercel URL, gå tilbage til Railway og opdater:

```
FRONTEND_URL=https://din-app.vercel.app
```

Railway vil automatisk redeploy.

---

## Fejlfinding

### "Missing required environment variables"

```
❌ Missing required environment variables: DATABASE_URL, JWT_SECRET, FRONTEND_URL
```

**Løsning**: Tjek at alle environment variables er sat korrekt i Railway.

### "Database connection failed"

```
❌ Failed to start server: Can't reach database server
```

**Løsninger**:
1. Tjek at `DATABASE_URL` er korrekt
2. Tjek at Neon database er aktiv
3. Tjek at `?sslmode=require` er med i URL'en

### "CORS error" i frontend

**Løsning**: Tjek at `FRONTEND_URL` i Railway matcher din Vercel URL præcis (inkl. `https://`).

### Railway build fejler

**Mulige årsager**:
1. **Root Directory** ikke sat til `apps/api`
2. Prisma schema fejl - tjek `prisma/schema.prisma`
3. TypeScript fejl - kør `pnpm run build` lokalt først

### Socket.IO forbindelse fejler

**Løsning**: Tjek at:
1. `NEXT_PUBLIC_WS_URL` bruger `wss://` (ikke `ws://`)
2. Railway domain er korrekt
3. Frontend CORS URL matcher

---

## Lokalt Setup (Development)

```bash
# Installer dependencies
pnpm install

# Opret .env fil i apps/api/
cat > apps/api/.env << EOF
DATABASE_URL="postgresql://user:pass@localhost:5432/emerald"
JWT_SECRET="dev-secret-min-32-chars-long-here"
FRONTEND_URL="http://localhost:3000"
STEAM_API_KEY="din-steam-api-key"
EOF

# Generer Prisma client
cd apps/api && pnpm run db:generate

# Push schema til database
pnpm run db:push

# Kør seed (optional)
pnpm run db:seed

# Start backend
pnpm run dev

# I ny terminal - start frontend
cd apps/web && pnpm run dev
```

---

## Steam API Key

1. Gå til [Steam Developer](https://steamcommunity.com/dev/apikey)
2. Log ind med din Steam konto
3. Registrer et nyt domæne (brug din Vercel URL)
4. Kopier API key til `STEAM_API_KEY`

---

## Betalingsintegrationer (Optional)

### NOWPayments (Crypto)

1. Opret konto på [nowpayments.io](https://nowpayments.io)
2. Tilføj i Railway:
   - `NOWPAYMENTS_API_KEY`
   - `NOWPAYMENTS_IPN_SECRET`
3. Sæt IPN callback URL til: `https://din-api.up.railway.app/api/payments/nowpayments/ipn`

### Waxpeer (Skin Withdrawal)

1. Opret konto på [waxpeer.com](https://waxpeer.com)
2. Tilføj i Railway:
   - `WAXPEER_API_KEY`

---

## Checklist

- [ ] Neon database oprettet
- [ ] DATABASE_URL kopieret
- [ ] JWT_SECRET genereret (64+ chars)
- [ ] Steam API key hentet
- [ ] Railway projekt oprettet med root `apps/api`
- [ ] Alle Railway env vars sat
- [ ] Railway deployed og health check OK
- [ ] Vercel projekt oprettet med root `apps/web`
- [ ] Alle Vercel env vars sat
- [ ] FRONTEND_URL opdateret i Railway
- [ ] Test login med Steam
