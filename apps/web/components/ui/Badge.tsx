'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'rarity';
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
  style,
}: BadgeProps) {
  const variants = {
    default: 'bg-dark-lighter text-gray-300',
    success: 'bg-emerald-500/20 text-emerald-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
    rarity: '', // Custom color via style prop
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded',
        variants[variant],
        sizes[size],
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}

// Rarity badge specifically for CS2 skins
interface RarityBadgeProps {
  rarity: string;
  size?: 'sm' | 'md';
  className?: string;
}

const rarityColors: Record<string, { bg: string; text: string }> = {
  consumer: { bg: 'rgba(176, 195, 217, 0.2)', text: '#b0c3d9' },
  industrial: { bg: 'rgba(94, 152, 217, 0.2)', text: '#5e98d9' },
  milspec: { bg: 'rgba(75, 105, 255, 0.2)', text: '#4b69ff' },
  restricted: { bg: 'rgba(136, 71, 255, 0.2)', text: '#8847ff' },
  classified: { bg: 'rgba(211, 44, 230, 0.2)', text: '#d32ce6' },
  covert: { bg: 'rgba(235, 75, 75, 0.2)', text: '#eb4b4b' },
  contraband: { bg: 'rgba(228, 174, 57, 0.2)', text: '#e4ae39' },
};

const rarityNames: Record<string, string> = {
  consumer: 'Consumer',
  industrial: 'Industrial',
  milspec: 'Mil-Spec',
  restricted: 'Restricted',
  classified: 'Classified',
  covert: 'Covert',
  contraband: 'Contraband',
};

export function RarityBadge({ rarity, size = 'sm', className }: RarityBadgeProps) {
  const colors = rarityColors[rarity] || { bg: 'rgba(128, 128, 128, 0.2)', text: '#808080' };

  return (
    <Badge
      variant="rarity"
      size={size}
      className={className}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {rarityNames[rarity] || rarity}
    </Badge>
  );
}
