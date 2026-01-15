import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@emerald/shared';
import { useAuthStore } from './authStore';
import { useBattleStore } from './battleStore';
import { useChatStore } from './chatStore';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  socket: TypedSocket | null;
  isConnected: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;
  emit: <K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ) => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    const socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket'],
    }) as TypedSocket;

    socket.on('connect', () => {
      console.log('Socket connected');
      set({ isConnected: true });

      // Authenticate if we have a token
      const token = useAuthStore.getState().token;
      if (token) {
        socket.emit('auth', { token });
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ isConnected: false });
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data);
    });

    // User events
    socket.on('user:balanceUpdate', (data) => {
      useAuthStore.getState().updateBalance(data.balance);
    });

    // Battle events
    socket.on('battle:created', (battle) => {
      useBattleStore.getState().addBattle(battle);
    });

    socket.on('battle:playerJoined', (data) => {
      useBattleStore.getState().handlePlayerJoined(data);
    });

    socket.on('battle:playerLeft', (data) => {
      useBattleStore.getState().handlePlayerLeft(data);
    });

    socket.on('battle:starting', (data) => {
      useBattleStore.getState().handleBattleStarting(data);
    });

    socket.on('battle:roundStart', (data) => {
      useBattleStore.getState().handleRoundStart(data);
    });

    socket.on('battle:roundResult', (data) => {
      useBattleStore.getState().handleRoundResult(data);
    });

    socket.on('battle:finished', (data) => {
      useBattleStore.getState().handleBattleFinished(data);
    });

    socket.on('battle:cancelled', (data) => {
      useBattleStore.getState().handleBattleCancelled(data);
    });

    // Chat events
    socket.on('chat:message', (message) => {
      useChatStore.getState().addMessage(message);
    });

    socket.on('chat:deleted', (data) => {
      useChatStore.getState().deleteMessage(data.messageId);
    });

    // Global events
    socket.on('global:bigWin', (data) => {
      // Could add to a notification store
      console.log('Big win:', data);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  emit: (event, data) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit(event, data as never);
    }
  },
}));
