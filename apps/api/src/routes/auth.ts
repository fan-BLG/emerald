import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../index.js';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Steam OAuth redirect
  fastify.get('/steam', async (request, reply) => {
    const returnUrl = `${request.protocol}://${request.hostname}/api/auth/steam/callback`;

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnUrl,
      'openid.realm': `${request.protocol}://${request.hostname}`,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    return reply.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
  });

  // Steam OAuth callback
  fastify.get('/steam/callback', async (request, reply) => {
    const query = request.query as Record<string, string>;

    // Verify the OpenID response
    const params = new URLSearchParams(query);
    params.set('openid.mode', 'check_authentication');

    try {
      const verifyResponse = await fetch(STEAM_OPENID_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const verifyText = await verifyResponse.text();

      if (!verifyText.includes('is_valid:true')) {
        return reply.redirect(`${FRONTEND_URL}?error=steam_auth_failed`);
      }

      // Extract Steam ID from claimed_id
      const claimedId = query['openid.claimed_id'];
      const steamIdMatch = claimedId?.match(/\/id\/(\d+)$/);

      if (!steamIdMatch) {
        return reply.redirect(`${FRONTEND_URL}?error=invalid_steam_id`);
      }

      const steamId = steamIdMatch[1];

      // Fetch Steam profile
      const profileResponse = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`
      );
      const profileData = await profileResponse.json();
      const profile = profileData.response?.players?.[0];

      if (!profile) {
        return reply.redirect(`${FRONTEND_URL}?error=profile_fetch_failed`);
      }

      // Create or update user
      const user = await prisma.user.upsert({
        where: { steamId },
        update: {
          username: profile.personaname,
          avatarUrl: profile.avatarfull,
          lastLoginAt: new Date(),
        },
        create: {
          steamId,
          username: profile.personaname,
          avatarUrl: profile.avatarfull,
          clientSeed: crypto.randomBytes(16).toString('hex'),
          lastLoginAt: new Date(),
        },
      });

      // Create initial user seed if not exists
      const existingSeed = await prisma.userSeed.findFirst({
        where: { userId: user.id, isActive: true },
      });

      if (!existingSeed) {
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

        await prisma.userSeed.create({
          data: {
            userId: user.id,
            serverSeed,
            serverSeedHash,
            clientSeed: user.clientSeed || crypto.randomBytes(16).toString('hex'),
          },
        });
      }

      // Generate JWT
      const token = fastify.jwt.sign({
        id: user.id,
        steamId: user.steamId,
        username: user.username,
      });

      // Redirect to frontend with token
      return reply.redirect(`${FRONTEND_URL}?token=${token}`);
    } catch (error) {
      fastify.log.error(error);
      return reply.redirect(`${FRONTEND_URL}?error=auth_error`);
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        steamId: true,
        username: true,
        avatarUrl: true,
        email: true,
        balance: true,
        totalDeposited: true,
        totalWithdrawn: true,
        totalWagered: true,
        totalWon: true,
        level: true,
        xp: true,
        vipTier: true,
        emeraldSpinEnabled: true,
        clientSeed: true,
        isBanned: true,
        is2faEnabled: true,
        createdAt: true,
        lastLoginAt: true,
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
        balance: Number(user.balance),
        totalDeposited: Number(user.totalDeposited),
        totalWithdrawn: Number(user.totalWithdrawn),
        totalWagered: Number(user.totalWagered),
        totalWon: Number(user.totalWon),
        xp: Number(user.xp),
      },
    };
  });

  // Refresh token
  fastify.post('/refresh', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const user = request.user as any;

    const token = fastify.jwt.sign({
      id: user.id,
      steamId: user.steamId,
      username: user.username,
    });

    return { success: true, data: { token } };
  });

  // Logout (client-side mostly, but can invalidate sessions if using Redis)
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async () => {
    return { success: true };
  });
};
