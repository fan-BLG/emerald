import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import crypto from 'crypto';

export async function affiliateRoutes(fastify: FastifyInstance) {
  // Get user's affiliate info
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            affiliateCode: true,
            affiliateEarnings: true,
            referredBy: true,
          },
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        // Count referrals
        const referralCount = await prisma.user.count({
          where: { referredBy: userId },
        });

        // Get total earnings from referrals (5% of their wagers)
        const referralWagers = await prisma.user.aggregate({
          where: { referredBy: userId },
          _sum: { totalWagered: true },
        });

        const totalReferralWagers = Number(referralWagers._sum.totalWagered) || 0;

        return reply.send({
          success: true,
          data: {
            affiliateCode: user.affiliateCode,
            earnings: Number(user.affiliateEarnings),
            referralCount,
            totalReferralWagers,
            commissionRate: 0.05, // 5% commission
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: { code: 'AFFILIATE_ERROR', message: 'Failed to fetch affiliate info' },
        });
      }
    }
  );

  // Generate or regenerate affiliate code
  fastify.post(
    '/generate-code',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        // Generate unique code
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Check if code already exists
        const existing = await prisma.user.findFirst({
          where: { affiliateCode: code },
        });

        if (existing) {
          // Regenerate if collision
          const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();
          await prisma.user.update({
            where: { id: userId },
            data: { affiliateCode: newCode },
          });

          return reply.send({
            success: true,
            data: { affiliateCode: newCode },
          });
        }

        await prisma.user.update({
          where: { id: userId },
          data: { affiliateCode: code },
        });

        return reply.send({
          success: true,
          data: { affiliateCode: code },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: { code: 'CODE_GENERATION_ERROR', message: 'Failed to generate affiliate code' },
        });
      }
    }
  );

  // Apply affiliate code (for new users)
  fastify.post(
    '/apply-code',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const { code } = request.body as { code: string };

        if (!code) {
          return reply.code(400).send({
            success: false,
            error: { code: 'MISSING_CODE', message: 'Affiliate code is required' },
          });
        }

        // Check if user already has a referrer
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { referredBy: true },
        });

        if (user?.referredBy) {
          return reply.code(400).send({
            success: false,
            error: { code: 'ALREADY_REFERRED', message: 'You have already used a referral code' },
          });
        }

        // Find the affiliate
        const affiliate = await prisma.user.findFirst({
          where: { affiliateCode: code.toUpperCase() },
        });

        if (!affiliate) {
          return reply.code(404).send({
            success: false,
            error: { code: 'INVALID_CODE', message: 'Invalid affiliate code' },
          });
        }

        if (affiliate.id === userId) {
          return reply.code(400).send({
            success: false,
            error: { code: 'SELF_REFERRAL', message: 'You cannot use your own affiliate code' },
          });
        }

        // Apply the referral
        await prisma.user.update({
          where: { id: userId },
          data: { referredBy: affiliate.id },
        });

        return reply.send({
          success: true,
          data: { message: 'Affiliate code applied successfully' },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: { code: 'APPLY_CODE_ERROR', message: 'Failed to apply affiliate code' },
        });
      }
    }
  );

  // Claim affiliate earnings
  fastify.post(
    '/claim',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { affiliateEarnings: true, balance: true },
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        const earnings = Number(user.affiliateEarnings);

        if (earnings < 1) {
          return reply.code(400).send({
            success: false,
            error: { code: 'INSUFFICIENT_EARNINGS', message: 'Minimum claim amount is $1' },
          });
        }

        // Transfer earnings to balance
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: {
              balance: { increment: earnings },
              affiliateEarnings: 0,
            },
          }),
          prisma.transaction.create({
            data: {
              userId,
              type: 'affiliate',
              amount: earnings,
              status: 'completed',
              metadata: { source: 'affiliate_claim' },
            },
          }),
        ]);

        return reply.send({
          success: true,
          data: {
            claimed: earnings,
            message: `Successfully claimed ${earnings.toFixed(2)} in affiliate earnings`,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: { code: 'CLAIM_ERROR', message: 'Failed to claim affiliate earnings' },
        });
      }
    }
  );

  // Get referral list
  fastify.get(
    '/referrals',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const page = parseInt((request.query as any).page || '1', 10);
        const limit = Math.min(parseInt((request.query as any).limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const [referrals, total] = await Promise.all([
          prisma.user.findMany({
            where: { referredBy: userId },
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              createdAt: true,
              totalWagered: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.user.count({
            where: { referredBy: userId },
          }),
        ]);

        const referralList = referrals.map((ref) => ({
          id: ref.id,
          username: ref.username,
          avatarUrl: ref.avatarUrl || '',
          joinedAt: ref.createdAt.toISOString(),
          wagered: Number(ref.totalWagered),
          commission: Number(ref.totalWagered) * 0.05,
        }));

        return reply.send({
          success: true,
          data: {
            referrals: referralList,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: { code: 'REFERRALS_ERROR', message: 'Failed to fetch referrals' },
        });
      }
    }
  );
}
