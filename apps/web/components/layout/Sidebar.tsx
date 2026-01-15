'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Users, ChevronLeft, Send, Globe } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { cn, formatTimeAgo, getVipTierColor } from '@/lib/utils';

export function Sidebar() {
  const { messages, currentRoom, isOpen, toggleChat, setCurrentRoom } = useChatStore();
  const { user, isAuthenticated } = useAuthStore();
  const { emit } = useSocketStore();

  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const rooms = [
    { id: 'global', name: 'Global', icon: Globe },
    { id: 'english', name: 'EN', icon: null },
    { id: 'russian', name: 'RU', icon: null },
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isAuthenticated) return;

    emit('chat:message', { room: currentRoom, message: message.trim() });
    setMessage('');
  };

  const handleRoomChange = (roomId: string) => {
    setCurrentRoom(roomId);
    emit('chat:leave', { room: currentRoom });
    emit('chat:join', { room: roomId });
  };

  return (
    <>
      {/* Toggle Button (when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={toggleChat}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-dark-card border border-dark-border border-l-0 rounded-r-lg p-2 hover:bg-dark-hover transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-emerald-500" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-[calc(100vh-4rem)] bg-dark-card border-r border-dark-border flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 border-b border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                <span className="font-medium">Chat</span>
                <span className="flex items-center gap-1 text-sm text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>1,234</span>
                </span>
              </div>
              <button
                onClick={toggleChat}
                className="p-1 hover:bg-dark-hover rounded transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Room Tabs */}
            <div className="flex border-b border-dark-border">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleRoomChange(room.id)}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    currentRoom === room.id
                      ? 'text-emerald-400 border-b-2 border-emerald-500'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {room.name}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'group',
                      msg.isDeleted && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <img
                        src={msg.user.avatarUrl || '/default-avatar.png'}
                        alt={msg.user.username}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${getVipTierColor(msg.user.vipTier)}20`,
                              color: getVipTierColor(msg.user.vipTier),
                            }}
                          >
                            {msg.user.level}
                          </span>
                          <span className="font-medium text-sm truncate">
                            {msg.user.username}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(msg.createdAt)}
                          </span>
                        </div>
                        <p className={cn(
                          'text-sm text-gray-300 break-words',
                          msg.isDeleted && 'italic text-gray-500'
                        )}>
                          {msg.isDeleted ? 'Message deleted' : msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-dark-border">
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="input flex-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim()}
                    className="btn btn-primary p-2 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm">
                  Sign in to chat
                </p>
              )}
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
