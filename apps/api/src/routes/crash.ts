import { FastifyPluginAsync } from 'fastify';
import { placeCrashBetSchema } from '@emerald/shared';
import { crashService } from '../services/crashService.js';

export const crashRoutes: FastifyPluginAsync = async (fastify) => {
  // Start crash service when routes are loaded
  crashService.start();

  // Get current round
  fastify.get('/current', async (request, reply) => {
    const round = await crashService.getCurrentRound();

    if (!round) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NO_ROUND', message: 'No active round' },
      });
    }

    return {
      success: true,
      data: round,
    };
  });

  // Get crash history
  fastify.get('/history', async (request, reply) => {
    const { limit = 20 } = request.query as { limit?: number };

    const history = await crashService.getHistory(Math.min(limit, 100));

    return {
      success: true,
      data: history,
    };
  });

  // Place bet
  fastify.post('/bet', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const parseResult = placeCrashBetSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', details: parseResult.error.flatten() },
      });
    }

    try {
      const bet = await crashService.placeBet(userId, parseResult.data.amount, parseResult.data.autoCashout);
      return {
        success: true,
        data: {
          ...bet,
          amount: Number(bet.amount),
          autoCashout: bet.autoCashout ? Number(bet.autoCashout) : null,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to place bet';
      let code = 'BET_FAILED';
      if (errorMessage.includes('Insufficient')) code = 'INSUFFICIENT_BALANCE';
      if (errorMessage.includes('No active round')) code = 'NO_ROUND';
      if (errorMessage.includes('closed')) code = 'BETTING_CLOSED';
      if (errorMessage.includes('Already placed')) code = 'ALREADY_BET';

      return reply.code(400).send({
        success: false,
        error: { code, message: errorMessage },
      });
    }
  });

  // Cashout
  fastify.post('/cashout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    try {
      const result = await crashService.cashout(userId);
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to cashout';
      let code = 'CASHOUT_FAILED';
      if (errorMessage.includes('No active round')) code = 'NO_ROUND';
      if (errorMessage.includes('not running')) code = 'ROUND_NOT_RUNNING';
      if (errorMessage.includes('No bet found')) code = 'NO_BET';
      if (errorMessage.includes('Already cashed')) code = 'ALREADY_CASHED';
      if (errorMessage.includes('crashed')) code = 'ROUND_CRASHED';

      return reply.code(400).send({
        success: false,
        error: { code, message: errorMessage },
      });
    }
  });

  // Get user's bet in current round
  fastify.get('/my-bet', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const round = await crashService.getCurrentRound();
    if (!round) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NO_ROUND', message: 'No active round' },
      });
    }

    const bet = round.bets.find(b => b.userId === userId);
    if (!bet) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: bet,
    };
  });

  // Get user's crash history
  fastify.get('/my-history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;
    const { page = 1, limit = 20 } = request.query as any;

    const bets = await fastify.prisma.crashBet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        round: {
          select: {
            id: true,
            crashPoint: true,
            crashedAt: true,
          },
        },
      },
    });

    return {
      success: true,
      data: bets.map(b => ({
        ...b,
        amount: Number(b.amount),
        autoCashout: b.autoCashout ? Number(b.autoCashout) : null,
        cashedOutAt: b.cashedOutAt ? Number(b.cashedOutAt) : null,
        payout: b.payout ? Number(b.payout) : null,
        round: {
          ...b.round,
          crashPoint: b.round.crashPoint ? Number(b.round.crashPoint) : null,
        },
      })),
    };
  });
};
