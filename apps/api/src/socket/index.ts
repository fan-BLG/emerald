import { Server, Socket } from 'socket.io';
import { prisma } from '../index.js';
import { BattleService } from '../services/battleService.js';
import jwt from 'jsonwebtoken';
import type { ServerToClientEvents, ClientToServerEvents } from '@emerald/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'emerald-super-secret-key-change-in-production';

// Track connected users
const connectedUsers = new Map<string, Set<string>>(); // odId -> Set<socketId>
const socketToUser = new Map<string, string>(); // socketId -> userId

// Battle service instance
const battleService = new BattleService();

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`Socket connected: ${socket.id}`);

    // Authentication
    socket.on('auth', async (data) => {
      try {
        const decoded = jwt.verify(data.token, JWT_SECRET) as {
          id: string;
          steamId: string;
          username: string;
        };

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, username: true, balance: true, isBanned: true },
        });

        if (!user) {
          socket.emit('error', { code: 'AUTH_FAILED', message: 'User not found' });
          return;
        }

        if (user.isBanned) {
          socket.emit('error', { code: 'USER_BANNED', message: 'Your account is banned' });
          socket.disconnect();
          return;
        }

        // Track user connection
        socketToUser.set(socket.id, user.id);
        if (!connectedUsers.has(user.id)) {
          connectedUsers.set(user.id, new Set());
        }
        connectedUsers.get(user.id)!.add(socket.id);

        // Join user's personal room for notifications
        socket.join(`user:${user.id}`);

        // Emit success
        socket.emit('connected', {
          odId: user.id,
          balance: Number(user.balance),
        } as any);

        console.log(`User authenticated: ${user.username} (${user.id})`);
      } catch (error) {
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Invalid token' });
      }
    });

    // Battle events
    socket.on('battle:create', async (data) => {
      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        return;
      }

      // Battle creation is handled via REST API
      // This event is just for real-time notification
      socket.emit('error', { code: 'USE_REST_API', message: 'Use REST API to create battles' });
    });

    socket.on('battle:join', async (data) => {
      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        return;
      }

      // Join is handled via REST API, this just subscribes to updates
      socket.join(`battle:${data.battleId}`);
    });

    socket.on('battle:leave', async (data) => {
      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        return;
      }

      // Leave room updates
      socket.leave(`battle:${data.battleId}`);
    });

    socket.on('battle:spectate', async (data) => {
      // Join battle room as spectator
      socket.join(`battle:${data.battleId}`);
    });

    socket.on('battle:unspectate', async (data) => {
      socket.leave(`battle:${data.battleId}`);
    });

    // Chat events
    socket.on('chat:join', async (data) => {
      socket.join(`chat:${data.room}`);
    });

    socket.on('chat:leave', async (data) => {
      socket.leave(`chat:${data.room}`);
    });

    socket.on('chat:message', async (data) => {
      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        return;
      }

      try {
        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            level: true,
            vipTier: true,
            isBanned: true,
          },
        });

        if (!user || user.isBanned) {
          socket.emit('error', { code: 'CHAT_BLOCKED', message: 'You cannot send messages' });
          return;
        }

        // Validate message
        const message = data.message?.trim();
        if (!message || message.length > 500) {
          socket.emit('error', { code: 'INVALID_MESSAGE', message: 'Invalid message' });
          return;
        }

        // Save to database
        const chatMessage = await prisma.chatMessage.create({
          data: {
            userId,
            room: data.room || 'global',
            message,
          },
        });

        // Broadcast to room
        io.to(`chat:${data.room || 'global'}`).emit('chat:message', {
          id: chatMessage.id,
          odId: user.id,
          user: {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            level: user.level,
            vipTier: user.vipTier,
          },
          room: data.room || 'global',
          message,
          isDeleted: false,
          createdAt: chatMessage.createdAt,
        } as any);
      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { code: 'CHAT_ERROR', message: 'Failed to send message' });
      }
    });

    // User settings
    socket.on('user:updateSeed', async (data) => {
      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        return;
      }

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { clientSeed: data.clientSeed },
        });

        // Also update active seed pair
        await prisma.userSeed.updateMany({
          where: { userId, isActive: true },
          data: { clientSeed: data.clientSeed },
        });
      } catch (error) {
        socket.emit('error', { code: 'UPDATE_FAILED', message: 'Failed to update seed' });
      }
    });

    socket.on('user:toggleEmeraldSpin', async (data) => {
      const userId = socketToUser.get(socket.id);
      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        return;
      }

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { emeraldSpinEnabled: data.enabled },
        });
      } catch (error) {
        socket.emit('error', { code: 'UPDATE_FAILED', message: 'Failed to update setting' });
      }
    });

    // Disconnection
    socket.on('disconnect', () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        const userSockets = connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            connectedUsers.delete(userId);
          }
        }
        socketToUser.delete(socket.id);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Periodic cleanup of stale connections
  setInterval(() => {
    const now = Date.now();
    // Additional cleanup logic if needed
  }, 60000);
}

// Export helper functions for use in routes
export function getUserSockets(userId: string): Set<string> | undefined {
  return connectedUsers.get(userId);
}

export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId) && connectedUsers.get(userId)!.size > 0;
}

export function getOnlineUserCount(): number {
  return connectedUsers.size;
}

export { battleService };
