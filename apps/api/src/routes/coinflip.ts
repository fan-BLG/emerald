import { FastifyPluginAsync } from 'fastify';
import { createCoinflipSchema, joinCoinflipSchema, getCoinflipsQuerySchema } from '@emerald/shared';
import { CoinflipService } from '../services/coinflipService.js';

export const coinflipRoutes: FastifyPluginAsync = async (fastify) => {
  const coinflipService = new CoinflipService();

  // List coinflip games
  fastify.get('/', async (request, reply) => {
    const parseResult = getCoinflipsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid query parameters' },
      });
    }

    const result = await coinflipService.getGames(parseResult.data);

    return {
      success: true,
      data: result,
    };
  });

  // Get coinflip game by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const { games } = await coinflipService.getGames({ status: undefined, page: 1, limit: 1 });
    // This is a simple lookup - in production you'd have a dedicated method
    const game = games.find(g => g.id === id);

    if (!game) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
      });
    }

    return {
      success: true,
      data: game,
    };
  });

  // Create coinflip game
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const parseResult = createCoinflipSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', details: parseResult.error.flatten() },
      });
    }

    try {
      const game = await coinflipService.createGame(
        userId,
        parseResult.data.side,
        parseResult.data.amount,
        parseResult.data.vsBot
      );
      return {
        success: true,
        data: {
          ...game,
          amount: Number((game as any).amount),
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create game';
      const code = errorMessage.includes('Insufficient') ? 'INSUFFICIENT_BALANCE' : 'CREATE_FAILED';
      return reply.code(400).send({
        success: false,
        error: { code, message: errorMessage },
      });
    }
  });

  // Join coinflip game
  fastify.post('/:id/join', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    try {
      const game = await coinflipService.joinGame(userId, id);
      return {
        success: true,
        data: {
          ...game,
          amount: Number(game.amount),
          rollValue: game.rollValue ? Number(game.rollValue) : null,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to join game';
      let code = 'JOIN_FAILED';
      if (errorMessage.includes('Insufficient')) code = 'INSUFFICIENT_BALANCE';
      if (errorMessage.includes('not found')) code = 'NOT_FOUND';
      if (errorMessage.includes('not available')) code = 'GAME_NOT_AVAILABLE';
      if (errorMessage.includes('own game')) code = 'CANNOT_JOIN_OWN';

      return reply.code(400).send({
        success: false,
        error: { code, message: errorMessage },
      });
    }
  });

  // Cancel coinflip game
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as any).id;

    try {
      await coinflipService.cancelGame(userId, id);
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to cancel game';
      let code = 'CANCEL_FAILED';
      if (errorMessage.includes('not found')) code = 'NOT_FOUND';
      if (errorMessage.includes('Only the creator')) code = 'FORBIDDEN';
      if (errorMessage.includes('cannot be cancelled')) code = 'GAME_STARTED';

      return reply.code(400).send({
        success: false,
        error: { code, message: errorMessage },
      });
    }
  });

  // Get user's coinflip history
  fastify.get('/history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;
    const { page = 1, limit = 20 } = request.query as any;

    const games = await fastify.prisma.coinflipGame.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { opponentId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
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
    });

    return {
      success: true,
      data: games.map((g) => ({
        ...g,
        amount: Number(g.amount),
        rollValue: g.rollValue ? Number(g.rollValue) : null,
      })),
    };
  });
};
