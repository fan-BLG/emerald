'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins, getRarityColor } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Skin {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
}

interface CaseItem {
  id: string;
  skin: Skin;
  coinValue: number;
  oddsPercentage: number;
}

interface CaseWithItems {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
  items: CaseItem[];
}

interface OpenResult {
  item: CaseItem;
  coinValue: number;
  rollValue: number;
  isEmeraldSpin: boolean;
}

export default function CaseOpenPage() {
  const { slug } = useParams();
  const { user, updateBalance } = useAuthStore();
  const [caseData, setCaseData] = useState<CaseWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenResult | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinItems, setSpinItems] = useState<CaseItem[]>([]);
  const spinContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) {
      api.get<CaseWithItems>(`/cases/${slug}`)
        .then((res) => {
          if (res.success && res.data) {
            setCaseData(res.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [slug]);

  const generateSpinItems = (winningItem: CaseItem) => {
    if (!caseData) return [];

    const items: CaseItem[] = [];
    const totalItems = 50;
    const winPosition = 43; // Win position near the end

    for (let i = 0; i < totalItems; i++) {
      if (i === winPosition) {
        items.push(winningItem);
      } else {
        // Random item from case
        const randomItem = caseData.items[Math.floor(Math.random() * caseData.items.length)];
        items.push(randomItem);
      }
    }
    return items;
  };

  const openCase = async () => {
    if (!caseData || !user || opening) return;

    if (user.balance < caseData.price) {
      alert('Insufficient balance');
      return;
    }

    setOpening(true);
    setResult(null);
    setIsSpinning(true);

    try {
      const res = await api.post<OpenResult>(`/cases/${caseData.id}/open`, {});

      if (res.success && res.data) {
        // Generate spin items with winning item
        const items = generateSpinItems(res.data.item);
        setSpinItems(items);

        // Animate spin
        if (spinContainerRef.current) {
          const itemWidth = 180;
          const winPosition = 43;
          const offset = (winPosition * itemWidth) - (spinContainerRef.current.offsetWidth / 2) + (itemWidth / 2);

          spinContainerRef.current.style.transition = 'none';
          spinContainerRef.current.style.transform = 'translateX(0)';

          // Force reflow
          spinContainerRef.current.offsetHeight;

          spinContainerRef.current.style.transition = 'transform 5s cubic-bezier(0.15, 0.85, 0.35, 1)';
          spinContainerRef.current.style.transform = `translateX(-${offset}px)`;
        }

        // Show result after animation
        setTimeout(() => {
          setIsSpinning(false);
          setResult(res.data!);
          updateBalance(user.balance - caseData.price + res.data!.coinValue);
        }, 5500);
      }
    } catch (error) {
      console.error('Failed to open case:', error);
      setIsSpinning(false);
    } finally {
      setOpening(false);
    }
  };

  if (loading || !caseData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dark-card rounded w-1/4 mb-8" />
          <div className="bg-dark-card rounded-xl p-8 mb-8">
            <div className="h-64 bg-dark-lighter rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Case Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">{caseData.name}</h1>
        <div className="flex items-center gap-2 bg-dark-card px-4 py-2 rounded-lg">
          <span className="text-gray-400">Price:</span>
          <span className="text-emerald-400 font-bold text-xl">{formatCoins(caseData.price)}</span>
          <span className="text-gray-500">coins</span>
        </div>
      </div>

      {/* Spinner Area */}
      <div className="bg-dark-card rounded-xl p-8 mb-8 overflow-hidden relative">
        {/* Center Indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-emerald-400 z-10 shadow-lg shadow-emerald-400/50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-emerald-400 z-10" />

        {/* Spinner */}
        <div className="relative h-48 overflow-hidden">
          <div
            ref={spinContainerRef}
            className="flex absolute left-1/2 -translate-x-1/2 gap-2"
          >
            {(isSpinning ? spinItems : caseData.items.slice(0, 10)).map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className={`
                  flex-shrink-0 w-44 h-44 bg-dark-lighter rounded-lg p-3
                  border-2 transition-colors
                `}
                style={{ borderColor: getRarityColor(item.skin.rarity) }}
              >
                <div className="relative w-full h-24 mb-2">
                  {item.skin.imageUrl ? (
                    <Image
                      src={item.skin.imageUrl}
                      alt={item.skin.name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-dark-card rounded flex items-center justify-center">
                      <span className="text-2xl">🎁</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-center truncate">{item.skin.name}</p>
                <p className="text-emerald-400 text-center font-bold text-sm">
                  {formatCoins(item.coinValue)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Open Button */}
        <div className="mt-8 text-center">
          <button
            onClick={openCase}
            disabled={opening || !user || (user.balance < caseData.price)}
            className={`
              px-12 py-4 rounded-lg font-bold text-lg transition-all
              ${opening || !user || (user.balance < caseData.price)
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30'
              }
            `}
          >
            {opening ? 'Opening...' : `Open for ${formatCoins(caseData.price)} coins`}
          </button>
          {!user && (
            <p className="text-gray-400 mt-2 text-sm">Login to open cases</p>
          )}
        </div>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setResult(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-dark-card rounded-2xl p-8 text-center max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">You Won!</h2>
              <div
                className="w-48 h-48 mx-auto mb-4 rounded-lg p-4 border-2"
                style={{ borderColor: getRarityColor(result.item.skin.rarity) }}
              >
                {result.item.skin.imageUrl ? (
                  <Image
                    src={result.item.skin.imageUrl}
                    alt={result.item.skin.name}
                    width={160}
                    height={160}
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl">🎁</span>
                  </div>
                )}
              </div>
              <p className="text-lg mb-2">{result.item.skin.name}</p>
              <p className="text-3xl font-bold text-emerald-400 mb-6">
                +{formatCoins(result.coinValue)} coins
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setResult(null)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    openCase();
                  }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                >
                  Open Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Case Contents */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Case Contents</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {caseData.items
            .sort((a, b) => b.coinValue - a.coinValue)
            .map((item) => (
              <div
                key={item.id}
                className="bg-dark-card rounded-lg p-4 border-l-2"
                style={{ borderColor: getRarityColor(item.skin.rarity) }}
              >
                <div className="relative h-24 mb-3">
                  {item.skin.imageUrl ? (
                    <Image
                      src={item.skin.imageUrl}
                      alt={item.skin.name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-dark-lighter rounded flex items-center justify-center">
                      <span className="text-2xl">🎁</span>
                    </div>
                  )}
                </div>
                <p className="text-sm truncate mb-1">{item.skin.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">{formatCoins(item.coinValue)}</span>
                  <span className="text-xs text-gray-500">{item.oddsPercentage.toFixed(2)}%</span>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
