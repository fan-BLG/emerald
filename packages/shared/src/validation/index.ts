import { z } from 'zod';

// ============================================
// EMERALD VALIDATION SCHEMAS (Zod)
// ============================================

// ==================== COMMON ====================
export const uuidSchema = z.string().uuid();
export const steamIdSchema = z.string().regex(/^\d{17}$/, 'Invalid Steam ID');

// ==================== AUTH ====================
export const authTokenSchema = z.object({
  token: z.string().min(1),
});

// ==================== USER ====================
export const updateUserSettingsSchema = z.object({
  emeraldSpinEnabled: z.boolean().optional(),
  email: z.string().email().optional().nullable(),
});

export const updateClientSeedSchema = z.object({
  clientSeed: z.string().min(1).max(64),
});

// ==================== BATTLES ====================
export const battleTypeSchema = z.enum(['standard', 'team', 'shared']);
export const battleModeSchema = z.enum(['normal', 'crazy', 'cursed', 'progressive', 'mystery']);

export const createBattleSchema = z.object({
  type: battleTypeSchema,
  mode: battleModeSchema,
  maxPlayers: z.number().int().min(2).max(4),
  cases: z.array(uuidSchema).min(1).max(50),
  options: z.object({
    isPrivate: z.boolean().default(false),
    isFastMode: z.boolean().default(false),
    emeraldSpin: z.boolean().default(true),
  }),
});

export const joinBattleSchema = z.object({
  battleId: uuidSchema,
  position: z.number().int().min(0).max(3),
  team: z.number().int().min(0).max(1).optional().nullable(),
});

export const battleIdSchema = z.object({
  battleId: uuidSchema,
});

export const randomBattleSchema = z.object({
  budget: z.number().min(5).max(10000),
  minCases: z.number().int().min(1).max(20),
});

// ==================== CASES ====================
export const openCaseSchema = z.object({
  count: z.number().int().min(1).max(10).default(1),
});

export const getCasesQuerySchema = z.object({
  featured: z.coerce.boolean().optional(),
  category: z.string().optional(),
  sort: z.enum(['popular', 'newest', 'price_asc', 'price_desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== PAYMENTS ====================
export const createDepositSchema = z.object({
  amount: z.number().min(5).max(100000),
  currency: z.string().min(2).max(10),
});

export const requestWithdrawalSchema = z.object({
  waxpeerItemId: z.string().min(1),
  tradeLink: z.string().url().includes('steamcommunity.com/tradeoffer'),
});

export const cryptoWithdrawalSchema = z.object({
  amount: z.number().min(10).max(100000),
  currency: z.string().min(2).max(10),
  address: z.string().min(10),
});

// ==================== CHAT ====================
export const chatMessageSchema = z.object({
  room: z.string().min(1).max(30).default('global'),
  message: z.string().min(1).max(500).trim(),
});

// ==================== PROVABLY FAIR ====================
export const calculateResultSchema = z.object({
  serverSeed: z.string().length(64),
  publicSeed: z.string().min(1),
  clientSeed: z.string().min(1).max(64),
  nonce: z.number().int().min(0),
});

// ==================== PAGINATION ====================
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== BATTLES LIST QUERY ====================
export const getBattlesQuerySchema = z.object({
  status: z.enum(['waiting', 'starting', 'in_progress', 'finished', 'cancelled']).optional(),
  type: battleTypeSchema.optional(),
  mode: battleModeSchema.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().max(1000000).optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'players']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ==================== COINFLIP ====================
export const coinflipSideSchema = z.enum(['heads', 'tails']);

export const createCoinflipSchema = z.object({
  side: coinflipSideSchema,
  amount: z.number().min(0.10).max(100000),
});

export const joinCoinflipSchema = z.object({
  gameId: uuidSchema,
});

export const getCoinflipsQuerySchema = z.object({
  status: z.enum(['waiting', 'in_progress', 'finished', 'cancelled']).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().max(1000000).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ==================== CRASH ====================
export const placeCrashBetSchema = z.object({
  amount: z.number().min(0.10).max(100000),
  autoCashout: z.number().min(1.01).max(1000000).optional(),
});

export const cashoutCrashSchema = z.object({
  roundId: uuidSchema,
});

// ==================== ROULETTE ====================
export const rouletteBetTypeSchema = z.enum(['red', 'black', 'green']);

export const placeRouletteBetSchema = z.object({
  betType: rouletteBetTypeSchema,
  amount: z.number().min(0.10).max(100000),
});

// ==================== TYPE EXPORTS ====================
export type AuthToken = z.infer<typeof authTokenSchema>;
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;
export type UpdateClientSeed = z.infer<typeof updateClientSeedSchema>;
export type CreateBattle = z.infer<typeof createBattleSchema>;
export type JoinBattle = z.infer<typeof joinBattleSchema>;
export type RandomBattle = z.infer<typeof randomBattleSchema>;
export type OpenCase = z.infer<typeof openCaseSchema>;
export type GetCasesQuery = z.infer<typeof getCasesQuerySchema>;
export type CreateDeposit = z.infer<typeof createDepositSchema>;
export type RequestWithdrawal = z.infer<typeof requestWithdrawalSchema>;
export type CryptoWithdrawal = z.infer<typeof cryptoWithdrawalSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type CalculateResult = z.infer<typeof calculateResultSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type GetBattlesQuery = z.infer<typeof getBattlesQuerySchema>;
export type CreateCoinflip = z.infer<typeof createCoinflipSchema>;
export type JoinCoinflip = z.infer<typeof joinCoinflipSchema>;
export type GetCoinflipsQuery = z.infer<typeof getCoinflipsQuerySchema>;
export type PlaceCrashBet = z.infer<typeof placeCrashBetSchema>;
export type CashoutCrash = z.infer<typeof cashoutCrashSchema>;
export type PlaceRouletteBet = z.infer<typeof placeRouletteBetSchema>;
