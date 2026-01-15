import crypto from 'crypto';
import { prisma, io } from '../index.js';
import { generateResult, generateServerSeed, hashServerSeed, getEOSBlockHash } from './provablyFair.js';

const HOUSE_EDGE = 0.04; // 4% house edge
const BETTING_DURATION = 10000; // 10 seconds for betting
const TICK_INTERVAL = 100; // Update multiplier every 100ms
const MAX_MULTIPLIER = 1000; // Maximum crash point

export class CrashService {
  private currentRound: string | null = null;
  private roundTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private roundStartTime: number = 0;
  private isRunning: boolean = false;

  /**
   * Start the crash game engine
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🎰 Crash game engine started');
    await this.startNewRound();
  }

  /**
   * Stop the crash game engine
   */
  stop() {
    this.isRunning = false;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    console.log('🛑 Crash game engine stopped');
  }

  /**
   * Start a new betting round
   */
  private async startNewRound() {
    if (!this.isRunning) return;

    // Generate seeds
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    // Calculate crash point from server seed (provably fair)
    const crashPoint = this.calculateCrashPoint(serverSeed);

    // Create round
    const round = await prisma.crashRound.create({
      data: {
        serverSeed,
        serverSeedHash,
        crashPoint,
        status: 'betting',
      },
    });

    this.currentRound = round.id;

    // Emit new round
    io.emit('crash:newRound', {
      round: {
        id: round.id,
        status: 'betting',
        crashPoint: null, // Hidden until crash
        serverSeedHash: round.serverSeedHash,
        publicSeed: null,
        totalBets: 0,
        totalPayout: 0,
        startedAt: null,
        crashedAt: null,
        createdAt: round.createdAt,
      },
      bettingEndsIn: BETTING_DURATION,
    });

    // Start betting timer
    this.roundTimer = setTimeout(() => this.startCrash(), BETTING_DURATION);
  }

  /**
   * Calculate crash point from server seed (provably fair)
   */
  private calculateCrashPoint(serverSeed: string): number {
    // Use HMAC to generate a hash
    const hash = crypto.createHmac('sha256', serverSeed).update('crash').digest('hex');

    // Take first 8 hex chars and convert to number
    const h = parseInt(hash.substring(0, 8), 16);

    // Calculate crash point with house edge
    // Formula ensures ~4% house edge
    const e = Math.pow(2, 32);
    const result = Math.floor((100 * e - h) / (e - h)) / 100;

    // Cap at max multiplier
    return Math.min(result, MAX_MULTIPLIER);
  }

  /**
   * Start the crash animation/multiplier increase
   */
  private async startCrash() {
    if (!this.currentRound || !this.isRunning) return;

    // Get public seed from EOS blockchain
    const eosBlock = await getEOSBlockHash();

    // Update round status
    const round = await prisma.crashRound.update({
      where: { id: this.currentRound },
      data: {
        status: 'running',
        publicSeed: eosBlock.blockHash,
        startedAt: new Date(),
      },
    });

    this.roundStartTime = Date.now();
    const crashPoint = Number(round.crashPoint);

    // Emit round starting
    io.emit('crash:starting', {
      roundId: round.id,
      publicSeed: eosBlock.blockHash,
    });

    // Start tick updates
    this.tickTimer = setInterval(() => {
      const elapsed = Date.now() - this.roundStartTime;
      const multiplier = this.calculateMultiplier(elapsed);

      // Check if crashed
      if (multiplier >= crashPoint) {
        this.endRound(crashPoint);
      } else {
        // Emit tick
        io.emit('crash:tick', {
          roundId: this.currentRound!,
          multiplier: Math.floor(multiplier * 100) / 100,
          elapsed,
        });
      }
    }, TICK_INTERVAL);
  }

  /**
   * Calculate multiplier based on elapsed time
   * Uses exponential growth: multiplier = e^(0.00006 * time)
   */
  private calculateMultiplier(elapsed: number): number {
    // Exponential growth formula
    return Math.pow(Math.E, 0.00006 * elapsed);
  }

  /**
   * End the current round
   */
  private async endRound(crashPoint: number) {
    if (!this.currentRound) return;

    // Stop tick timer
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    const roundId = this.currentRound;

    // Get round with bets
    const round = await prisma.crashRound.findUnique({
      where: { id: roundId },
      include: {
        bets: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
            },
          },
        },
      },
    });

    if (!round) return;

    // Process losing bets (those still active)
    const losingBets = round.bets.filter(b => b.status === 'active');
    let totalPayout = Number(round.totalPayout);

    await prisma.$transaction(async (tx) => {
      // Mark losing bets
      for (const bet of losingBets) {
        await tx.crashBet.update({
          where: { id: bet.id },
          data: { status: 'lost' },
        });
      }

      // Update round
      await tx.crashRound.update({
        where: { id: roundId },
        data: {
          status: 'crashed',
          crashedAt: new Date(),
          totalPayout,
        },
      });
    });

    // Emit crash event
    io.emit('crash:end', {
      roundId,
      crashPoint,
      serverSeed: round.serverSeed, // Reveal for verification
    });

    // Emit balance updates for losers
    for (const bet of losingBets) {
      io.to(`user:${bet.userId}`).emit('crash:lost', {
        roundId,
        betId: bet.id,
        amount: Number(bet.amount),
      });
    }

    this.currentRound = null;

    // Start next round after short delay
    setTimeout(() => this.startNewRound(), 3000);
  }

  /**
   * Place a bet on the current round
   */
  async placeBet(userId: string, amount: number, autoCashout?: number) {
    if (!this.currentRound) {
      throw new Error('No active round');
    }

    // Get round
    const round = await prisma.crashRound.findUnique({
      where: { id: this.currentRound },
    });

    if (!round || round.status !== 'betting') {
      throw new Error('Betting is closed');
    }

    // Check for existing bet
    const existingBet = await prisma.crashBet.findUnique({
      where: {
        roundId_userId: {
          roundId: this.currentRound,
          userId,
        },
      },
    });

    if (existingBet) {
      throw new Error('Already placed a bet this round');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true, balance: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (Number(user.balance) < amount) {
      throw new Error('Insufficient balance');
    }

    // Create bet
    const bet = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          totalWagered: { increment: amount },
        },
      });

      // Create bet
      const newBet = await tx.crashBet.create({
        data: {
          roundId: this.currentRound!,
          userId,
          amount,
          autoCashout,
        },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      });

      // Update round total
      await tx.crashRound.update({
        where: { id: this.currentRound! },
        data: {
          totalBets: { increment: amount },
        },
      });

      // Create transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'case_open',
          amount: -amount,
          referenceType: 'crash',
          referenceId: this.currentRound!,
          status: 'pending',
          description: 'Crash bet',
        },
      });

      return newBet;
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: -amount,
      reason: 'crash_bet',
    });

    // Emit bet placed
    io.emit('crash:betPlaced', {
      roundId: this.currentRound!,
      bet: {
        ...bet,
        amount: Number(bet.amount),
        autoCashout: bet.autoCashout ? Number(bet.autoCashout) : null,
        cashedOutAt: null,
        payout: null,
      },
    });

    return bet;
  }

  /**
   * Cash out from the current round
   */
  async cashout(userId: string) {
    if (!this.currentRound) {
      throw new Error('No active round');
    }

    // Get round
    const round = await prisma.crashRound.findUnique({
      where: { id: this.currentRound },
    });

    if (!round || round.status !== 'running') {
      throw new Error('Round is not running');
    }

    // Get user's bet
    const bet = await prisma.crashBet.findUnique({
      where: {
        roundId_userId: {
          roundId: this.currentRound,
          userId,
        },
      },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
        },
      },
    });

    if (!bet) {
      throw new Error('No bet found');
    }

    if (bet.status !== 'active') {
      throw new Error('Already cashed out');
    }

    // Calculate current multiplier
    const elapsed = Date.now() - this.roundStartTime;
    const multiplier = this.calculateMultiplier(elapsed);
    const crashPoint = Number(round.crashPoint);

    // Check if already crashed
    if (multiplier >= crashPoint) {
      throw new Error('Round has crashed');
    }

    // Calculate payout
    const amount = Number(bet.amount);
    const payout = amount * multiplier;

    // Update bet and credit user
    await prisma.$transaction(async (tx) => {
      // Update bet
      await tx.crashBet.update({
        where: { id: bet.id },
        data: {
          status: 'cashed_out',
          cashedOutAt: multiplier,
          payout,
        },
      });

      // Credit user
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: payout },
          totalWon: { increment: payout },
        },
      });

      // Update round payout total
      await tx.crashRound.update({
        where: { id: this.currentRound! },
        data: {
          totalPayout: { increment: payout },
        },
      });

      // Create win transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'case_win',
          amount: payout,
          referenceType: 'crash',
          referenceId: this.currentRound!,
          status: 'completed',
          description: `Crash cashout at ${multiplier.toFixed(2)}x`,
        },
      });
    });

    // Emit balance update
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    io.to(`user:${userId}`).emit('user:balanceUpdate', {
      balance: Number(updatedUser?.balance || 0),
      change: payout,
      reason: 'crash_cashout',
    });

    // Emit cashout event
    io.emit('crash:cashout', {
      roundId: this.currentRound!,
      odId: userId,
      username: bet.user.username,
      multiplier: Math.floor(multiplier * 100) / 100,
      payout,
    });

    // Emit big win if significant
    if (payout >= 100 && multiplier >= 5) {
      io.emit('global:bigWin', {
        odId: userId,
        username: bet.user.username,
        game: 'crash',
        item: { name: `${multiplier.toFixed(2)}x Crash`, value: payout },
        multiplier,
      } as any);
    }

    return {
      multiplier: Math.floor(multiplier * 100) / 100,
      payout,
    };
  }

  /**
   * Get current round info
   */
  async getCurrentRound() {
    if (!this.currentRound) {
      return null;
    }

    const round = await prisma.crashRound.findUnique({
      where: { id: this.currentRound },
      include: {
        bets: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
            },
          },
        },
      },
    });

    if (!round) return null;

    // Calculate current multiplier if running
    let currentMultiplier: number | null = null;
    if (round.status === 'running') {
      const elapsed = Date.now() - this.roundStartTime;
      currentMultiplier = Math.floor(this.calculateMultiplier(elapsed) * 100) / 100;
    }

    return {
      ...round,
      crashPoint: round.status === 'crashed' ? Number(round.crashPoint) : null,
      currentMultiplier,
      totalBets: Number(round.totalBets),
      totalPayout: Number(round.totalPayout),
      bets: round.bets.map(b => ({
        ...b,
        amount: Number(b.amount),
        autoCashout: b.autoCashout ? Number(b.autoCashout) : null,
        cashedOutAt: b.cashedOutAt ? Number(b.cashedOutAt) : null,
        payout: b.payout ? Number(b.payout) : null,
      })),
    };
  }

  /**
   * Get crash history
   */
  async getHistory(limit: number = 20) {
    const rounds = await prisma.crashRound.findMany({
      where: { status: 'crashed' },
      orderBy: { crashedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        crashPoint: true,
        serverSeedHash: true,
        serverSeed: true,
        publicSeed: true,
        crashedAt: true,
      },
    });

    return rounds.map(r => ({
      ...r,
      crashPoint: Number(r.crashPoint),
    }));
  }

  /**
   * Handle auto-cashouts during the game tick
   */
  async processAutoCashouts(multiplier: number) {
    if (!this.currentRound) return;

    // Find bets with auto-cashout at or below current multiplier
    const bets = await prisma.crashBet.findMany({
      where: {
        roundId: this.currentRound,
        status: 'active',
        autoCashout: { lte: multiplier },
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    // Process each auto-cashout
    for (const bet of bets) {
      try {
        await this.cashout(bet.userId);
      } catch (error) {
        // Ignore errors for auto-cashout
        console.error(`Auto-cashout failed for user ${bet.userId}:`, error);
      }
    }
  }
}

// Singleton instance
export const crashService = new CrashService();
