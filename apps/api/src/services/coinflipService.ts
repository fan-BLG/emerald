import crypto from 'crypto';
import { prisma, io } from '../index.js';
import { generateResult, generateServerSeed, hashServerSeed } from './provablyFair.js';

// House edges
const PVP_HOUSE_EDGE = 0; // 0% for player vs player
const BOT_HOUSE_EDGE = 0.02; // 2% for player vs bot

// Bot configuration
const BOT_NAMES = [
  'EmeraldBot', 'LuckyFlip', 'CoinMaster', 'FlipKing', 'GreenGambler',
  'DiamondFlip', 'GoldCoin', 'SilverSpin', 'CryptoFlip', 'ProGambler'
];

const BOT_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot2',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot3',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot5',
];

// Bot user object (not a real user in DB)
function generateBotUser() {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
  return {
    id: `bot_${crypto.randomBytes(8).toString('hex')}`,
    username: name,
    avatarUrl: avatar,
    level: Math.floor(Math.random() * 50) + 10,
    vipTier: 'bronze' as const,
    isBot: true,
  };
}

export class CoinflipService {
  /**
   * Creates a new coinflip game
   */
  async createGame(userId: string, side: 'heads' | 'tails', amount: number, vsBot: boolean = false) {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true, balance: true, clientSeed: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (Number(user.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    // Generate server seed
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    // Create game in transaction
    const game = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          totalWagered: { increment: amount },
        },
      });

      // Create transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'case_open',
          amount: -amount,
          referenceType: 'coinflip',
          status: 'pending',
          description: vsBot ? 'Coinflip bet vs bot' : 'Coinflip bet',
        },
      });

      // Create game
      const newGame = await tx.coinflipGame.create({
        data: {
          creatorId: userId,
          creatorSide: side,
          amount,
          serverSeed,
          serverSeedHash,
          clientSeed: user.clientSeed,
          isVsBot: vsBot,
        },
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      });

      return newGame;
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: -amount,
      reason: 'coinflip_bet',
    });

    // If vs bot, immediately execute the flip
    if (vsBot) {
      return this.executeVsBotFlip(game, user);
    }

    // Emit game created for PVP
    io.emit('coinflip:created', {
      game: {
        ...game,
        amount: Number(game.amount),
        rollValue: null,
        opponent: null,
        winner: null,
        winnerSide: null,
        isVsBot: false,
      },
    });

    return game;
  }

  /**
   * Execute a flip against a bot
   */
  private async executeVsBotFlip(game: any, user: any) {
    const amount = Number(game.amount);
    const botUser = generateBotUser();

    // Generate result
    const rollResult = generateResult(game.serverSeed, Date.now().toString(), user.clientSeed || 'default', 0);

    // Determine winner: < 0.5 = heads, >= 0.5 = tails
    const winnerSide = rollResult.rollValue < 0.5 ? 'heads' : 'tails';
    const playerWon = winnerSide === game.creatorSide;

    // Calculate payout with bot house edge (2%)
    const totalPot = amount * 2;
    const houseCut = totalPot * BOT_HOUSE_EDGE;
    const payout = playerWon ? (totalPot - houseCut) : 0;

    // Update game and handle payout
    const result = await prisma.$transaction(async (tx) => {
      // Update game
      const updatedGame = await tx.coinflipGame.update({
        where: { id: game.id },
        data: {
          opponentId: null, // Bot has no real user ID
          status: 'finished',
          winnerId: playerWon ? game.creatorId : null,
          winnerSide,
          rollValue: rollResult.rollValue,
          finishedAt: new Date(),
        },
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      });

      if (playerWon) {
        // Credit winner
        await tx.user.update({
          where: { id: game.creatorId },
          data: {
            balance: { increment: payout },
            totalWon: { increment: payout },
          },
        });

        // Create win transaction
        await tx.transaction.create({
          data: {
            userId: game.creatorId,
            type: 'case_win',
            amount: payout,
            referenceType: 'coinflip',
            referenceId: game.id,
            status: 'completed',
            description: 'Coinflip win vs bot',
          },
        });
      }

      // Mark bet transaction as completed
      await tx.transaction.updateMany({
        where: {
          referenceType: 'coinflip',
          referenceId: game.id,
          type: 'case_open',
        },
        data: { status: 'completed' },
      });

      return { game: updatedGame, winnerSide, rollValue: rollResult.rollValue, payout, botUser };
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: game.creatorId },
      select: { balance: true },
    });

    io.to(`user:${game.creatorId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: playerWon ? payout - amount : -amount,
      reason: 'coinflip_result',
    });

    // Emit game created with bot opponent
    io.emit('coinflip:created', {
      game: {
        ...result.game,
        amount: Number(result.game.amount),
        rollValue: null,
        opponent: botUser,
        winner: null,
        winnerSide: null,
        isVsBot: true,
      },
    });

    // Emit result after short delay for animation
    setTimeout(() => {
      io.emit('coinflip:result', {
        gameId: game.id,
        winnerSide: result.winnerSide,
        winnerId: playerWon ? game.creatorId : botUser.id,
        winnerUsername: playerWon ? result.game.creator.username : botUser.username,
        rollValue: result.rollValue,
        serverSeed: game.serverSeed,
        isVsBot: true,
      });

      // Emit big win if significant
      if (result.payout >= 100) {
        io.emit('global:bigWin', {
          odId: game.creatorId,
          username: result.game.creator.username,
          game: 'coinflip',
          item: { name: 'Coinflip vs Bot', value: result.payout },
          multiplier: 2 * (1 - BOT_HOUSE_EDGE),
        } as any);
      }
    }, 3000);

    return {
      ...result.game,
      opponent: botUser,
      winner: playerWon ? result.game.creator : botUser,
      winnerSide: result.winnerSide,
      isVsBot: true,
    };
  }

  /**
   * Join an existing coinflip game (PVP - 0% house edge)
   */
  async joinGame(userId: string, gameId: string) {
    // Get game
    const game = await prisma.coinflipGame.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true, clientSeed: true },
        },
      },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'waiting') {
      throw new Error('Game is not available');
    }

    if (game.creatorId === userId) {
      throw new Error('Cannot join your own game');
    }

    if ((game as any).isVsBot) {
      throw new Error('Cannot join a bot game');
    }

    // Get opponent user
    const opponent = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true, balance: true, clientSeed: true },
    });

    if (!opponent) {
      throw new Error('User not found');
    }

    const amount = Number(game.amount);
    if (Number(opponent.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    // Join game and execute flip - PVP has 0% house edge!
    const result = await prisma.$transaction(async (tx) => {
      // Deduct opponent balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          totalWagered: { increment: amount },
        },
      });

      // Create transaction for opponent
      await tx.transaction.create({
        data: {
          userId,
          type: 'case_open',
          amount: -amount,
          referenceType: 'coinflip',
          referenceId: gameId,
          status: 'pending',
          description: 'Coinflip bet',
        },
      });

      // Generate result using combined client seeds
      const combinedClientSeed = `${game.clientSeed || 'default'}:${opponent.clientSeed || 'default'}`;
      const rollResult = generateResult(game.serverSeed, Date.now().toString(), combinedClientSeed, 0);

      // Determine winner: < 0.5 = heads, >= 0.5 = tails
      const winnerSide = rollResult.rollValue < 0.5 ? 'heads' : 'tails';
      const winnerId = winnerSide === game.creatorSide ? game.creatorId : userId;

      // PVP: 0% house edge - winner takes all!
      const payout = amount * 2;

      // Update game
      const updatedGame = await tx.coinflipGame.update({
        where: { id: gameId },
        data: {
          opponentId: userId,
          status: 'finished',
          winnerId,
          winnerSide,
          rollValue: rollResult.rollValue,
          finishedAt: new Date(),
        },
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
          opponent: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
          winner: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      });

      // Credit winner
      await tx.user.update({
        where: { id: winnerId },
        data: {
          balance: { increment: payout },
          totalWon: { increment: payout },
        },
      });

      // Create win transaction
      await tx.transaction.create({
        data: {
          userId: winnerId,
          type: 'case_win',
          amount: payout,
          referenceType: 'coinflip',
          referenceId: gameId,
          status: 'completed',
          description: 'Coinflip win',
        },
      });

      // Mark bet transactions as completed
      await tx.transaction.updateMany({
        where: {
          referenceType: 'coinflip',
          referenceId: gameId,
          type: 'case_open',
        },
        data: { status: 'completed' },
      });

      return { game: updatedGame, winnerSide, rollValue: rollResult.rollValue, payout };
    });

    // Emit balance updates
    for (const odUserId of [game.creatorId, userId]) {
      const user = await prisma.user.findUnique({
        where: { id: odUserId },
        select: { balance: true },
      });

      io.to(`user:${odUserId}`).emit('user:balanceUpdate', {
        balance: Number(user?.balance || 0),
        change: odUserId === result.game.winnerId ? result.payout - amount : -amount,
        reason: 'coinflip_result',
      });
    }

    // Emit game joined
    io.emit('coinflip:joined', {
      gameId,
      opponent: result.game.opponent,
    });

    // Emit result after short delay for animation
    setTimeout(() => {
      io.emit('coinflip:result', {
        gameId,
        winnerSide: result.winnerSide,
        winnerId: result.game.winnerId!,
        winnerUsername: result.game.winner!.username,
        rollValue: result.rollValue,
        serverSeed: game.serverSeed,
        isVsBot: false,
      });

      // Emit big win if significant
      if (result.payout >= 100) {
        io.emit('global:bigWin', {
          odId: result.game.winnerId!,
          username: result.game.winner!.username,
          game: 'coinflip',
          item: { name: 'Coinflip', value: result.payout },
          multiplier: 2, // No house edge for PVP
        } as any);
      }
    }, 3000);

    return result.game;
  }

  /**
   * Cancel a waiting coinflip game
   */
  async cancelGame(userId: string, gameId: string) {
    const game = await prisma.coinflipGame.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.creatorId !== userId) {
      throw new Error('Only the creator can cancel');
    }

    if (game.status !== 'waiting') {
      throw new Error('Game cannot be cancelled');
    }

    const amount = Number(game.amount);

    await prisma.$transaction(async (tx) => {
      // Refund creator
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          totalWagered: { decrement: amount },
        },
      });

      // Update game
      await tx.coinflipGame.update({
        where: { id: gameId },
        data: { status: 'cancelled' },
      });

      // Create refund transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'case_win',
          amount,
          referenceType: 'coinflip',
          referenceId: gameId,
          status: 'completed',
          description: 'Coinflip cancelled - refund',
        },
      });
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: amount,
      reason: 'coinflip_refund',
    });

    // Emit cancellation
    io.emit('coinflip:cancelled', { gameId });

    return { success: true };
  }

  /**
   * Get active coinflip games
   */
  async getGames(filters: {
    status?: string;
    minAmount?: number;
    maxAmount?: number;
    page?: number;
    limit?: number;
  }) {
    const { status, minAmount, maxAmount, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (minAmount !== undefined) where.amount = { ...where.amount, gte: minAmount };
    if (maxAmount !== undefined) where.amount = { ...where.amount, lte: maxAmount };

    const [games, total] = await Promise.all([
      prisma.coinflipGame.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
          opponent: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
          winner: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      }),
      prisma.coinflipGame.count({ where }),
    ]);

    return {
      games: games.map((g) => ({
        ...g,
        amount: Number(g.amount),
        rollValue: g.rollValue ? Number(g.rollValue) : null,
      })),
      total,
      page,
      limit,
      hasMore: skip + games.length < total,
    };
  }
}
