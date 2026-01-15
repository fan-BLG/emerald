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

### 1.3 Juridisk Struktur

**Licens (Prioriteret rækkefølge):**
1. **Curacao Gaming License (Anbefalet til start)**
   - Pris: ~€47,000/år (B2C)
   - Setup: €20,000-50,000
   - Tidslinje: 2-3 måneder
   - Dækker alle gambling typer

2. **Malta Gaming Authority (Senere)**
   - Højere prestige
   - Dyrere (~€25,000 setup + højere skatter)
   - Bedre for EU marked

**Virksomhedsstruktur:**
- Holding selskab (offshore)
- Operationelt selskab i Curacao
- Teknisk selskab (kan være EU-baseret)

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

Infrastructure:
├── Cloud: AWS / Google Cloud
├── CDN: Cloudflare
├── Containers: Docker + Kubernetes
├── CI/CD: GitHub Actions
└── Monitoring: Datadog / Grafana

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

### 2.3 Systemarkitektur Diagram

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

### 3.2 Custom Case Creator (KERNE FEATURE)

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

### 5.1 Indbetalingsmetoder

```
CRYPTO (Prioritet 1 - Laveste fees):
├── Bitcoin (BTC)
├── Ethereum (ETH)
├── Litecoin (LTC)
├── USDT (Tether)
├── USDC
├── Dogecoin (DOGE)
├── Tron (TRX)
└── BNB

SKINS (Prioritet 2 - Kerneprodukt):
├── CS2 Skins (via Steam Trade)
├── Instant skin værdiansættelse
└── 0% deposit fee (konkurrencefordel)

FIAT (Prioritet 3 - Via payment processor):
├── Visa / Mastercard
├── Apple Pay / Google Pay
├── Bank Transfer
└── PIX (Brasilien)
├── Boleto (Brasilien)
└── Lokal payment methods
```

### 5.2 Udbetalingsmetoder

```
SKINS:
├── Instant withdrawal til Steam
├── P2P Marketplace
├── 0-3% withdrawal fee
└── Trade bot network

CRYPTO:
├── Alle supported cryptocurrencies
├── 0-1% fee
└── Automatisk processing

FIAT (KYC påkrævet):
├── Bank transfer
├── Crypto → Fiat gateways
└── 2-5% fee
```

### 5.3 Intern Valuta

**"Emerald Coins" (EC)**
- 1 EC = $0.01 USD
- Alle spil bruger EC
- Undgår valutakurs problemer
- Gør odds beregning simpelt

### 5.4 Steam Trade Bot System

```
┌────────────────────────────────────────────────────┐
│              TRADE BOT ARKITEKTUR                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────┐    ┌──────────────┐             │
│  │   Bot Pool   │    │   Bot Pool   │             │
│  │   (Deposits) │    │ (Withdrawals)│             │
│  │              │    │              │             │
│  │  Bot 1 [$5k] │    │  Bot A [$8k] │             │
│  │  Bot 2 [$5k] │    │  Bot B [$8k] │             │
│  │  Bot 3 [$5k] │    │  Bot C [$8k] │             │
│  │  Bot 4 [$5k] │    │  Bot D [$8k] │             │
│  │     ...      │    │     ...      │             │
│  └──────┬───────┘    └──────┬───────┘             │
│         │                   │                     │
│         ▼                   ▼                     │
│  ┌─────────────────────────────────────────────┐  │
│  │           TRADE COORDINATOR                 │  │
│  │  • Load balancing mellem bots               │  │
│  │  • Inventory management                     │  │
│  │  • Price checking (multiple APIs)           │  │
│  │  • Trade offer creation & tracking          │  │
│  │  • Steam Guard 2FA automation               │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  INTEGRATIONER:                                    │
│  • Steam Web API                                   │
│  • Steamwebapi.com (inventory caching)            │
│  • CSFloat / Buff163 (pricing)                    │
│  • Pricempire (price aggregation)                 │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Trade Bot Krav:**
- 15+ dages Steam Guard på hver bot
- Dedikeret telefonnummer per bot
- Clean trade history
- Geografisk distribueret (avoid bans)
- Minimum 20 bots til launch
- ~$100,000 skin inventory til start

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

## Del 11: Budget Estimat

### 11.1 Opstartsomkostninger

| Kategori | Lav | Medium | Høj |
|----------|-----|--------|-----|
| Legal & Licens | $50,000 | $75,000 | $120,000 |
| Udvikling (team) | $150,000 | $300,000 | $500,000 |
| Infrastructure | $10,000 | $25,000 | $50,000 |
| Skin Inventory | $50,000 | $100,000 | $250,000 |
| Marketing (launch) | $50,000 | $150,000 | $300,000 |
| **Total** | **$310,000** | **$650,000** | **$1,220,000** |

### 11.2 Månedlige Driftsomkostninger

| Kategori | Estimat |
|----------|---------|
| Hosting & Infrastructure | $5,000-15,000 |
| Team (5-10 personer) | $30,000-80,000 |
| Marketing | $20,000-100,000 |
| Licens & Compliance | $5,000-10,000 |
| Support & Operations | $5,000-15,000 |
| **Total** | **$65,000-220,000** |

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
