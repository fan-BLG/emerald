'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, useAnimation } from 'framer-motion';
import { cn, getRarityColor } from '@/lib/utils';

interface CaseItem {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  coinValue: number;
}

interface CaseSpinnerProps {
  items: CaseItem[];
  winningItem: CaseItem;
  onComplete: () => void;
  duration?: number;
  emeraldSpin?: boolean;
}

export function CaseSpinner({
  items,
  winningItem,
  onComplete,
  duration = 5000,
  emeraldSpin = false,
}: CaseSpinnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const [isSpinning, setIsSpinning] = useState(true);
  const [showEmeraldReveal, setShowEmeraldReveal] = useState(false);

  // Create a strip of items with the winning item at a specific position
  const ITEMS_COUNT = 50;
  const WINNING_POSITION = 42; // Position where winning item lands
  const ITEM_WIDTH = 140;

  const spinItems = Array.from({ length: ITEMS_COUNT }).map((_, i) => {
    if (i === WINNING_POSITION) {
      return winningItem;
    }
    return items[Math.floor(Math.random() * items.length)];
  });

  useEffect(() => {
    const startSpin = async () => {
      const targetPosition = -(WINNING_POSITION * ITEM_WIDTH - 280);

      // Start fast, decelerate at the end
      await controls.start({
        x: targetPosition + (Math.random() * 40 - 20), // Small random offset
        transition: {
          duration: duration / 1000,
          ease: [0.15, 0.85, 0.25, 1], // Custom easing for realistic deceleration
        },
      });

      setIsSpinning(false);

      // Check for emerald spin (high value item)
      if (emeraldSpin && winningItem.coinValue >= 500) {
        setShowEmeraldReveal(true);
        setTimeout(() => {
          setShowEmeraldReveal(false);
          onComplete();
        }, 2000);
      } else {
        setTimeout(onComplete, 500);
      }
    };

    startSpin();
  }, [controls, duration, emeraldSpin, onComplete, winningItem]);

  return (
    <div className="relative overflow-hidden">
      {/* Spin Container */}
      <div
        ref={containerRef}
        className="relative h-40 overflow-hidden"
      >
        {/* Gradient edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-dark-card to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-dark-card to-transparent z-10" />

        {/* Center indicator */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-500 z-20 -translate-x-1/2" />
        <div className="absolute left-1/2 top-0 w-4 h-4 bg-emerald-500 z-20 -translate-x-1/2 rotate-45 -translate-y-1/2" />

        {/* Items strip */}
        <motion.div
          animate={controls}
          className="flex items-center gap-2 px-[50%]"
        >
          {spinItems.map((item, index) => (
            <div
              key={index}
              className={cn(
                'flex-shrink-0 w-32 h-36 rounded-lg p-2 transition-all',
                !isSpinning && index === WINNING_POSITION && 'ring-2 ring-emerald-500 scale-105'
              )}
              style={{
                backgroundColor: getRarityColor(item.rarity) + '20',
                borderBottom: `3px solid ${getRarityColor(item.rarity)}`,
              }}
            >
              <div className="relative w-full h-20">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    🎁
                  </div>
                )}
              </div>
              <p className="text-xs text-center truncate mt-1">{item.name}</p>
              <p
                className="text-xs text-center font-bold"
                style={{ color: getRarityColor(item.rarity) }}
              >
                {item.coinValue}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Emerald Spin Reveal */}
      {showEmeraldReveal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-dark-card/95 z-30"
        >
          <div className="text-center">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 360],
              }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-32 h-32 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
            >
              <span className="text-6xl">💎</span>
            </motion.div>
            <h3 className="text-2xl font-bold text-emerald-400">EMERALD SPIN!</h3>
            <p className="text-gray-400">You won something special!</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
