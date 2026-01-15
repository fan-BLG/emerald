import { FastifyPluginAsync } from 'fastify';
import { placeRouletteBetSchema } from '@emerald/shared';
import { rouletteService } from '../services/rouletteService.js';

export const rouletteRoutes: FastifyPluginAsync = async (fastify) => {
  // Start roulette service when routes are loaded
  rouletteService.start();

  // Get current round
  fastify.get('/current', async (request, reply) => {
    const round = await rouletteService.getCurrentRound();

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

  // Get roulette history
  fastify.get('/history', async (request, reply) => {
    const { limit = 20 } = request.query as { limit?: number };

    const history = await rouletteService.getHistory(Math.min(limit, 100));

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

    const parseResult = placeRouletteBetSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', details: parseResult.error.flatten() },
      });
    }

    try {
      const bet = await rouletteService.placeBet(userId, parseResult.data.betType, parseResult.data.amount);
      return {
        success: true,
        data: {
          ...bet,
          amount: Number(bet.amount),
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to place bet';
      let code = 'BET_FAILED';
      if (errorMessage.includes('Insufficient')) code = 'INSUFFICIENT_BALANCE';
      if (errorMessage.includes('No active round')) code = 'NO_ROUND';
      if (errorMessage.includes('closed')) code = 'BETTING_CLOSED';

      return reply.code(400).send({
        success: false,
        error: { code, message: errorMessage },
      });
    }
  });

  // Get user's bets in current round
  fastify.get('/my-bets', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const round = await rouletteService.getCurrentRound();
    if (!round) {
      return {
        success: true,
        data: [],
      };
    }

    const userBets = round.bets.filter(b => b.userId === userId);

    return {
      success: true,
      data: userBets,
    };
  });

  // Get user's roulette history
  fastify.get('/my-history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;
    const { page = 1, limit = 20 } = request.query as any;

    const bets = await fastify.prisma.rouletteBet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        round: {
          select: {
            id: true,
            result: true,
            finishedAt: true,
          },
        },
      },
    });

    return {
      success: true,
      data: bets.map(b => ({
        ...b,
        amount: Number(b.amount),
        payout: b.payout ? Number(b.payout) : null,
      })),
    };
  });

  // Get color configuration
  fastify.get('/config', async (request, reply) => {
    return {
      success: true,
      data: {
        colors: {
          0: 'green',
          1: 'red', 2: 'red', 3: 'red', 4: 'red', 5: 'red', 6: 'red', 7: 'red',
          8: 'black', 9: 'black', 10: 'black', 11: 'black', 12: 'black', 13: 'black', 14: 'black',
        },
        multipliers: {
          green: 14,
          red: 2,
          black: 2,
        },
        bettingDuration: 15000,
        spinDuration: 5000,
      },
    };
  });
};
