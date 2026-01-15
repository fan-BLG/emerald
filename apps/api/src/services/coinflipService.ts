import crypto from 'crypto';
import { prisma, io } from '../index.js';
import { generateResult, generateServerSeed, hashServerSeed } from './provablyFair.js';

const HOUSE_EDGE = 0.05; // 5% house edge

export class CoinflipService {
  /**
   * Creates a new coinflip game
   */
  async createGame(userId: string, side: 'heads' | 'tails', amount: number) {
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
          type: 'case_open', // Reusing existing type for coinflip
          amount: -amount,
          referenceType: 'coinflip',
          status: 'pending',
          description: 'Coinflip bet',
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

    // Emit game created
    io.emit('coinflip:created', {
      game: {
        ...game,
        amount: Number(game.amount),
        rollValue: null,
        opponent: null,
        winner: null,
        winnerSide: null,
      },
    });

    return game;
  }

  /**
   * Join an existing coinflip game
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

    // Join game and execute flip
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

      // Calculate payout (total pot minus house edge)
      const totalPot = amount * 2;
      const houseCut = totalPot * HOUSE_EDGE;
      const payout = totalPot - houseCut;

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
        rollValue: result.rollValue,
        serverSeed: game.serverSeed, // Reveal server seed
      });

      // Emit big win if significant
      if (result.payout >= 100) {
        io.emit('global:bigWin', {
          odId: result.game.winnerId!,
          username: result.game.winner!.username,
          game: 'coinflip',
          item: { name: 'Coinflip', value: result.payout },
          multiplier: 2 - HOUSE_EDGE,
        } as any);
      }
    }, 3000); // 3 second delay for flip animation

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
