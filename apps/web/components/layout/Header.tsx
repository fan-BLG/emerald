'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Wallet,
  LogOut,
  Settings,
  User,
  Gamepad2,
  Swords,
  Package,
  CircleDot,
  Coins,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn, formatCurrency, getVipTierColor } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isGamesOpen, setIsGamesOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  const games = [
    { name: 'Case Battles', href: '/battles', icon: Swords, highlight: true },
    { name: 'Cases', href: '/cases', icon: Package },
    { name: 'Roulette', href: '/roulette', icon: CircleDot },
    { name: 'Coinflip', href: '/coinflip', icon: Coins },
    { name: 'Crash', href: '/crash', icon: TrendingUp },
  ];

  return (
    <header className="h-16 bg-dark-card border-b border-dark-border px-4 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <span className="text-xl font-bold gradient-emerald-text">EMERALD</span>
        </Link>

        {/* Games Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsGamesOpen(!isGamesOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-dark-hover transition-colors"
          >
            <Gamepad2 className="w-5 h-5" />
            <span>Games</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', isGamesOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {isGamesOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsGamesOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden"
                >
                  {games.map((game) => (
                    <Link
                      key={game.name}
                      href={game.href}
                      onClick={() => setIsGamesOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 hover:bg-dark-hover transition-colors',
                        game.highlight && 'bg-emerald-600/10 border-l-2 border-emerald-600'
                      )}
                    >
                      <game.icon className={cn('w-5 h-5', game.highlight && 'text-emerald-500')} />
                      <span className={cn(game.highlight && 'text-emerald-400 font-medium')}>
                        {game.name}
                      </span>
                    </Link>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Links */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/rewards"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Rewards
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Leaderboard
          </Link>
        </nav>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {isAuthenticated && user ? (
          <>
            {/* Balance */}
            <div className="flex items-center gap-2 bg-dark-base px-4 py-2 rounded-lg border border-dark-border">
              <Coins className="w-4 h-4 text-gold" />
              <span className="font-medium text-gold">{formatCurrency(user.balance)}</span>
            </div>

            {/* Withdraw Button */}
            <Link
              href="/withdraw"
              className="btn btn-secondary hidden sm:flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Withdraw
            </Link>

            {/* Deposit Button */}
            <Link
              href="/deposit"
              className="btn btn-primary flex items-center gap-2"
            >
              <span>Deposit</span>
            </Link>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserOpen(!isUserOpen)}
                className="flex items-center gap-2 p-1 rounded hover:bg-dark-hover transition-colors"
              >
                <img
                  src={user.avatarUrl || '/default-avatar.png'}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
                <ChevronDown className={cn('w-4 h-4 transition-transform', isUserOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {isUserOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full right-0 mt-2 w-56 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden"
                    >
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-dark-border">
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-gray-400 flex items-center gap-1">
                          Level {user.level}
                          <span
                            className="ml-1 px-1.5 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: `${getVipTierColor(user.vipTier)}20`,
                              color: getVipTierColor(user.vipTier),
                            }}
                          >
                            {user.vipTier.toUpperCase()}
                          </span>
                        </p>
                      </div>

                      {/* Menu Items */}
                      <Link
                        href={`/user/${user.id}`}
                        onClick={() => setIsUserOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-dark-hover transition-colors"
                      >
                        <User className="w-5 h-5" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setIsUserOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-dark-hover transition-colors"
                      >
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setIsUserOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-hover transition-colors text-lose"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <a
            href={`${API_URL}/api/auth/steam`}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z" />
            </svg>
            <span>Sign in with Steam</span>
          </a>
        )}
      </div>
    </header>
  );
}
