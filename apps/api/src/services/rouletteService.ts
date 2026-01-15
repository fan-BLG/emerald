import crypto from 'crypto';
import { prisma, io } from '../index.js';
import { generateResult, generateServerSeed, hashServerSeed, getEOSBlockHash } from './provablyFair.js';

// Roulette configuration
const BETTING_DURATION = 15000; // 15 seconds for betting
const SPIN_DURATION = 5000; // 5 seconds for spin animation
const RESULT_DISPLAY_DURATION = 3000; // 3 seconds to show result

// Colors: 0 = green, 1-7 = red, 8-14 = black
const COLORS: Record<number, 'red' | 'black' | 'green'> = {
  0: 'green',
  1: 'red', 2: 'red', 3: 'red', 4: 'red', 5: 'red', 6: 'red', 7: 'red',
  8: 'black', 9: 'black', 10: 'black', 11: 'black', 12: 'black', 13: 'black', 14: 'black',
};

const MULTIPLIERS: Record<string, number> = {
  green: 14,
  red: 2,
  black: 2,
};

export class RouletteService {
  private currentRound: string | null = null;
  private roundTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start the roulette game engine
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🎡 Roulette game engine started');
    await this.startNewRound();
  }

  /**
   * Stop the roulette game engine
   */
  stop() {
    this.isRunning = false;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    console.log('🛑 Roulette game engine stopped');
  }

  /**
   * Start a new betting round
   */
  private async startNewRound() {
    if (!this.isRunning) return;

    // Generate seeds
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    // Create round
    const round = await prisma.rouletteRound.create({
      data: {
        serverSeed,
        serverSeedHash,
        status: 'betting',
        bettingEndsAt: new Date(Date.now() + BETTING_DURATION),
      },
    });

    this.currentRound = round.id;

    // Emit new round
    io.emit('roulette:newRound', {
      round: {
        id: round.id,
        status: 'betting',
        result: null,
        serverSeedHash: round.serverSeedHash,
        publicSeed: null,
        rollValue: null,
        totalBets: 0,
        totalPayout: 0,
        bettingEndsAt: round.bettingEndsAt,
        spinStartedAt: null,
        finishedAt: null,
        createdAt: round.createdAt,
      },
      bettingEndsIn: BETTING_DURATION,
    });

    // Start betting timer
    this.roundTimer = setTimeout(() => this.startSpin(), BETTING_DURATION);
  }

  /**
   * Start the spin animation
   */
  private async startSpin() {
    if (!this.currentRound || !this.isRunning) return;

    // Get public seed from EOS blockchain
    const eosBlock = await getEOSBlockHash();

    // Get round with server seed
    const round = await prisma.rouletteRound.findUnique({
      where: { id: this.currentRound },
    });

    if (!round) return;

    // Calculate result using provably fair
    const result = generateResult(round.serverSeed, eosBlock.blockHash, 'roulette', 0);

    // Map roll value to 0-14
    const resultNumber = Math.floor(result.rollValue * 15);
    const resultColor = COLORS[resultNumber];

    // Update round
    await prisma.rouletteRound.update({
      where: { id: this.currentRound },
      data: {
        status: 'spinning',
        publicSeed: eosBlock.blockHash,
        rollValue: result.rollValue,
        result: resultNumber,
        spinStartedAt: new Date(),
      },
    });

    // Emit spin event
    io.emit('roulette:spin', {
      roundId: this.currentRound,
      duration: SPIN_DURATION,
    });

    // Wait for spin animation then show result
    this.roundTimer = setTimeout(() => this.showResult(resultNumber, resultColor), SPIN_DURATION);
  }

  /**
   * Show result and process payouts
   */
  private async showResult(resultNumber: number, resultColor: 'red' | 'black' | 'green') {
    if (!this.currentRound || !this.isRunning) return;

    const roundId = this.currentRound;

    // Get round with bets
    const round = await prisma.rouletteRound.findUnique({
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

    // Process bets
    const winners: { odId: string; username: string; payout: number }[] = [];
    let totalPayout = 0;

    await prisma.$transaction(async (tx) => {
      for (const bet of round.bets) {
        const won = bet.betType === resultColor;
        const payout = won ? Number(bet.amount) * MULTIPLIERS[bet.betType] : 0;

        if (won) {
          totalPayout += payout;
          winners.push({
            odId: bet.userId,
            username: bet.user.username,
            payout,
          });

          // Credit winner
          await tx.user.update({
            where: { id: bet.userId },
            data: {
              balance: { increment: payout },
              totalWon: { increment: payout },
            },
          });

          // Create win transaction
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: 'case_win',
              amount: payout,
              referenceType: 'roulette',
              referenceId: roundId,
              status: 'completed',
              description: `Roulette win - ${resultColor}`,
            },
          });
        }

        // Update bet
        await tx.rouletteBet.update({
          where: { id: bet.id },
          data: {
            won,
            payout: won ? payout : 0,
          },
        });
      }

      // Mark bet transactions as completed
      await tx.transaction.updateMany({
        where: {
          referenceType: 'roulette',
          referenceId: roundId,
          type: 'case_open',
        },
        data: { status: 'completed' },
      });

      // Update round
      await tx.rouletteRound.update({
        where: { id: roundId },
        data: {
          status: 'finished',
          totalPayout,
          finishedAt: new Date(),
        },
      });
    });

    // Emit balance updates to winners
    for (const winner of winners) {
      const user = await prisma.user.findUnique({
        where: { id: winner.odId },
        select: { balance: true },
      });

      io.to(`user:${winner.odId}`).emit('user:balanceUpdate', {
        balance: Number(user?.balance || 0),
        change: winner.payout,
        reason: 'roulette_win',
      });
    }

    // Emit result event
    io.emit('roulette:result', {
      roundId,
      result: resultNumber,
      color: resultColor,
      serverSeed: round.serverSeed, // Reveal for verification
      winners,
    });

    // Emit big wins
    for (const winner of winners) {
      if (winner.payout >= 100) {
        io.emit('global:bigWin', {
          odId: winner.odId,
          username: winner.username,
          game: 'roulette',
          item: { name: `${resultColor.toUpperCase()} ${resultNumber}`, value: winner.payout },
          multiplier: MULTIPLIERS[resultColor],
        } as any);
      }
    }

    this.currentRound = null;

    // Start next round after delay
    this.roundTimer = setTimeout(() => this.startNewRound(), RESULT_DISPLAY_DURATION);
  }

  /**
   * Place a bet on the current round
   */
  async placeBet(userId: string, betType: 'red' | 'black' | 'green', amount: number) {
    if (!this.currentRound) {
      throw new Error('No active round');
    }

    // Get round
    const round = await prisma.rouletteRound.findUnique({
      where: { id: this.currentRound },
    });

    if (!round || round.status !== 'betting') {
      throw new Error('Betting is closed');
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
      const newBet = await tx.rouletteBet.create({
        data: {
          roundId: this.currentRound!,
          userId,
          betType,
          amount,
        },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true },
          },
        },
      });

      // Update round total
      await tx.rouletteRound.update({
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
          referenceType: 'roulette',
          referenceId: this.currentRound!,
          status: 'pending',
          description: `Roulette bet - ${betType}`,
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
      reason: 'roulette_bet',
    });

    // Get current totals
    const totals = await this.getRoundTotals(this.currentRound!);

    // Emit bet placed
    io.emit('roulette:betPlaced', {
      roundId: this.currentRound!,
      bet: {
        ...bet,
        amount: Number(bet.amount),
        won: null,
        payout: null,
      },
      totals,
    });

    return bet;
  }

  /**
   * Get totals for each color in a round
   */
  private async getRoundTotals(roundId: string) {
    const bets = await prisma.rouletteBet.findMany({
      where: { roundId },
    });

    return {
      red: bets.filter(b => b.betType === 'red').reduce((sum, b) => sum + Number(b.amount), 0),
      black: bets.filter(b => b.betType === 'black').reduce((sum, b) => sum + Number(b.amount), 0),
      green: bets.filter(b => b.betType === 'green').reduce((sum, b) => sum + Number(b.amount), 0),
    };
  }

  /**
   * Get current round info
   */
  async getCurrentRound() {
    if (!this.currentRound) {
      return null;
    }

    const round = await prisma.rouletteRound.findUnique({
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

    const totals = await this.getRoundTotals(round.id);

    return {
      ...round,
      result: round.status === 'finished' ? round.result : null,
      rollValue: round.rollValue ? Number(round.rollValue) : null,
      totalBets: Number(round.totalBets),
      totalPayout: Number(round.totalPayout),
      totals,
      bets: round.bets.map(b => ({
        ...b,
        amount: Number(b.amount),
        payout: b.payout ? Number(b.payout) : null,
      })),
    };
  }

  /**
   * Get roulette history
   */
  async getHistory(limit: number = 20) {
    const rounds = await prisma.rouletteRound.findMany({
      where: { status: 'finished' },
      orderBy: { finishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        result: true,
        serverSeedHash: true,
        serverSeed: true,
        publicSeed: true,
        rollValue: true,
        finishedAt: true,
      },
    });

    return rounds.map(r => ({
      ...r,
      color: r.result !== null ? COLORS[r.result] : null,
      rollValue: r.rollValue ? Number(r.rollValue) : null,
    }));
  }
}

// Singleton instance
export const rouletteService = new RouletteService();
