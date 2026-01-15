'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { formatCoins, getRarityColor } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Trophy, Shield, Copy, Check } from 'lucide-react';

interface BattleParticipant {
  id: string;
  odId: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
    level: number;
  };
  position: number;
  totalValue: number;
}

interface BattleRound {
  roundNumber: number;
  participantId: string;
  odId: string;
  skinName: string;
  skinImage: string;
  skinRarity: string;
  coinValue: number;
  rollValue: number;
}

interface BattleCase {
  roundNumber: number;
  case: {
    id: string;
    name: string;
    imageUrl: string;
    price: number;
  };
}

interface Battle {
  id: string;
  status: 'waiting' | 'countdown' | 'in_progress' | 'finished' | 'cancelled';
  mode: string;
  maxPlayers: number;
  totalValue: number;
  creatorId: string;
  winnerId?: string;
  isPrivate: boolean;
  serverSeedHash: string;
  publicSeed?: string;
  participants: BattleParticipant[];
  cases: BattleCase[];
  rounds: BattleRound[];
  countdown?: number;
  currentRound?: number;
}

export default function BattlePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { socket } = useSocketStore();

  const [battle, setBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentlySpinning, setCurrentlySpinning] = useState<Record<string, boolean>>({});

  // Fetch initial battle data
  useEffect(() => {
    if (id) {
      api.get<Battle>(`/battles/${id}`)
        .then((res) => {
          if (res.success && res.data) {
            setBattle(res.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !id) return;

    // Join battle room
    socket.emit('battle:spectate', { battleId: id as string });

    // Listen for updates
    const handlePlayerJoined = (data: { battleId: string; position: number; player: any }) => {
      setBattle(prev => prev ? {
        ...prev,
        participants: [...prev.participants, {
          id: data.player.id,
          odId: data.player.id,
          user: data.player,
          position: data.position,
          totalValue: 0,
        }],
      } : null);
    };

    const handlePlayerLeft = (data: { battleId: string; position: number; userId: string }) => {
      setBattle(prev => prev ? {
        ...prev,
        participants: prev.participants.filter(p => p.user.id !== data.userId),
      } : null);
    };

    const handleCountdown = (data: { countdown: number }) => {
      setBattle(prev => prev ? {
        ...prev,
        status: 'countdown',
        countdown: data.countdown,
      } : null);
    };

    const handleStarted = (data: { publicSeed: string }) => {
      setBattle(prev => prev ? {
        ...prev,
        status: 'in_progress',
        publicSeed: data.publicSeed,
        currentRound: 1,
      } : null);
    };

    const handleRoundResult = (data: { odId: string; roundNumber: number; result: BattleRound }) => {
      // Start spinning animation
      setCurrentlySpinning(prev => ({ ...prev, [data.odId]: true }));

      // Show result after spin animation
      setTimeout(() => {
        setBattle(prev => prev ? {
          ...prev,
          rounds: [...prev.rounds, data.result],
          participants: prev.participants.map(p =>
            p.odId === data.odId
              ? { ...p, totalValue: p.totalValue + data.result.coinValue }
              : p
          ),
        } : null);
        setCurrentlySpinning(prev => ({ ...prev, [data.odId]: false }));
      }, 3000);
    };

    const handleRoundComplete = (data: { roundNumber: number }) => {
      setBattle(prev => prev ? {
        ...prev,
        currentRound: data.roundNumber + 1,
      } : null);
    };

    const handleFinished = (data: { winnerId: string; winnings: number }) => {
      setBattle(prev => prev ? {
        ...prev,
        status: 'finished',
        winnerId: data.winnerId,
      } : null);
    };

    socket.on('battle:playerJoined', handlePlayerJoined);
    socket.on('battle:playerLeft', handlePlayerLeft);
    socket.on('battle:countdown', handleCountdown);
    socket.on('battle:started', handleStarted);
    socket.on('battle:roundResult', handleRoundResult);
    socket.on('battle:roundComplete', handleRoundComplete);
    socket.on('battle:finished', handleFinished);

    return () => {
      socket.emit('battle:unspectate', { battleId: id as string });
      socket.off('battle:playerJoined', handlePlayerJoined);
      socket.off('battle:playerLeft', handlePlayerLeft);
      socket.off('battle:countdown', handleCountdown);
      socket.off('battle:started', handleStarted);
      socket.off('battle:roundResult', handleRoundResult);
      socket.off('battle:roundComplete', handleRoundComplete);
      socket.off('battle:finished', handleFinished);
    };
  }, [socket, id]);

  const joinBattle = async () => {
    if (!battle || !user || joining) return;

    setJoining(true);
    try {
      const res = await api.post(`/battles/${battle.id}/join`, {});
      if (res.success) {
        // Will be updated via socket
      }
    } catch (error) {
      console.error('Failed to join battle:', error);
    } finally {
      setJoining(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !battle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-card rounded w-1/4 mb-8" />
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-dark-card rounded-xl p-8 h-96" />
            <div className="bg-dark-card rounded-xl p-8 h-96" />
          </div>
        </div>
      </div>
    );
  }

  const isParticipant = battle.participants.some(p => p.odId === user?.id);
  const canJoin = battle.status === 'waiting' &&
    battle.participants.length < battle.maxPlayers &&
    !isParticipant &&
    user;
  const costPerPlayer = battle.cases.reduce((sum, c) => sum + c.case.price, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">Battle #{battle.id.slice(-6)}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              battle.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
              battle.status === 'countdown' ? 'bg-orange-500/20 text-orange-400' :
              battle.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400' :
              battle.status === 'finished' ? 'bg-blue-500/20 text-blue-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {battle.status === 'waiting' ? 'Waiting' :
               battle.status === 'countdown' ? `Starting in ${battle.countdown}s` :
               battle.status === 'in_progress' ? 'Live' :
               battle.status === 'finished' ? 'Finished' : 'Cancelled'}
            </span>
            <span className="px-2 py-1 bg-dark-card rounded text-sm text-gray-400">
              {battle.mode}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Users size={16} />
              {battle.participants.length}/{battle.maxPlayers}
            </span>
            <span className="flex items-center gap-1">
              <Trophy size={16} />
              Pot: {formatCoins(battle.totalValue)}
            </span>
            <span className="flex items-center gap-1">
              <Shield size={16} />
              {battle.serverSeedHash.slice(0, 12)}...
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2 bg-dark-card hover:bg-dark-lighter rounded-lg transition-colors"
          >
            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
          {canJoin && (
            <button
              onClick={joinBattle}
              disabled={joining || (user && user.balance < costPerPlayer)}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {joining ? 'Joining...' : `Join for ${formatCoins(costPerPlayer)}`}
            </button>
          )}
        </div>
      </div>

      {/* Battle Arena */}
      <div className={`grid gap-4 ${
        battle.maxPlayers === 2 ? 'grid-cols-2' :
        battle.maxPlayers === 3 ? 'grid-cols-3' : 'grid-cols-4'
      }`}>
        {Array.from({ length: battle.maxPlayers }).map((_, index) => {
          const participant = battle.participants.find(p => p.position === index);
          const participantRounds = battle.rounds.filter(r => r.odId === participant?.odId);
          const isWinner = battle.winnerId === participant?.odId;
          const isSpinning = participant && currentlySpinning[participant.odId];

          return (
            <div
              key={index}
              className={`bg-dark-card rounded-xl p-4 transition-all ${
                isWinner ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20' : ''
              }`}
            >
              {/* Player Header */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-dark-lighter">
                {participant ? (
                  <>
                    <div className="relative">
                      <Image
                        src={participant.user.avatarUrl || '/default-avatar.png'}
                        alt={participant.user.username}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                      {isWinner && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Trophy size={12} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{participant.user.username}</p>
                      <p className="text-sm text-gray-400">Level {participant.user.level}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold">{formatCoins(participant.totalValue)}</p>
                      <p className="text-xs text-gray-500">total</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-12 h-12 rounded-full bg-dark-lighter flex items-center justify-center">
                      <Users size={24} className="text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-500">Waiting for player...</p>
                    </div>
                    {canJoin && !isParticipant && (
                      <button
                        onClick={joinBattle}
                        className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-600/30 transition-colors"
                      >
                        Join Slot
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Rounds */}
              <div className="space-y-3">
                {battle.cases.map((battleCase, roundIndex) => {
                  const roundResult = participantRounds.find(r => r.roundNumber === roundIndex + 1);
                  const isCurrentRound = battle.currentRound === roundIndex + 1;

                  return (
                    <div
                      key={roundIndex}
                      className={`p-3 rounded-lg transition-all ${
                        roundResult
                          ? 'bg-dark-lighter'
                          : isCurrentRound && isSpinning
                          ? 'bg-emerald-600/10 animate-pulse'
                          : 'bg-dark-lighter/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 relative flex-shrink-0">
                          {roundResult ? (
                            <>
                              {roundResult.skinImage ? (
                                <Image
                                  src={roundResult.skinImage}
                                  alt={roundResult.skinName}
                                  fill
                                  className="object-contain"
                                />
                              ) : (
                                <div
                                  className="w-full h-full rounded flex items-center justify-center text-xl"
                                  style={{ backgroundColor: getRarityColor(roundResult.skinRarity) + '20' }}
                                >
                                  🎁
                                </div>
                              )}
                            </>
                          ) : battleCase.case.imageUrl ? (
                            <Image
                              src={battleCase.case.imageUrl}
                              alt={battleCase.case.name}
                              fill
                              className="object-contain opacity-50"
                            />
                          ) : (
                            <div className="w-full h-full bg-dark-card rounded flex items-center justify-center">
                              <span className="text-gray-500">📦</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {roundResult ? (
                            <>
                              <p className="text-sm truncate">{roundResult.skinName}</p>
                              <p
                                className="font-bold"
                                style={{ color: getRarityColor(roundResult.skinRarity) }}
                              >
                                {formatCoins(roundResult.coinValue)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-gray-500 truncate">{battleCase.case.name}</p>
                              <p className="text-gray-600 text-sm">Round {roundIndex + 1}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner Banner */}
      <AnimatePresence>
        {battle.status === 'finished' && battle.winnerId && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-dark-card border border-emerald-500/50 rounded-xl p-6 shadow-2xl shadow-emerald-500/20"
          >
            <div className="flex items-center gap-4">
              <Trophy size={48} className="text-emerald-400" />
              <div>
                <p className="text-lg font-bold">
                  {battle.participants.find(p => p.odId === battle.winnerId)?.user.username} Wins!
                </p>
                <p className="text-emerald-400 text-2xl font-bold">
                  +{formatCoins(battle.totalValue)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
