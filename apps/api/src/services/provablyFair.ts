import crypto from 'crypto';

/**
 * Generates a provably fair result using server seed, public seed, client seed, and nonce.
 * The result is deterministic and can be verified by the user.
 */
export function generateResult(
  serverSeed: string,
  publicSeed: string,
  clientSeed: string,
  nonce: number
): { hash: string; rollValue: number; hexUsed: string; decimalValue: number } {
  // Create HMAC using server seed as key
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(`${publicSeed}:${clientSeed}:${nonce}`)
    .digest('hex');

  // Take first 8 hex characters and convert to decimal
  const hexSubstring = hash.substring(0, 8);
  const decimalValue = parseInt(hexSubstring, 16);

  // Normalize to 0-1 range
  const rollValue = decimalValue / 0xffffffff;

  return {
    hash,
    rollValue,
    hexUsed: hexSubstring,
    decimalValue,
  };
}

/**
 * Maps a roll value (0-1) to an item based on cumulative odds.
 * Items must have a 'cumulative' property representing their cumulative probability.
 */
export function rollToItem<T extends { cumulative: number }>(
  rollValue: number,
  items: T[]
): T {
  for (const item of items) {
    if (rollValue <= item.cumulative) {
      return item;
    }
  }

  // Fallback to last item (should never happen if cumulative sums to 1)
  return items[items.length - 1];
}

/**
 * Verifies that a result matches the expected roll value.
 */
export function verifyResult(
  serverSeed: string,
  publicSeed: string,
  clientSeed: string,
  nonce: number,
  expectedRoll: number
): boolean {
  const result = generateResult(serverSeed, publicSeed, clientSeed, nonce);
  // Allow small floating point differences
  return Math.abs(result.rollValue - expectedRoll) < 0.0000001;
}

/**
 * Generates a new server seed.
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a server seed using SHA-256.
 */
export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

/**
 * Generates a default client seed.
 */
export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Fetches the latest EOS block hash to use as public seed.
 * This provides an external, unpredictable source of randomness.
 */
export async function getEOSBlockHash(): Promise<{
  blockNum: number;
  blockHash: string;
  timestamp: string;
}> {
  try {
    // Use EOS public API
    const infoResponse = await fetch('https://eos.greymass.com/v1/chain/get_info');
    const info = await infoResponse.json();

    const blockNum = info.last_irreversible_block_num;

    const blockResponse = await fetch('https://eos.greymass.com/v1/chain/get_block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_num_or_id: blockNum }),
    });
    const block = await blockResponse.json();

    return {
      blockNum,
      blockHash: block.id,
      timestamp: block.timestamp,
    };
  } catch (error) {
    console.error('Failed to fetch EOS block:', error);
    // Fallback: use timestamp + random bytes as public seed
    // Not ideal but ensures system doesn't break
    const fallback = crypto
      .createHash('sha256')
      .update(`${Date.now()}:${crypto.randomBytes(16).toString('hex')}`)
      .digest('hex');

    return {
      blockNum: 0,
      blockHash: fallback,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Calculates cumulative odds from weight-based items.
 */
export function calculateCumulativeOdds<T extends { oddsWeight: number }>(
  items: T[]
): (T & { cumulative: number })[] {
  const totalWeight = items.reduce((sum, item) => sum + item.oddsWeight, 0);
  let cumulative = 0;

  return items.map((item) => {
    cumulative += item.oddsWeight / totalWeight;
    return { ...item, cumulative };
  });
}

/**
 * Determines if a result should trigger Emerald Spin animation.
 */
export function shouldTriggerEmeraldSpin(
  item: { coinValue: number; rarity: string },
  casePrice: number,
  userEnabled: boolean = true
): boolean {
  if (!userEnabled) return false;

  // Trigger for:
  // 1. Covert (red) rarity items
  // 2. Contraband (gold) rarity items (knives/gloves)
  // 3. Items worth 10x+ case price
  const highValueMultiplier = 10;
  const highRarities = ['covert', 'contraband'];

  if (highRarities.includes(item.rarity)) return true;
  if (item.coinValue >= casePrice * highValueMultiplier) return true;

  return false;
}
