import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { createBattleSchema, joinBattleSchema, getBattlesQuerySchema, randomBattleSchema } from '@emerald/shared';
import { prisma, io } from '../index.js';
import { BattleService } from '../services/battleService.js';

export const battleRoutes: FastifyPluginAsync = async (fastify) => {
  const battleService = new BattleService();

  // List active battles
  fastify.get('/', async (request, reply) => {
    const parseResult = getBattlesQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid query parameters' },
      });
    }

    const { status, type, mode, minPrice, maxPrice, sort, page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (mode) where.mode = mode;
    if (minPrice !== undefined) where.costPerPlayer = { ...where.costPerPlayer, gte: minPrice };
    if (maxPrice !== undefined) where.costPerPlayer = { ...where.costPerPlayer, lte: maxPrice };

    const orderBy: any = {};
    switch (sort) {
      case 'newest':
        orderBy.createdAt = 'desc';
        break;
      case 'oldest':
        orderBy.createdAt = 'asc';
        break;
      case 'price_asc':
        orderBy.costPerPlayer = 'asc';
        break;
      case 'price_desc':
        orderBy.costPerPlayer = 'desc';
        break;
      default:
        orderBy.createdAt = 'desc';
    }

    const [battles, total] = await Promise.all([
      prisma.battle.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
          participants: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
              },
            },
          },
          cases: {
            include: {
              case: true,
            },
            orderBy: { roundNumber: 'asc' },
          },
        },
      }),
      prisma.battle.count({ where }),
    ]);

    return {
      success: true,
      data: battles.map((battle) => ({
        ...battle,
        costPerPlayer: Number(battle.costPerPlayer),
        totalValue: Number(battle.totalValue),
        participants: battle.participants.map((p) => ({
          ...p,
          totalValue: Number(p.totalValue),
        })),
        cases: battle.cases.map((bc) => ({
          ...bc,
          case: { ...bc.case, price: Number(bc.case.price) },
        })),
      })),
    };
  });

  // Get battle by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
        },
        winner: {
          select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        cases: {
          include: {
            case: {
              include: {
                items: {
                  include: { skin: true },
                },
              },
            },
          },
          orderBy: { roundNumber: 'asc' },
        },
        rounds: {
          include: {
            caseItem: {
              include: { skin: true },
            },
            participant: {
              include: {
                user: {
                  select: { id: true, username: true },
                },
              },
            },
          },
          orderBy: [{ roundNumber: 'asc' }, { participantId: 'asc' }],
        },
      },
    });

    if (!battle) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle not found' },
      });
    }

    return {
      success: true,
      data: {
        ...battle,
        costPerPlayer: Number(battle.costPerPlayer),
        totalValue: Number(battle.totalValue),
        participants: battle.participants.map((p) => ({
          ...p,
          totalValue: Number(p.totalValue),
        })),
        cases: battle.cases.map((bc) => ({
          ...bc,
          case: {
            ...bc.case,
            price: Number(bc.case.price),
            items: bc.case.items.map((item) => ({
              ...item,
              coinValue: Number(item.coinValue),
            })),
          },
        })),
        rounds: battle.rounds.map((r) => ({
          ...r,
          coinValue: Number(r.coinValue),
          rollValue: Number(r.rollValue),
        })),
      },
    };
  });

  // Create battle
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const parseResult = createBattleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', details: parseResult.error.flatten() },
      });
    }

    const { type, mode, maxPlayers, cases: caseIds, options } = parseResult.data;

    // Get cases
    const cases = await prisma.case.findMany({
      where: { id: { in: caseIds }, isActive: true },
      include: { items: { include: { skin: true } } },
    });

    if (cases.length !== caseIds.length) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_CASES', message: 'One or more cases not found' },
      });
    }

    // Calculate cost per player
    const costPerPlayer = cases.reduce((sum, c) => sum + Number(c.price), 0);

    // Check user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || Number(user.balance) < costPerPlayer) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Not enough balance to create battle',
          details: { required: costPerPlayer, current: user ? Number(user.balance) : 0 },
        },
      });
    }

    // Generate server seed
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    // Create battle
    const battle = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: costPerPlayer },
          totalWagered: { increment: costPerPlayer },
        },
      });

      // Create transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'battle_entry',
          amount: -costPerPlayer,
          referenceType: 'battle',
          status: 'pending',
        },
      });

      // Create battle
      const newBattle = await tx.battle.create({
        data: {
          type,
          mode,
          maxPlayers,
          totalRounds: caseIds.length,
          costPerPlayer,
          serverSeed,
          serverSeedHash,
          createdById: userId,
          isPrivate: options.isPrivate,
          privateCode: options.isPrivate ? crypto.randomBytes(4).toString('hex').toUpperCase() : null,
          isFastMode: options.isFastMode,
          emeraldSpin: options.emeraldSpin,
          participants: {
            create: {
              userId,
              position: 0,
            },
          },
          cases: {
            create: caseIds.map((caseId, index) => ({
              caseId,
              roundNumber: index + 1,
            })),
          },
        },
        include: {
          creator: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
          participants: {
            include: {
              user: {
                select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
              },
            },
          },
          cases: {
            include: { case: true },
            orderBy: { roundNumber: 'asc' },
          },
        },
      });

      return newBattle;
    });

    // Emit battle created
    io.emit('battle:created', {
      ...battle,
      costPerPlayer: Number(battle.costPerPlayer),
      totalValue: Number(battle.totalValue),
      participants: battle.participants.map((p) => ({
        ...p,
        totalValue: Number(p.totalValue),
      })),
      cases: battle.cases.map((bc) => ({
        ...bc,
        case: { ...bc.case, price: Number(bc.case.price) },
      })),
    } as any);

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: -costPerPlayer,
      reason: 'battle_entry',
    });

    return {
      success: true,
      data: {
        ...battle,
        costPerPlayer: Number(battle.costPerPlayer),
        totalValue: Number(battle.totalValue),
        serverSeedHash,
      },
    };
  });

  // Join battle
  fastify.post('/:id/join', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    const parseResult = joinBattleSchema.safeParse({ ...(request.body as any), battleId: id });
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input' },
      });
    }

    const { position, team } = parseResult.data;

    // Get battle
    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!battle) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle not found' },
      });
    }

    if (battle.status !== 'waiting') {
      return reply.code(400).send({
        success: false,
        error: { code: 'BATTLE_STARTED', message: 'Battle has already started' },
      });
    }

    if (battle.participants.length >= battle.maxPlayers) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BATTLE_FULL', message: 'Battle is full' },
      });
    }

    if (battle.participants.some((p) => p.position === position)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'POSITION_TAKEN', message: 'Position is already taken' },
      });
    }

    if (battle.participants.some((p) => p.userId === userId)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'ALREADY_JOINED', message: 'You have already joined this battle' },
      });
    }

    // Check user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const cost = Number(battle.costPerPlayer);

    if (!user || Number(user.balance) < cost) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Not enough balance',
          details: { required: cost, current: user ? Number(user.balance) : 0 },
        },
      });
    }

    // Join battle
    const participant = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: cost },
          totalWagered: { increment: cost },
        },
      });

      // Create transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'battle_entry',
          amount: -cost,
          referenceType: 'battle',
          referenceId: id,
          status: 'pending',
        },
      });

      // Add participant
      const newParticipant = await tx.battleParticipant.create({
        data: {
          battleId: id,
          userId,
          position,
          team,
        },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      });

      // Update battle total value
      await tx.battle.update({
        where: { id },
        data: {
          totalValue: { increment: cost },
        },
      });

      return newParticipant;
    });

    // Emit player joined
    io.to(`battle:${id}`).emit('battle:playerJoined', {
      battleId: id,
      position,
      player: participant.user,
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: -cost,
      reason: 'battle_entry',
    });

    // Check if battle is full and start
    const updatedBattle = await prisma.battle.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (updatedBattle && updatedBattle.participants.length >= updatedBattle.maxPlayers) {
      // Start battle
      battleService.startBattle(id);
    }

    return {
      success: true,
      data: { participant },
    };
  });

  // Leave battle
  fastify.post('/:id/leave', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    const battle = await prisma.battle.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!battle) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle not found' },
      });
    }

    if (battle.status !== 'waiting') {
      return reply.code(400).send({
        success: false,
        error: { code: 'BATTLE_STARTED', message: 'Cannot leave a started battle' },
      });
    }

    const participant = battle.participants.find((p) => p.userId === userId);
    if (!participant) {
      return reply.code(400).send({
        success: false,
        error: { code: 'NOT_IN_BATTLE', message: 'You are not in this battle' },
      });
    }

    // If creator leaves, cancel the battle
    if (battle.createdById === userId) {
      await battleService.cancelBattle(id, 'creator_left');
      return { success: true, data: { cancelled: true } };
    }

    // Refund and remove participant
    const cost = Number(battle.costPerPlayer);

    await prisma.$transaction([
      // Refund balance
      prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: cost },
          totalWagered: { decrement: cost },
        },
      }),
      // Remove participant
      prisma.battleParticipant.delete({
        where: { id: participant.id },
      }),
      // Update battle total value
      prisma.battle.update({
        where: { id },
        data: {
          totalValue: { decrement: cost },
        },
      }),
      // Create refund transaction
      prisma.transaction.create({
        data: {
          userId,
          type: 'battle_entry',
          amount: cost,
          referenceType: 'battle',
          referenceId: id,
          description: 'Refund - Left battle',
        },
      }),
    ]);

    // Emit player left
    io.to(`battle:${id}`).emit('battle:playerLeft', {
      battleId: id,
      position: participant.position,
      userId,
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: cost,
      reason: 'battle_refund',
    });

    return { success: true };
  });

  // Cancel battle (creator only)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    const battle = await prisma.battle.findUnique({ where: { id } });

    if (!battle) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle not found' },
      });
    }

    if (battle.createdById !== userId) {
      return reply.code(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the creator can cancel' },
      });
    }

    if (battle.status !== 'waiting') {
      return reply.code(400).send({
        success: false,
        error: { code: 'BATTLE_STARTED', message: 'Cannot cancel a started battle' },
      });
    }

    await battleService.cancelBattle(id, 'creator_cancelled');

    return { success: true };
  });

  // Generate random battle
  fastify.post('/random', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parseResult = randomBattleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input' },
      });
    }

    const { budget, minCases } = parseResult.data;

    // Get random cases that fit the budget
    const cases = await prisma.case.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    if (cases.length === 0) {
      return reply.code(400).send({
        success: false,
        error: { code: 'NO_CASES', message: 'No cases available' },
      });
    }

    // Select random cases that fit budget
    const selectedCases: typeof cases = [];
    let remainingBudget = budget;
    const shuffledCases = [...cases].sort(() => Math.random() - 0.5);

    while (
      selectedCases.length < minCases ||
      (remainingBudget > 0 && selectedCases.length < 20)
    ) {
      const availableCases = shuffledCases.filter((c) => Number(c.price) <= remainingBudget);
      if (availableCases.length === 0) break;

      const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
      selectedCases.push(randomCase);
      remainingBudget -= Number(randomCase.price);
    }

    if (selectedCases.length < minCases) {
      return reply.code(400).send({
        success: false,
        error: { code: 'BUDGET_TOO_LOW', message: 'Budget too low for minimum cases' },
      });
    }

    // Random mode and player count
    const modes = ['normal', 'crazy'];
    const playerCounts = [2, 3, 4];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const maxPlayers = playerCounts[Math.floor(Math.random() * playerCounts.length)];

    const totalCost = selectedCases.reduce((sum, c) => sum + Number(c.price), 0);

    return {
      success: true,
      data: {
        type: 'standard',
        mode,
        maxPlayers,
        cases: selectedCases.map((c) => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl,
          price: Number(c.price),
        })),
        totalCost,
        costPerPlayer: totalCost,
      },
    };
  });

  // Get verification data for battle
  fastify.get('/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string };

    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        rounds: {
          include: {
            caseItem: {
              include: { skin: true },
            },
            participant: {
              include: {
                user: { select: { id: true, username: true, clientSeed: true } },
              },
            },
          },
          orderBy: [{ roundNumber: 'asc' }, { participantId: 'asc' }],
        },
      },
    });

    if (!battle) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle not found' },
      });
    }

    // Only reveal server seed if battle is finished
    const serverSeed = battle.status === 'finished' ? battle.serverSeed : null;

    return {
      success: true,
      data: {
        serverSeed,
        serverSeedHash: battle.serverSeedHash,
        publicSeed: battle.publicSeed,
        rounds: battle.rounds.map((r) => ({
          roundNumber: r.roundNumber,
          participantId: r.participantId,
          username: r.participant.user.username,
          clientSeed: r.participant.user.clientSeed,
          nonce: r.nonce,
          rollValue: Number(r.rollValue),
          itemName: r.caseItem.skin.name,
          coinValue: Number(r.coinValue),
        })),
      },
    };
  });
};
