# EMERALD - Technical Implementation Guide
## For Claude Code Development

---

## Tech Stack

```
Frontend:
├── Next.js 14+ (App Router)
├── Tailwind CSS + Framer Motion
├── Zustand (state management)
├── Socket.IO client
└── TypeScript

Backend:
├── Node.js/Express
├── PostgreSQL (Prisma ORM)
├── Redis (caching)
├── Socket.IO (real-time)
└── TypeScript

Infrastructure:
├── Database: PostgreSQL
├── Cache: Redis
├── Real-time: Socket.IO
└── Blockchain: EOS (provably fair seeds)
```

---

## Database Schema (Prisma)

**CRITICAL: All existing schemas are in apps/api/prisma/schema.prisma**

Key tables already implemented:
- `users` - Steam auth, balance, level, VIP
- `skins` - Marketing images for items
- `cases` - Case definitions
- `case_items` - Items inside cases with odds + **fixed coin values**
- `battles` - Case battle games
- `battle_participants` - Battle players
- `battle_rounds` - Round results
- `transactions` - Payment history
- `seeds` - Provably fair seed system
- `chat_messages` - Chat system
- `affiliates` - Referral tracking

**NEW TABLES NEEDED (add to schema):**

```prisma
// Coinflip games
model CoinFlipGame {
  id              String   @id @default(uuid())
  
  // Setup
  creatorId       String
  creator         User     @relation("CoinflipCreator", fields: [creatorId], references: [id])
  joinerIdString?
  joiner          User?    @relation("CoinflipJoiner", fields: [joinerId], references: [id])
  
  amount          Decimal  @db.Decimal(18,2)
  creatorSide     String   // "T" or "CT"
  
  // Provably fair
  serverSeed      String
  serverSeedHash  String
  publicSeed      String?
  nonce           Int      @default(0)
  
  // Result
  result          String?  // "T" or "CT"
  winnerId        String?
  
  status          String   @default("waiting") // waiting/in_progress/finished/cancelled
  
  createdAt       DateTime @default(now())
  finishedAt      DateTime?
  
  @@index([status])
  @@index([creatorId])
}

// Crash games
model CrashGame {
  id              String   @id @default(uuid())
  
  // Game state
  gameNumber      Int      @unique
  status          String   @default("betting") // betting/running/crashed
  
  // Provably fair
  serverSeed      String
  serverSeedHash  String
  publicSeed      String?
  
  // Result
  crashPoint      Decimal  @db.Decimal(10,2) // Multiplier when crashed
  
  startedAt       DateTime?
  crashedAt       DateTime?
  createdAt       DateTime @default(now())
  
  bets            CrashBet[]
  
  @@index([status])
  @@index([gameNumber])
}

model CrashBet {
  id              String   @id @default(uuid())
  
  gameId          String
  game            CrashGame @relation(fields: [gameId], references: [id])
  
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  
  amount          Decimal  @db.Decimal(18,2)
  cashoutAt       Decimal? @db.Decimal(10,2) // Multiplier they cashed out at
  profit          Decimal? @db.Decimal(18,2)
  
  status          String   @default("active") // active/cashedout/lost
  
  createdAt       DateTime @default(now())
  cashedOutAt     DateTime?
  
  @@index([gameId])
  @@index([userId])
}

// Roulette games
model RouletteGame {
  id              String   @id @default(uuid())
  
  gameNumber      Int      @unique
  status          String   @default("betting") // betting/rolling/finished
  
  // Provably fair
  serverSeed      String
  serverSeedHash  String
  publicSeed      String?
  nonce           Int      @default(0)
  
  // Result
  result          String?  // "red"/"blue"/"green"
  rollValue       Decimal? @db.Decimal(10,8)
  
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime @default(now())
  
  bets            RouletteBet[]
  
  @@index([status])
  @@index([gameNumber])
}

model RouletteBet {
  id              String   @id @default(uuid())
  
  gameId          String
  game            RouletteGame @relation(fields: [gameId], references: [id])
  
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  
  amount          Decimal  @db.Decimal(18,2)
  color           String   // "red"/"blue"/"green"
  profit          Decimal? @db.Decimal(18,2)
  
  won             Boolean?
  
  createdAt       DateTime @default(now())
  
  @@index([gameId])
  @@index([userId])
}
```

---

## Provably Fair System (CRITICAL)

**ALL games must use this system:**

```typescript
import crypto from 'crypto';

/**
 * Generate provably fair result
 * MUST be used for: Cases, Battles, Coinflip, Crash, Roulette
 */
export function generateResult(
  serverSeed: string,
  publicSeed: string,
  clientSeed: string,
  nonce: number
): { hash: string; rollValue: number } {
  
  // 1. Combine seeds using HMAC
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(`${publicSeed}:${clientSeed}:${nonce}`)
    .digest('hex');
  
  // 2. Take first 8 hex chars
  const hexSubstring = hash.substring(0, 8);
  const decimalValue = parseInt(hexSubstring, 16);
  
  // 3. Normalize to 0-1 range
  const rollValue = decimalValue / 0xFFFFFFFF;
  
  return { hash, rollValue };
}

/**
 * Get EOS blockchain hash for public seed
 */
export async function getEOSBlockHash(): Promise<string> {
  const { JsonRpc } = require('eosjs');
  const rpc = new JsonRpc('https://eos.greymass.com');
  
  const info = await rpc.get_info();
  const blockNum = info.last_irreversible_block_num;
  const block = await rpc.get_block(blockNum);
  
  return block.id;
}

/**
 * Generate server seed (keep secret until revealed)
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash server seed (show this to players BEFORE game)
 */
export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}
```

**Critical Flow:**
1. Generate `serverSeed` → hash it → show hash to players FIRST
2. Start game → get EOS `publicSeed`
3. For each roll: use `generateResult()` with player's `clientSeed` + `nonce`
4. After game: reveal `serverSeed` so players can verify

---

## Game Implementations

### COINFLIP

**Endpoints:**
```
POST /api/coinflip/create
Body: { amount: 50.00, side: "T" }

POST /api/coinflip/:id/join
Body: { side: "CT" }

GET /api/coinflip/active
GET /api/coinflip/:id
GET /api/coinflip/history
```

**Game Logic:**
```typescript
// Create
1. Deduct amount from creator balance
2. Generate serverSeed + hash
3. Store: creatorId, amount, creatorSide, serverSeedHash, status="waiting"

// Join
1. Verify game is "waiting"
2. Verify joiner has enough balance
3. Deduct amount from joiner
4. Get EOS publicSeed
5. Generate result:
   - Use creator's clientSeed + joiner's clientSeed (concatenated)
   - rollValue = generateResult(serverSeed, publicSeed, combinedClientSeeds, 0)
   - If rollValue < 0.475: result = "T"
   - If rollValue > 0.525: result = "CT"
   - Else (0.475-0.525 = 5% house edge): house wins, no payout
6. Determine winner
7. Credit winner (amount * 2 * 0.95)
8. Save result + reveal serverSeed

// Socket.IO events
socket.emit('coinflip:created', game);
socket.emit('coinflip:joined', game);
socket.emit('coinflip:result', { game, winner, rollValue });
```

**House Edge:** 5% (middle range 0.475-0.525)

---

### CRASH

**Endpoints:**
```
GET /api/crash/current
POST /api/crash/:gameId/bet
Body: { amount: 10.00, autoCashout: 2.50 }

POST /api/crash/:gameId/cashout

GET /api/crash/history
```

**Game Logic:**
```typescript
// Game Loop (runs continuously)
1. BETTING PHASE (10 seconds)
   - Players can place bets
   - Show countdown
   - Collect all bets

2. RUNNING PHASE
   - Get EOS publicSeed at start
   - Calculate crashPoint using provably fair:
     
     const e = Math.pow(2, 32);
     const h = parseInt(hash.substring(0, 8), 16);
     
     // House edge formula (8%)
     const houseEdgeMultiplier = 0.92;
     const result = Math.floor((100 * e - h) / (e - h) * houseEdgeMultiplier) / 100;
     const crashPoint = Math.max(1.00, Math.min(result, MAX_MULTIPLIER));
   
   - Start multiplier at 1.00x
   - Increment by ~0.01x every ~100ms
   - Emit multiplier updates to all clients
   - When multiplier >= crashPoint: CRASH
   
3. CRASHED PHASE
   - Reveal crashPoint
   - Reveal serverSeed (verification)
   - All active bets = LOST
   - All cashed-out bets = PROFIT (amount * cashoutMultiplier)
   - Wait 3 seconds → start new game

// Cashout
- Verify bet is active
- Verify game is still running
- Calculate profit: amount * currentMultiplier
- Credit user
- Mark bet as cashedout

// Socket.IO events
socket.emit('crash:betting', { gameId, timeLeft });
socket.emit('crash:started', { gameId, publicSeed });
socket.emit('crash:tick', { gameId, multiplier }); // Every 100ms
socket.emit('crash:crashed', { gameId, crashPoint, serverSeed });
socket.emit('crash:cashout', { userId, multiplier, profit });
```

**House Edge:** ~8% (in crash formula)

---

### ROULETTE

**Endpoints:**
```
GET /api/roulette/current
POST /api/roulette/:gameId/bet
Body: { amount: 25.00, color: "red" }

GET /api/roulette/history
```

**Game Logic:**
```typescript
// Game Loop (30 seconds per round)
1. BETTING PHASE (20 seconds)
   - Players place bets on: red/blue/green
   - Show countdown
   
2. ROLLING PHASE (7 seconds)
   - Get EOS publicSeed
   - Calculate result:
     
     const { rollValue } = generateResult(serverSeed, publicSeed, "roulette", nonce);
     
     let result: string;
     if (rollValue < 0.4865) result = "red";
     else if (rollValue < 0.9730) result = "blue";
     else result = "green"; // 0.9730 - 1.0000 = 2.7%
   
   - Animate wheel spinning
   - Emit rollValue updates
   
3. FINISHED PHASE (3 seconds)
   - Reveal result + serverSeed
   - Calculate payouts:
     * red/blue: 2x (48.65% chance each)
     * green: 14x (2.7% chance)
   - Credit winners
   - Start new game

// Socket.IO events
socket.emit('roulette:betting', { gameId, timeLeft });
socket.emit('roulette:rolling', { gameId, publicSeed });
socket.emit('roulette:result', { gameId, result, rollValue, serverSeed });
```

**House Edge:** ~6.6%
- Red/Blue: 48.65% × 2 = 97.3% RTP
- Green: 2.7% × 14 = 37.8% RTP
- Weighted average ≈ 93.4% RTP → 6.6% house edge

---

## REST API Endpoints (Base: /api/v1)

**Already Implemented:**
- `/auth/*` - Steam OAuth
- `/users/*` - User profiles, settings
- `/cases/*` - Case listings, opening
- `/battles/*` - Case battles (core system)
- `/payments/*` - NOWPayments deposits
- `/withdrawals/*` - Waxpeer withdrawals
- `/chat/*` - Chat system
- `/fair/*` - Provably fair verification
- `/leaderboard/*` - Leaderboards
- `/affiliate/*` - Affiliate system

**To Implement:**
- `/coinflip/*` - Coinflip games
- `/crash/*` - Crash games
- `/roulette/*` - Roulette games

---

## Socket.IO Events

**Namespaces:**
- `/` - Global events
- `/battles` - Battle-specific
- `/chat` - Chat rooms
- `/user` - User-specific

**Connection:**
```typescript
// Client
socket.emit('auth', { token: 'jwt_token' });

// Server response
socket.on('connected', { userId, balance, settings });
```

**Battle Events (REFERENCE - already implemented):**
```typescript
// Client → Server
socket.emit('battle:create', battleConfig);
socket.emit('battle:join', { battleId, position });
socket.emit('battle:spectate', { battleId });

// Server → Client
socket.on('battle:created', battle);
socket.on('battle:playerJoined', { battleId, player, position });
socket.on('battle:starting', { battleId, countdown, publicSeed });
socket.on('battle:roundResult', { battleId, round, results, scores });
socket.on('battle:finished', { battleId, winner, serverSeed });
```

**New Game Events (TO IMPLEMENT):**
```typescript
// Coinflip
socket.on('coinflip:created', game);
socket.on('coinflip:joined', game);
socket.on('coinflip:result', { game, winner });

// Crash
socket.on('crash:betting', { gameId, timeLeft });
socket.on('crash:started', { gameId, publicSeed });
socket.on('crash:tick', { gameId, multiplier });
socket.on('crash:crashed', { gameId, crashPoint, serverSeed });
socket.on('crash:cashout', { userId, multiplier, profit });

// Roulette
socket.on('roulette:betting', { gameId, timeLeft });
socket.on('roulette:rolling', { gameId });
socket.on('roulette:result', { gameId, result, rollValue, serverSeed });
```

---

## Payment Integrations

### NOWPayments (Deposits) - ALREADY IMPLEMENTED

```typescript
// Located in: apps/api/src/routes/payments.ts
// Already has: create deposit, check status, IPN webhook
```

### Waxpeer (Skin Withdrawals) - ALREADY IMPLEMENTED

```typescript
// Located in: apps/api/src/routes/payments.ts (withdrawals section)
// Already has: search skins, request withdrawal, check status
```

---

## Important Implementation Notes

### 1. Fixed Coin Value System
**CRITICAL:** Cases don't contain real skins!
- Skin images are just marketing
- Each case_item has a **fixed coin_value**
- Users win COINS, not skins
- Coins can be withdrawn as real skins via Waxpeer

### 2. House Edge Must Be In Algorithm
- Don't just "take 5%" after calculation
- Build it INTO the provably fair logic
- Players must be able to verify the house edge is fair

### 3. Balance Updates
- ALWAYS use database transactions
- Deduct BEFORE game starts
- Credit AFTER game finishes
- Emit balance updates via Socket.IO to user

### 4. Error Handling
```typescript
// Standard error response
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "You don't have enough coins",
    "details": { "required": 50.00, "current": 25.00 }
  }
}
```

### 5. Rate Limiting
- Prevent spam: max 1 game action per 2 seconds per user
- Use Redis for rate limit tracking
- Return 429 Too Many Requests if exceeded

---

## Frontend Pages (Already Exist)

**Current pages:**
- `/` - Homepage
- `/battles` - Case battles
- `/battles/create` - Create battle
- `/cases` - Case listings
- `/coinflip` - Coinflip (UI only, no backend)
- `/crash` - Crash (UI only, no backend)
- `/roulette` - Roulette (UI only, no backend)
- `/wallet` - Deposits/withdrawals
- `/profile` - User profile
- `/fair` - Provably fair info
- `/leaderboard` - Leaderboards

**Frontend stores (Zustand):**
- `authStore` - User auth state
- `battleStore` - Battle state
- `socketStore` - Socket.IO connection

---

## Development Priority

**NEXT TASKS (in order):**

1. **Coinflip Backend**
   - Add CoinFlipGame model to Prisma
   - Create `/api/coinflip/*` routes
   - Implement provably fair logic
   - Add Socket.IO events
   - Connect to existing frontend

2. **Crash Backend**
   - Add CrashGame/CrashBet models
   - Create `/api/crash/*` routes
   - Implement crash multiplier algorithm with house edge
   - Add game loop (betting → running → crashed)
   - Socket.IO real-time updates
   - Connect to frontend

3. **Roulette Backend**
   - Add RouletteGame/RouletteBet models
   - Create `/api/roulette/*` routes
   - Implement color selection logic
   - Add game loop (betting → rolling → result)
   - Socket.IO events
   - Connect to frontend

---

## Testing Strategy

**For FAKE BALANCE MVP:**
- Add `test_mode` flag to environment
- When `test_mode = true`:
  - Don't require real deposits
  - Users start with 1000 test coins
  - Balance updates work normally
  - All games function identically
  - Mark test accounts in database

**Transition to REAL MONEY:**
- Set `test_mode = false`
- Require deposits before playing
- All existing game logic works unchanged
- Get technical review before going live

---

## File Structure Reference

```
emerald/
├── apps/
│   ├── api/                    # Backend
│   │   ├── src/
│   │   │   ├── index.ts        # Main server
│   │   │   ├── routes/         # API endpoints
│   │   │   │   ├── auth.ts     # ✅ Done
│   │   │   │   ├── battles.ts  # ✅ Done
│   │   │   │   ├── cases.ts    # ✅ Done
│   │   │   │   ├── payments.ts # ✅ Done
│   │   │   │   ├── fair.ts     # ✅ Done
│   │   │   │   ├── coinflip.ts # ❌ TODO
│   │   │   │   ├── crash.ts    # ❌ TODO
│   │   │   │   └── roulette.ts # ❌ TODO
│   │   │   ├── services/       # Business logic
│   │   │   │   ├── battleService.ts      # ✅ Done (reference)
│   │   │   │   ├── provablyFair.ts       # ✅ Done
│   │   │   │   ├── coinflipService.ts    # ❌ TODO
│   │   │   │   ├── crashService.ts       # ❌ TODO
│   │   │   │   └── rouletteService.ts    # ❌ TODO
│   │   │   └── socket/
│   │   │       └── index.ts    # Socket.IO handlers
│   │   └── prisma/
│   │       └── schema.prisma   # Database schema
│   │
│   └── web/                    # Frontend
│       ├── app/                # Next.js pages
│       │   ├── coinflip/       # ✅ UI done, needs backend
│       │   ├── crash/          # ✅ UI done, needs backend
│       │   └── roulette/       # ✅ UI done, needs backend
│       ├── components/         # React components
│       └── stores/             # Zustand state
│
└── packages/
    └── shared/                 # Shared types/validation
        └── src/
            ├── types/          # TypeScript types
            └── validation/     # Zod schemas
```

---

## Color System (Minimal Reference)

```typescript
// Tailwind colors already configured
emerald: {
  600: '#059669',  // Primary green
  glow: '#00FF7F'  // Neon accent
}

dark: {
  base: '#0D0D0D',  // Background
  card: '#141414'   // Card background
}

// CS2 rarity colors (for items)
covert: '#eb4b4b',      // Red
classified: '#d32ce6',  // Pink
restricted: '#8847ff',  // Purple
milspec: '#4b69ff'      // Blue
```

---

## CRITICAL REMINDERS

1. **ALL games MUST use provably fair system**
2. **House edge MUST be in the algorithm, not just "taken after"**
3. **Always use database transactions for balance updates**
4. **Emit Socket.IO events for real-time updates**
5. **Follow existing battleService.ts pattern for structure**
6. **Test with FAKE BALANCE first**
7. **Document ALL endpoints and Socket events**
8. **Verify hash consistency (serverSeedHash must match revealed seed)**

---

## Quick Reference: Existing Working Code

**Provably Fair (REFERENCE):**
`apps/api/src/services/provablyFair.ts`

**Battle Service (REFERENCE PATTERN):**
`apps/api/src/services/battleService.ts`

**Battle Routes (REFERENCE PATTERN):**
`apps/api/src/routes/battles.ts`

**Socket.IO Setup:**
`apps/api/src/socket/index.ts`

**Database Schema:**
`apps/api/prisma/schema.prisma`

---

## END OF TECHNICAL SPEC

This document contains ONLY the technical requirements needed to implement Coinflip, Crash, and Roulette games. All business logic, marketing content, and non-technical information has been removed.

For implementation questions, reference the existing Battle system code as a pattern.
