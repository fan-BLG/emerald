'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCoins } from '@/lib/utils';
import { ArrowLeft, Copy, Check, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Currency {
  code: string;
  name: string;
  minDeposit: number;
}

interface DepositResult {
  id: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  expiresAt: string;
  qrCode: string;
}

const CRYPTO_ICONS: Record<string, string> = {
  BTC: '/crypto/btc.png',
  ETH: '/crypto/eth.png',
  LTC: '/crypto/ltc.png',
  USDT: '/crypto/usdt.png',
  USDC: '/crypto/usdc.png',
  SOL: '/crypto/sol.png',
  DOGE: '/crypto/doge.png',
  TRX: '/crypto/trx.png',
};

export default function DepositPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BTC');
  const [amount, setAmount] = useState(50);
  const [creating, setCreating] = useState(false);
  const [deposit, setDeposit] = useState<DepositResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    api.get<{ currencies: Currency[] }>('/payments/currencies')
      .then((res) => {
        if (res.success && res.data) {
          setCurrencies(res.data.currencies);
        }
      });
  }, [isAuthenticated, router]);

  const createDeposit = async () => {
    if (creating || amount < 5) return;

    setCreating(true);
    setError(null);

    try {
      const res = await api.post<DepositResult>('/payments/deposit', {
        amount,
        currency: selectedCurrency,
      });

      if (res.success && res.data) {
        setDeposit(res.data);
      } else {
        setError(res.error?.message || 'Failed to create deposit');
      }
    } catch (err) {
      setError('Failed to create deposit');
    } finally {
      setCreating(false);
    }
  };

  const copyAddress = () => {
    if (deposit) {
      navigator.clipboard.writeText(deposit.payAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedCurrencyInfo = currencies.find(c => c.code === selectedCurrency);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/profile" className="p-2 hover:bg-dark-card rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Deposit</h1>
          <p className="text-gray-400">Add funds using cryptocurrency</p>
        </div>
      </div>

      {!deposit ? (
        <>
          {/* Currency Selection */}
          <div className="bg-dark-card rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4">Select Currency</h2>
            <div className="grid grid-cols-4 gap-3">
              {currencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => setSelectedCurrency(currency.code)}
                  className={`p-4 rounded-lg transition-all text-center ${
                    selectedCurrency === currency.code
                      ? 'bg-emerald-600/20 border-2 border-emerald-500'
                      : 'bg-dark-lighter border-2 border-transparent hover:border-gray-600'
                  }`}
                >
                  <div className="w-10 h-10 mx-auto mb-2 relative">
                    {CRYPTO_ICONS[currency.code] ? (
                      <Image
                        src={CRYPTO_ICONS[currency.code]}
                        alt={currency.code}
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-dark-card rounded-full flex items-center justify-center text-xs font-bold">
                        {currency.code.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm">{currency.code}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Selection */}
          <div className="bg-dark-card rounded-xl p-6 mb-6">
            <h2 className="font-semibold mb-4">Amount (USD)</h2>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[25, 50, 100, 250].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset)}
                  className={`py-3 rounded-lg font-semibold transition-all ${
                    amount === preset
                      ? 'bg-emerald-600 text-white'
                      : 'bg-dark-lighter text-gray-400 hover:text-white'
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Custom Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(5, Number(e.target.value)))}
                  min={5}
                  max={10000}
                  className="w-full bg-dark-lighter rounded-lg pl-8 pr-4 py-3 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Minimum: ${selectedCurrencyInfo?.minDeposit || 5} | Maximum: $10,000
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-dark-card rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">You deposit</span>
              <span className="text-2xl font-bold">${amount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">You receive</span>
              <span className="text-2xl font-bold text-emerald-400">{formatCoins(amount)} coins</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={createDeposit}
            disabled={creating || amount < 5}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              creating || amount < 5
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {creating ? 'Creating Deposit...' : 'Generate Payment Address'}
          </button>
        </>
      ) : (
        /* Payment Details */
        <div className="bg-dark-card rounded-xl p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-emerald-400" size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Awaiting Payment</h2>
            <p className="text-gray-400">
              Send exactly <span className="text-white font-bold">{deposit.payAmount} {deposit.payCurrency}</span> to the address below
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg w-48 h-48 mx-auto mb-6">
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${deposit.payAddress}`}
              alt="QR Code"
              width={176}
              height={176}
            />
          </div>

          {/* Address */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Payment Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deposit.payAddress}
                readOnly
                className="flex-1 bg-dark-lighter rounded-lg px-4 py-3 text-sm font-mono"
              />
              <button
                onClick={copyAddress}
                className="px-4 py-3 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
              >
                {copied ? <Check className="text-emerald-400" /> : <Copy />}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-dark-lighter rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Amount to send</span>
              <span className="font-bold">{deposit.payAmount} {deposit.payCurrency}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">You will receive</span>
              <span className="font-bold text-emerald-400">{formatCoins(amount)} coins</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Expires</span>
              <span className="font-bold">{new Date(deposit.expiresAt).toLocaleTimeString()}</span>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500">
            Payment will be credited automatically after network confirmations
          </p>

          <button
            onClick={() => setDeposit(null)}
            className="w-full py-3 bg-dark-lighter hover:bg-dark-base rounded-lg mt-4 transition-colors"
          >
            Create New Deposit
          </button>
        </div>
      )}
    </div>
  );
}
