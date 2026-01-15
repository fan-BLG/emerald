'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Settings, Shield, Bell, Eye, Dice1, Copy, Check, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, checkAuth } = useAuthStore();

  const [clientSeed, setClientSeed] = useState('');
  const [serverSeedHash, setServerSeedHash] = useState('');
  const [emeraldSpinEnabled, setEmeraldSpinEnabled] = useState(true);
  const [tradeUrl, setTradeUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    if (user) {
      setClientSeed(user.clientSeed || '');
      setEmeraldSpinEnabled(user.emeraldSpinEnabled);
    }

    fetchSeeds();
  }, [isAuthenticated, user, router]);

  const fetchSeeds = async () => {
    const res = await api.get<{ serverSeedHash: string; clientSeed: string; nonce: number }>('/fair/seeds');
    if (res.success && res.data) {
      setServerSeedHash(res.data.serverSeedHash);
      if (!clientSeed) {
        setClientSeed(res.data.clientSeed);
      }
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await api.put('/users/settings', {
        emeraldSpinEnabled,
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        checkAuth();
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateClientSeed = async () => {
    if (!clientSeed.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await api.put('/users/client-seed', { clientSeed });

      if (res.success) {
        setMessage({ type: 'success', text: 'Client seed updated!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update client seed' });
      }
    } finally {
      setSaving(false);
    }
  };

  const rotateServerSeed = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await api.post<{ revealedSeed: string; newServerSeedHash: string }>('/fair/seeds/rotate');

      if (res.success && res.data) {
        setServerSeedHash(res.data.newServerSeedHash);
        setMessage({
          type: 'success',
          text: `Server seed rotated! Previous seed: ${res.data.revealedSeed.slice(0, 16)}...`
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to rotate server seed' });
      }
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateRandomSeed = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let seed = '';
    for (let i = 0; i < 32; i++) {
      seed += chars[Math.floor(Math.random() * chars.length)];
    }
    setClientSeed(seed);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <p className="text-gray-400">Manage your account preferences and security</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
          'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Game Settings */}
        <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Dice1 className="w-5 h-5" />
            Game Settings
          </h2>

          <div className="space-y-4">
            {/* Emerald Spin Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Emerald Spin</p>
                <p className="text-sm text-gray-400">Show special animation for big wins</p>
              </div>
              <button
                onClick={() => setEmeraldSpinEnabled(!emeraldSpinEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  emeraldSpinEnabled ? 'bg-emerald-600' : 'bg-dark-lighter'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    emeraldSpinEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Provably Fair */}
        <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Provably Fair
          </h2>

          <div className="space-y-4">
            {/* Server Seed Hash */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Server Seed Hash (SHA-256)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverSeedHash}
                  readOnly
                  className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 text-sm font-mono border border-dark-border"
                />
                <button
                  onClick={() => copyToClipboard(serverSeedHash, 'hash')}
                  className="px-3 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
                >
                  {copied === 'hash' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
                <button
                  onClick={rotateServerSeed}
                  disabled={saving}
                  className="px-3 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
                  title="Rotate server seed"
                >
                  <RefreshCw className={`w-5 h-5 ${saving ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Rotating reveals the previous server seed for verification
              </p>
            </div>

            {/* Client Seed */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Client Seed</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientSeed}
                  onChange={(e) => setClientSeed(e.target.value)}
                  placeholder="Enter your client seed"
                  className="flex-1 bg-dark-lighter rounded-lg px-4 py-2 text-sm font-mono border border-dark-border focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={generateRandomSeed}
                  className="px-3 py-2 bg-dark-lighter hover:bg-dark-base rounded-lg transition-colors"
                  title="Generate random seed"
                >
                  <Dice1 className="w-5 h-5" />
                </button>
                <button
                  onClick={updateClientSeed}
                  disabled={saving || !clientSeed.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your client seed is combined with our server seed to generate provably fair results
              </p>
            </div>
          </div>
        </div>

        {/* Trade URL */}
        <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Trade Settings
          </h2>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Steam Trade URL</label>
            <input
              type="text"
              value={tradeUrl}
              onChange={(e) => setTradeUrl(e.target.value)}
              placeholder="https://steamcommunity.com/tradeoffer/new/?partner=..."
              className="w-full bg-dark-lighter rounded-lg px-4 py-2 text-sm border border-dark-border focus:border-emerald-500 focus:outline-none"
            />
            <a
              href="https://steamcommunity.com/my/tradeoffers/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:underline mt-1 inline-block"
            >
              Get your trade URL
            </a>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Battle Invites</p>
                <p className="text-sm text-gray-400">Notify when invited to a battle</p>
              </div>
              <button className="w-14 h-8 rounded-full bg-emerald-600 relative">
                <span className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Big Wins</p>
                <p className="text-sm text-gray-400">Notify on significant wins</p>
              </div>
              <button className="w-14 h-8 rounded-full bg-emerald-600 relative">
                <span className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Promotional Offers</p>
                <p className="text-sm text-gray-400">Receive bonus and promotion updates</p>
              </div>
              <button className="w-14 h-8 rounded-full bg-dark-lighter relative">
                <span className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full" />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
