'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { formatCoins, getRarityColor } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Target, Zap } from 'lucide-react';

interface UpgradeItem {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  value: number;
}

export default function UpgradePage() {
  const { user, updateBalance } = useAuthStore();
  const [fromItem, setFromItem] = useState<UpgradeItem | null>(null);
  const [toItem, setToItem] = useState<UpgradeItem | null>(null);
  const [items, setItems] = useState<UpgradeItem[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [result, setResult] = useState<{ won: boolean; item?: UpgradeItem } | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  useEffect(() => {
    // Fetch available items for upgrade
    api.get<{ items: UpgradeItem[] }>('/cases/upgrade-items').then((res) => {
      if (res.success && res.data) {
        setItems(res.data.items);
      } else {
        // Mock data for demo
        setItems([
          { id: '1', name: 'AK-47 | Redline', imageUrl: '', rarity: 'classified', value: 30 },
          { id: '2', name: 'AWP | Asiimov', imageUrl: '', rarity: 'covert', value: 100 },
          { id: '3', name: 'M4A4 | Howl', imageUrl: '', rarity: 'contraband', value: 3000 },
          { id: '4', name: 'Karambit | Fade', imageUrl: '', rarity: 'covert', value: 2500 },
          { id: '5', name: 'AWP | Dragon Lore', imageUrl: '', rarity: 'covert', value: 2000 },
          { id: '6', name: 'USP-S | Kill Confirmed', imageUrl: '', rarity: 'covert', value: 80 },
          { id: '7', name: 'Desert Eagle | Blaze', imageUrl: '', rarity: 'covert', value: 400 },
          { id: '8', name: 'Glock-18 | Fade', imageUrl: '', rarity: 'covert', value: 800 },
        ]);
      }
    });
  }, []);

  const winChance = fromItem && toItem
    ? Math.min(95, Math.max(5, (fromItem.value / toItem.value) * 100))
    : 0;

  const multiplier = toItem && fromItem ? (toItem.value / fromItem.value) : 0;

  const upgrade = async () => {
    if (!fromItem || !toItem || upgrading || !user) return;

    setUpgrading(true);
    setResult(null);

    // Simulate upgrade animation
    await new Promise(resolve => setTimeout(resolve, 3000));

    const won = Math.random() * 100 < winChance;

    setResult({
      won,
      item: won ? toItem : undefined,
    });

    if (won) {
      updateBalance(user.balance - fromItem.value + toItem.value);
    } else {
      updateBalance(user.balance - fromItem.value);
    }

    setUpgrading(false);
  };

  const availableFromItems = items.filter(i => !toItem || i.value < toItem.value);
  const availableToItems = items.filter(i => !fromItem || i.value > fromItem.value);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/20 rounded-full mb-4">
          <TrendingUp size={40} className="text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Upgrader</h1>
        <p className="text-gray-400">Risk a skin for a chance at something better!</p>
      </div>

      {/* Upgrade Arena */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-5 gap-4 items-center mb-8">
          {/* From Item */}
          <div className="col-span-2">
            <button
              onClick={() => setShowFromPicker(true)}
              className="w-full bg-dark-card rounded-xl p-6 border-2 border-dashed border-dark-lighter hover:border-emerald-500/50 transition-colors"
            >
              {fromItem ? (
                <div className="text-center">
                  <div
                    className="w-32 h-32 mx-auto mb-3 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: getRarityColor(fromItem.rarity) + '20' }}
                  >
                    {fromItem.imageUrl ? (
                      <Image src={fromItem.imageUrl} alt={fromItem.name} width={120} height={120} className="object-contain" />
                    ) : (
                      <span className="text-4xl">🎁</span>
                    )}
                  </div>
                  <p className="font-semibold truncate">{fromItem.name}</p>
                  <p className="text-emerald-400 font-bold">{formatCoins(fromItem.value)}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-dark-lighter rounded-full flex items-center justify-center mx-auto mb-3">
                    <Target size={24} className="text-gray-500" />
                  </div>
                  <p className="text-gray-400">Select Item to Upgrade</p>
                </div>
              )}
            </button>
          </div>

          {/* Arrow / Chance */}
          <div className="col-span-1 text-center">
            <motion.div
              animate={upgrading ? { scale: [1, 1.2, 1], rotate: [0, 360] } : {}}
              transition={{ duration: 1, repeat: upgrading ? Infinity : 0 }}
              className="relative"
            >
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                winChance > 50 ? 'bg-emerald-500/20' : winChance > 25 ? 'bg-yellow-500/20' : 'bg-red-500/20'
              }`}>
                <span className={`text-2xl font-bold ${
                  winChance > 50 ? 'text-emerald-400' : winChance > 25 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {winChance.toFixed(1)}%
                </span>
              </div>
            </motion.div>
            {multiplier > 0 && (
              <p className="text-sm text-gray-400 mt-2">{multiplier.toFixed(2)}x</p>
            )}
          </div>

          {/* To Item */}
          <div className="col-span-2">
            <button
              onClick={() => setShowToPicker(true)}
              className="w-full bg-dark-card rounded-xl p-6 border-2 border-dashed border-dark-lighter hover:border-purple-500/50 transition-colors"
            >
              {toItem ? (
                <div className="text-center">
                  <div
                    className="w-32 h-32 mx-auto mb-3 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: getRarityColor(toItem.rarity) + '20' }}
                  >
                    {toItem.imageUrl ? (
                      <Image src={toItem.imageUrl} alt={toItem.name} width={120} height={120} className="object-contain" />
                    ) : (
                      <span className="text-4xl">🎁</span>
                    )}
                  </div>
                  <p className="font-semibold truncate">{toItem.name}</p>
                  <p className="text-purple-400 font-bold">{formatCoins(toItem.value)}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-dark-lighter rounded-full flex items-center justify-center mx-auto mb-3">
                    <Zap size={24} className="text-gray-500" />
                  </div>
                  <p className="text-gray-400">Select Target Item</p>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Upgrade Button */}
        <div className="text-center">
          <button
            onClick={upgrade}
            disabled={!fromItem || !toItem || upgrading || !user}
            className={`px-12 py-4 rounded-xl font-bold text-lg transition-all ${
              !fromItem || !toItem || upgrading || !user
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 shadow-lg hover:shadow-purple-500/30'
            }`}
          >
            {upgrading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Upgrading...
              </span>
            ) : (
              `Upgrade (${winChance.toFixed(1)}% chance)`
            )}
          </button>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`mt-8 p-8 rounded-xl text-center ${
                result.won
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
              }`}
            >
              <h2 className={`text-3xl font-bold mb-4 ${result.won ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.won ? 'Upgrade Success!' : 'Upgrade Failed'}
              </h2>
              {result.won && result.item ? (
                <div>
                  <p className="text-lg mb-2">You received:</p>
                  <p className="text-2xl font-bold">{result.item.name}</p>
                  <p className="text-emerald-400 text-xl">+{formatCoins(result.item.value - (fromItem?.value || 0))}</p>
                </div>
              ) : (
                <p className="text-red-400">You lost {fromItem?.name}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Item Picker Modals */}
      <AnimatePresence>
        {showFromPicker && (
          <ItemPicker
            title="Select Item to Upgrade"
            items={availableFromItems}
            onSelect={(item) => {
              setFromItem(item);
              setShowFromPicker(false);
            }}
            onClose={() => setShowFromPicker(false)}
          />
        )}
        {showToPicker && (
          <ItemPicker
            title="Select Target Item"
            items={availableToItems}
            onSelect={(item) => {
              setToItem(item);
              setShowToPicker(false);
            }}
            onClose={() => setShowToPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemPicker({
  title,
  items,
  onSelect,
  onClose,
}: {
  title: string;
  items: UpgradeItem[];
  onSelect: (item: UpgradeItem) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-dark-card rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="bg-dark-lighter rounded-lg p-3 hover:bg-dark-card transition-colors text-left"
            >
              <div
                className="aspect-square rounded-lg mb-2 flex items-center justify-center"
                style={{ backgroundColor: getRarityColor(item.rarity) + '20' }}
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} width={80} height={80} className="object-contain" />
                ) : (
                  <span className="text-3xl">🎁</span>
                )}
              </div>
              <p className="text-sm truncate">{item.name}</p>
              <p className="text-emerald-400 font-bold">{formatCoins(item.value)}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
