import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../index.js';
import { createDepositSchema, requestWithdrawalSchema, cryptoWithdrawalSchema } from '@emerald/shared';
import crypto from 'crypto';

// NOWPayments API configuration
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || '';
const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '';

// Waxpeer API configuration
const WAXPEER_API_KEY = process.env.WAXPEER_API_KEY || '';
const WAXPEER_API_URL = 'https://api.waxpeer.com/v1';

// Supported cryptocurrencies
const SUPPORTED_CURRENCIES = ['btc', 'eth', 'ltc', 'usdt', 'usdc', 'sol', 'doge', 'trx'];

export async function paymentRoutes(fastify: FastifyInstance) {
  // Get available currencies
  fastify.get('/currencies', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      success: true,
      data: {
        currencies: SUPPORTED_CURRENCIES.map(c => ({
          code: c.toUpperCase(),
          name: getCurrencyName(c),
          minDeposit: getMinDeposit(c),
        })),
      },
    };
  });

  // Create crypto deposit
  fastify.post('/deposit', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = createDepositSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.error.message },
      });
    }

    const { amount, currency } = validation.data;
    const userId = request.user!.id;

    if (!SUPPORTED_CURRENCIES.includes(currency.toLowerCase())) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_CURRENCY', message: 'Unsupported currency' },
      });
    }

    try {
      // Create NOWPayments invoice
      const response = await fetch(`${NOWPAYMENTS_API_URL}/payment`, {
        method: 'POST',
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: 'usd',
          pay_currency: currency.toLowerCase(),
          order_id: `emerald_${userId}_${Date.now()}`,
          order_description: `Emerald deposit - ${amount} coins`,
          ipn_callback_url: `${process.env.API_URL}/api/payments/webhook/nowpayments`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('NOWPayments error:', error);
        return reply.code(500).send({
          success: false,
          error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment' },
        });
      }

      const paymentData = await response.json();

      // Store deposit in database
      const deposit = await prisma.cryptoDeposit.create({
        data: {
          userId,
          paymentId: paymentData.payment_id?.toString(),
          paymentStatus: paymentData.payment_status || 'waiting',
          payAddress: paymentData.pay_address,
          payCurrency: currency.toLowerCase(),
          payAmount: paymentData.pay_amount,
          priceAmount: amount,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
        },
      });

      return {
        success: true,
        data: {
          id: deposit.id,
          paymentId: paymentData.payment_id,
          payAddress: paymentData.pay_address,
          payAmount: paymentData.pay_amount,
          payCurrency: currency.toUpperCase(),
          expiresAt: deposit.expiresAt,
          qrCode: `bitcoin:${paymentData.pay_address}?amount=${paymentData.pay_amount}`,
        },
      };
    } catch (error) {
      console.error('Deposit error:', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create deposit' },
      });
    }
  });

  // Get deposit status
  fastify.get('/deposit/:id', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.user!.id;

    const deposit = await prisma.cryptoDeposit.findFirst({
      where: { id, userId },
    });

    if (!deposit) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Deposit not found' },
      });
    }

    return {
      success: true,
      data: {
        id: deposit.id,
        status: deposit.paymentStatus,
        payAddress: deposit.payAddress,
        payAmount: Number(deposit.payAmount),
        payCurrency: deposit.payCurrency?.toUpperCase(),
        priceAmount: Number(deposit.priceAmount),
        actuallyPaid: Number(deposit.actuallyPaid),
        coinsCredited: Number(deposit.coinsCredited),
        createdAt: deposit.createdAt,
        expiresAt: deposit.expiresAt,
      },
    };
  });

  // NOWPayments webhook
  fastify.post('/webhook/nowpayments', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;

    // Verify IPN signature
    const signature = request.headers['x-nowpayments-sig'] as string;
    if (NOWPAYMENTS_IPN_SECRET && signature) {
      const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
      const sortedPayload = JSON.stringify(sortObject(payload));
      const calculatedSig = hmac.update(sortedPayload).digest('hex');

      if (signature !== calculatedSig) {
        return reply.code(400).send({ error: 'Invalid signature' });
      }
    }

    const paymentId = payload.payment_id?.toString();
    const paymentStatus = payload.payment_status;
    const actuallyPaid = payload.actually_paid || 0;

    if (!paymentId) {
      return reply.code(400).send({ error: 'Missing payment_id' });
    }

    // Find deposit
    const deposit = await prisma.cryptoDeposit.findFirst({
      where: { paymentId },
    });

    if (!deposit) {
      console.error(`Deposit not found for payment ${paymentId}`);
      return reply.code(404).send({ error: 'Deposit not found' });
    }

    // Update deposit status
    await prisma.cryptoDeposit.update({
      where: { id: deposit.id },
      data: {
        paymentStatus,
        actuallyPaid,
      },
    });

    // Credit user if payment is confirmed
    if (paymentStatus === 'finished' && deposit.coinsCredited === 0n) {
      const coinsToCredit = Number(deposit.priceAmount);

      await prisma.$transaction(async (tx) => {
        // Update deposit
        await tx.cryptoDeposit.update({
          where: { id: deposit.id },
          data: {
            coinsCredited: coinsToCredit,
            creditedAt: new Date(),
          },
        });

        // Credit user balance
        await tx.user.update({
          where: { id: deposit.userId },
          data: {
            balance: { increment: coinsToCredit },
            totalDeposited: { increment: coinsToCredit },
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: deposit.userId,
            type: 'deposit',
            amount: coinsToCredit,
            referenceType: 'crypto_deposit',
            referenceId: deposit.id,
            status: 'completed',
            description: `Crypto deposit - ${deposit.payCurrency?.toUpperCase()}`,
          },
        });
      });

      console.log(`Credited ${coinsToCredit} coins to user ${deposit.userId}`);
    }

    return { success: true };
  });

  // Get withdrawal skins from Waxpeer
  fastify.get('/withdrawals/skins', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Querystring: { search?: string; minPrice?: string; maxPrice?: string } }>, reply: FastifyReply) => {
    const { search, minPrice, maxPrice } = request.query;

    try {
      const params = new URLSearchParams({
        api: WAXPEER_API_KEY,
        game: 'csgo',
        sort: 'price',
        order: 'asc',
      });

      if (search) params.append('search', search);
      if (minPrice) params.append('min_price', minPrice);
      if (maxPrice) params.append('max_price', maxPrice);

      const response = await fetch(`${WAXPEER_API_URL}/items-list?${params}`);

      if (!response.ok) {
        return reply.code(500).send({
          success: false,
          error: { code: 'WAXPEER_ERROR', message: 'Failed to fetch skins' },
        });
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          items: (data.items || []).map((item: any) => ({
            id: item.item_id,
            name: item.name,
            imageUrl: item.image,
            price: item.price / 1000, // Waxpeer uses cents
            wear: item.wear,
            float: item.float,
          })),
        },
      };
    } catch (error) {
      console.error('Waxpeer skins error:', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch skins' },
      });
    }
  });

  // Request skin withdrawal
  fastify.post('/withdrawals/request', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = requestWithdrawalSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.error.message },
      });
    }

    const { waxpeerItemId, tradeLink } = validation.data;
    const userId = request.user!.id;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    try {
      // Get item details from Waxpeer
      const itemResponse = await fetch(`${WAXPEER_API_URL}/get-item-info?api=${WAXPEER_API_KEY}&item_id=${waxpeerItemId}`);
      if (!itemResponse.ok) {
        return reply.code(400).send({
          success: false,
          error: { code: 'ITEM_NOT_FOUND', message: 'Item not available' },
        });
      }

      const itemData = await itemResponse.json();
      const itemPrice = (itemData.price || 0) / 1000; // Convert from cents

      // Check balance
      if (Number(user.balance) < itemPrice) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance' },
        });
      }

      // Create withdrawal request
      const withdrawal = await prisma.$transaction(async (tx) => {
        // Deduct balance
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: itemPrice },
            totalWithdrawn: { increment: itemPrice },
          },
        });

        // Create withdrawal record
        const withdrawal = await tx.skinWithdrawal.create({
          data: {
            userId,
            coinAmount: itemPrice,
            waxpeerItemId,
            skinName: itemData.name,
            tradeLink,
            status: 'pending',
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId,
            type: 'withdrawal',
            amount: -itemPrice,
            referenceType: 'skin_withdrawal',
            referenceId: withdrawal.id,
            status: 'pending',
            description: `Skin withdrawal - ${itemData.name}`,
          },
        });

        return withdrawal;
      });

      // Initiate Waxpeer trade
      const tradeResponse = await fetch(`${WAXPEER_API_URL}/buy-one-p2p`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api: WAXPEER_API_KEY,
          item_id: waxpeerItemId,
          price: itemData.price,
          tradelink: tradeLink,
        }),
      });

      if (tradeResponse.ok) {
        const tradeData = await tradeResponse.json();
        await prisma.skinWithdrawal.update({
          where: { id: withdrawal.id },
          data: {
            waxpeerTradeId: tradeData.trade_id?.toString(),
            status: 'processing',
          },
        });
      }

      return {
        success: true,
        data: {
          id: withdrawal.id,
          skinName: itemData.name,
          coinAmount: itemPrice,
          status: 'processing',
        },
      };
    } catch (error) {
      console.error('Withdrawal error:', error);
      return reply.code(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process withdrawal' },
      });
    }
  });

  // Get user's withdrawals
  fastify.get('/withdrawals', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);

    const [withdrawals, total] = await Promise.all([
      prisma.skinWithdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.skinWithdrawal.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: {
        items: withdrawals.map(w => ({
          id: w.id,
          skinName: w.skinName,
          coinAmount: Number(w.coinAmount),
          status: w.status,
          createdAt: w.createdAt,
          completedAt: w.completedAt,
          errorMessage: w.errorMessage,
        })),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    };
  });

  // Get user's deposits
  fastify.get('/deposits', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);

    const [deposits, total] = await Promise.all([
      prisma.cryptoDeposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cryptoDeposit.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: {
        items: deposits.map(d => ({
          id: d.id,
          payCurrency: d.payCurrency?.toUpperCase(),
          priceAmount: Number(d.priceAmount),
          coinsCredited: Number(d.coinsCredited),
          status: d.paymentStatus,
          createdAt: d.createdAt,
        })),
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    };
  });
}

// Helper functions
function getCurrencyName(code: string): string {
  const names: Record<string, string> = {
    btc: 'Bitcoin',
    eth: 'Ethereum',
    ltc: 'Litecoin',
    usdt: 'Tether',
    usdc: 'USD Coin',
    sol: 'Solana',
    doge: 'Dogecoin',
    trx: 'Tron',
  };
  return names[code] || code.toUpperCase();
}

function getMinDeposit(code: string): number {
  const mins: Record<string, number> = {
    btc: 10,
    eth: 10,
    ltc: 5,
    usdt: 5,
    usdc: 5,
    sol: 5,
    doge: 5,
    trx: 5,
  };
  return mins[code] || 5;
}

function sortObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj).sort().reduce((result: any, key) => {
    result[key] = sortObject(obj[key]);
    return result;
  }, {});
}
