import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';

type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';

interface LeaderboardEntry {
  position: number;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
    level: number;
    vipTier: string;
  };
  wagered: number;
  profit: number;
  wins: number;
}

export async function leaderboardRoutes(fastify: FastifyInstance) {
  // Get leaderboard for period
  fastify.get<{ Params: { period: Period } }>(
    '/:period',
    async (request: FastifyRequest<{ Params: { period: Period } }>, reply: FastifyReply) => {
      const { period } = request.params;

      if (!['daily', 'weekly', 'monthly', 'alltime'].includes(period)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_PERIOD', message: 'Invalid period. Use daily, weekly, monthly, or alltime' },
        });
      }

      try {
        // Calculate date range
        const now = new Date();
        let startDate: Date;

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

        // Get aggregated battle participants for the period
        const battleParticipants = await prisma.battleParticipant.findMany({
          where: {
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
                level: true,
                vipTier: true,
              },
            },
            battle: {
              select: {
                costPerPlayer: true,
                totalValue: true,
              },
            },
          },
        });

        // Aggregate by user
        const userStats = new Map<string, {
          user: any;
          wagered: number;
          profit: number;
          wins: number;
        }>();

        for (const participant of battleParticipants) {
          const userId = participant.userId;
          const existing = userStats.get(userId) || {
            user: participant.user,
            wagered: 0,
            profit: 0,
            wins: 0,
          };

          const cost = Number(participant.battle.costPerPlayer);
          existing.wagered += cost;

          if (participant.isWinner) {
            const winnings = Number(participant.totalValue);
            existing.profit += winnings - cost;
            existing.wins += 1;
          } else {
            existing.profit -= cost;
          }

          userStats.set(userId, existing);
        }

        // Sort by wagered and create leaderboard
        const entries: LeaderboardEntry[] = Array.from(userStats.values())
          .sort((a, b) => b.wagered - a.wagered)
          .slice(0, 100)
          .map((stats, index) => ({
            position: index + 1,
            user: {
              id: stats.user.id,
              username: stats.user.username,
              avatarUrl: stats.user.avatarUrl || '',
              level: stats.user.level,
              vipTier: stats.user.vipTier,
            },
            wagered: stats.wagered,
            profit: stats.profit,
            wins: stats.wins,
          }));

        return reply.send({
          success: true,
          data: { entries },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: { code: 'LEADERBOARD_ERROR', message: 'Failed to fetch leaderboard' },
        });
      }
    }
  );

  // Get prize pool info
  fastify.get('/prize-pool', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Calculate prize pool based on house edge from recent battles
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const dailyWagered = await prisma.battle.aggregate({
        where: {
          status: 'finished',
          updatedAt: { gte: startOfDay },
        },
        _sum: { totalValue: true },
      });

      // 1% of wagered goes to prize pool
      const prizePool = (Number(dailyWagered._sum.totalValue) || 0) * 0.01;

      // Calculate time until reset (next midnight)
      const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const timeUntilReset = nextReset.getTime() - now.getTime();

      return reply.send({
        success: true,
        data: {
          prizePool,
          timeUntilReset,
          distribution: {
            first: 0.5,
            second: 0.3,
            third: 0.2,
          },
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: { code: 'PRIZE_POOL_ERROR', message: 'Failed to fetch prize pool info' },
      });
    }
  });
}
