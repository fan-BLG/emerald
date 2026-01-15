'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins } from '@/lib/utils';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, RefreshCw } from 'lucide-react';

type CoinSide = 'emerald' | 'ruby';

interface FlipResult {
  result: CoinSide;
  won: boolean;
  payout: number;
  rollValue: number;
}

export default function CoinflipPage() {
  const { user, updateBalance } = useAuthStore();
  const [betAmount, setBetAmount] = useState(10);
  const [selectedSide, setSelectedSide] = useState<CoinSide>('emerald');
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);
  const [coinRotation, setCoinRotation] = useState(0);

  const flip = async () => {
    if (!user || flipping || betAmount > user.balance) return;

    setFlipping(true);
    setResult(null);
    setCoinRotation(prev => prev + 1800 + Math.random() * 720); // 5-7 full rotations

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const won = Math.random() > 0.5;
      const resultSide: CoinSide = won ? selectedSide : (selectedSide === 'emerald' ? 'ruby' : 'emerald');

      const flipResult: FlipResult = {
        result: resultSide,
        won,
        payout: won ? betAmount * 1.96 : 0,
        rollValue: Math.random(),
      };

      setResult(flipResult);
      setCoinRotation(prev => prev + (resultSide === 'emerald' ? 0 : 180));

      if (won) {
        updateBalance(user.balance - betAmount + flipResult.payout);
      } else {
        updateBalance(user.balance - betAmount);
      }
    } finally {
      setFlipping(false);
    }
  };

  const presetAmounts = [10, 25, 50, 100, 250];

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/20 rounded-full mb-4">
          <Coins size={40} className="text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Coinflip</h1>
        <p className="text-gray-400">Pick a side and double your coins!</p>
      </div>

      {/* Coin Animation */}
      <div className="flex justify-center mb-8">
        <motion.div
          className="relative w-48 h-48"
          animate={{ rotateY: coinRotation }}
          transition={{ duration: 2, ease: "easeOut" }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Emerald Side */}
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-6xl font-bold text-white">E</span>
          </div>
          {/* Ruby Side */}
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="text-6xl font-bold text-white">R</span>
          </div>
        </motion.div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && !flipping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-center mb-8 p-6 rounded-xl ${
              result.won
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            <p className="text-2xl font-bold mb-2">
              {result.won ? 'You Won!' : 'You Lost!'}
            </p>
            <p className={`text-3xl font-bold ${result.won ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.won ? `+${formatCoins(result.payout)}` : `-${formatCoins(betAmount)}`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="bg-dark-card rounded-xl p-6">
        {/* Side Selection */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-3">Choose Your Side</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedSide('emerald')}
              disabled={flipping}
              className={`p-4 rounded-xl transition-all ${
                selectedSide === 'emerald'
                  ? 'bg-emerald-600/20 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20'
                  : 'bg-dark-lighter border-2 border-transparent hover:border-emerald-500/50'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 mx-auto mb-2 flex items-center justify-center">
                <span className="text-2xl font-bold">E</span>
              </div>
              <p className="font-semibold">Emerald</p>
              <p className="text-sm text-gray-400">1.96x</p>
            </button>
            <button
              onClick={() => setSelectedSide('ruby')}
              disabled={flipping}
              className={`p-4 rounded-xl transition-all ${
                selectedSide === 'ruby'
                  ? 'bg-red-600/20 border-2 border-red-500 shadow-lg shadow-red-500/20'
                  : 'bg-dark-lighter border-2 border-transparent hover:border-red-500/50'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 mx-auto mb-2 flex items-center justify-center">
                <span className="text-2xl font-bold">R</span>
              </div>
              <p className="font-semibold">Ruby</p>
              <p className="text-sm text-gray-400">1.96x</p>
            </button>
          </div>
        </div>

        {/* Bet Amount */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-3">Bet Amount</label>
          <div className="flex gap-2 mb-3">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount)}
                disabled={flipping}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  betAmount === amount
                    ? 'bg-emerald-600 text-white'
                    : 'bg-dark-lighter text-gray-400 hover:text-white'
                }`}
              >
                {formatCoins(amount)}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
            min={1}
            disabled={flipping}
            className="w-full bg-dark-lighter rounded-lg px-4 py-3 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Summary */}
        <div className="flex justify-between items-center mb-6 text-sm">
          <span className="text-gray-400">Potential Win</span>
          <span className="text-emerald-400 font-bold text-lg">
            {formatCoins(betAmount * 1.96)}
          </span>
        </div>

        {/* Flip Button */}
        <button
          onClick={flip}
          disabled={flipping || !user || (user && user.balance < betAmount)}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
            flipping || !user || (user && user.balance < betAmount)
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 shadow-lg hover:shadow-yellow-500/30'
          }`}
        >
          {flipping ? (
            <>
              <RefreshCw className="animate-spin" size={24} />
              Flipping...
            </>
          ) : (
            <>
              <Coins size={24} />
              Flip for {formatCoins(betAmount)}
            </>
          )}
        </button>

        {!user && (
          <p className="text-center text-gray-400 text-sm mt-3">Login to play</p>
        )}
      </div>
    </div>
  );
}
