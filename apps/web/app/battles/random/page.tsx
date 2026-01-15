'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins } from '@/lib/utils';
import { Shuffle, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RandomBattleResult {
  id: string;
  cases: { name: string; price: number }[];
  maxPlayers: number;
  mode: string;
  totalCost: number;
}

export default function RandomBattlePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [budget, setBudget] = useState(50);
  const [players, setPlayers] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<RandomBattleResult | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);

  const generateBattle = async () => {
    if (!user || generating) return;

    setGenerating(true);
    setShowAnimation(true);
    setResult(null);

    // Animate for a bit before showing result
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const res = await api.post<RandomBattleResult>('/battles/random', {
        maxBudget: budget,
        maxPlayers: players,
      });

      if (res.success && res.data) {
        setResult(res.data);
      }
    } catch (error) {
      console.error('Failed to generate battle:', error);
    } finally {
      setGenerating(false);
      setShowAnimation(false);
    }
  };

  const joinGeneratedBattle = () => {
    if (result) {
      router.push(`/battles/${result.id}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-600/20 rounded-full mb-4">
          <Shuffle size={40} className="text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Create a Battle for Me</h1>
        <p className="text-gray-400">
          Let us generate the perfect battle based on your budget!
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-dark-card rounded-xl p-6 mb-8">
        {/* Budget Slider */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2">
            Maximum Budget: <span className="text-emerald-400">{formatCoins(budget)} coins</span>
          </label>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full h-2 bg-dark-lighter rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10</span>
            <span>100</span>
            <span>250</span>
            <span>500</span>
          </div>
        </div>

        {/* Player Count */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-3">Players</label>
          <div className="flex gap-3">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                onClick={() => setPlayers(count)}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  players === count
                    ? 'bg-purple-600 text-white'
                    : 'bg-dark-lighter text-gray-400 hover:text-white'
                }`}
              >
                {count} Players
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-dark-lighter rounded-lg p-4 text-center">
            <Zap className="mx-auto mb-2 text-yellow-400" size={24} />
            <p className="text-sm font-medium">Random Mode</p>
            <p className="text-xs text-gray-500">Normal or Crazy</p>
          </div>
          <div className="bg-dark-lighter rounded-lg p-4 text-center">
            <Sparkles className="mx-auto mb-2 text-purple-400" size={24} />
            <p className="text-sm font-medium">Optimal Cases</p>
            <p className="text-xs text-gray-500">Best value mix</p>
          </div>
          <div className="bg-dark-lighter rounded-lg p-4 text-center">
            <Shuffle className="mx-auto mb-2 text-emerald-400" size={24} />
            <p className="text-sm font-medium">1-5 Rounds</p>
            <p className="text-xs text-gray-500">Randomly selected</p>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateBattle}
          disabled={generating || !user || (user && user.balance < 10)}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all flex items-center justify-center gap-3 ${
            generating || !user || (user && user.balance < 10)
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 shadow-lg hover:shadow-purple-500/30'
          }`}
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Shuffle size={24} />
              Generate Battle
            </>
          )}
        </button>

        {!user && (
          <p className="text-center text-gray-400 text-sm mt-3">
            Login to create battles
          </p>
        )}
      </div>

      {/* Animation Overlay */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Shuffle size={80} className="text-purple-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-dark-card rounded-xl p-6 border border-emerald-500/30"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-emerald-400" />
              <h2 className="text-xl font-bold">Your Battle is Ready!</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-dark-lighter rounded-lg p-3">
                <p className="text-sm text-gray-400">Mode</p>
                <p className="font-semibold capitalize">{result.mode}</p>
              </div>
              <div className="bg-dark-lighter rounded-lg p-3">
                <p className="text-sm text-gray-400">Players</p>
                <p className="font-semibold">{result.maxPlayers}</p>
              </div>
              <div className="bg-dark-lighter rounded-lg p-3">
                <p className="text-sm text-gray-400">Rounds</p>
                <p className="font-semibold">{result.cases.length}</p>
              </div>
              <div className="bg-dark-lighter rounded-lg p-3">
                <p className="text-sm text-gray-400">Your Cost</p>
                <p className="font-semibold text-emerald-400">{formatCoins(result.totalCost)}</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">Cases:</p>
              <div className="flex flex-wrap gap-2">
                {result.cases.map((c, i) => (
                  <span key={i} className="px-3 py-1 bg-dark-lighter rounded-full text-sm">
                    {c.name} ({formatCoins(c.price)})
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={joinGeneratedBattle}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              Join Battle
              <ArrowRight size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
