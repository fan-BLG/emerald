// ============================================
// EMERALD SHARED TYPES
// ============================================

// ==================== USER ====================
export interface User {
  id: string;
  steamId: string;
  username: string;
  avatarUrl: string | null;
  email: string | null;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWagered: number;
  totalWon: number;
  level: number;
  xp: number;
  vipTier: VipTier;
  emeraldSpinEnabled: boolean;
  clientSeed: string | null;
  isBanned: boolean;
  is2faEnabled: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export type VipTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'emerald';

export interface UserPublic {
  id: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  vipTier: VipTier;
}

// ==================== SKINS ====================
export type SkinRarity =
  | 'consumer'
  | 'industrial'
  | 'milspec'
  | 'restricted'
  | 'classified'
  | 'covert'
  | 'contraband';

export type WeaponType =
  | 'knife'
  | 'gloves'
  | 'rifle'
  | 'pistol'
  | 'smg'
  | 'shotgun'
  | 'machinegun'
  | 'sniper';

export interface Skin {
  id: string;
  name: string;
  marketHashName: string;
  imageUrl: string;
  rarity: SkinRarity;
  weaponType: WeaponType | null;
  collection: string | null;
  exterior: string | null;
  isStattrak: boolean;
  displayPrice: number | null;
}

// ==================== CASES ====================
export interface Case {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
  houseEdge: number;
  isCustom: boolean;
  creatorId: string | null;
  isFeatured: boolean;
  isActive: boolean;
  totalOpened: number;
}

export interface CaseItem {
  id: string;
  caseId: string;
  skinId: string;
  skin: Skin;
  coinValue: number;
  oddsWeight: number;
  oddsPercentage: number;
}

export interface CaseWithItems extends Case {
  items: CaseItem[];
}

// ==================== BATTLES ====================
export type BattleType = 'standard' | 'team' | 'shared';
export type BattleMode = 'normal' | 'crazy' | 'cursed' | 'progressive' | 'mystery';
export type BattleStatus = 'waiting' | 'starting' | 'in_progress' | 'finished' | 'cancelled';

export interface Battle {
  id: string;
  type: BattleType;
  mode: BattleMode;
  maxPlayers: number;
  teamSize: number;
  isPrivate: boolean;
  privateCode: string | null;
  isFastMode: boolean;
  emeraldSpin: boolean;
  status: BattleStatus;
  currentRound: number;
  totalRounds: number;
  costPerPlayer: number;
  totalValue: number;
  serverSeedHash: string;
  publicSeed: string | null;
  winnerId: string | null;
  winningTeam: number | null;
  createdBy: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface BattleParticipant {
  id: string;
  battleId: string;
  userId: string;
  user: UserPublic;
  position: number;
  team: number | null;
  totalValue: number;
  isWinner: boolean;
  joinedAt: Date;
}

export interface BattleCase {
  id: string;
  battleId: string;
  caseId: string;
  case: Case;
  roundNumber: number;
}

export interface BattleRound {
  id: string;
  battleId: string;
  participantId: string;
  roundNumber: number;
  caseItemId: string;
  item: CaseItem;
  coinValue: number;
  nonce: number;
  rollValue: number;
  triggeredEmeraldSpin: boolean;
}

export interface BattleWithDetails extends Battle {
  participants: BattleParticipant[];
  cases: BattleCase[];
  creator: UserPublic;
}

// ==================== TRANSACTIONS ====================
export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'battle_entry'
  | 'battle_win'
  | 'case_open'
  | 'case_win'
  | 'bonus'
  | 'rakeback';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  status: TransactionStatus;
  description: string | null;
  createdAt: Date;
}

// ==================== PAYMENTS ====================
export type DepositStatus =
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'sending'
  | 'partially_paid'
  | 'finished'
  | 'failed'
  | 'refunded'
  | 'expired';

export interface CryptoDeposit {
  id: string;
  userId: string;
  paymentId: string | null;
  paymentStatus: DepositStatus;
  payAddress: string | null;
  payCurrency: string;
  payAmount: number | null;
  priceAmount: number;
  actuallyPaid: number;
  coinsCredited: number;
  createdAt: Date;
  expiresAt: Date | null;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'sent' | 'completed' | 'failed' | 'cancelled';

export interface SkinWithdrawal {
  id: string;
  userId: string;
  coinAmount: number;
  waxpeerItemId: string | null;
  skinName: string | null;
  tradeLink: string;
  status: WithdrawalStatus;
  waxpeerTradeId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

// ==================== CHAT ====================
export interface ChatMessage {
  id: string;
  userId: string;
  user: UserPublic;
  room: string;
  message: string;
  isDeleted: boolean;
  createdAt: Date;
}

// ==================== PROVABLY FAIR ====================
export interface UserSeeds {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RevealedSeed {
  serverSeed: string;
  serverSeedHash: string;
  publicSeed: string;
  clientSeed: string;
  nonce: number;
}

export interface VerificationData {
  serverSeed: string;
  serverSeedHash: string;
  publicSeed: string;
  clientSeed: string;
  rounds: {
    roundNumber: number;
    nonce: number;
    rollValue: number;
    itemName: string;
    coinValue: number;
  }[];
}

// ==================== API RESPONSES ====================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== SOCKET.IO EVENTS ====================
export interface ServerToClientEvents {
  // Connection
  connected: (data: { userId: string; balance: number }) => void;
  error: (data: { code: string; message: string }) => void;

  // Battles
  'battle:created': (battle: BattleWithDetails) => void;
  'battle:playerJoined': (data: { battleId: string; position: number; player: UserPublic }) => void;
  'battle:playerLeft': (data: { battleId: string; position: number; userId: string }) => void;
  'battle:starting': (data: { battleId: string; countdown: number; publicSeed: string }) => void;
  'battle:roundStart': (data: { battleId: string; round: number; totalRounds: number; case: Case }) => void;
  'battle:roundResult': (data: BattleRoundResultEvent) => void;
  'battle:finished': (data: BattleFinishedEvent) => void;
  'battle:cancelled': (data: { battleId: string; reason: string; refunded: boolean }) => void;

  // Chat
  'chat:message': (message: ChatMessage) => void;
  'chat:deleted': (data: { messageId: string }) => void;

  // Global
  'global:bigWin': (data: BigWinEvent) => void;
  'global:battleCreated': (data: { battleId: string; type: BattleType; totalValue: number; creator: UserPublic }) => void;

  // User
  'user:balanceUpdate': (data: { balance: number; change: number; reason: string }) => void;
  'user:notification': (data: NotificationEvent) => void;
  'user:levelUp': (data: { newLevel: number; rewards: Record<string, unknown> }) => void;
}

export interface ClientToServerEvents {
  // Auth
  auth: (data: { token: string }) => void;

  // Battles
  'battle:create': (data: CreateBattleRequest) => void;
  'battle:join': (data: { battleId: string; position: number; team?: number }) => void;
  'battle:leave': (data: { battleId: string }) => void;
  'battle:spectate': (data: { battleId: string }) => void;
  'battle:unspectate': (data: { battleId: string }) => void;

  // Chat
  'chat:message': (data: { room: string; message: string }) => void;
  'chat:join': (data: { room: string }) => void;
  'chat:leave': (data: { room: string }) => void;

  // User
  'user:updateSeed': (data: { clientSeed: string }) => void;
  'user:toggleEmeraldSpin': (data: { enabled: boolean }) => void;
}

// Event Data Types
export interface BattleRoundResultEvent {
  battleId: string;
  round: number;
  results: {
    position: number;
    playerId: string;
    item: {
      skinId: string;
      name: string;
      imageUrl: string;
      rarity: SkinRarity;
      coinValue: number;
    };
    isEmeraldSpin: boolean;
    nonce: number;
    rollValue: number;
  }[];
  roundWinner: number | null;
  scores: { position: number; total: number }[];
}

export interface BattleFinishedEvent {
  battleId: string;
  winner: {
    position: number;
    userId: string;
    username: string;
    totalValue: number;
  };
  serverSeed: string;
  allItems: CaseItem[];
}

export interface BigWinEvent {
  odId: string;
  username: string;
  game: 'battle' | 'case' | 'roulette' | 'coinflip' | 'crash';
  item: { name: string; value: number };
  multiplier: number;
}

export interface NotificationEvent {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface CreateBattleRequest {
  type: BattleType;
  mode: BattleMode;
  maxPlayers: number;
  cases: string[];
  options: {
    isPrivate: boolean;
    isFastMode: boolean;
    emeraldSpin: boolean;
  };
}

// ==================== RARITY COLORS ====================
export const RARITY_COLORS: Record<SkinRarity, string> = {
  consumer: '#b0c3d9',
  industrial: '#5e98d9',
  milspec: '#4b69ff',
  restricted: '#8847ff',
  classified: '#d32ce6',
  covert: '#eb4b4b',
  contraband: '#e4ae39',
};
