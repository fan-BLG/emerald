'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Shield, RefreshCw, Copy, Check, HelpCircle, ExternalLink } from 'lucide-react';

interface SeedInfo {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface FairInfo {
  title: string;
  description: string;
  components: Record<string, string>;
  formula: string;
  rollCalculation: string;
  verification: string[];
}

interface VerifyResult {
  hash: string;
  rollValue: number;
  percentage: number;
}

export default function FairPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [seedInfo, setSeedInfo] = useState<SeedInfo | null>(null);
  const [fairInfo, setFairInfo] = useState<FairInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'seeds' | 'verify' | 'info'>('seeds');
  const [copied, setCopied] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState<string | null>(null);

  // Verification form
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyPublicSeed, setVerifyPublicSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('');
  const [verifyNonce, setVerifyNonce] = useState(0);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // Fetch fair info
    api.get<FairInfo>('/fair/info').then((res) => {
      if (res.success && res.data) {
        setFairInfo(res.data);
      }
    });

    // Fetch user seeds if authenticated
    if (isAuthenticated) {
      api.get<SeedInfo>('/fair/seeds').then((res) => {
        if (res.success && res.data) {
          setSeedInfo(res.data);
        }
      });
    }
  }, [isAuthenticated]);

  const rotateSeed = async () => {
    if (rotating) return;
    setRotating(true);

    try {
      const res = await api.post<{
        previousSeed: { serverSeed: string };
        newSeed: SeedInfo;
      }>('/fair/seeds/rotate', {});

      if (res.success && res.data) {
        setRevealedSeed(res.data.previousSeed.serverSeed);
        setSeedInfo(res.data.newSeed);
      }
    } finally {
      setRotating(false);
    }
  };

  const verify = async () => {
    if (verifying) return;
    setVerifying(true);

    try {
      const res = await api.post<VerifyResult>('/fair/calculate', {
        serverSeed: verifyServerSeed,
        publicSeed: verifyPublicSeed,
        clientSeed: verifyClientSeed,
        nonce: verifyNonce,
      });

      if (res.success && res.data) {
        setVerifyResult(res.data);
      }
    } finally {
      setVerifying(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-600/20 rounded-full mb-4">
          <Shield size={40} className="text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Provably Fair</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Our system ensures every outcome is verifiably random and cannot be manipulated by anyone - including us.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {[
          { id: 'seeds', label: 'My Seeds', requiresAuth: true },
          { id: 'verify', label: 'Verify Result', requiresAuth: false },
          { id: 'info', label: 'How It Works', requiresAuth: false },
        ].map(({ id, label, requiresAuth }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            disabled={requiresAuth && !isAuthenticated}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === id
                ? 'bg-emerald-600 text-white'
                : requiresAuth && !isAuthenticated
                ? 'bg-dark-card text-gray-600 cursor-not-allowed'
                : 'bg-dark-card text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Seeds Tab */}
      {activeTab === 'seeds' && (
        <div className="space-y-6">
          {!isAuthenticated ? (
            <div className="bg-dark-card rounded-xl p-8 text-center">
              <p className="text-gray-400">Please login to view your seeds</p>
            </div>
          ) : seedInfo ? (
            <>
              {/* Current Seeds */}
              <div className="bg-dark-card rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Current Seeds</h2>

                <div className="space-y-4">
                  <SeedField
                    label="Server Seed Hash"
                    value={seedInfo.serverSeedHash}
                    onCopy={() => copy(seedInfo.serverSeedHash, 'hash')}
                    copied={copied === 'hash'}
                    help="SHA-256 hash of your server seed. The actual seed will be revealed when you rotate."
                  />

                  <SeedField
                    label="Client Seed"
                    value={seedInfo.clientSeed}
                    onCopy={() => copy(seedInfo.clientSeed, 'client')}
                    copied={copied === 'client'}
                    editable
                    help="Your personal seed. Change it anytime to influence outcomes."
                  />

                  <SeedField
                    label="Nonce"
                    value={seedInfo.nonce.toString()}
                    help="Number of bets made with current seed pair."
                  />
                </div>
              </div>

              {/* Rotate Seed */}
              <div className="bg-dark-card rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Rotate Server Seed</h2>
                    <p className="text-sm text-gray-400">
                      This will reveal your current server seed and generate a new one.
                    </p>
                  </div>
                  <button
                    onClick={rotateSeed}
                    disabled={rotating}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={18} className={rotating ? 'animate-spin' : ''} />
                    Rotate
                  </button>
                </div>

                {revealedSeed && (
                  <div className="mt-4 p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-sm text-emerald-400 mb-2">Previous Server Seed (Revealed)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-dark-lighter p-2 rounded font-mono break-all">
                        {revealedSeed}
                      </code>
                      <button
                        onClick={() => copy(revealedSeed, 'revealed')}
                        className="p-2 hover:bg-dark-lighter rounded transition-colors"
                      >
                        {copied === 'revealed' ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-dark-card rounded-xl p-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      )}

      {/* Verify Tab */}
      {activeTab === 'verify' && (
        <div className="bg-dark-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Verify a Result</h2>
          <p className="text-gray-400 mb-6">
            Enter the seeds to calculate and verify any game outcome.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Server Seed</label>
              <input
                type="text"
                value={verifyServerSeed}
                onChange={(e) => setVerifyServerSeed(e.target.value)}
                placeholder="Enter server seed"
                className="w-full bg-dark-lighter rounded-lg px-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Public Seed (EOS Block)</label>
              <input
                type="text"
                value={verifyPublicSeed}
                onChange={(e) => setVerifyPublicSeed(e.target.value)}
                placeholder="Enter public seed"
                className="w-full bg-dark-lighter rounded-lg px-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Client Seed</label>
              <input
                type="text"
                value={verifyClientSeed}
                onChange={(e) => setVerifyClientSeed(e.target.value)}
                placeholder="Enter client seed"
                className="w-full bg-dark-lighter rounded-lg px-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Nonce</label>
              <input
                type="number"
                value={verifyNonce}
                onChange={(e) => setVerifyNonce(Number(e.target.value))}
                min={0}
                className="w-full bg-dark-lighter rounded-lg px-4 py-2 border border-dark-lighter focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={verify}
            disabled={verifying || !verifyServerSeed || !verifyPublicSeed || !verifyClientSeed}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? 'Calculating...' : 'Calculate Result'}
          </button>

          {verifyResult && (
            <div className="mt-6 p-4 bg-dark-lighter rounded-lg">
              <h3 className="font-semibold mb-3">Result</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Hash</span>
                  <code className="text-sm font-mono">{verifyResult.hash.slice(0, 32)}...</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Roll Value</span>
                  <span className="font-bold">{verifyResult.rollValue.toFixed(8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Percentage</span>
                  <span className="font-bold text-emerald-400">{verifyResult.percentage.toFixed(4)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && fairInfo && (
        <div className="space-y-6">
          <div className="bg-dark-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">{fairInfo.title}</h2>
            <p className="text-gray-400 mb-6">{fairInfo.description}</p>

            <h3 className="font-semibold mb-3">Components</h3>
            <div className="space-y-4 mb-6">
              {Object.entries(fairInfo.components).map(([key, value]) => (
                <div key={key} className="bg-dark-lighter rounded-lg p-4">
                  <h4 className="font-medium capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</h4>
                  <p className="text-sm text-gray-400">{value}</p>
                </div>
              ))}
            </div>

            <h3 className="font-semibold mb-3">Formula</h3>
            <code className="block bg-dark-lighter rounded-lg p-4 text-sm font-mono text-emerald-400 mb-6">
              {fairInfo.formula}
            </code>

            <h3 className="font-semibold mb-3">Roll Calculation</h3>
            <p className="text-gray-400 mb-6">{fairInfo.rollCalculation}</p>

            <h3 className="font-semibold mb-3">Verification Steps</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-400">
              {fairInfo.verification.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="bg-dark-card rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">External Verification</h2>
            <p className="text-gray-400 mb-4">
              You can verify our EOS block hashes on any EOS blockchain explorer.
            </p>
            <a
              href="https://bloks.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-emerald-400 hover:underline"
            >
              View on Bloks.io
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function SeedField({
  label,
  value,
  help,
  onCopy,
  copied,
  editable,
}: {
  label: string;
  value: string;
  help?: string;
  onCopy?: () => void;
  copied?: boolean;
  editable?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm text-gray-400">{label}</label>
        {help && (
          <div className="group relative">
            <HelpCircle size={14} className="text-gray-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-dark-lighter rounded-lg text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {help}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 text-sm font-mono break-all">
          {value}
        </code>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-2 hover:bg-dark-lighter rounded-lg transition-colors"
          >
            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
