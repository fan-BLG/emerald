'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins } from '@/lib/utils';
import { Plus, Minus, Users, Zap, HelpCircle, X } from 'lucide-react';

interface Case {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
}

type BattleMode = 'normal' | 'crazy' | 'progressive' | 'mystery';

const BATTLE_MODES: { id: BattleMode; name: string; description: string; icon: string }[] = [
  { id: 'normal', name: 'Normal', description: 'Highest total value wins', icon: '⚔️' },
  { id: 'crazy', name: 'Crazy', description: 'Lowest total value wins', icon: '🤪' },
  { id: 'progressive', name: 'Progressive', description: 'Case prices increase each round', icon: '📈' },
  { id: 'mystery', name: 'Mystery', description: 'Values hidden until end', icon: '❓' },
];

const PLAYER_COUNTS = [2, 3, 4];
const ROUND_OPTIONS = [1, 2, 3, 4, 5];

export default function CreateBattlePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Battle configuration
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [mode, setMode] = useState<BattleMode>('normal');
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    api.get<{ cases: Case[] }>('/cases')
      .then((res) => {
        if (res.success && res.data) {
          setCases(res.data.cases);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCaseObjects = selectedCases.map(id => cases.find(c => c.id === id)!).filter(Boolean);
  const totalCost = selectedCaseObjects.reduce((sum, c) => sum + c.price, 0);
  const canCreate = selectedCases.length > 0 && user && user.balance >= totalCost;

  const addCase = (caseId: string) => {
    if (selectedCases.length < 10) {
      setSelectedCases([...selectedCases, caseId]);
    }
  };

  const removeCase = (index: number) => {
    setSelectedCases(selectedCases.filter((_, i) => i !== index));
  };

  const createBattle = async () => {
    if (!canCreate || creating) return;

    setCreating(true);
    try {
      const res = await api.post<{ id: string }>('/battles', {
        caseIds: selectedCases,
        maxPlayers,
        mode,
        isPrivate,
      });

      if (res.success && res.data) {
        router.push(`/battles/${res.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create battle:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Create Battle</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mode Selection */}
          <section className="bg-dark-card rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap size={20} className="text-emerald-400" />
              Battle Mode
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {BATTLE_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`p-4 rounded-lg text-left transition-all ${
                    mode === m.id
                      ? 'bg-emerald-600/20 border-2 border-emerald-500'
                      : 'bg-dark-lighter border-2 border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{m.icon}</span>
                    <span className="font-semibold">{m.name}</span>
                  </div>
                  <p className="text-sm text-gray-400">{m.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Player Count */}
          <section className="bg-dark-card rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={20} className="text-emerald-400" />
              Players
            </h2>
            <div className="flex gap-3">
              {PLAYER_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => setMaxPlayers(count)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    maxPlayers === count
                      ? 'bg-emerald-600 text-white'
                      : 'bg-dark-lighter text-gray-400 hover:text-white'
                  }`}
                >
                  {count} Players
                </button>
              ))}
            </div>
          </section>

          {/* Case Selection */}
          <section className="bg-dark-card rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Select Cases (up to 10 rounds)</h2>

            {/* Selected Cases */}
            {selectedCases.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">Selected ({selectedCases.length}/10):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCaseObjects.map((c, index) => (
                    <div
                      key={`selected-${index}`}
                      className="flex items-center gap-2 bg-dark-lighter rounded-lg p-2 pr-3"
                    >
                      <div className="w-10 h-10 relative">
                        {c.imageUrl ? (
                          <Image src={c.imageUrl} alt={c.name} fill className="object-contain" />
                        ) : (
                          <div className="w-full h-full bg-dark-card rounded flex items-center justify-center text-lg">📦</div>
                        )}
                      </div>
                      <span className="text-sm">{c.name}</span>
                      <span className="text-emerald-400 text-sm font-semibold">{formatCoins(c.price)}</span>
                      <button
                        onClick={() => removeCase(index)}
                        className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Cases */}
            {loading ? (
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-dark-lighter rounded-lg p-3 animate-pulse">
                    <div className="aspect-square bg-dark-card rounded mb-2" />
                    <div className="h-4 bg-dark-card rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => addCase(c.id)}
                    disabled={selectedCases.length >= 10}
                    className="bg-dark-lighter rounded-lg p-3 text-left hover:bg-dark-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="aspect-square relative mb-2">
                      {c.imageUrl ? (
                        <Image src={c.imageUrl} alt={c.name} fill className="object-contain" />
                      ) : (
                        <div className="w-full h-full bg-dark-card rounded flex items-center justify-center text-2xl">📦</div>
                      )}
                    </div>
                    <p className="text-xs truncate mb-1">{c.name}</p>
                    <p className="text-emerald-400 text-sm font-semibold">{formatCoins(c.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Private Toggle */}
          <section className="bg-dark-card rounded-lg p-6">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <h2 className="font-semibold">Private Battle</h2>
                <p className="text-sm text-gray-400">Only players with the link can join</p>
              </div>
              <div
                className={`w-12 h-6 rounded-full transition-colors ${
                  isPrivate ? 'bg-emerald-600' : 'bg-dark-lighter'
                }`}
                onClick={() => setIsPrivate(!isPrivate)}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${
                    isPrivate ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          </section>
        </div>

        {/* Summary Panel */}
        <div className="lg:col-span-1">
          <div className="bg-dark-card rounded-lg p-6 sticky top-24">
            <h2 className="text-lg font-semibold mb-4">Battle Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Mode</span>
                <span className="font-medium">{BATTLE_MODES.find(m => m.id === mode)?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Players</span>
                <span className="font-medium">{maxPlayers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Rounds</span>
                <span className="font-medium">{selectedCases.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Visibility</span>
                <span className="font-medium">{isPrivate ? 'Private' : 'Public'}</span>
              </div>
              <hr className="border-dark-lighter" />
              <div className="flex justify-between">
                <span className="text-gray-400">Your Cost</span>
                <span className="text-emerald-400 font-bold text-lg">{formatCoins(totalCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Pot</span>
                <span className="font-medium">{formatCoins(totalCost * maxPlayers)}</span>
              </div>
            </div>

            <button
              onClick={createBattle}
              disabled={!canCreate || creating}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                canCreate && !creating
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {creating ? 'Creating...' : selectedCases.length === 0 ? 'Select Cases' : !user ? 'Login Required' : user.balance < totalCost ? 'Insufficient Balance' : 'Create Battle'}
            </button>

            {user && user.balance < totalCost && selectedCases.length > 0 && (
              <p className="text-red-400 text-sm text-center mt-2">
                Need {formatCoins(totalCost - user.balance)} more coins
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
