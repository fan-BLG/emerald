import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { calculateResultSchema } from '@emerald/shared';
import { generateResult, verifyResult, getEOSBlockHash } from '../services/provablyFair.js';
import crypto from 'crypto';

export async function fairRoutes(fastify: FastifyInstance) {
  // Get user's current seeds
  fastify.get('/seeds', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    // Find active seed pair
    let userSeed = await prisma.userSeed.findFirst({
      where: { userId, isActive: true },
    });

    // Create if doesn't exist
    if (!userSeed) {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

      userSeed = await prisma.userSeed.create({
        data: {
          userId,
          serverSeed,
          serverSeedHash,
          clientSeed: 'default',
          nonce: 0,
        },
      });
    }

    return {
      success: true,
      data: {
        serverSeedHash: userSeed.serverSeedHash,
        clientSeed: userSeed.clientSeed,
        nonce: userSeed.nonce,
      },
    };
  });

  // Rotate server seed (reveals old, creates new)
  fastify.post('/seeds/rotate', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;

    // Find active seed
    const currentSeed = await prisma.userSeed.findFirst({
      where: { userId, isActive: true },
    });

    if (!currentSeed) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NO_ACTIVE_SEED', message: 'No active seed found' },
      });
    }

    // Generate new seeds
    const newServerSeed = crypto.randomBytes(32).toString('hex');
    const newServerSeedHash = crypto.createHash('sha256').update(newServerSeed).digest('hex');

    // Reveal old, create new
    await prisma.$transaction(async (tx) => {
      // Deactivate and reveal old seed
      await tx.userSeed.update({
        where: { id: currentSeed.id },
        data: {
          isActive: false,
          revealedAt: new Date(),
        },
      });

      // Create new seed
      await tx.userSeed.create({
        data: {
          userId,
          serverSeed: newServerSeed,
          serverSeedHash: newServerSeedHash,
          clientSeed: currentSeed.clientSeed,
          nonce: 0,
        },
      });
    });

    return {
      success: true,
      data: {
        previousSeed: {
          serverSeed: currentSeed.serverSeed,
          serverSeedHash: currentSeed.serverSeedHash,
          clientSeed: currentSeed.clientSeed,
          nonce: currentSeed.nonce,
        },
        newSeed: {
          serverSeedHash: newServerSeedHash,
          clientSeed: currentSeed.clientSeed,
          nonce: 0,
        },
      },
    };
  });

  // Update client seed
  fastify.put('/seeds/client', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { clientSeed: string } }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const { clientSeed } = request.body;

    if (!clientSeed || clientSeed.length < 1 || clientSeed.length > 64) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_SEED', message: 'Client seed must be 1-64 characters' },
      });
    }

    // Update active seed
    const updated = await prisma.userSeed.updateMany({
      where: { userId, isActive: true },
      data: { clientSeed },
    });

    // Also update user's stored client seed
    await prisma.user.update({
      where: { id: userId },
      data: { clientSeed },
    });

    if (updated.count === 0) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NO_ACTIVE_SEED', message: 'No active seed found' },
      });
    }

    return {
      success: true,
      data: { clientSeed },
    };
  });

  // Get seed history
  fastify.get('/seeds/history', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);

    const [seeds, total] = await Promise.all([
      prisma.userSeed.findMany({
        where: { userId, isActive: false },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userSeed.count({ where: { userId, isActive: false } }),
    ]);

    return {
      success: true,
      data: {
        items: seeds.map(s => ({
          serverSeed: s.serverSeed,
          serverSeedHash: s.serverSeedHash,
          clientSeed: s.clientSeed,
          nonce: s.nonce,
          createdAt: s.createdAt,
          revealedAt: s.revealedAt,
        })),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    };
  });

  // Verify a battle
  fastify.get('/verify/battle/:battleId', async (request: FastifyRequest<{ Params: { battleId: string } }>, reply: FastifyReply) => {
    const { battleId } = request.params;

    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, clientSeed: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        rounds: {
          include: {
            caseItem: {
              include: { skin: true },
            },
            participant: {
              include: {
                user: {
                  select: { username: true },
                },
              },
            },
          },
          orderBy: [{ roundNumber: 'asc' }, { participantId: 'asc' }],
        },
        cases: {
          include: { case: true },
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!battle) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Battle not found' },
      });
    }

    // Only show full verification data for finished battles
    if (battle.status !== 'finished') {
      return {
        success: true,
        data: {
          battleId: battle.id,
          status: battle.status,
          serverSeedHash: battle.serverSeedHash,
          publicSeed: battle.publicSeed,
          message: 'Server seed will be revealed when battle is finished',
        },
      };
    }

    // Build verification data
    const roundsData = battle.rounds.map(round => ({
      roundNumber: round.roundNumber,
      player: round.participant.user.username,
      position: battle.participants.find(p => p.id === round.participantId)?.position,
      nonce: round.nonce,
      rollValue: Number(round.rollValue),
      itemName: round.caseItem.skin.name,
      coinValue: Number(round.coinValue),
      isVerified: verifyResult(
        battle.serverSeed,
        battle.publicSeed!,
        battle.participants.find(p => p.id === round.participantId)?.user.clientSeed || 'default',
        round.nonce,
        Number(round.rollValue)
      ),
    }));

    return {
      success: true,
      data: {
        battleId: battle.id,
        serverSeed: battle.serverSeed,
        serverSeedHash: battle.serverSeedHash,
        publicSeed: battle.publicSeed,
        participants: battle.participants.map(p => ({
          position: p.position,
          username: p.user.username,
          clientSeed: p.user.clientSeed || 'default',
        })),
        rounds: roundsData,
        allVerified: roundsData.every(r => r.isVerified),
      },
    };
  });

  // Calculate result (for verification)
  fastify.post('/calculate', async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = calculateResultSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.error.message },
      });
    }

    const { serverSeed, publicSeed, clientSeed, nonce } = validation.data;

    const result = generateResult(serverSeed, publicSeed, clientSeed, nonce);

    return {
      success: true,
      data: {
        hash: result.hash,
        rollValue: result.rollValue,
        percentage: result.percentage,
      },
    };
  });

  // Get current EOS block (for public seed reference)
  fastify.get('/eos-block', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const eosBlock = await getEOSBlockHash();
      return {
        success: true,
        data: eosBlock,
      };
    } catch (error) {
      console.error('EOS block error:', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'EOS_ERROR', message: 'Failed to fetch EOS block' },
      });
    }
  });

  // How fairness works (info endpoint)
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      success: true,
      data: {
        title: 'Provably Fair System',
        description: 'Emerald uses a provably fair system to ensure all game outcomes are random and verifiable.',
        components: {
          serverSeed: 'A random 256-bit value generated by our server. The SHA-256 hash is shown before the game, and the actual seed is revealed after.',
          publicSeed: 'Retrieved from the EOS blockchain at the moment the game starts. This provides an external source of randomness that neither the server nor players can predict or manipulate.',
          clientSeed: 'A value you can set yourself. This ensures you have input into the random outcome.',
          nonce: 'A counter that increments with each bet, ensuring each outcome is unique.',
        },
        formula: 'result = HMAC-SHA256(serverSeed, publicSeed:clientSeed:nonce)',
        rollCalculation: 'The first 8 hex characters of the hash are converted to a decimal and divided by 0xFFFFFFFF to get a roll between 0 and 1.',
        verification: 'After a game, you can verify the outcome by combining all seeds and checking that the hash matches what we showed you.',
      },
    };
  });
}
