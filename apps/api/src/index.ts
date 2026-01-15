import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import type { ServerToClientEvents, ClientToServerEvents } from '@emerald/shared';

// Import routes
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { caseRoutes } from './routes/cases.js';
import { battleRoutes } from './routes/battles.js';
import { paymentRoutes } from './routes/payments.js';
import { fairRoutes } from './routes/fair.js';
import { chatRoutes } from './routes/chat.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { statsRoutes } from './routes/stats.js';
import { affiliateRoutes } from './routes/affiliate.js';

// Import socket handlers
import { setupSocketHandlers } from './socket/index.js';

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set these in your Railway/deployment environment.');
  process.exit(1);
}

// Initialize Prisma with connection retry
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize Fastify
const fastify = Fastify({
  logger: true,
  trustProxy: true, // Required for Railway/Vercel
});

// Create HTTP server for Socket.IO
const httpServer = createServer(fastify.server);

// Initialize Socket.IO with polling fallback for Railway
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Polling fallback for environments that block WS
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  // JWT (JWT_SECRET is validated at startup)
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
}

// Register routes
async function registerRoutes() {
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(userRoutes, { prefix: '/api/users' });
  fastify.register(caseRoutes, { prefix: '/api/cases' });
  fastify.register(battleRoutes, { prefix: '/api/battles' });
  fastify.register(paymentRoutes, { prefix: '/api/payments' });
  fastify.register(fairRoutes, { prefix: '/api/fair' });
  fastify.register(chatRoutes, { prefix: '/api/chat' });
  fastify.register(leaderboardRoutes, { prefix: '/api/leaderboard' });
  fastify.register(statsRoutes, { prefix: '/api/stats' });
  fastify.register(affiliateRoutes, { prefix: '/api/affiliate' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
}

// Decorate fastify with prisma
fastify.decorate('prisma', prisma);

// JWT verification decorator
fastify.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
  }
});

// Start server
async function start() {
  try {
    // Test database connection
    console.log('🔄 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected');

    await registerPlugins();
    await registerRoutes();
    setupSocketHandlers(io);

    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';

    // Use HTTP server instead of Fastify's built-in server for Socket.IO
    await fastify.ready();

    httpServer.listen(port, host, () => {
      console.log(`🚀 Emerald API running on http://${host}:${port}`);
      console.log(`🔌 Socket.IO ready`);
      console.log(`📍 CORS origin: ${process.env.FRONTEND_URL}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  await fastify.close();
  httpServer.close();
  process.exit(0);
});

start();

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: any, reply: any) => Promise<void>;
  }
  interface FastifyRequest {
    user?: {
      id: string;
      steamId: string;
      username: string;
    };
  }
}
