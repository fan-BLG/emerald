'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, Zap } from 'lucide-react';

interface CrashBet {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  amount: number;
  cashoutMultiplier?: number;
  profit?: number;
}

interface CrashRound {
  id: string;
  status: 'waiting' | 'running' | 'crashed';
  multiplier: number;
  crashPoint?: number;
  bets: CrashBet[];
  countdown: number;
}

export default function CrashPage() {
  const { user, isAuthenticated } = useAuthStore();

  const [round, setRound] = useState<CrashRound>({
    id: '1',
    status: 'waiting',
    multiplier: 1.00,
    bets: [],
    countdown: 5,
  });

  const [betAmount, setBetAmount] = useState(10);
  const [autoCashout, setAutoCashout] = useState(2.00);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [history, setHistory] = useState<number[]>([2.45, 1.12, 5.67, 1.89, 3.21, 1.05, 12.34, 1.45, 2.98, 4.56]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (round.status === 'waiting') {
      interval = setInterval(() => {
        setRound(prev => {
          if (prev.countdown <= 1) {
            startRound();
            return { ...prev, status: 'running', countdown: 0 };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [round.status]);

  const startRound = () => {
    const crashPoint = generateCrashPoint();
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentMultiplier = Math.pow(Math.E, 0.1 * elapsed);

      if (currentMultiplier >= crashPoint) {
        setRound(prev => ({
          ...prev,
          status: 'crashed',
          multiplier: crashPoint,
          crashPoint,
        }));
        setHistory(prev => [crashPoint, ...prev.slice(0, 9)]);

        // Reset after crash
        setTimeout(() => {
          setRound({
            id: Date.now().toString(),
            status: 'waiting',
            multiplier: 1.00,
            bets: [],
            countdown: 5,
          });
          setHasBet(false);
          setCashedOut(false);
        }, 3000);
        return;
      }

      setRound(prev => ({ ...prev, multiplier: currentMultiplier }));
      drawGraph(currentMultiplier);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const generateCrashPoint = (): number => {
    // House edge implementation
    const houseEdge = 0.04;
    const random = Math.random();
    if (random < houseEdge) return 1.00;
    return Math.max(1.00, 0.99 / (1 - random));
  };

  const drawGraph = (multiplier: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = height - (i * height / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw curve
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, height);

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const points = 100;

    for (let i = 0; i <= points; i++) {
      const t = (i / points) * elapsed;
      const m = Math.pow(Math.E, 0.1 * t);
      const x = (i / points) * width;
      const y = height - ((m - 1) / (multiplier - 1 + 0.01)) * (height * 0.8);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  };

  const placeBet = () => {
    if (!isAuthenticated || round.status !== 'waiting' || hasBet) return;
    setHasBet(true);
  };

  const cashout = () => {
    if (!hasBet || cashedOut || round.status !== 'running') return;
    setCashedOut(true);
    // In real implementation, emit to socket and get confirmation
  };

  const getMultiplierColor = (mult: number): string => {
    if (mult < 1.5) return 'text-gray-400';
    if (mult < 2) return 'text-blue-400';
    if (mult < 5) return 'text-emerald-400';
    if (mult < 10) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Crash</h1>
        <p className="text-gray-400">Cash out before the crash</p>
      </div>

      {/* History */}
      <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto">
        <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <div className="flex gap-2">
          {history.map((mult, i) => (
            <div
              key={i}
              className={`px-3 py-1 rounded-lg text-sm font-bold ${
                mult < 2 ? 'bg-gray-800 text-gray-400' :
                mult < 5 ? 'bg-emerald-600/20 text-emerald-400' :
                mult < 10 ? 'bg-yellow-600/20 text-yellow-400' :
                'bg-red-600/20 text-red-400'
              }`}
            >
              {mult.toFixed(2)}x
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Graph Area */}
        <div className="lg:col-span-2">
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            {/* Multiplier Display */}
            <div className="text-center mb-4">
              {round.status === 'waiting' ? (
                <div>
                  <p className="text-gray-400 mb-2">Starting in</p>
                  <p className="text-5xl font-bold">{round.countdown}s</p>
                </div>
              ) : round.status === 'crashed' ? (
                <div>
                  <p className="text-red-400 mb-2">CRASHED</p>
                  <p className="text-5xl font-bold text-red-500">
                    {round.crashPoint?.toFixed(2)}x
                  </p>
                </div>
              ) : (
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <p className={`text-6xl font-bold ${getMultiplierColor(round.multiplier)}`}>
                    {round.multiplier.toFixed(2)}x
                  </p>
                </motion.div>
              )}
            </div>

            {/* Canvas */}
            <div className="relative bg-dark-lighter rounded-lg overflow-hidden" style={{ height: '300px' }}>
              <canvas
                ref={canvasRef}
                width={800}
                height={300}
                className="w-full h-full"
              />

              {round.status === 'waiting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-lighter/80">
                  <div className="text-center">
                    <Zap className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
                    <p className="text-lg">Waiting for next round...</p>
                  </div>
                </div>
              )}

              {round.status === 'crashed' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/20">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-red-500">CRASHED!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Betting Panel */}
        <div className="space-y-4">
          {/* Bet Input */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            <label className="block text-sm text-gray-400 mb-2">Bet Amount</label>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                min={1}
                disabled={hasBet}
                className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 border border-dark-border focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex gap-2 mb-4">
              {[10, 50, 100, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  disabled={hasBet}
                  className="flex-1 px-2 py-1 bg-dark-lighter hover:bg-dark-base rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {amount}
                </button>
              ))}
            </div>

            <label className="block text-sm text-gray-400 mb-2">Auto Cashout</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={autoCashout}
                onChange={(e) => setAutoCashout(Number(e.target.value))}
                min={1.01}
                step={0.01}
                disabled={hasBet}
                className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 border border-dark-border focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
              <span className="flex items-center px-3 text-gray-400">x</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            {!isAuthenticated ? (
              <p className="text-center text-gray-400">Sign in with Steam to play</p>
            ) : !hasBet ? (
              <button
                onClick={placeBet}
                disabled={round.status !== 'waiting'}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Place Bet - {formatCoins(betAmount)}
              </button>
            ) : cashedOut ? (
              <div className="text-center">
                <p className="text-emerald-400 font-bold text-lg">Cashed Out!</p>
                <p className="text-gray-400">+{formatCoins(betAmount * round.multiplier)}</p>
              </div>
            ) : round.status === 'crashed' ? (
              <div className="text-center">
                <p className="text-red-400 font-bold text-lg">You Lost</p>
                <p className="text-gray-400">-{formatCoins(betAmount)}</p>
              </div>
            ) : (
              <button
                onClick={cashout}
                className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-lg transition-colors animate-pulse"
              >
                Cashout @ {round.multiplier.toFixed(2)}x
                <br />
                <span className="text-sm opacity-80">
                  +{formatCoins(betAmount * round.multiplier)}
                </span>
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Statistics
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Bets</span>
                <span>{round.bets.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Wagered</span>
                <span>{formatCoins(round.bets.reduce((sum, b) => sum + b.amount, 0))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Bets */}
      <div className="mt-8">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Current Players
        </h3>
        <div className="bg-dark-card rounded-xl overflow-hidden border border-dark-border">
          <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-dark-lighter text-sm text-gray-400">
            <div>Player</div>
            <div className="text-right">Bet</div>
            <div className="text-right">Cashout</div>
            <div className="text-right">Profit</div>
          </div>
          <div className="p-4 text-center text-gray-500">
            No bets in this round yet
          </div>
        </div>
      </div>
    </div>
  );
}
