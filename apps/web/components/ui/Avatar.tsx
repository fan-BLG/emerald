'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: string;
  showOnline?: boolean;
  isOnline?: boolean;
}

const sizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const onlineDotSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

export function Avatar({
  src,
  alt,
  size = 'md',
  className,
  fallback,
  showOnline = false,
  isOnline = false,
}: AvatarProps) {
  const initials = fallback || alt.slice(0, 2).toUpperCase();

  return (
    <div className={cn('relative inline-flex', sizes[size], className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="rounded-full object-cover"
        />
      ) : (
        <div
          className={cn(
            'w-full h-full rounded-full bg-dark-lighter flex items-center justify-center',
            'text-gray-400 font-medium'
          )}
        >
          <span className={size === 'xs' || size === 'sm' ? 'text-xs' : 'text-sm'}>
            {initials}
          </span>
        </div>
      )}
      {showOnline && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-dark-card',
            onlineDotSizes[size],
            isOnline ? 'bg-emerald-500' : 'bg-gray-500'
          )}
        />
      )}
    </div>
  );
}

// User avatar with level badge
interface UserAvatarProps extends AvatarProps {
  level?: number;
  vipTier?: string;
}

export function UserAvatar({ level, vipTier, ...props }: UserAvatarProps) {
  return (
    <div className="relative inline-flex">
      <Avatar {...props} />
      {level && (
        <span
          className={cn(
            'absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 rounded-full',
            'bg-dark-card border border-dark-border text-xs font-bold',
            'flex items-center justify-center',
            vipTier === 'emerald' && 'border-emerald-500 text-emerald-400',
            vipTier === 'diamond' && 'border-cyan-400 text-cyan-400',
            vipTier === 'platinum' && 'border-gray-300 text-gray-300',
            vipTier === 'gold' && 'border-yellow-400 text-yellow-400'
          )}
        >
          {level}
        </span>
      )}
    </div>
  );
}
