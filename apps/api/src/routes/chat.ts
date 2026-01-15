import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, io } from '../index.js';
import { chatMessageSchema } from '@emerald/shared';

// Rate limiting per user
const messageRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX = 5; // Max 5 messages per window

export async function chatRoutes(fastify: FastifyInstance) {
  // Get chat messages
  fastify.get('/messages', async (request: FastifyRequest<{ Querystring: { room?: string; limit?: string; before?: string } }>, reply: FastifyReply) => {
    const { room = 'global', limit = '50', before } = request.query;

    const messages = await prisma.chatMessage.findMany({
      where: {
        room,
        isDeleted: false,
        ...(before && { createdAt: { lt: new Date(before) } }),
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
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10), 100),
    });

    return {
      success: true,
      data: {
        messages: messages.reverse().map(m => ({
          id: m.id,
          userId: m.userId,
          user: m.user,
          room: m.room,
          message: m.message,
          createdAt: m.createdAt,
        })),
      },
    };
  });

  // Send chat message (REST alternative to socket)
  fastify.post('/messages', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = chatMessageSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.error.message },
      });
    }

    const { room, message } = validation.data;
    const userId = request.user!.id;

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return reply.code(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'You are sending messages too fast' },
      });
    }

    // Check if user is banned
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

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    if (user.isBanned) {
      return reply.code(403).send({
        success: false,
        error: { code: 'USER_BANNED', message: 'You are banned from chat' },
      });
    }

    // Filter message content
    const filteredMessage = filterMessage(message);

    // Create message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        userId,
        room,
        message: filteredMessage,
      },
    });

    // Broadcast to room
    const messageData = {
      id: chatMessage.id,
      userId: user.id,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        level: user.level,
        vipTier: user.vipTier,
      },
      room,
      message: filteredMessage,
      createdAt: chatMessage.createdAt,
    };

    io.to(`chat:${room}`).emit('chat:message', messageData as any);

    return {
      success: true,
      data: messageData,
    };
  });

  // Delete message (mod/admin only)
  fastify.delete('/messages/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user!.id;

    // TODO: Add proper admin/mod check
    // For now, only allow users to delete their own messages
    const message = await prisma.chatMessage.findUnique({
      where: { id },
    });

    if (!message) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
    }

    if (message.userId !== userId) {
      return reply.code(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' },
      });
    }

    await prisma.chatMessage.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedById: userId,
      },
    });

    // Broadcast deletion
    io.to(`chat:${message.room}`).emit('chat:deleted', { messageId: id });

    return {
      success: true,
      data: { deleted: true },
    };
  });

  // Get online users count
  fastify.get('/online', async (request: FastifyRequest<{ Querystring: { room?: string } }>, reply: FastifyReply) => {
    const { room = 'global' } = request.query;

    const roomName = `chat:${room}`;
    const sockets = await io.in(roomName).fetchSockets();

    return {
      success: true,
      data: {
        room,
        online: sockets.length,
      },
    };
  });

  // Get available rooms
  fastify.get('/rooms', async (request: FastifyRequest, reply: FastifyReply) => {
    const rooms = [
      { id: 'global', name: 'Global', description: 'Main chat room', language: 'en' },
      { id: 'russian', name: 'Русский', description: 'Russian chat', language: 'ru' },
      { id: 'spanish', name: 'Español', description: 'Spanish chat', language: 'es' },
      { id: 'portuguese', name: 'Português', description: 'Portuguese chat', language: 'pt' },
      { id: 'german', name: 'Deutsch', description: 'German chat', language: 'de' },
    ];

    // Get online counts for each room
    const roomsWithCounts = await Promise.all(
      rooms.map(async (room) => {
        const sockets = await io.in(`chat:${room.id}`).fetchSockets();
        return {
          ...room,
          online: sockets.length,
        };
      })
    );

    return {
      success: true,
      data: { rooms: roomsWithCounts },
    };
  });
}

// Rate limiting helper
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userMessages = messageRateLimit.get(userId) || [];

  // Remove old messages outside window
  const recentMessages = userMessages.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recentMessages.length >= RATE_LIMIT_MAX) {
    return false;
  }

  recentMessages.push(now);
  messageRateLimit.set(userId, recentMessages);
  return true;
}

// Basic message filtering
function filterMessage(message: string): string {
  // Remove excessive whitespace
  let filtered = message.replace(/\s+/g, ' ').trim();

  // Basic word filter (expand as needed)
  const bannedWords = ['spam', 'scam', 'hack'];
  for (const word of bannedWords) {
    const regex = new RegExp(word, 'gi');
    filtered = filtered.replace(regex, '***');
  }

  // Limit length
  if (filtered.length > 500) {
    filtered = filtered.substring(0, 500);
  }

  return filtered;
}
