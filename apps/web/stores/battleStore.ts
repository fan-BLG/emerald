import { create } from 'zustand';
import type {
  BattleWithDetails,
  UserPublic,
  Case,
  BattleRoundResultEvent,
  BattleFinishedEvent,
} from '@emerald/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface BattleState {
  // List of active battles
  battles: BattleWithDetails[];
  loading: boolean; // Changed from isLoading for consistency

  // Current battle being viewed/played
  currentBattle: BattleWithDetails | null;
  currentRound: number;
  countdown: number | null;
  roundResults: BattleRoundResultEvent[];

  // Actions
  fetchBattles: () => Promise<void>;
  setBattles: (battles: BattleWithDetails[]) => void;
  addBattle: (battle: BattleWithDetails) => void;
  removeBattle: (battleId: string) => void;
  setCurrentBattle: (battle: BattleWithDetails | null) => void;
  setLoading: (loading: boolean) => void;

  // Socket event handlers
  handlePlayerJoined: (data: { battleId: string; position: number; player: UserPublic }) => void;
  handlePlayerLeft: (data: { battleId: string; position: number; userId: string }) => void;
  handleBattleStarting: (data: { battleId: string; countdown: number; publicSeed: string }) => void;
  handleRoundStart: (data: { battleId: string; round: number; totalRounds: number; case: Case }) => void;
  handleRoundResult: (data: BattleRoundResultEvent) => void;
  handleBattleFinished: (data: BattleFinishedEvent) => void;
  handleBattleCancelled: (data: { battleId: string; reason: string; refunded: boolean }) => void;
}

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: [],
  loading: false,
  currentBattle: null,
  currentRound: 0,
  countdown: null,
  roundResults: [],

  fetchBattles: async () => {
    set({ loading: true });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/battles`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success && data.data) {
        set({ battles: data.data.battles || data.data });
      }
    } catch (error) {
      console.error('Failed to fetch battles:', error);
    } finally {
      set({ loading: false });
    }
  },

  setBattles: (battles) => set({ battles }),

  addBattle: (battle) => {
    set((state) => ({
      battles: [battle, ...state.battles],
    }));
  },

  removeBattle: (battleId) => {
    set((state) => ({
      battles: state.battles.filter((b) => b.id !== battleId),
    }));
  },

  setCurrentBattle: (battle) => {
    set({
      currentBattle: battle,
      currentRound: battle?.currentRound || 0,
      countdown: null,
      roundResults: [],
    });
  },

  setLoading: (isLoading) => set({ loading: isLoading }),

  handlePlayerJoined: (data) => {
    set((state) => {
      // Update in battles list
      const battles = state.battles.map((battle) => {
        if (battle.id !== data.battleId) return battle;
        return {
          ...battle,
          participants: [
            ...battle.participants,
            {
              id: crypto.randomUUID(),
              battleId: data.battleId,
              userId: data.player.id,
              user: data.player,
              position: data.position,
              team: null,
              totalValue: 0,
              isWinner: false,
              joinedAt: new Date(),
            },
          ],
        };
      });

      // Update current battle if it's the same
      let currentBattle = state.currentBattle;
      if (currentBattle?.id === data.battleId) {
        currentBattle = battles.find((b) => b.id === data.battleId) || currentBattle;
      }

      return { battles, currentBattle };
    });
  },

  handlePlayerLeft: (data) => {
    set((state) => {
      const battles = state.battles.map((battle) => {
        if (battle.id !== data.battleId) return battle;
        return {
          ...battle,
          participants: battle.participants.filter((p) => p.userId !== data.userId),
        };
      });

      let currentBattle = state.currentBattle;
      if (currentBattle?.id === data.battleId) {
        currentBattle = battles.find((b) => b.id === data.battleId) || currentBattle;
      }

      return { battles, currentBattle };
    });
  },

  handleBattleStarting: (data) => {
    set((state) => {
      const battles = state.battles.map((battle) => {
        if (battle.id !== data.battleId) return battle;
        return { ...battle, status: 'starting' as const, publicSeed: data.publicSeed };
      });

      let currentBattle = state.currentBattle;
      if (currentBattle?.id === data.battleId) {
        currentBattle = { ...currentBattle, status: 'starting', publicSeed: data.publicSeed };
      }

      return { battles, currentBattle, countdown: data.countdown };
    });

    // Countdown timer
    const interval = setInterval(() => {
      set((state) => {
        if (state.countdown === null || state.countdown <= 0) {
          clearInterval(interval);
          return { countdown: null };
        }
        return { countdown: state.countdown - 1 };
      });
    }, 1000);
  },

  handleRoundStart: (data) => {
    set((state) => {
      const battles = state.battles.map((battle) => {
        if (battle.id !== data.battleId) return battle;
        return { ...battle, status: 'in_progress' as const, currentRound: data.round };
      });

      let currentBattle = state.currentBattle;
      if (currentBattle?.id === data.battleId) {
        currentBattle = { ...currentBattle, status: 'in_progress', currentRound: data.round };
      }

      return { battles, currentBattle, currentRound: data.round };
    });
  },

  handleRoundResult: (data) => {
    set((state) => ({
      roundResults: [...state.roundResults, data],
    }));
  },

  handleBattleFinished: (data) => {
    set((state) => {
      const battles = state.battles.map((battle) => {
        if (battle.id !== data.battleId) return battle;
        return {
          ...battle,
          status: 'finished' as const,
          winnerId: data.winner.userId,
        };
      });

      let currentBattle = state.currentBattle;
      if (currentBattle?.id === data.battleId) {
        currentBattle = {
          ...currentBattle,
          status: 'finished',
          winnerId: data.winner.userId,
        };
      }

      return { battles, currentBattle };
    });

    // Remove from active battles after a delay
    setTimeout(() => {
      get().removeBattle(data.battleId);
    }, 30000);
  },

  handleBattleCancelled: (data) => {
    set((state) => {
      const battles = state.battles.filter((b) => b.id !== data.battleId);

      let currentBattle = state.currentBattle;
      if (currentBattle?.id === data.battleId) {
        currentBattle = { ...currentBattle, status: 'cancelled' };
      }

      return { battles, currentBattle };
    });
  },
}));
