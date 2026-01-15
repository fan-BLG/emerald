'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins, getRarityColor } from '@/lib/utils';
import { ArrowLeft, Search, ShoppingCart, AlertCircle, Check } from 'lucide-react';

interface WaxpeerSkin {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  float?: number;
  wear?: string;
}

export default function WithdrawPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [skins, setSkins] = useState<WaxpeerSkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [selectedSkin, setSelectedSkin] = useState<WaxpeerSkin | null>(null);
  const [tradeUrl, setTradeUrl] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    fetchSkins();
  }, [isAuthenticated, router]);

  const fetchSkins = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (minPrice) params.append('minPrice', minPrice.toString());
      if (maxPrice) params.append('maxPrice', maxPrice.toString());

      const res = await api.get<{ items: WaxpeerSkin[] }>(`/payments/withdrawals/skins?${params}`);
      if (res.success && res.data) {
        setSkins(res.data.items);
      }
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async () => {
    if (!selectedSkin || !tradeUrl || withdrawing) return;

    if (!tradeUrl.includes('steamcommunity.com/tradeoffer')) {
      setError('Invalid Steam trade URL');
      return;
    }

    setWithdrawing(true);
    setError(null);

    try {
      const res = await api.post('/payments/withdrawals/request', {
        waxpeerItemId: selectedSkin.id,
        tradeLink: tradeUrl,
      });

      if (res.success) {
        setSuccess(true);
        setSelectedSkin(null);
      } else {
        setError(res.error?.message || 'Withdrawal failed');
      }
    } catch (err) {
      setError('Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profile" className="p-2 hover:bg-dark-card rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Withdraw Skins</h1>
          <p className="text-gray-400">Exchange your coins for CS2 skins</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Your Balance</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCoins(user?.balance || 0)}</p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Check className="text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-400">Withdrawal Requested!</p>
            <p className="text-sm text-gray-400">You will receive a Steam trade offer shortly</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Filters & Skin List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="bg-dark-card rounded-xl p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchSkins()}
                    placeholder="Search skins..."
                    className="w-full bg-dark-lighter rounded-lg pl-10 pr-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  placeholder="Min"
                  className="w-24 bg-dark-lighter rounded-lg px-3 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  placeholder="Max"
                  className="w-24 bg-dark-lighter rounded-lg px-3 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={fetchSkins}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                >
                  Filter
                </button>
              </div>
            </div>
          </div>

          {/* Skin Grid */}
          <div className="bg-dark-card rounded-xl p-4">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-dark-lighter rounded-lg p-3 animate-pulse">
                    <div className="aspect-square bg-dark-card rounded mb-2" />
                    <div className="h-4 bg-dark-card rounded mb-1" />
                    <div className="h-4 bg-dark-card rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : skins.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No skins found</p>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {skins.map((skin) => (
                  <button
                    key={skin.id}
                    onClick={() => setSelectedSkin(skin)}
                    disabled={(user?.balance || 0) < skin.price}
                    className={`bg-dark-lighter rounded-lg p-3 text-left transition-all ${
                      selectedSkin?.id === skin.id
                        ? 'ring-2 ring-emerald-500'
                        : (user?.balance || 0) < skin.price
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-dark-card'
                    }`}
                  >
                    <div className="aspect-square relative mb-2">
                      {skin.imageUrl ? (
                        <Image
                          src={skin.imageUrl}
                          alt={skin.name}
                          fill
                          className="object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-dark-card rounded flex items-center justify-center">
                          <span className="text-2xl">🎁</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm truncate mb-1">{skin.name}</p>
                    {skin.float && (
                      <p className="text-xs text-gray-500 mb-1">Float: {skin.float.toFixed(4)}</p>
                    )}
                    <p className="text-emerald-400 font-bold">{formatCoins(skin.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Checkout Panel */}
        <div className="lg:col-span-1">
          <div className="bg-dark-card rounded-xl p-6 sticky top-24">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart size={20} />
              Checkout
            </h2>

            {selectedSkin ? (
              <>
                {/* Selected Skin */}
                <div className="bg-dark-lighter rounded-lg p-4 mb-4">
                  <div className="aspect-square relative mb-3">
                    {selectedSkin.imageUrl ? (
                      <Image
                        src={selectedSkin.imageUrl}
                        alt={selectedSkin.name}
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-dark-card rounded flex items-center justify-center">
                        <span className="text-4xl">🎁</span>
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-center mb-1">{selectedSkin.name}</p>
                  <p className="text-emerald-400 font-bold text-center text-xl">
                    {formatCoins(selectedSkin.price)}
                  </p>
                </div>

                {/* Trade URL */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">Steam Trade URL</label>
                  <input
                    type="text"
                    value={tradeUrl}
                    onChange={(e) => setTradeUrl(e.target.value)}
                    placeholder="https://steamcommunity.com/tradeoffer/new/?..."
                    className="w-full bg-dark-lighter rounded-lg px-4 py-2 text-sm border border-dark-lighter focus:border-emerald-500 focus:outline-none"
                  />
                  <a
                    href="https://steamcommunity.com/my/tradeoffers/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:underline mt-1 inline-block"
                  >
                    Get your trade URL
                  </a>
                </div>

                {/* Summary */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Skin Price</span>
                    <span>{formatCoins(selectedSkin.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Your Balance</span>
                    <span>{formatCoins(user?.balance || 0)}</span>
                  </div>
                  <hr className="border-dark-lighter" />
                  <div className="flex justify-between font-semibold">
                    <span>Remaining</span>
                    <span className="text-emerald-400">
                      {formatCoins((user?.balance || 0) - selectedSkin.price)}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <AlertCircle className="text-red-400" size={16} />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  onClick={withdraw}
                  disabled={withdrawing || !tradeUrl}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    withdrawing || !tradeUrl
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {withdrawing ? 'Processing...' : 'Withdraw Skin'}
                </button>

                <button
                  onClick={() => setSelectedSkin(null)}
                  className="w-full py-2 text-gray-400 hover:text-white mt-2 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-dark-lighter rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="text-gray-500" size={24} />
                </div>
                <p className="text-gray-400">Select a skin to withdraw</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
