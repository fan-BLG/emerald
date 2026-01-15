# Emerald Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Vercel      │     │     Railway     │     │    Neon/Supabase│
│   (Frontend)    │────▶│    (Backend)    │────▶│   (PostgreSQL)  │
│    Next.js      │     │  Fastify+Socket │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Upstash Redis │
                        │    (Caching)    │
                        └─────────────────┘
```

---

## Step 1: Database Setup (Neon - Free)

1. Go to [neon.tech](https://neon.tech) and create account
2. Create new project "emerald"
3. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb`)
4. Save this as `DATABASE_URL`

---

## Step 2: Redis Setup (Upstash - Free)

1. Go to [upstash.com](https://upstash.com) and create account
2. Create new Redis database
3. Copy the Redis URL (looks like `redis://default:xxx@eu1-xxx.upstash.io:6379`)
4. Save this as `REDIS_URL`

---

## Step 3: Deploy Backend to Railway

### Option A: One-click Deploy (Recommended)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select the `emerald` repository
4. Set root directory to `apps/api`
5. Add environment variables:

```env
# Required
DATABASE_URL=<your-neon-url>
REDIS_URL=<your-upstash-url>
JWT_SECRET=<generate-random-64-char-string>
FRONTEND_URL=https://your-app.vercel.app

# Steam (get from steamcommunity.com/dev/apikey)
STEAM_API_KEY=<your-steam-api-key>
STEAM_RETURN_URL=https://your-api.up.railway.app/api/auth/steam/return

# Payments (optional for MVP)
NOWPAYMENTS_API_KEY=<optional>
NOWPAYMENTS_IPN_SECRET=<optional>
WAXPEER_API_KEY=<optional>
```

6. Click "Deploy"
7. Once deployed, go to Settings → Networking → Generate Domain
8. Copy your Railway URL (e.g., `emerald-api-production.up.railway.app`)

### Option B: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd apps/api
railway init

# Link to project
railway link

# Deploy
railway up
```

---

## Step 4: Deploy Frontend to Vercel

### Option A: One-click Deploy (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New" → "Project"
3. Import the `emerald` repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && pnpm install && pnpm --filter @emerald/web build`
   - **Install Command**: `pnpm install`

5. Add environment variables:

```env
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-api.up.railway.app
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

6. Click "Deploy"

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from web directory
cd apps/web
vercel

# Follow prompts, set root directory to apps/web
```

---

## Step 5: Configure DNS (Optional)

### Custom Domain on Vercel
1. Go to Project Settings → Domains
2. Add your domain (e.g., `emerald.gg`)
3. Update DNS records as instructed

### Custom Domain on Railway
1. Go to Project Settings → Networking → Custom Domain
2. Add your API domain (e.g., `api.emerald.gg`)
3. Update DNS records as instructed

---

## Step 6: Run Database Migrations

After deploying the backend, run migrations:

```bash
# Via Railway CLI
railway run pnpm run db:push

# Or via Railway dashboard
# Go to your project → Settings → Railway Shell
# Run: pnpm run db:push
```

---

## Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Random 64+ char secret for JWT |
| `FRONTEND_URL` | Yes | Your Vercel frontend URL |
| `PORT` | No | Default: 4000 |
| `STEAM_API_KEY` | Yes | Steam Web API key |
| `STEAM_RETURN_URL` | Yes | `https://api.yourdomain.com/api/auth/steam/return` |
| `NOWPAYMENTS_API_KEY` | No | For crypto deposits |
| `NOWPAYMENTS_IPN_SECRET` | No | For payment webhooks |
| `WAXPEER_API_KEY` | No | For skin withdrawals |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Your Railway backend URL (https) |
| `NEXT_PUBLIC_WS_URL` | Yes | Your Railway backend URL (wss) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your Vercel frontend URL |

---

## Troubleshooting

### "WebSocket connection failed"
- Ensure `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- Ensure Railway domain is generated and accessible

### "Database connection error"
- Check `DATABASE_URL` format
- Ensure Neon database is active
- Run `railway run pnpm run db:push` to sync schema

### "CORS errors"
- Update `FRONTEND_URL` in Railway to match your Vercel URL exactly
- No trailing slash

### "Steam login not working"
- Update `STEAM_RETURN_URL` to your Railway domain
- Verify Steam API key is valid

---

## Cost Breakdown (Free Tier)

| Service | Free Tier | Paid Starts At |
|---------|-----------|----------------|
| Vercel | 100GB bandwidth, unlimited deploys | $20/mo |
| Railway | $5 credit/month, ~500 hours | $5/mo |
| Neon | 3GB storage, 1 compute | $19/mo |
| Upstash | 10K commands/day, 256MB | $10/mo |

**Total for MVP**: $0/month (within free tiers)

---

## Production Checklist

- [ ] Generate strong `JWT_SECRET` (64+ random chars)
- [ ] Set up Steam API key
- [ ] Configure CORS properly
- [ ] Enable HTTPS everywhere
- [ ] Set up monitoring (Railway has built-in)
- [ ] Configure rate limiting in production
- [ ] Set up database backups (Neon has auto-backup)
- [ ] Test WebSocket connections
- [ ] Verify provably fair system works
