import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';

export async function statsRoutes(fastify: FastifyInstance) {
  // Get site statistics
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get total users
      const totalUsers = await prisma.user.count();

      // Get total battles
      const totalBattles = await prisma.battle.count({
        where: { status: 'finished' },
      });

      // Get total wagered
      const wageredResult = await prisma.battle.aggregate({
        where: { status: 'finished' },
        _sum: { totalValue: true },
      });
      const totalWagered = Number(wageredResult._sum.totalValue) || 0;

      // Get active users (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeUsers = await prisma.user.count({
        where: { updatedAt: { gte: oneDayAgo } },
      });

      // Get battles in last 24 hours
      const recentBattles = await prisma.battle.count({
        where: {
          status: 'finished',
          finishedAt: { gte: oneDayAgo },
        },
      });

      // Get online users (rough estimate based on recent activity)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const onlineUsers = await prisma.user.count({
        where: { updatedAt: { gte: fiveMinutesAgo } },
      });

      return reply.send({
        success: true,
        data: {
          totalUsers,
          totalBattles,
          totalWagered,
          activeUsers24h: activeUsers,
          battles24h: recentBattles,
          onlineNow: Math.max(onlineUsers, 1), // At least 1 if someone is requesting
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: { code: 'STATS_ERROR', message: 'Failed to fetch statistics' },
      });
    }
  });

  // Get live feed of recent wins
  fastify.get('/live-feed', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const recentWins = await prisma.battleParticipant.findMany({
        where: {
          isWinner: true,
          battle: { status: 'finished' },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          battle: {
            select: {
              id: true,
              mode: true,
              costPerPlayer: true,
              finishedAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: 20,
      });

      const feed = recentWins.map((win) => {
        const cost = Number(win.battle.costPerPlayer);
        const totalValue = Number(win.totalValue);
        const profit = totalValue - cost;
        return {
          id: win.id,
          user: {
            id: win.user.id,
            username: win.user.username,
            avatarUrl: win.user.avatarUrl || '',
          },
          battleId: win.battleId,
          battleMode: win.battle.mode,
          amount: totalValue,
          profit,
          timestamp: win.battle.finishedAt?.toISOString() || win.joinedAt.toISOString(),
        };
      });

      return reply.send({
        success: true,
        data: { feed },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: { code: 'FEED_ERROR', message: 'Failed to fetch live feed' },
      });
    }
  });

  // Get top wins
  fastify.get('/top-wins', async (request: FastifyRequest<{ Querystring: { period?: string } }>, reply: FastifyReply) => {
    try {
      const period = (request.query as any).period || 'daily';

      let startDate: Date;
      const now = new Date();

      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'weekly':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'alltime':
        default:
          startDate = new Date(0);
      }

      const topWins = await prisma.battleParticipant.findMany({
        where: {
          isWinner: true,
          battle: {
            status: 'finished',
            finishedAt: { gte: startDate },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          battle: {
            select: {
              costPerPlayer: true,
            },
          },
        },
        orderBy: { totalValue: 'desc' },
        take: 50, // Get more so we can filter by profit
      });

      // Calculate profit and filter/sort
      const winsWithProfit = topWins.map((win) => {
        const cost = Number(win.battle.costPerPlayer);
        const totalValue = Number(win.totalValue);
        const profit = totalValue - cost;
        return { win, cost, totalValue, profit };
      })
        .filter((w) => w.profit > 0)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

      const wins = winsWithProfit.map(({ win, cost, totalValue, profit }, index) => ({
        position: index + 1,
        user: {
          id: win.user.id,
          username: win.user.username,
          avatarUrl: win.user.avatarUrl || '',
        },
        amount: totalValue,
        profit,
        multiplier: cost > 0 ? totalValue / cost : 1,
      }));

      return reply.send({
        success: true,
        data: { wins, period },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: { code: 'TOP_WINS_ERROR', message: 'Failed to fetch top wins' },
      });
    }
  });
}
