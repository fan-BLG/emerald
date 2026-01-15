import { FastifyPluginAsync } from 'fastify';
import { updateUserSettingsSchema, updateClientSeedSchema, paginationSchema } from '@emerald/shared';
import { prisma } from '../index.js';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user profile (public)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        level: true,
        vipTier: true,
        totalWagered: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: {
        ...user,
        totalWagered: Number(user.totalWagered),
      },
    };
  });

  // Get user stats
  fastify.get('/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        totalWagered: true,
        totalWon: true,
        level: true,
        xp: true,
        _count: {
          select: {
            battles: true,
            wonBattles: true,
          },
        },
      },
    });

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    return {
      success: true,
      data: {
        totalWagered: Number(user.totalWagered),
        totalWon: Number(user.totalWon),
        profit: Number(user.totalWon) - Number(user.totalWagered),
        level: user.level,
        xp: Number(user.xp),
        battlesPlayed: user._count.battles,
        battlesWon: user._count.wonBattles,
        winRate: user._count.battles > 0
          ? (user._count.wonBattles / user._count.battles * 100).toFixed(2)
          : 0,
      },
    };
  });

  // Update user settings
  fastify.put('/settings', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const parseResult = updateUserSettingsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', details: parseResult.error.flatten() },
      });
    }

    const { emeraldSpinEnabled, email } = parseResult.data;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(emeraldSpinEnabled !== undefined && { emeraldSpinEnabled }),
        ...(email !== undefined && { email }),
      },
      select: {
        id: true,
        emeraldSpinEnabled: true,
        email: true,
      },
    });

    return { success: true, data: user };
  });

  // Update client seed
  fastify.put('/client-seed', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const parseResult = updateClientSeedSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input' },
      });
    }

    const { clientSeed } = parseResult.data;

    // Update user's client seed
    await prisma.user.update({
      where: { id: userId },
      data: { clientSeed },
    });

    // Also update active user seed
    await prisma.userSeed.updateMany({
      where: { userId, isActive: true },
      data: { clientSeed },
    });

    return { success: true, data: { clientSeed } };
  });

  // Get user transactions
  fastify.get('/transactions', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const parseResult = paginationSchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid pagination parameters' },
      });
    }

    const { page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: {
        items: transactions.map((t) => ({
          ...t,
          amount: Number(t.amount),
        })),
        total,
        page,
        limit,
        hasMore: skip + transactions.length < total,
      },
    };
  });

  // Get user battle history
  fastify.get('/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };

    const parseResult = paginationSchema.safeParse(request.query);
    const { page = 1, limit = 20 } = parseResult.success ? parseResult.data : {};
    const skip = (page - 1) * limit;

    const [battles, total] = await Promise.all([
      prisma.battleParticipant.findMany({
        where: { userId: id },
        include: {
          battle: {
            include: {
              creator: {
                select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
              },
              winner: {
                select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.battleParticipant.count({ where: { userId: id } }),
    ]);

    return {
      success: true,
      data: {
        items: battles.map((bp) => ({
          battle: {
            ...bp.battle,
            costPerPlayer: Number(bp.battle.costPerPlayer),
            totalValue: Number(bp.battle.totalValue),
          },
          position: bp.position,
          totalValue: Number(bp.totalValue),
          isWinner: bp.isWinner,
        })),
        total,
        page,
        limit,
        hasMore: skip + battles.length < total,
      },
    };
  });
};
