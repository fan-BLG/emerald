import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SkinRarity, VipTier } from '@emerald/shared';

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format coins (main currency)
export function formatCoins(amount: number): string {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(2) + 'M';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(2) + 'K';
  }
  if (amount < 1) {
    return amount.toFixed(2);
  }
  return amount.toFixed(2).replace(/\.00$/, '');
}

// Format number as currency
export function formatCurrency(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// Format number with K, M suffixes
export function formatCompact(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Get rarity color
export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    consumer: '#b0c3d9',
    industrial: '#5e98d9',
    milspec: '#4b69ff',
    restricted: '#8847ff',
    classified: '#d32ce6',
    covert: '#eb4b4b',
    contraband: '#e4ae39',
  };
  return colors[rarity] || '#b0c3d9';
}

// Get rarity class name
export function getRarityClassName(rarity: string): string {
  return `border-rarity-${rarity} bg-rarity-${rarity}`;
}

// Get VIP tier color
export function getVipTierColor(tier: VipTier): string {
  const colors: Record<VipTier, string> = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2',
    diamond: '#b9f2ff',
    emerald: '#00ff7f',
  };
  return colors[tier];
}

// Format time ago
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return past.toLocaleDateString();
}

// Generate random string
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate odds percentage
export function calculateOddsPercentage(oddsWeight: number, totalWeight: number): number {
  return (oddsWeight / totalWeight) * 100;
}

// Format odds as "1 in X"
export function formatOdds(percentage: number): string {
  if (percentage >= 1) {
    return `1 in ${Math.round(100 / percentage)}`;
  }
  return `1 in ${Math.round(100 / percentage)}`;
}

// Get battle type display name
export function getBattleTypeDisplayName(type: string): string {
  const names: Record<string, string> = {
    standard: 'Standard',
    team: 'Team',
    shared: 'Shared',
  };
  return names[type] || type;
}

// Get battle mode display name
export function getBattleModeDisplayName(mode: string): string {
  const names: Record<string, string> = {
    normal: 'Normal',
    crazy: 'Crazy',
    cursed: 'Cursed',
    progressive: 'Progressive',
    mystery: 'Mystery',
  };
  return names[mode] || mode;
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
