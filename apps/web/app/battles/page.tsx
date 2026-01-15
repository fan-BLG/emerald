'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBattleStore } from '@/stores/battleStore';
import { useAuthStore } from '@/stores/authStore';
import { BattleCard } from '@/components/battle/BattleCard';
import { Plus, Shuffle, Filter } from 'lucide-react';

type BattleFilter = 'all' | 'joinable' | 'in_progress' | 'finished';
type BattleMode = 'all' | 'normal' | 'crazy' | 'progressive' | 'mystery';

export default function BattlesPage() {
  const { battles, loading, fetchBattles } = useBattleStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<BattleFilter>('all');
  const [modeFilter, setModeFilter] = useState<BattleMode>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchBattles();
  }, [fetchBattles]);

  const filteredBattles = battles.filter((battle) => {
    // Status filter
    if (filter === 'joinable') {
      if (battle.status !== 'waiting') return false;
      if (battle.participants.length >= battle.maxPlayers) return false;
    } else if (filter === 'in_progress' && battle.status !== 'in_progress') {
      return false;
    } else if (filter === 'finished' && battle.status !== 'finished') {
      return false;
    }

    // Mode filter
    if (modeFilter !== 'all' && battle.mode !== modeFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Case Battles</h1>
          <p className="text-gray-400">Open cases against other players and win big!</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/battles/random"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
          >
            <Shuffle size={18} />
            <span>Create Battle for Me</span>
          </Link>
          <Link
            href="/battles/create"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            <Plus size={18} />
            <span>Create Battle</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-card rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter */}
          <div className="flex gap-2">
            {(['all', 'joinable', 'in_progress', 'finished'] as BattleFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-dark-lighter text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'joinable' ? 'Joinable' : f === 'in_progress' ? 'Live' : 'Finished'}
              </button>
            ))}
          </div>

          {/* Mode Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors ml-auto"
          >
            <Filter size={18} />
            <span>Modes</span>
          </button>
        </div>

        {/* Mode Filter */}
        {showFilters && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-dark-lighter">
            {(['all', 'normal', 'crazy', 'progressive', 'mystery'] as BattleMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  modeFilter === m
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-dark-lighter text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {m === 'all' ? 'All Modes' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Battle Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-dark-card rounded-lg p-4 animate-pulse">
              <div className="h-6 bg-dark-lighter rounded w-1/3 mb-4" />
              <div className="flex gap-4 mb-4">
                <div className="w-12 h-12 bg-dark-lighter rounded-full" />
                <div className="w-12 h-12 bg-dark-lighter rounded-full" />
              </div>
              <div className="h-24 bg-dark-lighter rounded mb-4" />
              <div className="h-10 bg-dark-lighter rounded" />
            </div>
          ))}
        </div>
      ) : filteredBattles.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-4">No battles found</p>
          <Link
            href="/battles/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            <Plus size={20} />
            <span>Create the first battle</span>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBattles.map((battle) => (
            <BattleCard key={battle.id} battle={battle} />
          ))}
        </div>
      )}
    </div>
  );
}
