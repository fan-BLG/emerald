'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { formatCoins } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, History, Users } from 'lucide-react';

type BetColor = 'red' | 'black' | 'green';

interface Bet {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  amount: number;
  color: BetColor;
}

interface RouletteRound {
  id: string;
  status: 'betting' | 'spinning' | 'finished';
  result?: number;
  bets: Bet[];
  countdown: number;
}

const ROULETTE_NUMBERS = [
  0, 11, 5, 10, 6, 9, 7, 8, 1, 14, 2, 13, 3, 12, 4
];

const getColorForNumber = (num: number): BetColor => {
  if (num === 0) return 'green';
  return num <= 7 ? 'red' : 'black';
};

export default function RoulettePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { socket } = useSocketStore();

  const [round, setRound] = useState<RouletteRound | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [selectedColor, setSelectedColor] = useState<BetColor | null>(null);
  const [history, setHistory] = useState<number[]>([4, 12, 0, 7, 11, 3, 9, 1, 14, 6]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Mock initial state
    setRound({
      id: '1',
      status: 'betting',
      bets: [],
      countdown: 15,
    });

    // Countdown timer
    const interval = setInterval(() => {
      setRound(prev => {
        if (!prev || prev.status !== 'betting') return prev;
        if (prev.countdown <= 1) {
          // Start spinning
          spinWheel();
          return { ...prev, status: 'spinning', countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const spinWheel = () => {
    setSpinning(true);
    const result = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
    const resultIndex = ROULETTE_NUMBERS.indexOf(result);
    const segmentAngle = 360 / ROULETTE_NUMBERS.length;
    const targetAngle = 360 * 5 + (resultIndex * segmentAngle) + (segmentAngle / 2);

    setRotation(targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setHistory(prev => [result, ...prev.slice(0, 9)]);
      setRound(prev => prev ? {
        ...prev,
        status: 'finished',
        result
      } : null);

      // Reset for next round
      setTimeout(() => {
        setRotation(0);
        setRound({
          id: Date.now().toString(),
          status: 'betting',
          bets: [],
          countdown: 15,
        });
      }, 3000);
    }, 5000);
  };

  const placeBet = (color: BetColor) => {
    if (!isAuthenticated || !round || round.status !== 'betting') return;

    setSelectedColor(color);
    // In real implementation, this would emit to socket
  };

  const getBetMultiplier = (color: BetColor): number => {
    switch (color) {
      case 'green': return 14;
      case 'red':
      case 'black': return 2;
    }
  };

  const colorStyles = {
    red: 'bg-red-600 hover:bg-red-500 border-red-500',
    black: 'bg-gray-800 hover:bg-gray-700 border-gray-600',
    green: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Roulette</h1>
        <p className="text-gray-400">Spin the wheel and test your luck</p>
      </div>

      {/* History */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <History className="w-5 h-5 text-gray-400" />
        <div className="flex gap-1">
          {history.map((num, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                num === 0 ? 'bg-emerald-600' : num <= 7 ? 'bg-red-600' : 'bg-gray-800'
              } ${i === 0 ? 'ring-2 ring-white' : 'opacity-70'}`}
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* Wheel */}
      <div className="relative max-w-md mx-auto mb-8">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400" />
        </div>

        {/* Wheel */}
        <motion.div
          ref={wheelRef}
          className="w-64 h-64 mx-auto rounded-full border-4 border-yellow-500 relative overflow-hidden"
          style={{ rotate: rotation }}
          animate={{ rotate: rotation }}
          transition={{ duration: 5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {ROULETTE_NUMBERS.map((num, i) => {
            const angle = (i * 360) / ROULETTE_NUMBERS.length;
            const color = getColorForNumber(num);
            return (
              <div
                key={num}
                className={`absolute w-full h-full origin-center ${
                  color === 'green' ? 'bg-emerald-600' :
                  color === 'red' ? 'bg-red-600' : 'bg-gray-800'
                }`}
                style={{
                  clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.tan(Math.PI / ROULETTE_NUMBERS.length)}% 0%)`,
                  transform: `rotate(${angle}deg)`,
                }}
              >
                <span
                  className="absolute text-white font-bold text-xs"
                  style={{
                    top: '20%',
                    left: '50%',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {num}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Status */}
        <div className="text-center mt-4">
          {round?.status === 'betting' && (
            <div className="text-2xl font-bold">
              <span className="text-gray-400">Betting closes in </span>
              <span className="text-emerald-400">{round.countdown}s</span>
            </div>
          )}
          {round?.status === 'spinning' && (
            <div className="flex items-center justify-center gap-2 text-xl">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Spinning...</span>
            </div>
          )}
          {round?.status === 'finished' && round.result !== undefined && (
            <div className="text-2xl font-bold">
              <span className={`${
                round.result === 0 ? 'text-emerald-400' :
                round.result <= 7 ? 'text-red-400' : 'text-gray-300'
              }`}>
                {round.result} - {getColorForNumber(round.result).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Betting Panel */}
      <div className="max-w-2xl mx-auto">
        {/* Bet Amount */}
        <div className="bg-dark-card rounded-xl p-4 mb-4 border border-dark-border">
          <label className="block text-sm text-gray-400 mb-2">Bet Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min={1}
              className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 border border-dark-border focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={() => setBetAmount(prev => prev * 2)}
              className="px-4 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
            >
              2x
            </button>
            <button
              onClick={() => setBetAmount(prev => Math.floor(prev / 2))}
              className="px-4 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => setBetAmount(100)}
              className="px-4 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
            >
              Max
            </button>
          </div>
        </div>

        {/* Bet Buttons */}
        <div className="grid grid-cols-3 gap-4">
          {(['red', 'green', 'black'] as BetColor[]).map((color) => (
            <button
              key={color}
              onClick={() => placeBet(color)}
              disabled={round?.status !== 'betting'}
              className={`${colorStyles[color]} py-6 rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-base' : ''
              }`}
            >
              <div className="text-center">
                <p className="text-2xl font-bold mb-1">{getBetMultiplier(color)}x</p>
                <p className="text-sm opacity-80 capitalize">{color}</p>
                <p className="text-xs opacity-60 mt-1">
                  {color === 'green' ? '0' : color === 'red' ? '1-7' : '8-14'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Place Bet Button */}
        {isAuthenticated && selectedColor && round?.status === 'betting' && (
          <button
            className="w-full mt-4 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-colors"
          >
            Place Bet - {formatCoins(betAmount)} on {selectedColor.toUpperCase()}
          </button>
        )}

        {!isAuthenticated && (
          <p className="text-center text-gray-400 mt-4">
            Sign in with Steam to place bets
          </p>
        )}
      </div>

      {/* Current Bets */}
      <div className="max-w-2xl mx-auto mt-8">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Current Bets
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {(['red', 'green', 'black'] as BetColor[]).map((color) => (
            <div key={color} className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <div className={`text-center font-bold mb-2 capitalize ${
                color === 'green' ? 'text-emerald-400' :
                color === 'red' ? 'text-red-400' : 'text-gray-300'
              }`}>
                {color}
              </div>
              <div className="text-center text-sm text-gray-400">
                No bets yet
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
