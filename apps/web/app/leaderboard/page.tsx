'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { formatCoins } from '@/lib/utils';
import { Trophy, Medal, Crown, TrendingUp, Calendar } from 'lucide-react';

interface LeaderboardEntry {
  position: number;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
    level: number;
    vipTier: string;
  };
  wagered: number;
  profit: number;
  wins: number;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'alltime';

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('daily');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ entries: LeaderboardEntry[] }>(`/leaderboard/${period}`);
      if (res.success && res.data) {
        setLeaderboard(res.data.entries);
      } else {
        // Mock data for demo
        setLeaderboard([
          { position: 1, user: { id: '1', username: 'EmeraldKing', avatarUrl: '', level: 99, vipTier: 'emerald' }, wagered: 125000, profit: 45000, wins: 234 },
          { position: 2, user: { id: '2', username: 'LuckyDragon', avatarUrl: '', level: 87, vipTier: 'diamond' }, wagered: 98000, profit: 32000, wins: 189 },
          { position: 3, user: { id: '3', username: 'CaseHunter', avatarUrl: '', level: 76, vipTier: 'platinum' }, wagered: 76000, profit: 28000, wins: 156 },
          { position: 4, user: { id: '4', username: 'SkinMaster', avatarUrl: '', level: 65, vipTier: 'gold' }, wagered: 54000, profit: 15000, wins: 98 },
          { position: 5, user: { id: '5', username: 'BattleChamp', avatarUrl: '', level: 58, vipTier: 'gold' }, wagered: 45000, profit: 12000, wins: 87 },
          { position: 6, user: { id: '6', username: 'CS2Pro', avatarUrl: '', level: 45, vipTier: 'silver' }, wagered: 32000, profit: 8000, wins: 65 },
          { position: 7, user: { id: '7', username: 'Gambler99', avatarUrl: '', level: 42, vipTier: 'silver' }, wagered: 28000, profit: 6500, wins: 54 },
          { position: 8, user: { id: '8', username: 'RichKid', avatarUrl: '', level: 38, vipTier: 'bronze' }, wagered: 21000, profit: 4200, wins: 43 },
          { position: 9, user: { id: '9', username: 'NewPlayer', avatarUrl: '', level: 25, vipTier: 'bronze' }, wagered: 15000, profit: 2800, wins: 32 },
          { position: 10, user: { id: '10', username: 'TryHard', avatarUrl: '', level: 18, vipTier: 'bronze' }, wagered: 8500, profit: 1200, wins: 21 },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const periods: { key: Period; label: string; icon: React.ReactNode }[] = [
    { key: 'daily', label: 'Daily', icon: <Calendar className="w-4 h-4" /> },
    { key: 'weekly', label: 'Weekly', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'monthly', label: 'Monthly', icon: <Medal className="w-4 h-4" /> },
    { key: 'alltime', label: 'All Time', icon: <Crown className="w-4 h-4" /> },
  ];

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1: return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/50';
      case 2: return 'bg-gradient-to-r from-gray-300/20 to-gray-400/20 border-gray-400/50';
      case 3: return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/50';
      default: return 'bg-dark-card border-dark-border';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2: return <Medal className="w-6 h-6 text-gray-300" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-gray-400">#{position}</span>;
    }
  };

  const tierColors: Record<string, string> = {
    bronze: 'text-amber-700',
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    platinum: 'text-gray-100',
    diamond: 'text-cyan-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/20 rounded-full mb-4">
          <Trophy size={40} className="text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-gray-400">Compete for glory and exclusive rewards</p>
      </div>

      {/* Period Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              period === p.key
                ? 'bg-emerald-600 text-white'
                : 'bg-dark-card text-gray-400 hover:text-white hover:bg-dark-lighter'
            }`}
          >
            {p.icon}
            {p.label}
          </button>
        ))}
      </div>

      {/* Prize Pool Banner */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-yellow-600/20 border border-emerald-500/30 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-gray-400 mb-1">Current Prize Pool</p>
            <p className="text-3xl font-bold text-emerald-400">{formatCoins(50000)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 mb-1">Resets in</p>
            <p className="text-2xl font-bold">12:34:56</p>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-dark-card rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-dark-lighter text-gray-400 text-sm font-medium">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Player</div>
          <div className="col-span-2 text-right">Wagered</div>
          <div className="col-span-2 text-right">Profit</div>
          <div className="col-span-2 text-right">Wins</div>
          <div className="col-span-1 text-right">Prize</div>
        </div>

        {/* Entries */}
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="divide-y divide-dark-border">
            {leaderboard.map((entry) => (
              <div
                key={entry.position}
                className={`grid grid-cols-12 gap-4 px-6 py-4 items-center border-l-4 ${getPositionStyle(entry.position)}`}
              >
                <div className="col-span-1 flex items-center justify-center">
                  {getPositionIcon(entry.position)}
                </div>
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-dark-lighter overflow-hidden">
                    {entry.user.avatarUrl ? (
                      <Image src={entry.user.avatarUrl} alt={entry.user.username} width={40} height={40} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">
                        {entry.user.username[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className={`font-semibold ${tierColors[entry.user.vipTier] || 'text-white'}`}>
                      {entry.user.username}
                    </p>
                    <p className="text-xs text-gray-500">Level {entry.user.level}</p>
                  </div>
                </div>
                <div className="col-span-2 text-right font-medium">
                  {formatCoins(entry.wagered)}
                </div>
                <div className="col-span-2 text-right font-medium text-emerald-400">
                  +{formatCoins(entry.profit)}
                </div>
                <div className="col-span-2 text-right text-gray-400">
                  {entry.wins}
                </div>
                <div className="col-span-1 text-right">
                  {entry.position <= 3 && (
                    <span className="text-yellow-400 font-bold">
                      {entry.position === 1 ? '50%' : entry.position === 2 ? '30%' : '20%'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="mt-8 bg-dark-card rounded-xl p-6">
        <h3 className="font-semibold mb-4">Leaderboard Rules</h3>
        <ul className="text-gray-400 space-y-2 text-sm">
          <li>• Rankings are based on total amount wagered during the period</li>
          <li>• Prize pool is distributed at the end of each period</li>
          <li>• Top 3 players receive 50%, 30%, and 20% of the prize pool</li>
          <li>• Minimum wager of $10 required to qualify</li>
          <li>• In case of a tie, the player with more wins ranks higher</li>
        </ul>
      </div>
    </div>
  );
}
