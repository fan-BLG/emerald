'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { formatCoins } from '@/lib/utils';
import { Gift, Star, Zap, Clock, Check, Lock, Crown, Gem, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface Reward {
  id: string;
  type: 'daily' | 'weekly' | 'level' | 'vip' | 'rakeback';
  name: string;
  description: string;
  amount: number;
  claimed: boolean;
  available: boolean;
  nextAvailable?: string;
  requirement?: string;
}

export default function RewardsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [rakebackAmount, setRakebackAmount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRewards();
    }
  }, [isAuthenticated]);

  const fetchRewards = async () => {
    // Mock rewards data
    setRewards([
      { id: '1', type: 'daily', name: 'Daily Bonus', description: 'Claim every 24 hours', amount: 5, claimed: false, available: true },
      { id: '2', type: 'weekly', name: 'Weekly Chest', description: 'Available every Monday', amount: 50, claimed: false, available: false, nextAvailable: '3 days' },
      { id: '3', type: 'level', name: 'Level 10 Reward', description: 'Reach level 10', amount: 25, claimed: true, available: false },
      { id: '4', type: 'level', name: 'Level 25 Reward', description: 'Reach level 25', amount: 100, claimed: false, available: false, requirement: 'Level 25' },
      { id: '5', type: 'vip', name: 'Gold VIP Bonus', description: 'Exclusive for Gold VIP', amount: 200, claimed: false, available: user?.vipTier === 'gold' || user?.vipTier === 'platinum' || user?.vipTier === 'diamond' || user?.vipTier === 'emerald' },
    ]);

    // Calculate rakeback (example: 5% of wagered)
    if (user) {
      setRakebackAmount(Number(user.totalWagered) * 0.05);
    }
  };

  const claimReward = async (rewardId: string) => {
    setClaiming(rewardId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, claimed: true, available: false } : r));
    setClaiming(null);
  };

  const claimRakeback = async () => {
    setClaiming('rakeback');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRakebackAmount(0);
    setClaiming(null);
  };

  const vipTiers = [
    { name: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-700/20', requirement: '$0' },
    { name: 'Silver', color: 'text-gray-300', bg: 'bg-gray-300/20', requirement: '$1,000' },
    { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-400/20', requirement: '$5,000' },
    { name: 'Platinum', color: 'text-gray-100', bg: 'bg-gray-100/20', requirement: '$25,000' },
    { name: 'Diamond', color: 'text-cyan-400', bg: 'bg-cyan-400/20', requirement: '$100,000' },
    { name: 'Emerald', color: 'text-emerald-400', bg: 'bg-emerald-400/20', requirement: '$500,000' },
  ];

  const currentTierIndex = vipTiers.findIndex(t => t.name.toLowerCase() === user?.vipTier);
  const progress = ((currentTierIndex + 1) / vipTiers.length) * 100;

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <Gift className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view rewards</h1>
          <p className="text-gray-400">Login with Steam to access exclusive bonuses and rakeback</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/20 rounded-full mb-4">
          <Gift size={40} className="text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Rewards Center</h1>
        <p className="text-gray-400">Claim bonuses, earn rakeback, and level up for exclusive perks</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rakeback Card */}
          <div className="bg-gradient-to-r from-emerald-600/20 to-purple-600/20 border border-emerald-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold">Rakeback</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">5% of all your wagers returned to you</p>
                <p className="text-3xl font-bold text-emerald-400">{formatCoins(rakebackAmount)}</p>
                <p className="text-xs text-gray-500 mt-1">Available to claim</p>
              </div>
              <button
                onClick={claimRakeback}
                disabled={rakebackAmount < 1 || claiming === 'rakeback'}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  rakebackAmount >= 1
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-dark-lighter text-gray-500 cursor-not-allowed'
                }`}
              >
                {claiming === 'rakeback' ? 'Claiming...' : 'Claim'}
              </button>
            </div>
          </div>

          {/* Rewards Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {rewards.map((reward) => (
              <motion.div
                key={reward.id}
                whileHover={{ scale: 1.02 }}
                className={`bg-dark-card rounded-xl p-5 border ${
                  reward.available ? 'border-emerald-500/50' : 'border-dark-border'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${
                    reward.type === 'daily' ? 'bg-yellow-500/20' :
                    reward.type === 'weekly' ? 'bg-purple-500/20' :
                    reward.type === 'level' ? 'bg-blue-500/20' : 'bg-emerald-500/20'
                  }`}>
                    {reward.type === 'daily' ? <Star className="w-5 h-5 text-yellow-400" /> :
                     reward.type === 'weekly' ? <Gift className="w-5 h-5 text-purple-400" /> :
                     reward.type === 'level' ? <Zap className="w-5 h-5 text-blue-400" /> :
                     <Crown className="w-5 h-5 text-emerald-400" />}
                  </div>
                  {reward.claimed && (
                    <span className="flex items-center gap-1 text-emerald-400 text-sm">
                      <Check className="w-4 h-4" /> Claimed
                    </span>
                  )}
                </div>

                <h4 className="font-semibold mb-1">{reward.name}</h4>
                <p className="text-sm text-gray-400 mb-3">{reward.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold text-lg">+{formatCoins(reward.amount)}</span>

                  {reward.claimed ? (
                    <span className="text-gray-500 text-sm">Already claimed</span>
                  ) : reward.available ? (
                    <button
                      onClick={() => claimReward(reward.id)}
                      disabled={claiming === reward.id}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
                    >
                      {claiming === reward.id ? 'Claiming...' : 'Claim'}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500 text-sm">
                      {reward.nextAvailable ? (
                        <><Clock className="w-4 h-4" /> {reward.nextAvailable}</>
                      ) : (
                        <><Lock className="w-4 h-4" /> {reward.requirement}</>
                      )}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* VIP Sidebar */}
        <div className="space-y-6">
          {/* Current VIP Status */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <div className="flex items-center gap-3 mb-4">
              <Gem className="w-6 h-6 text-emerald-400" />
              <h3 className="font-semibold">VIP Status</h3>
            </div>

            <div className="text-center mb-6">
              <p className={`text-2xl font-bold capitalize ${
                vipTiers[currentTierIndex]?.color || 'text-white'
              }`}>
                {user?.vipTier || 'Bronze'}
              </p>
              <p className="text-sm text-gray-400">Current Tier</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-2 bg-dark-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* VIP Tiers */}
            <div className="space-y-2">
              {vipTiers.map((tier, index) => (
                <div
                  key={tier.name}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    index <= currentTierIndex ? tier.bg : 'bg-dark-lighter'
                  }`}
                >
                  <span className={`font-medium ${index <= currentTierIndex ? tier.color : 'text-gray-500'}`}>
                    {tier.name}
                  </span>
                  <span className="text-sm text-gray-400">{tier.requirement}</span>
                </div>
              ))}
            </div>
          </div>

          {/* VIP Benefits */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h3 className="font-semibold mb-4">VIP Benefits</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Increased rakeback percentage</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Exclusive VIP bonuses</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Priority withdrawals</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Personal account manager</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Special event invitations</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
