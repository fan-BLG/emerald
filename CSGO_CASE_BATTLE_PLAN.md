# Emerald - CS2 Case Battle Platform
## Komplet A-Z Udviklingsplan

---

## Executive Summary

Dette dokument beskriver den komplette plan for at bygge en CS2 skin gambling platform med **Case Battles** som hovedfokus. Platformen vil konkurrere med CSGOEmpire, Rain.gg, DatDrop og CSGORoll ved at tilbyde innovative case battle features, custom cases og en førsteklasses brugeroplevelse.

---

## Del 1: Forretningsgrundlag

### 1.1 Markedsanalyse

**Markedsstørrelse:**
- CS2 skin gambling industrien estimeres til ~$5 milliarder
- Case battles er den hurtigst voksende segment
- CSGOEmpire har 2.3M+ månedlige besøgende
- Rain.gg er den hurtigst voksende platform

**Konkurrenter:**
| Platform | Styrker | Svagheder |
|----------|---------|-----------|
| CSGOEmpire | Størst, mest troværdig, bred spilleportefølje | Mindre fokus på case battles |
| Rain.gg | Bedste case battles, crazy mode, jackpot | Nyere, mindre etableret |
| DatDrop | Battle Royale (72 spillere), custom battles | UI kunne være bedre |
| CSGORoll | Stor skinportefølje, god VIP | Case battles ikke hovedfokus |
| Clash.gg | Custom battle setups | Mindre brugerbase |

### 1.2 Vores Differentiatorer

1. **Custom Case Creator** - Brugere kan designe egne cases
2. **Avancerede Battle Modes** - Flere unikke modes end konkurrenterne
3. **Social Gaming** - Streaming integration, chat, communities
4. **Bedste Odds** - Lavere house edge på case battles (5-6%)
5. **Instant Withdrawals** - Hurtigste skin udbetalinger i branchen

### 1.3 Projektfase

> **NOTE:** Dette projekt starter som privat/closed beta. Juridisk struktur og licensering håndteres i en senere fase når platformen er klar til offentlig launch.

**Fase 1 (Nu):** Privat udvikling, ingen licens påkrævet
**Fase 2 (Senere):** Curacao Gaming License (~€47,000/år) når vi går public

---

## Del 2: Teknisk Arkitektur

### 2.1 Tech Stack

```
Frontend:
├── Framework: Next.js 14+ (React)
├── Styling: Tailwind CSS + Framer Motion
├── State: Zustand / Redux Toolkit
├── Real-time: Socket.IO client
├── 3D/Animations: Three.js (case åbninger)
└── Mobile: React Native (senere fase)

Backend:
├── Runtime: Node.js (Bun for performance)
├── Framework: Fastify / NestJS
├── Database: PostgreSQL (primær)
├── Cache: Redis (sessions, real-time data)
├── Queue: BullMQ (job processing)
├── Search: Elasticsearch (skins katalog)
└── Real-time: Socket.IO

Infrastructure (LOW COST):
├── Cloud: Hetzner / DigitalOcean (IKKE AWS - for dyrt)
│   ├── Hetzner CX31: €10/måned (4 vCPU, 8GB RAM)
│   ├── Hetzner CX41: €18/måned (8 vCPU, 16GB RAM)
│   └── Database: Hetzner managed PostgreSQL ~€15/måned
├── CDN: Cloudflare (gratis tier)
├── Containers: Docker Compose (ikke K8s til start)
├── CI/CD: GitHub Actions (gratis)
└── Monitoring: Grafana Cloud (gratis tier) / Uptime Robot

Blockchain/Provably Fair:
├── Hash: SHA-256
├── Verification: EOS blockchain (public seed)
└── RNG: Cryptographically secure
```

### 2.2 Database Schema (Hovedtabeller)

```sql
-- Brugere
users (
  id, steam_id, username, avatar,
  email, balance, level, xp,
  vip_tier, total_wagered, created_at
)

-- Skins Inventory
skins (
  id, name, market_hash_name, image_url,
  rarity, price_usd, wear_value,
  collection, weapon_type, stattrack
)

-- Cases
cases (
  id, name, image_url, price,
  house_edge, is_custom, creator_id,
  items (JSON array med skin_id + odds)
)

-- Case Battles
battles (
  id, type, mode, status,
  max_players, current_players,
  cases (JSON array), total_value,
  server_seed_hash, public_seed,
  winner_id, created_at
)

-- Battle Participants
battle_participants (
  id, battle_id, user_id, team,
  position, total_value, items_won (JSON)
)

-- Transactions
transactions (
  id, user_id, type, amount,
  method, status, reference_id
)

-- Provably Fair Seeds
seeds (
  id, user_id, server_seed, server_seed_hash,
  client_seed, nonce, revealed_at
)
```

### 2.3 Detaljeret Database Schema

```sql
-- =====================================================
-- EMERALD DATABASE SCHEMA (PostgreSQL)
-- =====================================================

-- ==================== USERS ====================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    steam_id        VARCHAR(20) UNIQUE NOT NULL,
    username        VARCHAR(32) NOT NULL,
    avatar_url      TEXT,
    email           VARCHAR(255),

    -- Balance & Economy
    balance         DECIMAL(18,2) DEFAULT 0.00,  -- Emerald Coins
    total_deposited DECIMAL(18,2) DEFAULT 0.00,
    total_withdrawn DECIMAL(18,2) DEFAULT 0.00,
    total_wagered   DECIMAL(18,2) DEFAULT 0.00,
    total_won       DECIMAL(18,2) DEFAULT 0.00,

    -- Leveling
    level           INTEGER DEFAULT 1,
    xp              BIGINT DEFAULT 0,
    vip_tier        VARCHAR(20) DEFAULT 'bronze',  -- bronze/silver/gold/platinum/diamond/emerald

    -- Settings
    emerald_spin_enabled  BOOLEAN DEFAULT true,
    client_seed           VARCHAR(64),

    -- Security
    is_banned       BOOLEAN DEFAULT false,
    ban_reason      TEXT,
    is_2fa_enabled  BOOLEAN DEFAULT false,

    -- Timestamps
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    last_login_at   TIMESTAMP
);

-- ==================== SKINS (Marketing Images) ====================
CREATE TABLE skins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,           -- "AWP | Dragon Lore"
    market_hash_name VARCHAR(150) NOT NULL UNIQUE,   -- Steam market name
    image_url       TEXT NOT NULL,

    -- Properties
    rarity          VARCHAR(20) NOT NULL,  -- consumer/industrial/milspec/restricted/classified/covert/contraband
    weapon_type     VARCHAR(30),           -- knife/rifle/pistol/smg/shotgun/machinegun
    collection      VARCHAR(100),
    exterior        VARCHAR(30),           -- fn/mw/ft/ww/bs
    is_stattrak     BOOLEAN DEFAULT false,

    -- For display purposes only (actual value in case_items)
    display_price   DECIMAL(18,2),

    created_at      TIMESTAMP DEFAULT NOW()
);

-- ==================== CASES ====================
CREATE TABLE cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    image_url       TEXT NOT NULL,

    -- Pricing
    price           DECIMAL(18,2) NOT NULL,  -- Cost to open
    house_edge      DECIMAL(5,2) DEFAULT 8.00,  -- Percentage

    -- Type
    is_custom       BOOLEAN DEFAULT false,
    creator_id      UUID REFERENCES users(id),
    is_featured     BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,

    -- Stats
    total_opened    BIGINT DEFAULT 0,

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ==================== CASE ITEMS (Skin drops i cases) ====================
CREATE TABLE case_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    skin_id         UUID NOT NULL REFERENCES skins(id),

    -- VIGTIGT: Fast coin værdi (ikke skin værdi!)
    coin_value      DECIMAL(18,2) NOT NULL,  -- Hvad brugeren vinder i coins

    -- Odds
    odds_weight     INTEGER NOT NULL,  -- Relativ vægt (fx 1, 10, 100, 1000)
    odds_percentage DECIMAL(8,5),      -- Kalkuleret procent

    UNIQUE(case_id, skin_id)
);

-- ==================== BATTLES ====================
CREATE TABLE battles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Battle setup
    type            VARCHAR(20) NOT NULL,    -- standard/team/shared
    mode            VARCHAR(20) NOT NULL,    -- normal/crazy/cursed/progressive/mystery
    max_players     INTEGER NOT NULL,        -- 2, 3, 4
    team_size       INTEGER DEFAULT 1,       -- 1 for standard, 2 for 2v2, etc.

    -- Options
    is_private      BOOLEAN DEFAULT false,
    private_code    VARCHAR(20),
    is_fast_mode    BOOLEAN DEFAULT false,
    emerald_spin    BOOLEAN DEFAULT true,

    -- Status
    status          VARCHAR(20) DEFAULT 'waiting',  -- waiting/starting/in_progress/finished/cancelled
    current_round   INTEGER DEFAULT 0,
    total_rounds    INTEGER NOT NULL,

    -- Economics
    cost_per_player DECIMAL(18,2) NOT NULL,
    total_value     DECIMAL(18,2) DEFAULT 0.00,

    -- Provably Fair
    server_seed         VARCHAR(64) NOT NULL,
    server_seed_hash    VARCHAR(64) NOT NULL,  -- Vises FØR battle
    public_seed         VARCHAR(64),            -- EOS block hash (set ved start)

    -- Results
    winner_id       UUID REFERENCES users(id),
    winning_team    INTEGER,

    -- Creator
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    started_at      TIMESTAMP,
    finished_at     TIMESTAMP
);

-- ==================== BATTLE CASES (Hvilke cases i battle) ====================
CREATE TABLE battle_cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id       UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    case_id         UUID NOT NULL REFERENCES cases(id),
    round_number    INTEGER NOT NULL,

    UNIQUE(battle_id, round_number)
);

-- ==================== BATTLE PARTICIPANTS ====================
CREATE TABLE battle_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id       UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),

    position        INTEGER NOT NULL,  -- 0, 1, 2, 3
    team            INTEGER,           -- For team battles

    -- Results
    total_value     DECIMAL(18,2) DEFAULT 0.00,
    is_winner       BOOLEAN DEFAULT false,

    joined_at       TIMESTAMP DEFAULT NOW(),

    UNIQUE(battle_id, user_id),
    UNIQUE(battle_id, position)
);

-- ==================== BATTLE ROUNDS (Results per round per player) ====================
CREATE TABLE battle_rounds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id       UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    participant_id  UUID NOT NULL REFERENCES battle_participants(id) ON DELETE CASCADE,
    round_number    INTEGER NOT NULL,

    -- Result
    case_item_id    UUID NOT NULL REFERENCES case_items(id),
    coin_value      DECIMAL(18,2) NOT NULL,

    -- Provably Fair
    nonce           INTEGER NOT NULL,
    roll_value      DECIMAL(20,10) NOT NULL,  -- 0-1 value fra hash

    -- Emerald Spin trigger?
    triggered_emerald_spin BOOLEAN DEFAULT false,

    created_at      TIMESTAMP DEFAULT NOW(),

    UNIQUE(battle_id, participant_id, round_number)
);

-- ==================== TRANSACTIONS ====================
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    type            VARCHAR(30) NOT NULL,  -- deposit/withdrawal/battle_entry/battle_win/case_open/case_win/bonus/rakeback
    amount          DECIMAL(18,2) NOT NULL,

    -- Reference
    reference_type  VARCHAR(30),  -- battle/case/withdrawal/deposit
    reference_id    UUID,

    -- Status
    status          VARCHAR(20) DEFAULT 'completed',  -- pending/completed/failed/cancelled

    -- Metadata
    description     TEXT,
    metadata        JSONB,

    created_at      TIMESTAMP DEFAULT NOW()
);

-- ==================== CRYPTO DEPOSITS (NOWPayments) ====================
CREATE TABLE crypto_deposits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- NOWPayments data
    payment_id      VARCHAR(100) UNIQUE,
    payment_status  VARCHAR(30),  -- waiting/confirming/confirmed/sending/partially_paid/finished/failed/refunded/expired

    pay_address     TEXT,
    pay_currency    VARCHAR(10),  -- BTC/ETH/USDT/etc
    pay_amount      DECIMAL(18,8),

    -- Conversion
    price_currency  VARCHAR(10) DEFAULT 'USD',
    price_amount    DECIMAL(18,2),  -- USD amount

    actually_paid   DECIMAL(18,8) DEFAULT 0,

    -- Credit
    coins_credited  DECIMAL(18,2) DEFAULT 0,
    credited_at     TIMESTAMP,

    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP
);

-- ==================== SKIN WITHDRAWALS (Waxpeer) ====================
CREATE TABLE skin_withdrawals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Withdrawal details
    coin_amount     DECIMAL(18,2) NOT NULL,  -- Coins brugt

    -- Waxpeer data
    waxpeer_item_id VARCHAR(100),
    skin_name       VARCHAR(150),
    trade_link      TEXT NOT NULL,

    -- Status
    status          VARCHAR(30) DEFAULT 'pending',  -- pending/processing/sent/completed/failed/cancelled
    waxpeer_trade_id VARCHAR(100),

    -- Timestamps
    created_at      TIMESTAMP DEFAULT NOW(),
    processed_at    TIMESTAMP,
    completed_at    TIMESTAMP,

    error_message   TEXT
);

-- ==================== USER SEEDS (Provably Fair) ====================
CREATE TABLE user_seeds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    server_seed     VARCHAR(64) NOT NULL,
    server_seed_hash VARCHAR(64) NOT NULL,
    client_seed     VARCHAR(64) NOT NULL,
    nonce           INTEGER DEFAULT 0,

    is_active       BOOLEAN DEFAULT true,
    revealed_at     TIMESTAMP,  -- Når server seed afsløres

    created_at      TIMESTAMP DEFAULT NOW()
);

-- ==================== CHAT MESSAGES ====================
CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    room            VARCHAR(30) DEFAULT 'global',  -- global/english/russian
    message         TEXT NOT NULL,

    is_deleted      BOOLEAN DEFAULT false,
    deleted_by      UUID REFERENCES users(id),

    created_at      TIMESTAMP DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX idx_users_steam_id ON users(steam_id);
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_created_at ON battles(created_at DESC);
CREATE INDEX idx_battle_participants_user ON battle_participants(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_crypto_deposits_payment_id ON crypto_deposits(payment_id);
CREATE INDEX idx_skin_withdrawals_user ON skin_withdrawals(user_id);
CREATE INDEX idx_chat_messages_room ON chat_messages(room, created_at DESC);
```

### 2.4 Systemarkitektur Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Web    │  │  Mobile  │  │  Stream  │  │   API    │     │
│  │  (Next)  │  │  (RN)    │  │ Overlay  │  │ Partners │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE CDN                          │
│              (DDoS Protection, Caching, WAF)                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                            │
│                  (AWS ALB / Nginx)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   API Server  │ │   API Server  │ │   API Server  │
│   (Node.js)   │ │   (Node.js)   │ │   (Node.js)   │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   PostgreSQL  │ │     Redis     │ │  Socket.IO    │
│   (Primary)   │ │   (Cache)     │ │   Cluster     │
└───────────────┘ └───────────────┘ └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│              MICROSERVICES                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Trade  │ │  Battle │ │ Payment │ │  Fair   │ │
│  │   Bot   │ │  Engine │ │ Gateway │ │ System  │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
└───────────────────────────────────────────────────┘
```

### 2.5 Socket.IO Events (Real-time Communication)

```
╔═══════════════════════════════════════════════════════════════════╗
║                     SOCKET.IO EVENT SYSTEM                        ║
╠═══════════════════════════════════════════════════════════════════╣

NAMESPACES:
├── /              (default - global events)
├── /battles       (battle-specific events)
├── /chat          (chat rooms)
└── /user          (user-specific notifications)

════════════════════════════════════════════════════════════════════
CLIENT → SERVER EVENTS:
════════════════════════════════════════════════════════════════════

// Authentication
socket.emit('auth', { token: 'jwt_token' });

// Battles
socket.emit('battle:create', {
  type: 'standard',           // standard/team/shared
  mode: 'normal',             // normal/crazy/cursed/progressive/mystery
  maxPlayers: 2,
  cases: ['case_id_1', 'case_id_2'],
  options: {
    isPrivate: false,
    isFastMode: false,
    emeraldSpin: true
  }
});

socket.emit('battle:join', {
  battleId: 'uuid',
  position: 1,                // 0-3
  team: null                  // for team battles
});

socket.emit('battle:leave', { battleId: 'uuid' });

socket.emit('battle:spectate', { battleId: 'uuid' });
socket.emit('battle:unspectate', { battleId: 'uuid' });

// Chat
socket.emit('chat:message', {
  room: 'global',             // global/english/russian
  message: 'Hello world!'
});

socket.emit('chat:join', { room: 'english' });
socket.emit('chat:leave', { room: 'english' });

// User Actions
socket.emit('user:updateSeed', { clientSeed: 'new_seed_123' });
socket.emit('user:toggleEmeraldSpin', { enabled: true });

════════════════════════════════════════════════════════════════════
SERVER → CLIENT EVENTS:
════════════════════════════════════════════════════════════════════

// Connection
socket.on('connected', { userId, balance, settings });
socket.on('error', { code, message });

// Battle Lifecycle
socket.on('battle:created', {
  id: 'uuid',
  type: 'standard',
  mode: 'normal',
  maxPlayers: 2,
  cases: [...],
  costPerPlayer: 50.00,
  serverSeedHash: 'sha256_hash',
  createdBy: { id, username, avatar },
  status: 'waiting'
});

socket.on('battle:playerJoined', {
  battleId: 'uuid',
  position: 1,
  player: { id, username, avatar, level }
});

socket.on('battle:playerLeft', {
  battleId: 'uuid',
  position: 1,
  userId: 'uuid'
});

socket.on('battle:starting', {
  battleId: 'uuid',
  countdown: 3,              // seconds
  publicSeed: 'eos_block_hash'
});

socket.on('battle:roundStart', {
  battleId: 'uuid',
  round: 1,
  totalRounds: 5,
  case: { id, name, imageUrl, price }
});

// THE MAIN EVENT - Spin Results
socket.on('battle:roundResult', {
  battleId: 'uuid',
  round: 1,
  results: [
    {
      position: 0,
      playerId: 'uuid',
      item: {
        skinId: 'uuid',
        name: 'AWP | Dragon Lore',
        imageUrl: '...',
        rarity: 'covert',
        coinValue: 250.00
      },
      isEmeraldSpin: true,    // Trigger special animation!
      nonce: 1,
      rollValue: 0.00234      // For verification
    },
    {
      position: 1,
      playerId: 'uuid',
      item: { ... },
      isEmeraldSpin: false,
      nonce: 1,
      rollValue: 0.45678
    }
  ],
  roundWinner: 0,             // Position of round winner (or null for tie)
  scores: [
    { position: 0, total: 250.00 },
    { position: 1, total: 45.00 }
  ]
});

socket.on('battle:finished', {
  battleId: 'uuid',
  winner: {
    position: 0,
    userId: 'uuid',
    username: 'Winner123',
    totalValue: 520.00
  },
  loser: { ... },
  serverSeed: 'revealed_seed',  // NOW can verify!
  allItems: [...]               // All items won
});

socket.on('battle:cancelled', {
  battleId: 'uuid',
  reason: 'creator_left',
  refunded: true
});

// Chat Events
socket.on('chat:message', {
  id: 'uuid',
  room: 'global',
  user: { id, username, avatar, level, vipTier },
  message: 'Hello!',
  timestamp: 1234567890
});

socket.on('chat:deleted', { messageId: 'uuid' });

// Global Events (all users)
socket.on('global:bigWin', {
  userId: 'uuid',
  username: 'LuckyUser',
  game: 'battle',
  item: { name: 'Karambit | Emerald', value: 12500.00 },
  multiplier: 125.0
});

socket.on('global:battleCreated', {
  battleId: 'uuid',
  type: 'standard',
  totalValue: 500.00,
  creator: { username, avatar }
});

// User-specific Events
socket.on('user:balanceUpdate', {
  balance: 127.84,
  change: -50.00,
  reason: 'battle_entry'
});

socket.on('user:notification', {
  type: 'withdrawal_complete',
  title: 'Withdrawal Sent!',
  message: 'Your AWP | Asiimov has been sent to your Steam account',
  data: { ... }
});

socket.on('user:levelUp', {
  newLevel: 25,
  rewards: { ... }
});

╚═══════════════════════════════════════════════════════════════════╝

ROOMS & BROADCASTING:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  battle:{battleId}     → Alle i specifik battle + spectators    │
│  chat:{room}           → Alle i chat room                       │
│  user:{odId}           → Kun specifik bruger (private events)   │
│  global                → Alle connected users                    │
│                                                                 │
│  EKSEMPEL (Server-side):                                        │
│  io.to(`battle:${battleId}`).emit('battle:roundResult', data);  │
│  io.to('global').emit('global:bigWin', data);                   │
│  io.to(`user:${userId}`).emit('user:balanceUpdate', data);      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 REST API Endpoints

```
╔═══════════════════════════════════════════════════════════════════╗
║                     EMERALD REST API v1                           ║
║                     Base URL: /api/v1                             ║
╠═══════════════════════════════════════════════════════════════════╣

═══════════════════════════════════════════════════════════════════
AUTH ENDPOINTS:
═══════════════════════════════════════════════════════════════════

GET    /auth/steam              → Redirect til Steam OAuth
GET    /auth/steam/callback     → Steam OAuth callback
POST   /auth/refresh            → Refresh JWT token
POST   /auth/logout             → Invalidate session
GET    /auth/me                 → Get current user info

═══════════════════════════════════════════════════════════════════
USER ENDPOINTS:
═══════════════════════════════════════════════════════════════════

GET    /users/:id               → Get user profile (public info)
GET    /users/:id/stats         → Get user statistics
GET    /users/:id/history       → Get game history
PUT    /users/settings          → Update user settings
PUT    /users/client-seed       → Update client seed
GET    /users/transactions      → Get transaction history
GET    /users/notifications     → Get notifications

═══════════════════════════════════════════════════════════════════
CASES ENDPOINTS:
═══════════════════════════════════════════════════════════════════

GET    /cases                   → List all cases
       ?featured=true           → Only featured
       ?category=low-risk       → Filter by category
       ?sort=popular            → Sort order
       ?page=1&limit=20         → Pagination

GET    /cases/:id               → Get case details with items
GET    /cases/:id/drops         → Get recent drops from case
POST   /cases/:id/open          → Open a case (solo)

── Body: { count: 1 }           → Number of cases to open
── Response: { items: [...], newBalance }

GET    /cases/custom            → List custom cases
POST   /cases/custom            → Create custom case
PUT    /cases/custom/:id        → Update custom case (draft only)
DELETE /cases/custom/:id        → Delete custom case (draft only)

═══════════════════════════════════════════════════════════════════
BATTLES ENDPOINTS: (HOVEDFOKUS)
═══════════════════════════════════════════════════════════════════

GET    /battles                 → List active battles
       ?status=waiting          → Filter by status
       ?type=standard           → Filter by type
       ?mode=crazy              → Filter by mode
       ?minPrice=10             → Min price filter
       ?maxPrice=1000           → Max price filter
       ?sort=newest             → Sort order

GET    /battles/:id             → Get battle details
GET    /battles/:id/verify      → Get provably fair data

POST   /battles                 → Create new battle
── Body: {
     type: 'standard',
     mode: 'normal',
     maxPlayers: 2,
     cases: ['case_id_1', 'case_id_2'],
     options: {
       isPrivate: false,
       isFastMode: false,
       emeraldSpin: true
     }
   }
── Response: { battle, serverSeedHash }

POST   /battles/:id/join        → Join a battle
── Body: { position: 1, team: null }
── Response: { success, battle }

POST   /battles/:id/leave       → Leave a waiting battle
DELETE /battles/:id             → Cancel battle (creator only, if waiting)

POST   /battles/random          → Generate random battle ("Create for me")
── Body: {
     budget: 50.00,
     minCases: 5
   }
── Response: { suggestedBattle }  → Preview, not created yet

POST   /battles/random/create   → Actually create the random battle
── Body: { suggestedBattleId }

GET    /battles/history         → User's battle history
GET    /battles/history/:id     → Detailed battle result with replay data

═══════════════════════════════════════════════════════════════════
PAYMENTS ENDPOINTS:
═══════════════════════════════════════════════════════════════════

── DEPOSITS (NOWPayments) ──

GET    /payments/currencies     → List supported crypto currencies
POST   /payments/deposit        → Create deposit request
── Body: {
     amount: 100.00,            → USD amount
     currency: 'BTC'            → Crypto to pay with
   }
── Response: {
     paymentId,
     payAddress,
     payAmount,                 → Amount in crypto
     expiresAt,
     qrCodeUrl
   }

GET    /payments/deposit/:id    → Check deposit status
POST   /payments/deposit/webhook → NOWPayments IPN webhook (internal)

── WITHDRAWALS (Waxpeer) ──

GET    /withdrawals/skins       → Search available skins on Waxpeer
       ?query=awp               → Search query
       ?minPrice=10             → Min price
       ?maxPrice=500            → Max price

POST   /withdrawals/request     → Request skin withdrawal
── Body: {
     waxpeerItemId: '123456',
     tradeLink: 'https://steamcommunity.com/tradeoffer/...'
   }
── Response: { withdrawalId, status, estimatedTime }

GET    /withdrawals/:id         → Check withdrawal status
GET    /withdrawals/history     → User's withdrawal history

POST   /withdrawals/crypto      → Crypto withdrawal (alternative)
── Body: {
     amount: 50.00,
     currency: 'USDT',
     address: '0x...'
   }

═══════════════════════════════════════════════════════════════════
PROVABLY FAIR ENDPOINTS:
═══════════════════════════════════════════════════════════════════

GET    /fair/seeds              → Get user's current seeds
POST   /fair/seeds/rotate       → Rotate server seed (reveals old)
── Response: {
     revealedSeed: '...',       → Old server seed (can now verify)
     newServerSeedHash: '...',  → New hashed seed
     nonce: 0                   → Reset nonce
   }

GET    /fair/verify/:gameId     → Get verification data for game
POST   /fair/calculate          → Calculate result from seeds
── Body: {
     serverSeed,
     publicSeed,
     clientSeed,
     nonce,
     gameMode
   }
── Response: { rollValue, itemIndex }

═══════════════════════════════════════════════════════════════════
LEADERBOARD & STATS:
═══════════════════════════════════════════════════════════════════

GET    /leaderboard/daily       → Daily wagering leaderboard
GET    /leaderboard/weekly      → Weekly leaderboard
GET    /leaderboard/monthly     → Monthly leaderboard
GET    /leaderboard/alltime     → All-time leaderboard

GET    /stats/global            → Global platform stats
── Response: {
     totalUsers,
     totalBattles,
     totalWagered,
     biggestWin,
     onlineNow
   }

GET    /stats/live              → Live activity feed

═══════════════════════════════════════════════════════════════════
CHAT ENDPOINTS:
═══════════════════════════════════════════════════════════════════

GET    /chat/:room/history      → Get chat history
       ?before=timestamp        → Pagination
       ?limit=50

POST   /chat/:room/message      → Send message (also via Socket.IO)
DELETE /chat/message/:id        → Delete message (mods only)

═══════════════════════════════════════════════════════════════════
AFFILIATE ENDPOINTS:
═══════════════════════════════════════════════════════════════════

GET    /affiliate/stats         → Get affiliate statistics
GET    /affiliate/referrals     → List referred users
POST   /affiliate/withdraw      → Withdraw affiliate earnings
PUT    /affiliate/code          → Update affiliate code

╚═══════════════════════════════════════════════════════════════════╝

ERROR RESPONSES:
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "You don't have enough coins to join this battle",
    "details": { "required": 50.00, "current": 25.00 }
  }
}

COMMON ERROR CODES:
├── AUTH_REQUIRED          → Not authenticated
├── AUTH_EXPIRED           → Token expired
├── FORBIDDEN              → No permission
├── NOT_FOUND              → Resource not found
├── INSUFFICIENT_BALANCE   → Not enough coins
├── BATTLE_FULL            → Battle is full
├── BATTLE_STARTED         → Battle already started
├── INVALID_INPUT          → Validation error
├── RATE_LIMITED           → Too many requests
└── INTERNAL_ERROR         → Server error
```

### 2.7 Provably Fair Implementation (Detaljeret)

```
╔═══════════════════════════════════════════════════════════════════╗
║              PROVABLY FAIR SYSTEM - TECHNICAL DEEP DIVE           ║
╠═══════════════════════════════════════════════════════════════════╣

OVERVIEW:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Provably Fair sikrer at:                                       │
│  1. Vi IKKE kan manipulere resultater EFTER bet er placeret    │
│  2. Brugeren KAN verificere at resultatet var fair             │
│  3. Resultatet var uforudsigeligt for BEGGE parter             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
SEED COMPONENTS:
═══════════════════════════════════════════════════════════════════

1. SERVER SEED (Hemmeligt - kontrolleret af os)
   ├── Genereret: crypto.randomBytes(32).toString('hex')
   ├── Længde: 64 hex chars (256 bits)
   ├── Hashet FØR spil: SHA256(serverSeed)
   ├── Afsløret EFTER seed rotation
   └── Eksempel: "a1b2c3d4e5f6...64chars"

2. CLIENT SEED (Synligt - kontrolleret af bruger)
   ├── Default: Genereret ved signup
   ├── Kan ændres når som helst af bruger
   ├── Længde: Op til 64 chars
   └── Eksempel: "MyLuckySeed123"

3. PUBLIC SEED (Synligt - kontrolleret af blockchain)
   ├── Kilde: EOS blockchain block hash
   ├── Hentes ved battle/game start
   ├── Ingen kan forudsige næste block
   └── Eksempel: "0x7f8a9b...blockHash"

4. NONCE (Tæller)
   ├── Starter ved 0 for hver ny server seed
   ├── Øges med 1 for hvert spin/roll
   ├── Sikrer forskellige resultater per spin
   └── Eksempel: 0, 1, 2, 3...

═══════════════════════════════════════════════════════════════════
RESULT GENERATION ALGORITHM:
═══════════════════════════════════════════════════════════════════

```javascript
const crypto = require('crypto');

/**
 * Genererer et provably fair resultat
 */
function generateResult(serverSeed, publicSeed, clientSeed, nonce) {
  // 1. Kombiner alle seeds
  const combinedSeed = `${serverSeed}:${publicSeed}:${clientSeed}:${nonce}`;

  // 2. Hash kombinationen
  const hash = crypto.createHmac('sha256', serverSeed)
    .update(`${publicSeed}:${clientSeed}:${nonce}`)
    .digest('hex');

  // 3. Tag første 8 hex chars og konverter til nummer
  const hexSubstring = hash.substring(0, 8);
  const decimalValue = parseInt(hexSubstring, 16);

  // 4. Normaliser til 0-1 range
  const rollValue = decimalValue / 0xFFFFFFFF; // Max 32-bit value

  return {
    hash,
    rollValue,  // 0.0 til 1.0
    hexUsed: hexSubstring,
    decimalValue
  };
}

/**
 * Konverter roll til item baseret på case odds
 */
function rollToItem(rollValue, caseItems) {
  // caseItems er sorteret efter odds_weight (kumulativ)
  // Eksempel: [
  //   { item: 'Common', cumulative: 0.70 },    // 70% chance
  //   { item: 'Uncommon', cumulative: 0.90 },  // 20% chance
  //   { item: 'Rare', cumulative: 0.98 },      // 8% chance
  //   { item: 'Legendary', cumulative: 1.00 }  // 2% chance
  // ]

  for (const item of caseItems) {
    if (rollValue <= item.cumulative) {
      return item;
    }
  }

  // Fallback (should never happen)
  return caseItems[caseItems.length - 1];
}

/**
 * Verificer et resultat (client-side)
 */
function verifyResult(serverSeed, publicSeed, clientSeed, nonce, expectedRoll) {
  const result = generateResult(serverSeed, publicSeed, clientSeed, nonce);
  return Math.abs(result.rollValue - expectedRoll) < 0.0000001;
}
```

═══════════════════════════════════════════════════════════════════
BATTLE FLOW (Step by Step):
═══════════════════════════════════════════════════════════════════

FASE 1: Battle Oprettelse
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Bruger opretter battle                                      │
│  2. Server genererer ny SERVER SEED                             │
│  3. Server hasher seed: serverSeedHash = SHA256(serverSeed)     │
│  4. serverSeedHash vises til alle (bevis på forudbestemt seed)  │
│  5. Battle venter på spillere                                   │
│                                                                 │
│  ⚠️ VIGTIGT: serverSeedHash SKAL vises FØR nogen joiner!       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

FASE 2: Battle Start
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Alle spillere er joined                                     │
│  2. 3-2-1 countdown starter                                     │
│  3. Ved countdown = 0:                                          │
│     → Hent SENESTE EOS block hash som PUBLIC SEED               │
│     → Dette tidspunkt var ukendt før alle joined                │
│  4. Broadcast publicSeed til alle                               │
│                                                                 │
│  Nu er alle seeds låst - ingen kan ændre noget!                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

FASE 3: Runder
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  For hver runde (1 til N):                                      │
│    For hver spiller:                                            │
│      1. nonce = (round - 1) * numPlayers + playerPosition       │
│      2. result = generateResult(                                │
│           serverSeed,                                           │
│           publicSeed,                                           │
│           player.clientSeed,                                    │
│           nonce                                                 │
│         )                                                       │
│      3. item = rollToItem(result.rollValue, case.items)         │
│      4. Gem result i database                                   │
│      5. Broadcast result (med nonce + rollValue for verify)     │
│                                                                 │
│  ⚠️ Alle spillere bruger SAMME serverSeed + publicSeed         │
│     Men FORSKELLIGE clientSeed + nonce → forskellige resultater │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

FASE 4: Battle Slut
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. Afgør vinder baseret på mode (højeste/laveste/jackpot)      │
│  2. Krediter vinder                                             │
│  3. REVEAL SERVER SEED til alle spillere                        │
│  4. Nu kan alle verificere:                                     │
│     - At SHA256(revealedSeed) === serverSeedHash (vist før)     │
│     - At alle rolls matcher med de revealed seeds               │
│                                                                 │
│  ✅ FAIR GAME BEVIST!                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
EOS BLOCKCHAIN INTEGRATION:
═══════════════════════════════════════════════════════════════════

```javascript
const { JsonRpc } = require('eosjs');

const rpc = new JsonRpc('https://eos.greymass.com');

async function getEOSBlockHash() {
  // Hent seneste irreversible block
  const info = await rpc.get_info();
  const blockNum = info.last_irreversible_block_num;

  // Hent block data
  const block = await rpc.get_block(blockNum);

  return {
    blockNum,
    blockHash: block.id,
    timestamp: block.timestamp
  };
}

// Eksempel output:
// {
//   blockNum: 341234567,
//   blockHash: "0abc123def456789...",
//   timestamp: "2025-01-15T12:34:56.000"
// }
```

HVORFOR EOS?
├── Hurtige blocks (0.5 sekunder)
├── Deterministisk finality
├── Gratis at læse (ingen API key)
├── Umanipulerbar af os
└── Industri standard for gambling sites

═══════════════════════════════════════════════════════════════════
CRAZY MODE (Laveste vinder):
═══════════════════════════════════════════════════════════════════

```javascript
function determineWinner(mode, playerResults) {
  if (mode === 'normal') {
    // Højeste totalværdi vinder
    return playerResults.reduce((winner, player) =>
      player.totalValue > winner.totalValue ? player : winner
    );
  }

  if (mode === 'crazy') {
    // Laveste totalværdi vinder
    return playerResults.reduce((winner, player) =>
      player.totalValue < winner.totalValue ? player : winner
    );
  }

  if (mode === 'jackpot') {
    // Proportionel chance baseret på værdi
    const totalPool = playerResults.reduce((sum, p) => sum + p.totalValue, 0);
    const roll = Math.random(); // Note: Også provably fair!

    let cumulative = 0;
    for (const player of playerResults) {
      cumulative += player.totalValue / totalPool;
      if (roll <= cumulative) {
        return player;
      }
    }
  }
}
```

═══════════════════════════════════════════════════════════════════
CLIENT-SIDE VERIFICATION UI:
═══════════════════════════════════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚖️ VERIFY BATTLE #12345                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Server Seed Hash (shown before):                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Revealed Server Seed:                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Public Seed (EOS Block #341234567):                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 0abc123def456789abcdef0123456789abcdef0123456789abcdef │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Your Client Seed:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MyLuckySeed123                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ✅ Server Seed Hash Matches: SHA256(revealed) = hash           │
│                                                                 │
│  ROUND RESULTS:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Round │ Nonce │ Roll      │ Item           │ Verified  │   │
│  │ ──────────────────────────────────────────────────────│   │
│  │   1   │   0   │ 0.234567  │ AWP Asiimov    │ ✅        │   │
│  │   2   │   2   │ 0.891234  │ Glock Fade     │ ✅        │   │
│  │   3   │   4   │ 0.012345  │ Karambit Fade  │ ✅        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [ Copy Verification Data ]  [ Verify on 3rd Party Site ]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

╚═══════════════════════════════════════════════════════════════════╝
```

---

## Del 3: Case Battle System (HOVEDFOKUS)

### 3.1 Battle Typer

#### 3.1.1 Standard Battle (1v1, 1v1v1, 1v1v1v1)
- 2-4 spillere åbner identiske cases
- Højeste totalværdi vinder alt
- House edge: 5-8%

#### 3.1.2 Team Battle (2v2, 3v3)
- Hold konkurrerer mod hinanden
- Holdets samlede værdi afgør vinderen
- Fremmer social gaming

#### 3.1.3 Crazy Mode (UNIK FEATURE)
- **Laveste værdi vinder!**
- Vender standard strategien på hovedet
- Odds inverteres og normaliseres
- Meget populær på Rain.gg

#### 3.1.4 Jackpot Mode
- Vinderen bestemmes proportionelt efter værdi
- Spiller med 60% af værdien har 60% chance for at vinde alt
- Tilføjer ekstra spænding

#### 3.1.5 Battle Royale (72+ spillere)
- Tournament-style elimination
- Flere runder med eliminering
- Safe Mode vs Risky Mode
- Kæmpe prizepools

#### 3.1.6 🆕 Emerald Exclusive Modes

**Cursed Mode:**
- Random cases byttes mellem spillere efter hver runde
- Kaotisk og underholdende

**Sniper Battle:**
- Kun én case åbnes
- Alt eller intet

**Progressive Battle:**
- Case værdien stiger for hver runde
- Starter billigt, ender dyrt

**Mystery Battle:**
- Cases er skjulte indtil battle starter
- Ingen ved hvad de åbner

#### 3.1.7 🎲 "CREATE A BATTLE FOR ME" (UNIK FEATURE - INGEN ANDRE HAR DETTE!)

> **Dette er vores killer feature** - En random battle generator som ingen konkurrenter har!

```
┌─────────────────────────────────────────────────────────────┐
│           🎲 CREATE A BATTLE FOR ME                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Bruger vælger kun 2 ting:                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💰 Total Battle Pris:  [$____] (min $5, max $1000) │   │
│  │                                                      │   │
│  │  📦 Minimum Antal Cases: [___] (1-20)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│              [ 🎲 SURPRISE ME! ]                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  SYSTEMET GENERERER RANDOM:                                 │
│                                                             │
│  • Battle Mode (Standard/Crazy/Jackpot/Team/Cursed/etc)    │
│  • Antal spillere (1v1, 1v1v1, 2v2, etc)                   │
│  • Hvilke cases (mix af forskellige)                       │
│  • Antal runder (baseret på min cases + budget)            │
│  • Special modifiers (Mystery cases, Progressive, etc)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

ALGORITME:
1. Tag brugerens budget og min antal cases
2. Vælg random battle mode fra pulje
3. Vælg random antal spillere (passende til mode)
4. Fordel budget på X antal cases (min = brugerens valg)
5. Tilføj random modifiers (20% chance for special)
6. Opret battle og vis preview til bruger
7. Bruger kan "Reroll" eller "Create Battle"

EKSEMPEL OUTPUT:
┌─────────────────────────────────────────────────────┐
│  🎲 DIN RANDOM BATTLE:                              │
│                                                     │
│  Mode: CRAZY MODE (laveste vinder!)                 │
│  Format: 1v1v1v1 (4 spillere)                       │
│  Cases: 7 cases                                     │
│  Total: $50                                         │
│                                                     │
│  Cases:                                             │
│  [Danger Zone $3] [Clutch $5] [Dreams $8]          │
│  [Prisma $4] [Horizon $12] [Phoenix $10]           │
│  [Danger Zone $8]                                   │
│                                                     │
│  Special: 🔮 Mystery (cases afsløres ved start)    │
│                                                     │
│  [ 🔄 Reroll ]  [ ✅ Create Battle ]               │
└─────────────────────────────────────────────────────┘

HVORFOR DETTE ER GENIALT:
├── Ingen andre sites har dette
├── Reducerer "analysis paralysis" for nye brugere
├── Skaber variation og overraskelse
├── Øger engagement (folk vil se hvad de får)
├── Perfekt til streamers ("random battle challenge")
└── Let at implementere (random selection fra arrays)
```

#### 3.1.8 💎 EMERALD SPIN (Premium Reveal Animation)

> Inspireret af CSGOEmpire's "Empire Spin", CSGORoll's "Roll Spin" og Rain.gg's "Rain Spin"

```
HVAD ER EMERALD SPIN?
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Emerald Spin er en special animation der aktiveres når     │
│  brugeren rammer et HIGH-VALUE item (lav sandsynlighed).    │
│                                                             │
│  I stedet for bare at vise resultatet:                      │
│  1. Spinneren stopper på et "mystisk" felt                  │
│  2. Skærmen får emerald glow effect                         │
│  3. Special reveal animation afspilles                      │
│  4. Det rare item afsløres med celebration                  │
│                                                             │
│  Dette bygger MASSIV spænding og gør wins mere mindeværdige │
│                                                             │
└─────────────────────────────────────────────────────────────┘

HVORNÅR AKTIVERES DET?
├── Covert items (rød rarity)
├── Knive / Handsker (guld rarity)
├── Items over en vis værdi (f.eks. 10x case pris)
└── Kan toggles ON/OFF af bruger (som på CSGOEmpire)

ANIMATION FLOW:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  NORMAL SPIN:                                               │
│  [item][item][item][WINNER][item][item]                     │
│                 ↓                                           │
│           Vis resultat                                      │
│                                                             │
│  ════════════════════════════════════════════════════════   │
│                                                             │
│  EMERALD SPIN (når high-value):                             │
│  [item][item][item][ ? ? ? ][item][item]                    │
│                 ↓                                           │
│  ┌─────────────────────────────────────┐                   │
│  │     💎 EMERALD SPIN ACTIVATED 💎    │                   │
│  │                                      │                   │
│  │    ╔═══════════════════════════╗    │                   │
│  │    ║                           ║    │                   │
│  │    ║     [Glowing ? box]       ║    │                   │
│  │    ║                           ║    │                   │
│  │    ╚═══════════════════════════╝    │                   │
│  │                                      │                   │
│  │    Green particles swirling...       │                   │
│  │                                      │                   │
│  └─────────────────────────────────────┘                   │
│                 ↓                                           │
│         (2-3 sekunder later)                               │
│                 ↓                                           │
│  ┌─────────────────────────────────────┐                   │
│  │     🎉 CONGRATULATIONS! 🎉          │                   │
│  │                                      │                   │
│  │    ╔═══════════════════════════╗    │                   │
│  │    ║   🔪 Karambit | Emerald   ║    │                   │
│  │    ║      $12,450.00           ║    │                   │
│  │    ╚═══════════════════════════╝    │                   │
│  │                                      │                   │
│  │    [Confetti + Screen shake]         │                   │
│  │                                      │                   │
│  └─────────────────────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

UI TOGGLE (som CSGOEmpire):
┌─────────────────────────────────────────────────────────────┐
│  💎 Emerald Spin                              [====●]  ON   │
│  Toggle to highlight premium items during case openings     │
└─────────────────────────────────────────────────────────────┘

IMPLEMENTATION:
├── Frontend: Check if result.value > threshold BEFORE animation
├── Hvis ja: Trigger EmeraldSpin component i stedet
├── EmeraldSpin har egen animation timeline (GSAP/Framer)
├── Sound effects: Mystisk buildup → reveal fanfare
├── Particles: Emerald grønne particles (Canvas)
└── Gemmes i user preferences (localStorage + DB)

TECHNICAL FLOW:
```javascript
async function spinCase(caseId) {
  const result = await api.openCase(caseId);

  // Check if Emerald Spin should trigger
  const isEmeraldSpin =
    userSettings.emeraldSpinEnabled &&
    (result.item.rarity >= RARITY.COVERT ||
     result.item.value >= case.price * 10);

  if (isEmeraldSpin) {
    // Play mystery animation (hides actual result)
    await playMysterySpinAnimation();
    // Trigger Emerald reveal
    await playEmeraldReveal(result.item);
  } else {
    // Normal spin animation
    await playNormalSpinAnimation(result.item);
  }
}
```

HVORFOR DET ER VIGTIGT:
├── Øger excitement MASSIVT for big wins
├── Gør platformen mere "premium" feeling
├── Streamers elsker det (content moments)
├── Differentierer os fra basic sites
├── Brugere føler sig specielle
└── Kan bruges i marketing (highlight clips)
```

### 3.2 Create Battle Interface (CSGOEmpire-style)

```
CREATE BATTLE PAGE:
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Battles              CREATE BATTLE               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BATTLE TYPE:                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   ⚔️        │ │   👥        │ │   🤝        │          │
│  │  Standard   │ │   Shared    │ │    Team     │          │
│  │  Battle     │ │   Battle    │ │   Battle    │          │
│  │             │ │             │ │             │          │
│  │ 1v1  1v1v1  │ │   2  3  4   │ │     2v2     │          │
│  │    1v1v1v1  │ │             │ │             │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│       [●]             [ ]             [ ]                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  0 Cases Selected                      Total Value: 💰 0.00 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │                    [+]                               │   │
│  │                 Add Cases                            │   │
│  │                                                      │   │
│  │   (Klik for at vælge cases fra katalog)             │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BATTLE OPTIONS:                                            │
│                                                             │
│  ┌─────────────────────────────┐ ┌─────────────────────┐   │
│  │ 💎 Emerald Spin       [●══] │ │ 🔄 Uno Reverse  [ ] │   │
│  │ Highlight premium items     │ │ Lowest value wins!  │   │
│  │ during case openings        │ │                     │   │
│  └─────────────────────────────┘ └─────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────┐ ┌─────────────────────┐   │
│  │ ⚡ Fast Mode          [ ]   │ │ 🔒 Private Battle[] │   │
│  │ Speeds up case battles      │ │ Only players with   │   │
│  │ significantly               │ │ link can join/view  │   │
│  └─────────────────────────────┘ └─────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    Total Cost: 💰 0.00    [Create Battle]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

BATTLE MODES FORKLARET:
├── Standard Battle: Alle spillere mod hinanden, højeste vinder
├── Shared Battle: 2-4 spillere deler samme cases (ikke versus)
├── Team Battle: 2v2, holdets samlede værdi afgør vinder
└── + Vores unikke modes (Crazy, Cursed, Progressive, Mystery)

BATTLE OPTIONS:
├── Emerald Spin: Aktiverer premium reveal animation
├── Uno Reverse (Crazy Mode): Laveste værdi vinder
├── Fast Mode: Hurtigere spin animations
└── Private Battle: Kun via invite link

CASE SELECTOR MODAL:
┌─────────────────────────────────────────────────────────────┐
│  SELECT CASES                                    [X]        │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search cases...                                         │
│                                                             │
│  [Featured] [Low Risk] [Medium Risk] [High Risk] [Custom]   │
│                                                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  Case  │ │  Case  │ │  Case  │ │  Case  │ │  Case  │   │
│  │   1    │ │   2    │ │   3    │ │   4    │ │   5    │   │
│  │ 💰25.00│ │ 💰50.00│ │💰100.00│ │💰250.00│ │💰500.00│   │
│  │  [+]   │ │  [+]   │ │  [+]   │ │  [+]   │ │  [+]   │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                             │
│  Selected: [Case1 x2] [Case3 x1]           Total: 💰 150.00│
│                                             [Add to Battle] │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Custom Case Creator (KERNE FEATURE)

```
┌────────────────────────────────────────────────────────┐
│              CUSTOM CASE CREATOR                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌─────────────────────────────────────────────┐      │
│  │  Case Navn: [____________________]          │      │
│  │  Case Billede: [Upload / Vælg fra galleri]  │      │
│  │  Case Pris: [___] coins                     │      │
│  └─────────────────────────────────────────────┘      │
│                                                        │
│  TILFØJ SKINS:                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 🔍 Søg skins...                                  │ │
│  │                                                   │ │
│  │ Filtre: [Kniv ▼] [Covert ▼] [$100-500 ▼]        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  CASE INDHOLD:                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Item              │ Værdi    │ Odds   │ Chance  │ │
│  │ ─────────────────────────────────────────────── │ │
│  │ 🔪 Karambit Fade  │ $1,200   │ 0.5%   │ 1:200   │ │
│  │ 🔫 AK Vulcan FN   │ $450     │ 2%     │ 1:50    │ │
│  │ 🔫 AWP Asiimov    │ $120     │ 8%     │ 1:12    │ │
│  │ 🔫 M4A4 Desolate  │ $45      │ 20%    │ 1:5     │ │
│  │ 🔫 USP Kill Conf. │ $15      │ 30%    │ 1:3     │ │
│  │ 🔫 Glock Water El │ $5       │ 39.5%  │ 2:5     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ⚠️ VALIDERING:                                       │
│  ✅ Alle odds summer til 100%                         │
│  ✅ EV matcher case pris (med house edge)             │
│  ✅ Minimum 5 items                                   │
│  ✅ Mindst 1 item over case pris                      │
│                                                        │
│           [Preview Case]  [Gem som Draft]  [Publicer] │
└────────────────────────────────────────────────────────┘
```

**Custom Case Regler:**
- Minimum 5 skins per case
- Maximum 50 skins per case
- Odds skal summe til 100%
- Expected Value valideres automatisk
- Creator får 1% af alle åbninger
- Popular cases vises på forsiden

### 3.3 Battle Flow (Teknisk)

```javascript
// Forenklet battle flow
async function createBattle(options) {
  // 1. Generer server seed på forhånd
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = sha256(serverSeed);

  // 2. Opret battle i database
  const battle = await db.battles.create({
    type: options.type,
    mode: options.mode,
    cases: options.cases,
    maxPlayers: options.maxPlayers,
    serverSeedHash: serverSeedHash,
    status: 'waiting'
  });

  // 3. Broadcast til alle
  io.emit('battle:created', battle);

  return battle;
}

async function joinBattle(battleId, userId) {
  // 1. Verificer bruger har balance
  // 2. Træk coins fra bruger
  // 3. Tilføj til battle
  // 4. Hvis fuld, start battle
}

async function startBattle(battleId) {
  // 1. Hent EOS block hash som public seed
  const publicSeed = await getEOSBlockHash();

  // 2. For hver case, generer resultat
  for (const round of battle.cases) {
    for (const player of battle.players) {
      const result = generateResult(
        serverSeed,
        publicSeed,
        player.clientSeed,
        nonce++
      );

      // Animate og broadcast
      io.to(battleId).emit('round:result', result);
    }
  }

  // 3. Bestem vinder baseret på mode
  const winner = determineWinner(battle.mode, results);

  // 4. Udbetal til vinder
  await creditWinner(winner, totalValue);

  // 5. Reveal server seed
  await revealServerSeed(battleId, serverSeed);
}
```

### 3.4 Provably Fair System

```
SEED GENERATION:
┌─────────────────────────────────────────────────┐
│                                                 │
│  Server Seed: Genereret af os (hemmelig)        │
│       │                                         │
│       ▼                                         │
│  Server Seed Hash: SHA256(Server Seed)          │
│       │              ↑                          │
│       │         Vises FØR spil                  │
│       ▼                                         │
│  Public Seed: EOS Block Hash (ukendt for alle)  │
│       │                                         │
│       ▼                                         │
│  Client Seed: Brugerens eget seed               │
│       │                                         │
│       ▼                                         │
│  Nonce: Tæller der øges for hvert spin          │
│       │                                         │
│       ▼                                         │
│  Final Hash: SHA256(ServerSeed + PublicSeed     │
│              + ClientSeed + Nonce + GameMode)   │
│       │                                         │
│       ▼                                         │
│  Result: hash % totalOdds → Item selection      │
│                                                 │
└─────────────────────────────────────────────────┘

VERIFICATION (efter spil):
1. Bruger modtager unhashed server seed
2. Bruger kan selv beregne: SHA256(revealed_seed)
3. Hvis det matcher server_seed_hash → Fair!
4. Bruger kan selv genberegne alle resultater
```

---

## Del 4: Andre Spilmodes

### 4.1 Roulette

**Type:** CSGOEmpire Style (3 farver)
- 🔴 T Side (Rød): 2x payout - 48.65% chance
- 🔵 CT Side (Blå): 2x payout - 48.65% chance
- 🟢 Emerald (Grøn): 14x payout - 2.7% chance

**House Edge:** ~6.6%

### 4.2 Coinflip

- 1v1 coin flip med skins
- Bruger vælger side (T/CT)
- Create eller join eksisterende flips
- House edge: 5%

### 4.3 Crash

- Multiplier starter ved 1x og stiger
- Cash out før den crasher
- House edge indbygget i crash algorithm
- Social element med andre spilleres cash outs

### 4.4 Case Opening (Solo)

- Hundredevis af cases at vælge fra
- Official Valve cases + custom cases
- Animated 3D åbninger
- House edge: 8-15% (afhængig af case)

### 4.5 Upgrader

- Risk nuværende item for chance til bedre
- Slider til at justere odds vs. potential
- Mulighed for at upgrade alt fra inventory

### 4.6 Match Betting (Senere fase)

- Bet på CS2 esports kampe
- Live odds
- Integreret med esports data feeds

---

## Del 5: Økonomi & Betalinger

> **VIGTIGT:** Vi starter KUN med crypto deposits. Skin deposits kommer i senere fase.

### 5.1 Indbetalingsmetoder (Fase 1: Kun Crypto)

```
CRYPTO VIA NOWPAYMENTS (0.5% fee):
├── Bitcoin (BTC)
├── Ethereum (ETH)
├── Litecoin (LTC)
├── USDT (Tether) ← Anbefalet for brugere
├── USDC
├── Dogecoin (DOGE)
├── Tron (TRX)
└── 300+ andre coins supported

NOWPAYMENTS INTEGRATION:
├── API: https://nowpayments.io/
├── Fee: 0.5% per transaktion
├── Non-custodial (vi kontrollerer funds)
├── Instant payment notifications (IPN)
├── Auto-conversion til USDT/USD muligt
└── Node.js SDK tilgængelig
```

**INGEN skin deposits til start** - kommer i senere fase.

### 5.2 Udbetalingsmetoder

```
SKINS VIA WAXPEER API:
├── Integration: https://docs.waxpeer.com/
├── NPM package: npm install waxpeer
├── Bruger vælger skins fra Waxpeer marketplace
├── Vi betaler med crypto → Waxpeer sender skin
├── Kræver Steam access token (refresh hver 24 timer)
└── Websocket for real-time trade status

WAXPEER FLOW:
1. Bruger anmoder withdrawal (vælger skin på Waxpeer)
2. Vi sender API request med skin_id + brugerens trade link
3. Waxpeer sender trade offer til bruger
4. Vi får callback når trade er gennemført
5. Balance trækkes fra brugerens konto

CRYPTO WITHDRAWAL (alternativ):
├── Direkte crypto udbetaling
├── Via NOWPayments payout API
└── 0-1% fee
```

### 5.3 Intern Valuta

**"Emerald Coins" (EC)**
- 1 EC = $0.01 USD
- Alle spil bruger EC
- Undgår valutakurs problemer
- Gør odds beregning simpelt

### 5.4 Case Værdi System

> **VIGTIGT:** Vores cases bruger FASTE VÆRDIER - skin billeder er kun marketing!

```
SÅDAN FUNGERER DET:
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Case indeholder IKKE rigtige skins                 │
│  Skin billeder = Marketing / Visuel appeal          │
│  Hver "skin" har en FAST COIN VÆRDI                 │
│                                                     │
│  Eksempel Case ($10):                               │
│  ┌───────────────────────────────────────────────┐  │
│  │ "Karambit Fade" billede    → 5000 EC ($50)    │  │
│  │ "AWP Dragon Lore" billede  → 2000 EC ($20)    │  │
│  │ "AK-47 Vulcan" billede     → 500 EC ($5)      │  │
│  │ "M4A4 Howl" billede        → 100 EC ($1)      │  │
│  │ "Glock Fade" billede       → 50 EC ($0.50)    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Bruger VINDER COINS - ikke skins                   │
│  Coins kan withdrawes som RIGTIGE skins via Waxpeer │
│                                                     │
└─────────────────────────────────────────────────────┘

FORDELE VED DETTE SYSTEM:
├── Ingen skin inventory nødvendig ($0 startup cost)
├── Ingen trade bots at vedligeholde
├── Ingen Steam API rate limits
├── Nemmere at balancere odds
├── Brugere kan vælge præcis hvilke skins de vil have
└── Skalerer uden problemer
```

---

## Del 5.5: Branding, Navn & Design

### 5.5.1 Brand Identity: EMERALD

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ███████╗███╗   ███╗███████╗██████╗  █████╗ ██╗     ██████╗║
║     ██╔════╝████╗ ████║██╔════╝██╔══██╗██╔══██╗██║     ██╔══██║
║     █████╗  ██╔████╔██║█████╗  ██████╔╝███████║██║     ██║  ██║
║     ██╔══╝  ██║╚██╔╝██║██╔══╝  ██╔══██╗██╔══██║██║     ██║  ██║
║     ███████╗██║ ╚═╝ ██║███████╗██║  ██║██║  ██║███████╗██████╔╝
║     ╚══════╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝║
║                                                               ║
║                      emerald.win                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

NAVN: Emerald
DOMÆNE: emerald.win
TAGLINE: "The Rarest Drop"
```

### 5.5.2 Brand Inspiration: Gamma Doppler Emerald

> Vores brand er inspireret af **Gamma Doppler Emerald** - den sjældneste og mest værdifulde knife finish i CS2.

```
GAMMA DOPPLER EMERALD FAKTA:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🔪 HVAD ER DET?                                            │
│  Gamma Doppler Emerald er den sjældneste fase af           │
│  Gamma Doppler knife finishes. Hele bladet er dækket       │
│  i en intens, ren jade-grøn farve der skinner som          │
│  en ægte smaragd.                                          │
│                                                             │
│  💎 RARITY                                                  │
│  • Drop rate: Under 0.08% fra Gamma cases                  │
│  • 900% dyrere end standard Gamma Doppler phases           │
│  • Ækvivalent til Ruby/Sapphire for standard Doppler       │
│  • Kun ~10% af alle Gamma Dopplers er Emerald              │
│                                                             │
│  💰 VÆRDI (2025 priser)                                     │
│  • M9 Bayonet Emerald FN: $9,000 - $11,000                 │
│  • Karambit Emerald FN: $10,000 - $14,000                  │
│  • Butterfly Emerald FN: $8,000 - $12,000                  │
│  • StatTrak versioner: Op til $16,500+                     │
│                                                             │
│  🎨 UDSEENDE                                                │
│  • Monokromatisk jade/smaragd grøn                         │
│  • Translucente bølgende linjer (smoke pattern)            │
│  • Skifter til mørkere grøn væk fra lys                    │
│  • Metallic finish med gradient transitions                │
│                                                             │
│  KNIVE MED EMERALD:                                         │
│  M9 Bayonet, Karambit, Butterfly, Bayonet, Flip,          │
│  Gut, Falchion, Bowie, Huntsman, Navaja, Stiletto,        │
│  Talon, Ursus, Classic, Paracord, Survival, Nomad,        │
│  Skeleton, Kukri                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

BRAND MESSAGING:
├── "Som Emerald Doppler - sjælden, værdifuld, eftertragtet"
├── "Den grønne vej til victory"
├── "Where winners shine"
└── "The rarest drop wins"
```

### 5.5.3 Farvepalette (Gamma Doppler Emerald-inspireret)

```
EMERALD COLOR SYSTEM:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  PRIMARY: EMERALD GREEN (fra Gamma Doppler)                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ #00FF7F │ │ #10B981 │ │ #059669 │ │ #047857 │          │
│  │  Glow   │ │  Light  │ │ Primary │ │  Dark   │          │
│  │ (neon)  │ │ (hover) │ │ (main)  │ │ (shade) │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  JADE GRADIENT (knife blade effect):                        │
│  ┌──────────────────────────────────────────────┐          │
│  │  #00FF7F → #10B981 → #059669 → #047857       │          │
│  │  ░░░░░░░░░▓▓▓▓▓▓▓▓▓████████████████████      │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  BACKGROUNDS (Dark theme - CSGOEmpire style):              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ #0D0D0D │ │ #141414 │ │ #1A1A1A │ │ #242424 │          │
│  │  Base   │ │  Card   │ │  Hover  │ │ Border  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  ACCENT COLORS:                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ #FFD700 │ │ #00FF7F │ │ #FF4757 │ │ #a855f7 │          │
│  │  Gold   │ │ Emerald │ │  Red    │ │ Purple  │          │
│  │ (coins) │ │  (win)  │ │ (lose)  │ │ (rare)  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  CS2 RARITY COLORS (standard):                              │
│  ├── Consumer:    #b0c3d9 (Grå)                            │
│  ├── Industrial:  #5e98d9 (Lys blå)                        │
│  ├── Mil-Spec:    #4b69ff (Blå)                            │
│  ├── Restricted:  #8847ff (Lilla)                          │
│  ├── Classified:  #d32ce6 (Pink)                           │
│  ├── Covert:      #eb4b4b (Rød)                            │
│  └── Contraband:  #e4ae39 (Guld)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

TAILWIND CONFIG:
colors: {
  emerald: {
    glow: '#00FF7F',      // Neon glow effects
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',       // Light
    600: '#059669',       // PRIMARY
    700: '#047857',       // Dark
    800: '#065f46',
    900: '#064e3b',
  },
  dark: {
    base: '#0D0D0D',      // Page background
    card: '#141414',      // Card backgrounds
    hover: '#1A1A1A',     // Hover states
    border: '#242424',    // Borders
    muted: '#333333',     // Muted text
  },
  gold: '#FFD700',        // Coins
  lose: '#FF4757',        // Losses
}

CSS GLOW EFFECT (Emerald shine):
.emerald-glow {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.4),
              0 0 40px rgba(16, 185, 129, 0.2),
              0 0 60px rgba(16, 185, 129, 0.1);
}
.emerald-text-glow {
  text-shadow: 0 0 10px rgba(0, 255, 127, 0.8);
}
```

### 5.5.4 UI Design (Inspireret af CSGOEmpire)

```
LAYOUT STRUKTUR (CSGOEmpire-style):
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [EMERALD Logo]  Games▼  Rewards │ Withdraw [Deposit]│   │
│  │                                  │ 💰 127.84  [User]│   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  MAIN LAYOUT                                                │
│  ┌──────────┬──────────────────────────────────────────┐   │
│  │          │                                          │   │
│  │   CHAT   │           MAIN CONTENT                   │   │
│  │  SIDEBAR │                                          │   │
│  │          │   [Filters/Tabs]                         │   │
│  │ ──────── │                                          │   │
│  │ User Lvl │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │ Message  │   │Battle│ │Battle│ │Battle│ │Battle│  │   │
│  │ ──────── │   │ Card │ │ Card │ │ Card │ │ Card │  │   │
│  │ User Lvl │   └──────┘ └──────┘ └──────┘ └──────┘  │   │
│  │ Message  │                                          │   │
│  │ ──────── │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │          │   │ Case │ │ Case │ │ Case │ │ Case │  │   │
│  │[Input...]│   └──────┘ └──────┘ └──────┘ └──────┘  │   │
│  └──────────┴──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

KEY UI ELEMENTER:

1. HEADER (fixed top)
   ├── Logo venstre
   ├── Navigation (Games dropdown, Rewards)
   ├── Withdraw/Deposit buttons
   ├── Balance med coin icon (💰)
   └── User avatar + dropdown

2. CHAT SIDEBAR (fixed left, collapsible på mobil)
   ├── Online count
   ├── Language selector
   ├── Chat messages med:
   │   ├── User level badge (farvekodet)
   │   ├── Username
   │   └── Message
   ├── Recent wins ticker
   └── Input field

3. BATTLE CARDS (CSGOEmpire style)
   ┌─────────────────────────────────────────────────────┐
   │  ⚔ Standard    │ 24 Rounds                         │
   │  ──────────────────────────────────────────────────│
   │  [P1] [P2] vs [?] [?]    [Case][Case][Case][Case]  │
   │                           ▶▶▶▶▶▶▶                  │
   │                                      BATTLE COST   │
   │  ⏳ Waiting for players...           💰 285.83     │
   │                                      [Join for X]  │
   └─────────────────────────────────────────────────────┘

4. CASE CARDS (flotte designs!)
   ┌────────────────┐
   │   ┌────────┐   │
   │   │ CASE   │   │  ← Glowing case artwork
   │   │ IMAGE  │   │     med neon effects
   │   └────────┘   │
   │   Case Name    │
   │   💰 1,234.56  │
   └────────────────┘

5. GAMES DROPDOWN
   ├── 🎰 Roulette
   ├── 🪙 Coinflip
   ├── 📦 Cases
   └── ⚔ Case Battles

DESIGN PRINCIPPER (fra CSGOEmpire):
├── Dark theme (#0D0D0D base)
├── Gold/yellow for coins og værdier
├── Subtle borders og card elevation
├── Level badges med farver
├── Glowing effects på hover
├── Clean typography (Inter/system fonts)
├── Compact information density
└── Always visible chat for social engagement
```

### 5.5.5 Logo Koncept

```
LOGO VARIANTER:

1. PRIMARY LOGO (Full)
   ┌───────────────────────────────────┐
   │  💎 EMERALD                       │
   │  [Gem icon] + Wordmark            │
   └───────────────────────────────────┘

2. ICON ONLY (Favicon, small spaces)
   ┌─────┐
   │ 💎  │  ← Stylized emerald gem
   └─────┘     eller knife silhouette
              med emerald glow

3. WORDMARK ONLY
   EMERALD (med gradient fra light til dark green)

LOGO ELEMENTER:
├── Emerald gem shape (hexagonal cut)
├── Eller: Knife silhouette med emerald blade
├── Gradient: #00FF7F → #059669
├── Glow effect omkring
└── Clean, bold typography

FAVICON:
├── Simple gem shape
├── Emerald green (#059669)
├── Works at 16x16, 32x32, etc.
```

### 5.5.6 Animationer & Performance (KRITISK!)

> **VIGTIGT:** Animationer er AFGØRENDE for brugeroplevelsen på gambling sites. De skal være SMOOTH (60fps) og LÆKRE.

```
ANIMATION PRINCIPPER:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. PERFORMANCE FIRST                                       │
│  ├── Brug kun transform & opacity (GPU accelerated)        │
│  ├── Undgå layout shifts (width, height, top, left)        │
│  ├── will-change: transform på animerede elementer         │
│  └── RequestAnimationFrame for custom animations           │
│                                                             │
│  2. FRAMER MOTION SETTINGS                                  │
│  ├── spring: { damping: 20, stiffness: 300 }              │
│  ├── Brug layoutId for shared element transitions          │
│  └── AnimatePresence for mount/unmount                     │
│                                                             │
│  3. TIMING                                                  │
│  ├── Micro-interactions: 150-200ms                         │
│  ├── Page transitions: 300-400ms                           │
│  ├── Case spinning: 3-8 sekunder (bygger spænding)        │
│  └── Win celebration: 1-2 sekunder                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

VIGTIGE ANIMATIONER:

1. CASE OPENING SPINNER (Mest kritiske animation!)
┌─────────────────────────────────────────────────────────────┐
│  • Horizontal scroll af items                               │
│  • Starter hurtigt → decelererer smoothly                   │
│  • "Tick" lyd for hvert item der passerer                   │
│  • Glow effect på vinder item                               │
│  • Particle explosion ved covert/knife                      │
│  • Screen shake ved big win                                 │
│                                                             │
│  IMPLEMENTATION:                                            │
│  - CSS transform: translateX() for scroll                   │
│  - Cubic-bezier easing: cubic-bezier(0.15, 0.85, 0.4, 1)   │
│  - Canvas/WebGL for particles (performance)                 │
│  - Howler.js for synchronized lyd                           │
└─────────────────────────────────────────────────────────────┘

2. BATTLE ANIMATIONS
├── Player join: Slide in fra side + pulse
├── Round start: Countdown 3-2-1 med scale
├── Parallel spinning: Synkroniseret via Socket.IO
├── Round winner: Glow + score increment animation
├── Battle winner: Confetti + all items fly to winner
└── Value counter: Number ticker animation

3. UI MICRO-INTERACTIONS
├── Buttons: Scale 0.95 on press, glow on hover
├── Cards: Subtle lift (translateY -2px) on hover
├── Navigation: Underline slide animation
├── Balance: Smooth number transition ved ændring
├── Notifications: Slide in fra højre + fade
└── Modals: Scale + fade with backdrop blur

4. LOADING STATES
├── Skeleton loaders med shimmer effect
├── Spinner med emerald gradient
├── Progress bars med glow
└── Optimistic UI updates (instant feedback)

LIBRARIES:
├── Framer Motion (React animations)
├── GSAP (komplekse timeline animations)
├── Three.js (3D case model, optional)
├── Lottie (pre-made animations)
├── Howler.js (lyd synkronisering)
└── Canvas Confetti (celebration effects)
```

### 5.5.4 UI Inspiration & Stil

```
DESIGN INSPIRATIONER:
├── Rain.gg - Clean dark UI, gode animationer
├── CSGORoll - Polished, professional look
├── Stake.com - Modern gambling UI patterns
└── Discord - Dark theme, smooth interactions

STIL KEYWORDS:
├── Dark & Premium
├── Neon accents (emerald glow)
├── Glassmorphism (subtle)
├── Sharp corners (ikke rounded - mere "gaming")
├── High contrast
└── Futuristic/Cyber aesthetic

TYPOGRAPHY:
├── Headings: Inter / Outfit / Space Grotesk
├── Body: Inter / SF Pro
├── Numbers: Tabular nums (monospace digits)
└── Sizes: 14px base, 1.25 scale ratio

IKONER:
├── Lucide React (clean, consistent)
├── Custom skin icons
└── Animated icons for states
```

### 5.5.5 Sprog & Internationalisering

```
SPROG SUPPORT:

FASE 1 (Launch):
└── 🇬🇧 Engelsk (Primary) - ALT UI på engelsk

FASE 2 (Senere):
├── 🇷🇺 Russisk (Stort CS2 marked)
├── 🇧🇷 Portugisisk (Brasilien - voksende marked)
└── 🇹🇷 Tyrkisk (Aktivt CS2 community)

IMPLEMENTATION:
├── next-intl eller react-i18next
├── JSON language files
├── Auto-detect browser language
├── Manual language switcher i footer
└── RTL support ikke nødvendigt (ingen arabisk til start)

STRUKTUR:
/locales
├── en/
│   ├── common.json
│   ├── battles.json
│   ├── cases.json
│   └── errors.json
└── ru/
    ├── common.json
    └── ...
```

---

## Del 6: Brugeroplevelse (UX)

### 6.1 Onboarding Flow

```
STEP 1: Landing Page
├── Hero med live case battle
├── "Watch live battles" CTA
├── Trust signals (license, users, volume)
└── [Sign in with Steam] button

STEP 2: Steam Login
├── Steam OAuth
├── Automatisk profil import
└── Avatar, username, level

STEP 3: Welcome Bonus
├── Referral code input (valgfrit)
├── Free welcome case
├── Tutorial overlay (skippable)
└── First deposit bonus forklaring

STEP 4: Main Dashboard
├── Live battles feed
├── Quick join buttons
├── Balance prominent vist
└── Notification om free daily case
```

### 6.2 Hovednavigation

```
┌─────────────────────────────────────────────────────────────┐
│  🟢 EMERALD                    Search    [250 EC] [Avatar] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Case Battles]  [Cases]  [Roulette]  [Crash]  [More ▼]    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      MAIN CONTENT                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │              FEATURED BATTLES                        │   │
│  │                                                      │   │
│  │   [Battle 1]  [Battle 2]  [Battle 3]  [Battle 4]   │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              CREATE BATTLE                          │   │
│  │  [+ New Battle]  [Custom Case]  [Join Random]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  💬 LIVE CHAT                              [Online: 1,234] │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ User1: Nice win! 🎉                                 │   │
│  │ User2: gg                                           │   │
│  │ [Type message...]                           [Send]  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Case Battle Interface

```
┌─────────────────────────────────────────────────────────────┐
│  BATTLE #12345                    Mode: STANDARD 1v1       │
│  Total Value: 2,450 EC            Status: IN PROGRESS      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    VS    ┌─────────────────────┐  │
│  │                     │          │                     │  │
│  │   [Player 1 Avatar] │          │   [Player 2 Avatar] │  │
│  │   xXDragonSlayerXx  │          │   SkinMaster420     │  │
│  │                     │          │                     │  │
│  │   Total: 1,245 EC   │          │   Total: 1,205 EC   │  │
│  │   ████████████░░░░  │          │   ███████████░░░░░  │  │
│  │                     │          │                     │  │
│  └─────────────────────┘          └─────────────────────┘  │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                       ROUND 3/5                            │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  ┌─────────────────────┐          ┌─────────────────────┐  │
│  │  ╔═══════════════╗  │          │  ╔═══════════════╗  │  │
│  │  ║               ║  │          │  ║               ║  │  │
│  │  ║   [SPINNING]  ║  │          │  ║   [SPINNING]  ║  │  │
│  │  ║               ║  │          │  ║               ║  │  │
│  │  ╚═══════════════╝  │          │  ╚═══════════════╝  │  │
│  │                     │          │                     │  │
│  │  Round Value: ???   │          │  Round Value: ???   │  │
│  └─────────────────────┘          └─────────────────────┘  │
│                                                             │
│  PREVIOUS ROUNDS:                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ R1     │ │ R2     │ │ R3     │ │ R4     │ │ R5     │   │
│  │ P1:245 │ │ P1:500 │ │  ...   │ │  -     │ │  -     │   │
│  │ P2:180 │ │ P2:525 │ │        │ │        │ │        │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [🔗 Share Battle]  [👁 Spectators: 47]  [⚖️ Verify Fair]  │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Animations & Feedback

**Case Opening Animation:**
- 3D case model med Three.js
- Smooth scroll through items
- Dramatic slowdown
- Particle effects ved win
- Sound effects (mutable)

**Battle Results:**
- Confetti for winner
- Shake effect for loser
- Item fly-in animation
- Value counter animation

---

## Del 7: Brugerengagement & Retention

### 7.1 VIP/Leveling System

```
LEVEL SYSTEM:
├── XP gained per wager (1 XP per 1 EC wagered)
├── Levels 1-100 (standard)
├── Levels 100-500 (advanced)
└── Levels 500+ (VIP tiers)

VIP TIERS:
┌──────────────────────────────────────────────────────────┐
│ Tier      │ Level  │ Rakeback │ Daily Case │ Perks      │
├───────────┼────────┼──────────┼────────────┼────────────┤
│ Bronze    │ 1-50   │ 2%       │ Common     │ -          │
│ Silver    │ 51-100 │ 3%       │ Uncommon   │ -          │
│ Gold      │ 101-250│ 5%       │ Rare       │ Priority   │
│ Platinum  │ 251-500│ 7%       │ Epic       │ VIP Host   │
│ Diamond   │ 501-750│ 10%      │ Legendary  │ Custom     │
│ Emerald   │ 750+   │ 15%      │ Exclusive  │ Everything │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Daily Rewards

```
DAILY FREE CASES (baseret på level):
├── Level 1-25:   $0.50 case
├── Level 26-50:  $1.00 case
├── Level 51-100: $2.50 case
├── Level 100+:   $5.00 case
└── VIP:          $10-100 case

DAILY STREAK BONUS:
├── Day 1: 1x multiplier
├── Day 2: 1.1x
├── Day 3: 1.2x
├── Day 7: 2x
├── Day 14: 3x
└── Day 30: 5x
```

### 7.3 Leaderboard & Races

**Weekly Race:**
- Top 100 wagerers får præmier
- Prizes fra $10 til $10,000+
- Separate leaderboards per game mode

**Monthly Competition:**
- Større præmiepulje
- Eksklusive skins som præmier
- Medieomtale

### 7.4 Affiliate System

```
AFFILIATE STRUKTUR:
├── Affiliate Link: emerald.gg/r/USERNAME
├── Referred users get: 5% deposit bonus
├── Affiliate earns: 10-30% commission (tier based)
│   ├── Tier 1 (0-10 refs): 10%
│   ├── Tier 2 (11-50 refs): 15%
│   ├── Tier 3 (51-100 refs): 20%
│   └── Tier 4 (100+ refs): 30%
├── Minimum withdrawal: $50
├── Payment: Crypto or site balance
└── Dashboard with stats & analytics
```

### 7.5 Social Features

**Live Chat:**
- Global chat
- Language-specific rooms
- Emotes & GIFs
- Rain events (random drops)
- Moderation system

**Social Integration:**
- Discord server med live feeds
- Twitter/X notifications
- Kick/Twitch streaming integration
- Watch party feature

---

## Del 8: Sikkerhed & Compliance

### 8.1 Sikkerhedsarkitektur

```
SECURITY LAYERS:
┌─────────────────────────────────────────────────┐
│ Layer 1: Network Security                       │
├─────────────────────────────────────────────────┤
│ • Cloudflare DDoS Protection                    │
│ • Web Application Firewall (WAF)                │
│ • Rate limiting                                 │
│ • Geographic restrictions (banned countries)    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Layer 2: Application Security                   │
├─────────────────────────────────────────────────┤
│ • Input validation & sanitization               │
│ • CSRF protection                               │
│ • SQL injection prevention (parameterized)      │
│ • XSS prevention (CSP headers)                  │
│ • API rate limiting per user                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Layer 3: Authentication                         │
├─────────────────────────────────────────────────┤
│ • Steam OAuth 2.0                               │
│ • 2FA via authenticator app                     │
│ • Session management (Redis)                    │
│ • JWT tokens med kort levetid                   │
│ • IP tracking & anomaly detection               │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Layer 4: Data Security                          │
├─────────────────────────────────────────────────┤
│ • Encryption at rest (AES-256)                  │
│ • Encryption in transit (TLS 1.3)               │
│ • Database encryption                           │
│ • Secure key management (AWS KMS)               │
│ • Regular backups (encrypted)                   │
└─────────────────────────────────────────────────┘
```

### 8.2 Anti-Fraud System

**Bot Detection:**
- Captcha ved suspicious activity
- Behavioral analysis
- Device fingerprinting
- Multi-account detection

**Collusion Prevention:**
- Same IP blocking i battles
- Statistical analysis af patterns
- Manual review af flagged accounts

**Responsible Gambling:**
- Self-exclusion option
- Deposit limits
- Loss limits
- Session time reminders
- Links til hjælpeorganisationer

### 8.3 KYC/AML Compliance

```
KYC LEVELS:
├── Level 0 (No KYC):
│   └── Max withdrawal: $1,000/lifetime
│
├── Level 1 (Basic):
│   ├── Email verification
│   ├── Phone verification
│   └── Max withdrawal: $10,000/month
│
├── Level 2 (Standard):
│   ├── ID document (passport/driver's license)
│   ├── Selfie verification
│   └── Max withdrawal: $50,000/month
│
└── Level 3 (Enhanced):
    ├── Proof of address
    ├── Source of funds
    └── Unlimited withdrawals
```

### 8.4 🚨 KRITISK: Anti-Manipulation & Game Integrity

> **DETTE ER DET VIGTIGSTE AFSNIT I HELE DOKUMENTET**
> En eneste sårbarhed kan koste millioner og ødelægge vores omdømme permanent.

```
╔═══════════════════════════════════════════════════════════════════╗
║        🚨 KRITISKE SIKKERHEDSRISICI FOR GAMBLING SITES 🚨         ║
╠═══════════════════════════════════════════════════════════════════╣

RISIKO 1: RESULT MANIPULATION (Intern trussel)
─────────────────────────────────────────────────────────────────────
TRUSSEL: En medarbejder/developer ændrer RNG eller seed generation
         for at give sig selv eller venner bedre odds.

KONSEKVENS: Millioner i uretmæssige udbetalinger + permanent
            troværdighedstab hvis opdaget.

FOREBYGGELSE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. CODE REVIEW KRAV                                            │
│     ├── ALL changes til RNG/provably fair kræver 2+ reviews    │
│     ├── Audit trail på alle code changes                        │
│     └── Separate prod deployment keys (ikke devs)               │
│                                                                 │
│  2. SERVER SEED ISOLATION                                       │
│     ├── Server seeds genereres af separat microservice          │
│     ├── Ingen direkte database adgang til seed storage          │
│     ├── HSM (Hardware Security Module) til seed generation      │
│     └── Audit logs på alle seed operations                      │
│                                                                 │
│  3. TRANSPARENCY                                                │
│     ├── Alle resultater logges immutable (append-only)          │
│     ├── Public seed fra EOS blockchain = umanipulerbar          │
│     ├── Brugere kan ALTID verificere resultater                 │
│     └── Tredjepartsaudit af RNG årligt                          │
│                                                                 │
│  4. PRINCIPLE OF LEAST PRIVILEGE                                │
│     ├── Devs har IKKE prod database access                      │
│     ├── Ingen kan ændre gamle resultater                        │
│     ├── Admin actions kræver 2-person approval                  │
│     └── All sensitive ops kræver MFA                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

RISIKO 2: TIMING ATTACKS (Ekstern trussel)
─────────────────────────────────────────────────────────────────────
TRUSSEL: Angriber forudsiger næste EOS block hash før vi henter den,
         eller udnytter race conditions.

FOREBYGGELSE:
├── Hent EOS block hash på et UFORUDSIGELIGT tidspunkt
├── Brug last_irreversible_block (ikke head block)
├── Implementer jitter/random delay på block fetch
├── Valider at block timestamp er recent
└── Multiple EOS node endpoints som fallback

RISIKO 3: SEED PREDICTION/BRUTE FORCE
─────────────────────────────────────────────────────────────────────
TRUSSEL: Angriber gætter server seed via brute force.

FOREBYGGELSE:
├── 256-bit server seeds (2^256 kombinationer = impossible)
├── crypto.randomBytes() - kryptografisk secure
├── Rate limit på verification endpoints
└── Server seed roteres automatisk efter X spins

RISIKO 4: REPLAY ATTACKS
─────────────────────────────────────────────────────────────────────
TRUSSEL: Angriber genbruger gamle resultater eller manipulerer nonce.

FOREBYGGELSE:
├── Monotonisk stigende nonce per user seed
├── Nonce stored server-side (ikke client-controlled)
├── Unique constraint i database på (userId, nonce)
└── Reject any out-of-order nonce

RISIKO 5: MULTI-ACCOUNT ABUSE
─────────────────────────────────────────────────────────────────────
TRUSSEL: Samme person har flere konti for at udnytte bonusser eller
         collude i battles.

FOREBYGGELSE:
├── Steam account binding (én konto per Steam)
├── Device fingerprinting (browser/hardware)
├── IP tracking + VPN detection
├── Same IP kan ikke være i samme battle
├── Statistical analysis af suspicious patterns
├── Phone verification for withdrawals
└── Manual review ved flag

RISIKO 6: WITHDRAWAL FRAUD
─────────────────────────────────────────────────────────────────────
TRUSSEL: Angriber stjæler konto og withdrawer alt, eller finder måde
         at generere falsk balance.

FOREBYGGELSE:
├── Balance changes KUN via transaktioner (audit trail)
├── Double-entry bookkeeping i database
├── Withdrawal cooldown for nye konti (24-48 timer)
├── Large withdrawal kræver extra verification
├── Trade link verification mod Steam API
├── 2FA påkrævet for withdrawals
└── Email notification ved alle withdrawals

RISIKO 7: API ABUSE / RATE LIMIT BYPASS
─────────────────────────────────────────────────────────────────────
TRUSSEL: Bot automation til at udnytte edge cases eller overloade system.

FOREBYGGELSE:
├── Per-endpoint rate limiting
├── Per-user rate limiting
├── IP-based rate limiting
├── Captcha ved suspicious patterns
├── Request fingerprinting
└── Anomaly detection (unusual patterns)

╚═══════════════════════════════════════════════════════════════════╝
```

### 8.5 Sikker Kode Praksis

```javascript
// ❌ ALDRIG GØR DETTE:
const serverSeed = "hardcoded_seed";  // KATASTROFE!
const result = Math.random();         // Ikke kryptografisk secure!
const sql = `SELECT * FROM users WHERE id = ${userId}`;  // SQL injection!

// ✅ ALTID GØR DETTE:
import crypto from 'crypto';

// Kryptografisk secure random
const serverSeed = crypto.randomBytes(32).toString('hex');

// Parameterized queries
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Input validation
import { z } from 'zod';

const BattleJoinSchema = z.object({
  battleId: z.string().uuid(),
  position: z.number().int().min(0).max(3),
  team: z.number().int().min(0).max(1).nullable()
});

// Validate before processing
const validated = BattleJoinSchema.parse(input);
```

### 8.6 Database Integrity

```sql
-- KRITISKE CONSTRAINTS:

-- Balance kan ALDRIG gå negativ
ALTER TABLE users ADD CONSTRAINT balance_non_negative
  CHECK (balance >= 0);

-- Transactions må have valid reference
ALTER TABLE transactions ADD CONSTRAINT valid_reference
  CHECK (
    (reference_type IS NULL AND reference_id IS NULL) OR
    (reference_type IS NOT NULL AND reference_id IS NOT NULL)
  );

-- Nonce må være unik per user seed
CREATE UNIQUE INDEX unique_nonce_per_seed
  ON battle_rounds(participant_id, nonce);

-- Audit log (append-only)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Ingen kan DELETE fra audit_log
REVOKE DELETE ON audit_log FROM PUBLIC;

-- Trigger til at logge alle balance changes
CREATE OR REPLACE FUNCTION log_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.balance != NEW.balance THEN
    INSERT INTO audit_log (user_id, action, details)
    VALUES (
      NEW.id,
      'balance_change',
      jsonb_build_object(
        'old_balance', OLD.balance,
        'new_balance', NEW.balance,
        'change', NEW.balance - OLD.balance
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER balance_audit_trigger
  AFTER UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION log_balance_change();
```

### 8.7 Real-time Monitoring & Alerts

```
KRITISKE ALERTS (Øjeblikkelig notifikation):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  🚨 LEVEL 1 - CRITICAL (SMS + Call + Slack)                    │
│  ├── Unusual withdrawal spike (>$10k/hour)                      │
│  ├── Multiple failed admin logins                               │
│  ├── Database anomaly detected                                  │
│  ├── RNG service down                                           │
│  └── Negative balance detected (should be impossible!)          │
│                                                                 │
│  ⚠️ LEVEL 2 - WARNING (Slack + Email)                          │
│  ├── High loss rate for platform (house losing money)           │
│  ├── Suspicious betting pattern detected                        │
│  ├── Multiple accounts from same device                         │
│  ├── Large single bet (>$1000)                                  │
│  └── Failed provably fair verification                          │
│                                                                 │
│  📊 LEVEL 3 - INFO (Dashboard only)                            │
│  ├── Daily statistics summary                                   │
│  ├── New user registrations                                     │
│  ├── Withdrawal queue status                                    │
│  └── System performance metrics                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

MONITORING STACK:
├── Grafana → Dashboards & visualization
├── Prometheus → Metrics collection
├── Loki → Log aggregation
├── AlertManager → Alert routing
└── PagerDuty/Opsgenie → On-call rotation
```

### 8.8 Incident Response Plan

```
VED MISTANKE OM MANIPULATION/HACK:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  STEP 1: STOP BLEEDING (Inden for 5 minutter)                  │
│  ├── Pause alle withdrawals                                     │
│  ├── Pause nye battles/games                                    │
│  ├── Alert hele teamet                                          │
│  └── Start dokumentation                                        │
│                                                                 │
│  STEP 2: ASSESS (Inden for 30 minutter)                        │
│  ├── Identificer omfang af problemet                            │
│  ├── Gennemgå audit logs                                        │
│  ├── Identificer berørte brugere                                │
│  └── Vurder økonomisk impact                                    │
│                                                                 │
│  STEP 3: CONTAIN (Inden for 1 time)                            │
│  ├── Bloker mistænkelige konti                                  │
│  ├── Reverser uretmæssige transaktioner                         │
│  ├── Patch sårbarheden                                          │
│  └── Verificer fix virker                                       │
│                                                                 │
│  STEP 4: RECOVER (Inden for 24 timer)                          │
│  ├── Genaktiver services                                        │
│  ├── Kommuniker til brugere (hvis nødvendigt)                   │
│  ├── Kompenser berørte brugere                                  │
│  └── Full post-mortem rapport                                   │
│                                                                 │
│  STEP 5: PREVENT (Inden for 1 uge)                             │
│  ├── Implementer permanent fix                                  │
│  ├── Audit for lignende sårbarheder                             │
│  ├── Opdater security procedures                                │
│  └── Team debrief                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.9 Third-Party Security Audits

```
PÅKRÆVEDE AUDITS:
├── Årlig penetration test (ekstern firma)
├── Kvartalsvis code review af RNG system
├── Månedlig vulnerability scan
└── Kontinuerlig bug bounty program

ANBEFALEDE AUDIT FIRMAER:
├── Trail of Bits (crypto/blockchain focus)
├── Cure53 (web application security)
├── NCC Group (comprehensive audits)
└── Hackerone/Bugcrowd (bug bounty platforms)

BUDGET: $10,000-50,000/år for audits
(VIGTIG investering - billigere end et hack!)
```

---

## Del 9: Marketing & Vækst

### 9.1 Launch Strategi

**Pre-Launch (1-2 måneder før):**
- Beta signup page
- Discord community building
- Influencer outreach
- Teaser content på sociale medier

**Launch Week:**
- $100,000 launch leaderboard
- Free cases til alle nye brugere
- Influencer streams
- PR i gaming medier

**Post-Launch:**
- Ongoing influencer partnerships
- SEO content marketing
- Paid ads (where legal)
- Community events

### 9.2 Influencer Strategi

```
INFLUENCER TIERS:
├── Tier 1: Mega (1M+ followers)
│   ├── Custom affiliate codes
│   ├── Sponsored streams
│   └── Budget: $10,000-50,000/stream
│
├── Tier 2: Macro (100k-1M followers)
│   ├── Affiliate program
│   ├── Occasional sponsorships
│   └── Budget: $1,000-10,000/stream
│
└── Tier 3: Micro (10k-100k followers)
    ├── Affiliate program only
    ├── Free balance for content
    └── Budget: $100-1,000 balance
```

**Platforms:**
- Twitch (primær)
- YouTube (sekundær)
- Kick (voksende)
- TikTok (awareness)
- Twitter/X (community)

### 9.3 SEO & Content

**Target Keywords:**
- "CS2 case battles"
- "CSGO gambling"
- "CS2 skin gambling"
- "Case opening sites"
- "Provably fair gambling"

**Content Types:**
- Win compilations
- Tutorial guides
- Case battle highlights
- Strategy articles
- Skin market news

---

## Del 10: Implementeringsplan

### Phase 1: Foundation (Uge 1-8)

```
INFRASTRUCTURE:
├── [ ] Setup AWS/GCP projekt
├── [ ] Configure Kubernetes cluster
├── [ ] Setup CI/CD pipelines
├── [ ] Configure databases (PostgreSQL + Redis)
├── [ ] Setup monitoring (Datadog)
└── [ ] Configure Cloudflare

LEGAL:
├── [ ] Incorporate offshore company
├── [ ] Apply for Curacao license
├── [ ] Draft Terms of Service
├── [ ] Draft Privacy Policy
├── [ ] Setup compliance procedures
└── [ ] Establish banking relationships

BACKEND CORE:
├── [ ] User authentication (Steam OAuth)
├── [ ] Wallet system
├── [ ] Transaction logging
├── [ ] Provably fair seed generation
└── [ ] Basic API structure
```

### Phase 2: Core Features (Uge 9-16)

```
CASE SYSTEM:
├── [ ] Skin database integration
├── [ ] Case creation system
├── [ ] Custom case creator
├── [ ] Case opening logic
├── [ ] Case opening animations
└── [ ] Provably fair verification

CASE BATTLES (HOVEDFOKUS):
├── [ ] Battle creation
├── [ ] Battle lobby system
├── [ ] Standard 1v1/2v2/4-way battles
├── [ ] Team battles
├── [ ] Crazy mode
├── [ ] Jackpot mode
├── [ ] Real-time battle sync (Socket.IO)
├── [ ] Battle spectating
├── [ ] Battle history & replay
└── [ ] Battle sharing (links)
```

### Phase 3: Economy (Uge 17-22)

```
PAYMENTS:
├── [ ] Crypto deposits (Coinbase Commerce / NOWPayments)
├── [ ] Crypto withdrawals
├── [ ] Steam trade bot network
├── [ ] Skin deposits
├── [ ] Skin withdrawals
├── [ ] Fiat gateway integration
└── [ ] Payment verification system

MARKETPLACE:
├── [ ] P2P skin marketplace
├── [ ] Price oracle integration
├── [ ] Instant sell feature
└── [ ] Inventory management
```

### Phase 4: Engagement (Uge 23-28)

```
GAMIFICATION:
├── [ ] XP/Leveling system
├── [ ] Daily rewards
├── [ ] Leaderboards
├── [ ] Achievements
├── [ ] VIP tiers
└── [ ] Rakeback system

SOCIAL:
├── [ ] Live chat system
├── [ ] Rain events
├── [ ] Discord integration
├── [ ] Affiliate system
└── [ ] Referral tracking
```

### Phase 5: Additional Games (Uge 29-34)

```
GAMES:
├── [ ] Roulette
├── [ ] Coinflip
├── [ ] Crash
├── [ ] Upgrader
└── [ ] Mines (optional)
```

### Phase 6: Launch & Scale (Uge 35+)

```
LAUNCH:
├── [ ] Beta testing (invite only)
├── [ ] Bug fixes & optimization
├── [ ] Security audit
├── [ ] Load testing
├── [ ] Soft launch
├── [ ] Marketing campaign
└── [ ] Full launch

POST-LAUNCH:
├── [ ] Battle Royale mode
├── [ ] Match betting
├── [ ] Mobile app
├── [ ] Additional games
└── [ ] Expansion to new markets
```

---

## Del 11: Budget Estimat (LOW COST APPROACH)

> **STRATEGI:** Start så billigt som muligt, skaler når vi har revenue

### 11.1 Opstartsomkostninger (Minimum Viable)

| Kategori | Bootstrap | Notes |
|----------|-----------|-------|
| Legal & Licens | $0 | Privat fase - ingen licens |
| Domæne (.gg) | $20-50 | Årlig |
| Udvikling | $0 | DIY / Founders |
| Infrastructure setup | $0 | Free tiers |
| Skin Inventory | $0 | Fixed value system! |
| Marketing (launch) | $500 | Organic + små giveaways |
| **Total** | **~$500-1000** | |

### 11.2 Månedlige Driftsomkostninger (Start)

| Kategori | Low Cost | Notes |
|----------|----------|-------|
| Hetzner VPS (CX31) | €10 (~$11) | 4 vCPU, 8GB RAM |
| Hetzner Postgres | €15 (~$16) | Managed database |
| Redis (Upstash) | $0 | Free tier (10k commands/day) |
| Cloudflare | $0 | Free tier |
| NOWPayments | 0.5% | Per transaktion |
| Waxpeer | Variable | Per withdrawal |
| Domain renewal | ~$2 | Monthly amortized |
| **Total** | **~$30-50/måned** | Før vi skalerer |

### 11.3 Skaleret Budget (Når vi vokser)

| Kategori | Ved 1000 DAU | Ved 10000 DAU |
|----------|--------------|---------------|
| Servers | $50/mo | $200-500/mo |
| Database | $50/mo | $150/mo |
| Redis | $25/mo | $100/mo |
| CDN/Security | $20/mo | $200/mo |
| Support tools | $0 | $100/mo |
| **Total** | **~$150/mo** | **~$1000/mo** |

### 11.3 Revenue Model

```
REVENUE STREAMS:
├── Case Opening House Edge: 8-15%
├── Case Battle House Edge: 5-8%
├── Roulette House Edge: 6.6%
├── Coinflip House Edge: 5%
├── Crash House Edge: 4-6%
├── Trading Fees: 2-5%
└── Withdrawal Fees: 0-3%

EXAMPLE (at scale):
├── Monthly wagered: $10,000,000
├── Average house edge: 7%
├── Gross revenue: $700,000
├── Operating costs: $150,000
├── Net profit: $550,000
└── Profit margin: ~78%
```

---

## Del 12: Risici & Mitigation

### 12.1 Regulatoriske Risici

| Risiko | Sandsynlighed | Impact | Mitigation |
|--------|---------------|--------|------------|
| Licens afvist | Lav | Høj | Multiple jurisdiktioner |
| Regulation ændringer | Medium | Høj | Legal monitoring |
| Steam API ændringer | Medium | Høj | Diversify integrations |

### 12.2 Tekniske Risici

| Risiko | Sandsynlighed | Impact | Mitigation |
|--------|---------------|--------|------------|
| DDoS angreb | Høj | Medium | Cloudflare, redundancy |
| Data breach | Lav | Kritisk | Security audits, encryption |
| Bot manipulation | Medium | Medium | Anti-fraud systems |

### 12.3 Business Risici

| Risiko | Sandsynlighed | Impact | Mitigation |
|--------|---------------|--------|------------|
| Konkurrence | Høj | Medium | Differentiation, UX |
| Liquidity issues | Medium | Høj | Reserve funds |
| Influencer drama | Medium | Medium | Multiple partnerships |

---

## Del 13: Success Metrics (KPIs)

### 13.1 Growth Metrics
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- New User Registrations
- First Time Depositors (FTD)

### 13.2 Engagement Metrics
- Sessions per User
- Time on Site
- Battles Created/Joined
- Cases Opened

### 13.3 Financial Metrics
- Gross Gaming Revenue (GGR)
- Net Gaming Revenue (NGR)
- Average Revenue Per User (ARPU)
- Customer Lifetime Value (LTV)
- Customer Acquisition Cost (CAC)

### 13.4 Operational Metrics
- Deposit/Withdrawal Speed
- Support Response Time
- System Uptime
- Trade Bot Success Rate

---

## Del 14: Team Struktur

### 14.1 Core Team (Launch)

```
LEADERSHIP:
├── CEO / Founder
├── CTO
└── COO

ENGINEERING:
├── Lead Backend Developer
├── 2x Backend Developers
├── Lead Frontend Developer
├── 2x Frontend Developers
├── DevOps Engineer
└── QA Engineer

OPERATIONS:
├── Customer Support Lead
├── 2x Support Agents
├── Compliance Officer
└── Community Manager

MARKETING:
├── Marketing Manager
├── Content Creator
└── Influencer Relations
```

---

## Del 15: Konklusion

### Nøglepunkter for Success

1. **Case Battles er kernen** - Invester mest her
2. **Custom Cases er differentiatoren** - Ingen andre gør det så godt
3. **UX er alt** - Smuk, hurtig, mobil-først
4. **Trust through transparency** - Provably fair, synlig licens
5. **Community building** - Discord, chat, social features
6. **Influencer marketing** - Primær vækstkanal

### Konkurrencefordele

1. **Emerald Exclusive Modes** - Cursed, Sniper, Progressive, Mystery
2. **Bedste Custom Case Creator** - Mest intuitive og feature-rich
3. **Laveste House Edge** - 5-6% på battles
4. **Hurtigste Withdrawals** - Instant skin delivery
5. **Bedste Mobile Experience** - Native app kvalitet

### Næste Skridt

1. Finaliser business plan og budget
2. Secure funding / investment
3. Start juridisk setup
4. Rekrutter core team
5. Begin development sprint 1

---

*Dokumentet er udarbejdet baseret på research af CSGOEmpire, Rain.gg, DatDrop, CSGORoll, Clash.gg og andre ledende platforme i januar 2026.*

**Sources:**
- [CSGOEmpire](https://csgoempire.com)
- [Rain.gg Case Battles](https://rain.gg/games/case-battles)
- [DatDrop](https://datdrop.com)
- [CSGORoll Provably Fair](https://www.csgoroll.com/info/provably-fair/)
- [Curacao Gaming License Guide](https://crustlab.com/blog/curacao-gaming-license-casino-regulations/)
- [Steam Web API](https://www.steamwebapi.com/)
