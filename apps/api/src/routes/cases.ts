import { FastifyPluginAsync } from 'fastify';
import { getCasesQuerySchema, openCaseSchema } from '@emerald/shared';
import { prisma, io } from '../index.js';
import { generateResult, rollToItem } from '../services/provablyFair.js';

export const caseRoutes: FastifyPluginAsync = async (fastify) => {
  // List all cases
  fastify.get('/', async (request, reply) => {
    const parseResult = getCasesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid query parameters' },
      });
    }

    const { featured, category, sort, page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (featured !== undefined) where.isFeatured = featured;
    // Category would need additional logic based on price ranges

    const orderBy: any = {};
    switch (sort) {
      case 'popular':
        orderBy.totalOpened = 'desc';
        break;
      case 'newest':
        orderBy.createdAt = 'desc';
        break;
      case 'price_asc':
        orderBy.price = 'asc';
        break;
      case 'price_desc':
        orderBy.price = 'desc';
        break;
      default:
        orderBy.createdAt = 'desc';
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true },
          },
        },
      }),
      prisma.case.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items: cases.map((c) => ({
          ...c,
          price: Number(c.price),
          houseEdge: Number(c.houseEdge),
          totalOpened: Number(c.totalOpened),
        })),
        total,
        page,
        limit,
        hasMore: skip + cases.length < total,
      },
    };
  });

  // Get case by ID with items
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            skin: true,
          },
          orderBy: { coinValue: 'desc' },
        },
        creator: {
          select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
        },
      },
    });

    if (!caseData) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Case not found' },
      });
    }

    // Calculate total odds weight for percentage calculation
    const totalWeight = caseData.items.reduce((sum, item) => sum + item.oddsWeight, 0);

    return {
      success: true,
      data: {
        ...caseData,
        price: Number(caseData.price),
        houseEdge: Number(caseData.houseEdge),
        totalOpened: Number(caseData.totalOpened),
        items: caseData.items.map((item) => ({
          ...item,
          coinValue: Number(item.coinValue),
          oddsPercentage: (item.oddsWeight / totalWeight) * 100,
          skin: {
            ...item.skin,
            displayPrice: item.skin.displayPrice ? Number(item.skin.displayPrice) : null,
          },
        })),
      },
    };
  });

  // Open a case (solo opening)
  fastify.post('/:id/open', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    const parseResult = openCaseSchema.safeParse(request.body);
    const count = parseResult.success ? parseResult.data.count : 1;

    // Get case with items
    const caseData = await prisma.case.findUnique({
      where: { id, isActive: true },
      include: {
        items: {
          include: { skin: true },
          orderBy: { oddsWeight: 'desc' },
        },
      },
    });

    if (!caseData) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Case not found' },
      });
    }

    const totalCost = Number(caseData.price) * count;

    // Get user and check balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || Number(user.balance) < totalCost) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Not enough balance',
          details: { required: totalCost, current: user ? Number(user.balance) : 0 },
        },
      });
    }

    // Get user's active seed
    const userSeed = await prisma.userSeed.findFirst({
      where: { userId, isActive: true },
    });

    if (!userSeed) {
      return reply.code(500).send({
        success: false,
        error: { code: 'SEED_ERROR', message: 'No active seed found' },
      });
    }

    // Calculate cumulative odds for items
    const totalWeight = caseData.items.reduce((sum, item) => sum + item.oddsWeight, 0);
    let cumulative = 0;
    const itemsWithCumulative = caseData.items.map((item) => {
      cumulative += item.oddsWeight / totalWeight;
      return { ...item, cumulative };
    });

    // Generate results for each case
    const results = [];
    let totalWinnings = 0;

    for (let i = 0; i < count; i++) {
      const nonce = userSeed.nonce + i;
      const rollResult = generateResult(
        userSeed.serverSeed,
        'solo-opening', // Solo openings use a static public seed
        userSeed.clientSeed,
        nonce
      );

      const wonItem = rollToItem(rollResult.rollValue, itemsWithCumulative);
      totalWinnings += Number(wonItem.coinValue);

      results.push({
        item: {
          id: wonItem.id,
          skinId: wonItem.skinId,
          name: wonItem.skin.name,
          imageUrl: wonItem.skin.imageUrl,
          rarity: wonItem.skin.rarity,
          coinValue: Number(wonItem.coinValue),
        },
        nonce,
        rollValue: rollResult.rollValue,
      });
    }

    // Update database in transaction
    await prisma.$transaction([
      // Deduct cost
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: totalCost },
          totalWagered: { increment: totalCost },
        },
      }),
      // Add winnings
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: totalWinnings },
          totalWon: { increment: totalWinnings },
        },
      }),
      // Update nonce
      prisma.userSeed.update({
        where: { id: userSeed.id },
        data: { nonce: { increment: count } },
      }),
      // Update case stats
      prisma.case.update({
        where: { id },
        data: { totalOpened: { increment: count } },
      }),
      // Create transactions
      prisma.transaction.create({
        data: {
          userId,
          type: 'case_open',
          amount: -totalCost,
          referenceType: 'case',
          referenceId: id,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'case_win',
          amount: totalWinnings,
          referenceType: 'case',
          referenceId: id,
        },
      }),
    ]);

    // Get updated balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    // Emit balance update
    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: totalWinnings - totalCost,
      reason: 'case_opening',
    });

    // Check for big wins and broadcast
    const bigWinThreshold = Number(caseData.price) * 10;
    for (const result of results) {
      if (result.item.coinValue >= bigWinThreshold) {
        io.emit('global:bigWin', {
          odId: user.id,
          username: user.username,
          game: 'case',
          item: { name: result.item.name, value: result.item.coinValue },
          multiplier: result.item.coinValue / Number(caseData.price),
        });
      }
    }

    return {
      success: true,
      data: {
        items: results,
        newBalance: Number(updatedUser?.balance || 0),
        totalCost,
        totalWinnings,
        profit: totalWinnings - totalCost,
      },
    };
  });

  // Get recent drops from case
  fastify.get('/:id/drops', async (request, reply) => {
    const { id } = request.params as { id: string };

    // This would query battle rounds or a separate case openings table
    // For now, return empty as we'd need to track solo case openings separately

    return {
      success: true,
      data: {
        items: [],
      },
    };
  });
};
