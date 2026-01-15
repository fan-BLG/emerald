'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Zap, Lock, Repeat, Coins } from 'lucide-react';
import { cn, formatCurrency, getBattleModeDisplayName } from '@/lib/utils';
import type { BattleWithDetails } from '@emerald/shared';

interface BattleCardProps {
  battle: BattleWithDetails;
}

export function BattleCard({ battle }: BattleCardProps) {
  const filledSlots = battle.participants.length;
  const emptySlots = battle.maxPlayers - filledSlots;

  const getModeIcon = () => {
    switch (battle.mode) {
      case 'crazy':
        return <Repeat className="w-4 h-4 text-purple-400" />;
      default:
        return null;
    }
  };

  return (
    <Link href={`/battles/${battle.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="card-hover p-4 cursor-pointer"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {battle.type === 'standard' ? '1v1' : battle.type}
            </span>
            {battle.mode !== 'normal' && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                {getModeIcon()}
                {getBattleModeDisplayName(battle.mode)}
              </span>
            )}
            {battle.isPrivate && (
              <Lock className="w-4 h-4 text-gray-500" />
            )}
            {battle.isFastMode && (
              <Zap className="w-4 h-4 text-yellow-500" />
            )}
          </div>
          <span className="text-sm text-gray-400">
            {battle.totalRounds} {battle.totalRounds === 1 ? 'round' : 'rounds'}
          </span>
        </div>

        {/* Players */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {battle.participants.map((participant, index) => (
            <div
              key={participant.id}
              className="relative"
            >
              <img
                src={participant.user.avatarUrl || '/default-avatar.png'}
                alt={participant.user.username}
                className="w-10 h-10 rounded-full border-2 border-emerald-500"
              />
              {index < battle.participants.length - 1 && (
                <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-gray-600 font-bold">
                  vs
                </span>
              )}
            </div>
          ))}

          {/* Empty Slots */}
          {[...Array(emptySlots)].map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-10 h-10 rounded-full border-2 border-dashed border-dark-border flex items-center justify-center"
            >
              <span className="text-gray-600 text-lg">?</span>
            </div>
          ))}
        </div>

        {/* Cases Preview */}
        <div className="flex gap-1 mb-4 overflow-hidden">
          {battle.cases.slice(0, 5).map((battleCase) => (
            <div
              key={battleCase.id}
              className="w-12 h-12 bg-dark-base rounded border border-dark-border overflow-hidden flex-shrink-0"
            >
              <img
                src={battleCase.case.imageUrl}
                alt={battleCase.case.name}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {battle.cases.length > 5 && (
            <div className="w-12 h-12 bg-dark-base rounded border border-dark-border flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-400">+{battle.cases.length - 5}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="w-4 h-4" />
            <span>
              {filledSlots}/{battle.maxPlayers}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-gold" />
            <span className="font-bold text-gold">
              {formatCurrency(battle.costPerPlayer)}
            </span>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-3 pt-3 border-t border-dark-border">
          {battle.status === 'waiting' ? (
            <button className="w-full btn btn-primary text-sm py-2">
              Join for {formatCurrency(battle.costPerPlayer)}
            </button>
          ) : battle.status === 'in_progress' ? (
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm">In Progress - Round {battle.currentRound}/{battle.totalRounds}</span>
            </div>
          ) : (
            <span className="block text-center text-sm text-gray-500">
              {battle.status}
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
