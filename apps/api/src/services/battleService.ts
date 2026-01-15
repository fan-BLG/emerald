import { prisma, io } from '../index.js';
import {
  generateResult,
  rollToItem,
  calculateCumulativeOdds,
  getEOSBlockHash,
  shouldTriggerEmeraldSpin,
} from './provablyFair.js';

export class BattleService {
  private activeBattles: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Starts a battle after all players have joined.
   */
  async startBattle(battleId: string): Promise<void> {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true, clientSeed: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        cases: {
          include: {
            case: {
              include: {
                items: {
                  include: { skin: true },
                },
              },
            },
          },
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!battle || battle.status !== 'waiting') {
      console.error(`Battle ${battleId} not found or not in waiting state`);
      return;
    }

    // Get EOS block hash for public seed
    const eosBlock = await getEOSBlockHash();
    const publicSeed = eosBlock.blockHash;

    // Update battle status to starting
    await prisma.battle.update({
      where: { id: battleId },
      data: {
        status: 'starting',
        publicSeed,
        startedAt: new Date(),
      },
    });

    // Emit starting event with countdown
    io.to(`battle:${battleId}`).emit('battle:starting', {
      battleId,
      countdown: 3,
      publicSeed,
    });

    // Also emit to global for battle list updates
    io.emit('battle:starting', {
      battleId,
      countdown: 3,
      publicSeed,
    });

    // Wait for countdown then start rounds
    setTimeout(async () => {
      await this.runBattleRounds(battleId);
    }, 3000);
  }

  /**
   * Runs all rounds of a battle.
   */
  private async runBattleRounds(battleId: string): Promise<void> {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, level: true, vipTier: true, clientSeed: true, emeraldSpinEnabled: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        cases: {
          include: {
            case: {
              include: {
                items: {
                  include: { skin: true },
                  orderBy: { oddsWeight: 'desc' },
                },
              },
            },
          },
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!battle || battle.status === 'cancelled') {
      console.error(`Battle ${battleId} not found or cancelled`);
      return;
    }

    // Update status to in_progress
    await prisma.battle.update({
      where: { id: battleId },
      data: { status: 'in_progress' },
    });

    const roundDelay = battle.isFastMode ? 2000 : 5000;
    const playerScores: Map<string, number> = new Map();

    // Initialize scores
    battle.participants.forEach((p) => playerScores.set(p.id, 0));

    // Process each round
    for (let roundNum = 1; roundNum <= battle.totalRounds; roundNum++) {
      const battleCase = battle.cases.find((bc) => bc.roundNumber === roundNum);
      if (!battleCase) continue;

      // Emit round start
      io.to(`battle:${battleId}`).emit('battle:roundStart', {
        battleId,
        round: roundNum,
        totalRounds: battle.totalRounds,
        case: {
          id: battleCase.case.id,
          name: battleCase.case.name,
          imageUrl: battleCase.case.imageUrl,
          price: Number(battleCase.case.price),
        },
      });

      // Calculate cumulative odds for this case
      const itemsWithOdds = calculateCumulativeOdds(battleCase.case.items);

      // Generate results for each player
      const roundResults: {
        position: number;
        playerId: string;
        item: {
          skinId: string;
          name: string;
          imageUrl: string;
          rarity: string;
          coinValue: number;
        };
        isEmeraldSpin: boolean;
        nonce: number;
        rollValue: number;
      }[] = [];

      for (const participant of battle.participants) {
        // Calculate nonce: (round - 1) * numPlayers + position
        const nonce = (roundNum - 1) * battle.participants.length + participant.position;

        // Generate result
        const result = generateResult(
          battle.serverSeed,
          battle.publicSeed!,
          participant.user.clientSeed || 'default',
          nonce
        );

        // Determine won item
        const wonItem = rollToItem(result.rollValue, itemsWithOdds);
        const coinValue = Number(wonItem.coinValue);

        // Check for Emerald Spin
        const isEmeraldSpin = shouldTriggerEmeraldSpin(
          { coinValue, rarity: wonItem.skin.rarity },
          Number(battleCase.case.price),
          participant.user.emeraldSpinEnabled
        );

        // Update score
        const currentScore = playerScores.get(participant.id) || 0;
        playerScores.set(participant.id, currentScore + coinValue);

        // Save round result to database
        await prisma.battleRound.create({
          data: {
            battleId,
            participantId: participant.id,
            roundNumber: roundNum,
            caseItemId: wonItem.id,
            coinValue,
            nonce,
            rollValue: result.rollValue,
            triggeredEmeraldSpin: isEmeraldSpin,
          },
        });

        // Update participant total value
        await prisma.battleParticipant.update({
          where: { id: participant.id },
          data: {
            totalValue: { increment: coinValue },
          },
        });

        roundResults.push({
          position: participant.position,
          playerId: participant.user.id,
          item: {
            skinId: wonItem.skin.id,
            name: wonItem.skin.name,
            imageUrl: wonItem.skin.imageUrl,
            rarity: wonItem.skin.rarity,
            coinValue,
          },
          isEmeraldSpin,
          nonce,
          rollValue: result.rollValue,
        });
      }

      // Determine round winner (for display purposes)
      let roundWinner: number | null = null;
      if (battle.mode === 'normal') {
        roundWinner = roundResults.reduce((best, r) =>
          r.item.coinValue > (roundResults[best]?.item.coinValue || 0) ? r.position : best
        , 0);
      } else if (battle.mode === 'crazy') {
        roundWinner = roundResults.reduce((best, r) =>
          r.item.coinValue < (roundResults[best]?.item.coinValue || Infinity) ? r.position : best
        , 0);
      }

      // Build scores array
      const scores = battle.participants.map((p) => ({
        position: p.position,
        total: playerScores.get(p.id) || 0,
      }));

      // Emit round result
      io.to(`battle:${battleId}`).emit('battle:roundResult', {
        battleId,
        round: roundNum,
        results: roundResults,
        roundWinner,
        scores,
      });

      // Update battle current round
      await prisma.battle.update({
        where: { id: battleId },
        data: { currentRound: roundNum },
      });

      // Wait before next round
      if (roundNum < battle.totalRounds) {
        await this.sleep(roundDelay);
      }
    }

    // Determine winner
    await this.finishBattle(battleId, battle.mode, playerScores);
  }

  /**
   * Finishes a battle and distributes winnings.
   */
  private async finishBattle(
    battleId: string,
    mode: string,
    playerScores: Map<string, number>
  ): Promise<void> {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
        rounds: {
          include: {
            caseItem: {
              include: { skin: true },
            },
          },
        },
      },
    });

    if (!battle) return;

    // Determine winner based on mode
    let winnerId: string | null = null;
    let winnerParticipantId: string | null = null;
    let winnerTotal = 0;

    if (mode === 'normal') {
      // Highest total wins
      let highestScore = -1;
      for (const [participantId, score] of playerScores) {
        if (score > highestScore) {
          highestScore = score;
          winnerParticipantId = participantId;
        }
      }
    } else if (mode === 'crazy') {
      // Lowest total wins
      let lowestScore = Infinity;
      for (const [participantId, score] of playerScores) {
        if (score < lowestScore) {
          lowestScore = score;
          winnerParticipantId = participantId;
        }
      }
    }

    // Get winner user id
    const winnerParticipant = battle.participants.find((p) => p.id === winnerParticipantId);
    if (winnerParticipant) {
      winnerId = winnerParticipant.user.id;
      winnerTotal = playerScores.get(winnerParticipantId!) || 0;
    }

    // Calculate total pot
    const totalPot = Number(battle.costPerPlayer) * battle.participants.length;

    // Apply house edge (take from total pot, winner gets rest)
    const houseEdgePercent = 0.05; // 5%
    const houseTake = totalPot * houseEdgePercent;
    const winnerPrize = totalPot - houseTake;

    // Update database
    await prisma.$transaction(async (tx) => {
      // Mark battle as finished
      await tx.battle.update({
        where: { id: battleId },
        data: {
          status: 'finished',
          winnerId,
          totalValue: totalPot,
          finishedAt: new Date(),
        },
      });

      // Mark winner participant
      if (winnerParticipantId) {
        await tx.battleParticipant.update({
          where: { id: winnerParticipantId },
          data: { isWinner: true },
        });
      }

      // Credit winner
      if (winnerId) {
        await tx.user.update({
          where: { id: winnerId },
          data: {
            balance: { increment: winnerPrize },
            totalWon: { increment: winnerPrize },
          },
        });

        // Create win transaction
        await tx.transaction.create({
          data: {
            userId: winnerId,
            type: 'battle_win',
            amount: winnerPrize,
            referenceType: 'battle',
            referenceId: battleId,
          },
        });

        // Update entry transactions to completed
        await tx.transaction.updateMany({
          where: {
            referenceType: 'battle',
            referenceId: battleId,
            type: 'battle_entry',
          },
          data: { status: 'completed' },
        });
      }
    });

    // Get winner info for event
    const winner = winnerParticipant
      ? {
          position: winnerParticipant.position,
          userId: winnerParticipant.user.id,
          username: winnerParticipant.user.username,
          totalValue: winnerTotal,
        }
      : null;

    // Emit battle finished
    io.to(`battle:${battleId}`).emit('battle:finished', {
      battleId,
      winner: winner!,
      serverSeed: battle.serverSeed,
      allItems: battle.rounds.map((r) => ({
        id: r.caseItem.id,
        skinId: r.caseItem.skinId,
        name: r.caseItem.skin.name,
        imageUrl: r.caseItem.skin.imageUrl,
        rarity: r.caseItem.skin.rarity,
        coinValue: Number(r.coinValue),
      })),
    });

    // Emit balance update to winner
    if (winnerId) {
      const updatedWinner = await prisma.user.findUnique({
        where: { id: winnerId },
        select: { balance: true },
      });

      io.to(`user:${winnerId}`).emit('user:balanceUpdate', {
        balance: Number(updatedWinner?.balance || 0),
        change: winnerPrize,
        reason: 'battle_win',
      });

      // Broadcast big win if significant
      if (winnerPrize > 100) {
        io.emit('global:bigWin', {
          odId: winnerId,
          username: winnerParticipant!.user.username,
          game: 'battle',
          item: { name: `Battle Win`, value: winnerPrize },
          multiplier: winnerPrize / Number(battle.costPerPlayer),
        });
      }
    }
  }

  /**
   * Cancels a battle and refunds all participants.
   */
  async cancelBattle(battleId: string, reason: string): Promise<void> {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: true },
    });

    if (!battle || battle.status !== 'waiting') return;

    const cost = Number(battle.costPerPlayer);

    await prisma.$transaction(async (tx) => {
      // Refund all participants
      for (const participant of battle.participants) {
        await tx.user.update({
          where: { id: participant.userId },
          data: {
            balance: { increment: cost },
            totalWagered: { decrement: cost },
          },
        });

        // Create refund transaction
        await tx.transaction.create({
          data: {
            userId: participant.userId,
            type: 'battle_entry',
            amount: cost,
            referenceType: 'battle',
            referenceId: battleId,
            description: `Refund - Battle cancelled: ${reason}`,
          },
        });

        // Emit balance update
        const updatedUser = await tx.user.findUnique({
          where: { id: participant.userId },
          select: { balance: true },
        });

        io.to(`user:${participant.userId}`).emit('user:balanceUpdate', {
          balance: Number(updatedUser?.balance || 0),
          change: cost,
          reason: 'battle_cancelled',
        });
      }

      // Update battle status
      await tx.battle.update({
        where: { id: battleId },
        data: { status: 'cancelled' },
      });
    });

    // Emit cancelled event
    io.to(`battle:${battleId}`).emit('battle:cancelled', {
      battleId,
      reason,
      refunded: true,
    });

    // Remove from global battle list
    io.emit('battle:cancelled', {
      battleId,
      reason,
      refunded: true,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
