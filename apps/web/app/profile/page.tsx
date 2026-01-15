'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins } from '@/lib/utils';
import { User, Wallet, History, Settings, Trophy, TrendingUp, Shield, Copy, Check } from 'lucide-react';

interface UserStats {
  totalWagered: number;
  totalWon: number;
  battlesPlayed: number;
  battlesWon: number;
  casesOpened: number;
  biggestWin: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    Promise.all([
      api.get<UserStats>('/users/me/stats'),
      api.get<{ items: Transaction[] }>('/users/me/transactions'),
    ]).then(([statsRes, txRes]) => {
      if (statsRes.success) setStats(statsRes.data || null);
      if (txRes.success) setTransactions(txRes.data?.items || []);
    }).finally(() => setLoading(false));
  }, [isAuthenticated, router]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <p className="text-gray-400">Please login to view your profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile Header */}
      <div className="bg-dark-card rounded-xl p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Image
              src={user.avatarUrl || '/default-avatar.png'}
              alt={user.username}
              width={96}
              height={96}
              className="rounded-full"
            />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
              {user.level}
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">{user.username}</h1>
            <p className="text-gray-400 mb-3">
              {user.vipTier && (
                <span className={`px-2 py-1 rounded text-xs font-medium mr-2 ${
                  user.vipTier === 'diamond' ? 'bg-blue-500/20 text-blue-400' :
                  user.vipTier === 'gold' ? 'bg-yellow-500/20 text-yellow-400' :
                  user.vipTier === 'silver' ? 'bg-gray-500/20 text-gray-300' :
                  'bg-orange-500/20 text-orange-400'
                }`}>
                  {user.vipTier.toUpperCase()} VIP
                </span>
              )}
              Member since {new Date(user.createdAt || Date.now()).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-gray-400">Balance</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCoins(user.balance)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/wallet/deposit"
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors"
            >
              Deposit
            </Link>
            <Link
              href="/wallet/withdraw"
              className="px-6 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg font-semibold transition-colors"
            >
              Withdraw
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'history', label: 'History', icon: History },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === id
                ? 'bg-emerald-600 text-white'
                : 'bg-dark-card text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label="Total Wagered" value={formatCoins(stats?.totalWagered || 0)} />
          <StatCard icon={Trophy} label="Total Won" value={formatCoins(stats?.totalWon || 0)} />
          <StatCard icon={Shield} label="Battles Played" value={stats?.battlesPlayed?.toString() || '0'} />
          <StatCard icon={Trophy} label="Battles Won" value={stats?.battlesWon?.toString() || '0'} />
          <StatCard icon={Wallet} label="Cases Opened" value={stats?.casesOpened?.toString() || '0'} />
          <StatCard icon={TrendingUp} label="Biggest Win" value={formatCoins(stats?.biggestWin || 0)} color="text-emerald-400" />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-dark-card rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-dark-lighter rounded-lg">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
                  </div>
                  <p className={`font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatCoins(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <ProfileSettings />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = 'text-white' }: {
  icon: any;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-dark-card rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <Icon size={20} className="text-gray-400" />
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ProfileSettings() {
  const { user } = useAuthStore();
  const [clientSeed, setClientSeed] = useState(user?.clientSeed || '');
  const [tradeUrl, setTradeUrl] = useState('');
  const [emeraldSpin, setEmeraldSpin] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const saveSeed = async () => {
    setSaving(true);
    try {
      await api.put('/fair/seeds/client', { clientSeed });
    } finally {
      setSaving(false);
    }
  };

  const saveTradeUrl = async () => {
    setSaving(true);
    try {
      await api.put('/payments/trade-url', { tradeUrl });
    } finally {
      setSaving(false);
    }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(`https://emerald.win/r/${user?.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Client Seed */}
      <div className="bg-dark-card rounded-xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Shield size={20} className="text-emerald-400" />
          Provably Fair Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Client Seed</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
                placeholder="Enter your client seed"
              />
              <button
                onClick={saveSeed}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This seed is used in all provably fair calculations
            </p>
          </div>
        </div>
      </div>

      {/* Trade URL */}
      <div className="bg-dark-card rounded-xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Wallet size={20} className="text-emerald-400" />
          Withdrawal Settings
        </h3>
        <div>
          <label className="block text-sm text-gray-400 mb-2">Steam Trade URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tradeUrl}
              onChange={(e) => setTradeUrl(e.target.value)}
              className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
              placeholder="https://steamcommunity.com/tradeoffer/new/?partner=..."
            />
            <button
              onClick={saveTradeUrl}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Required for skin withdrawals
          </p>
        </div>
      </div>

      {/* Emerald Spin */}
      <div className="bg-dark-card rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-emerald-400">✨</span>
              Emerald Spin Animation
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Show special animation for high-value wins
            </p>
          </div>
          <button
            onClick={() => setEmeraldSpin(!emeraldSpin)}
            className={`w-12 h-6 rounded-full transition-colors ${
              emeraldSpin ? 'bg-emerald-600' : 'bg-dark-lighter'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
              emeraldSpin ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* Referral */}
      <div className="bg-dark-card rounded-xl p-6">
        <h3 className="font-semibold mb-4">Referral Link</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={`https://emerald.win/r/${user?.id}`}
            readOnly
            className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 text-gray-400"
          />
          <button
            onClick={copyReferral}
            className="px-4 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors flex items-center gap-2"
          >
            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
