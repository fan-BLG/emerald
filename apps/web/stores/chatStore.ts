import { create } from 'zustand';
import type { ChatMessage } from '@emerald/shared';

interface ChatState {
  messages: ChatMessage[];
  currentRoom: string;
  isOpen: boolean;

  // Actions
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  deleteMessage: (messageId: string) => void;
  setCurrentRoom: (room: string) => void;
  toggleChat: () => void;
  setOpen: (open: boolean) => void;
}

const MAX_MESSAGES = 100;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentRoom: 'global',
  isOpen: true,

  setMessages: (messages) => set({ messages: messages.slice(-MAX_MESSAGES) }),

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message].slice(-MAX_MESSAGES),
    }));
  },

  deleteMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, isDeleted: true } : m
      ),
    }));
  },

  setCurrentRoom: (room) => set({ currentRoom: room, messages: [] }),

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

  setOpen: (open) => set({ isOpen: open }),
}));
