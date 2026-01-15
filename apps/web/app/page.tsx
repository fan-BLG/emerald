'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Plus, Sparkles, TrendingUp, Users, Coins } from 'lucide-react';
import { BattleCard } from '@/components/battle/BattleCard';
import { useBattleStore } from '@/stores/battleStore';
import { apiRoutes } from '@/lib/api';
import type { BattleWithDetails } from '@emerald/shared';

export default function HomePage() {
  const { battles, setBattles, setLoading, isLoading } = useBattleStore();
  const [stats, setStats] = useState({
    onlineUsers: 1234,
    activeBattles: 47,
    totalWagered: 125000,
  });

  useEffect(() => {
    const fetchBattles = async () => {
      setLoading(true);
      const response = await apiRoutes.battles.list({ status: 'waiting', limit: 12 });
      if (response.success && response.data) {
        setBattles(response.data as BattleWithDetails[]);
      }
      setLoading(false);
    };

    fetchBattles();
  }, [setBattles, setLoading]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-card to-dark-base border border-dark-border">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative px-8 py-12">
          <div className="max-w-2xl">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              <span className="gradient-emerald-text">The Rarest Drop</span>
              <br />
              <span className="text-white">Wins</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-gray-400 text-lg mb-8"
            >
              Premium CS2 case battles with provably fair system. Battle against players,
              open cases, and win big.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/battles/create" className="btn btn-primary flex items-center gap-2 text-lg px-6 py-3">
                <Plus className="w-5 h-5" />
                Create Battle
              </Link>
              <Link href="/battles" className="btn btn-secondary flex items-center gap-2 text-lg px-6 py-3">
                <Swords className="w-5 h-5" />
                View All Battles
              </Link>
            </motion.div>
          </div>

          {/* Floating Stats */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4">
            <div className="bg-dark-base/80 backdrop-blur border border-dark-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Users className="w-4 h-4" />
                <span className="text-sm">Online Now</span>
              </div>
              <p className="text-2xl font-bold">{stats.onlineUsers.toLocaleString()}</p>
            </div>
            <div className="bg-dark-base/80 backdrop-blur border border-dark-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Swords className="w-4 h-4" />
                <span className="text-sm">Active Battles</span>
              </div>
              <p className="text-2xl font-bold">{stats.activeBattles}</p>
            </div>
            <div className="bg-dark-base/80 backdrop-blur border border-dark-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-gold">
                <Coins className="w-4 h-4" />
                <span className="text-sm">24h Wagered</span>
              </div>
              <p className="text-2xl font-bold">${stats.totalWagered.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Battles */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <Swords className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Active Battles</h2>
              <p className="text-sm text-gray-400">Join a battle and win big!</p>
            </div>
          </div>
          <Link href="/battles" className="btn btn-secondary text-sm">
            View All
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse h-48" />
            ))}
          </div>
        ) : battles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {battles.slice(0, 6).map((battle) => (
              <BattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No active battles right now</p>
            <Link href="/battles/create" className="btn btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create First Battle
            </Link>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold mb-2">Emerald Spin</h3>
          <p className="text-sm text-gray-400">
            Special premium animation for high-value drops. Experience the thrill of the reveal.
          </p>
        </div>
        <div className="card p-6">
          <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold mb-2">Provably Fair</h3>
          <p className="text-sm text-gray-400">
            Every spin is verifiable on the blockchain. Complete transparency with EOS verification.
          </p>
        </div>
        <div className="card p-6">
          <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center mb-4">
            <Coins className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold mb-2">Instant Withdrawals</h3>
          <p className="text-sm text-gray-400">
            Withdraw your winnings as CS2 skins instantly via our Waxpeer integration.
          </p>
        </div>
      </section>
    </div>
  );
}
