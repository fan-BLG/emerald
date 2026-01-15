'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn, formatCoins, formatCompact } from '@/lib/utils';
import { Sparkles, Package } from 'lucide-react';

interface CaseCardProps {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  price: number;
  totalOpened?: number;
  isFeatured?: boolean;
  isCustom?: boolean;
  creatorName?: string;
  bestItem?: {
    name: string;
    imageUrl: string;
    rarity: string;
    value: number;
  };
}

export function CaseCard({
  slug,
  name,
  imageUrl,
  price,
  totalOpened,
  isFeatured,
  isCustom,
  creatorName,
  bestItem,
}: CaseCardProps) {
  return (
    <Link href={`/cases/${slug}`}>
      <motion.div
        whileHover={{ scale: 1.03, y: -4 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'relative bg-dark-card rounded-xl overflow-hidden cursor-pointer group',
          'border border-dark-border hover:border-emerald-500/50 transition-all duration-300',
          isFeatured && 'ring-2 ring-emerald-500/30'
        )}
      >
        {/* Featured Badge */}
        {isFeatured && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded text-xs text-emerald-400">
            <Sparkles className="w-3 h-3" />
            Featured
          </div>
        )}

        {/* Custom Badge */}
        {isCustom && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded text-xs text-purple-400">
            <Package className="w-3 h-3" />
            Custom
          </div>
        )}

        {/* Case Image */}
        <div className="relative aspect-square p-4 bg-gradient-to-b from-dark-lighter/50 to-transparent">
          <div className="relative w-full h-full group-hover:scale-105 transition-transform duration-300">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="object-contain drop-shadow-2xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-gray-600" />
              </div>
            )}
          </div>

          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors rounded-xl" />
        </div>

        {/* Info */}
        <div className="p-4 pt-0">
          <h3 className="font-semibold text-white mb-1 truncate">{name}</h3>

          {isCustom && creatorName && (
            <p className="text-xs text-gray-500 mb-2">by {creatorName}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-bold">{formatCoins(price)}</span>
            {totalOpened !== undefined && totalOpened > 0 && (
              <span className="text-xs text-gray-500">
                {formatCompact(totalOpened)} opened
              </span>
            )}
          </div>
        </div>

        {/* Best Item Preview (on hover) */}
        {bestItem && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileHover={{ opacity: 1, y: 0 }}
            className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-dark-base to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded bg-dark-lighter overflow-hidden">
                {bestItem.imageUrl && (
                  <Image
                    src={bestItem.imageUrl}
                    alt={bestItem.name}
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate">{bestItem.name}</p>
                <p className="text-sm font-bold text-gold">{formatCoins(bestItem.value)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </Link>
  );
}

// Skeleton for loading state
export function CaseCardSkeleton() {
  return (
    <div className="bg-dark-card rounded-xl overflow-hidden border border-dark-border animate-pulse">
      <div className="aspect-square bg-dark-lighter" />
      <div className="p-4">
        <div className="h-5 bg-dark-lighter rounded mb-2" />
        <div className="h-4 bg-dark-lighter rounded w-1/2" />
      </div>
    </div>
  );
}
