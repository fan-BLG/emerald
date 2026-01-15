'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocketStore } from '@/stores/socketStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatTimeAgo } from '@/lib/utils';
import { MessageCircle, Send, Users, ChevronLeft, Globe } from 'lucide-react';

interface ChatMessage {
  id: string;
  user: {
    id: string;
    username: string;
    avatarUrl?: string | null;
    level: number;
    vipTier: string;
  };
  message: string;
  createdAt: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const ROOMS: { id: string; name: string; icon?: typeof Globe; flag?: string }[] = [
  { id: 'global', name: 'Global', icon: Globe },
  { id: 'english', name: 'English', flag: '🇬🇧' },
  { id: 'danish', name: 'Danish', flag: '🇩🇰' },
];

export function ChatSidebar({ isOpen, onToggle }: ChatSidebarProps) {
  const { socket, isConnected } = useSocketStore();
  const { user, isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentRoom, setCurrentRoom] = useState('global');
  const [onlineCount, setOnlineCount] = useState(0);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), message]); // Keep last 100 messages
    };

    const handleHistory = (data: { messages: ChatMessage[] }) => {
      setMessages(data.messages);
    };

    const handleOnlineCount = (data: { count: number }) => {
      setOnlineCount(data.count);
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:history', handleHistory);
    socket.on('chat:onlineCount', handleOnlineCount);

    // Join room
    socket.emit('chat:join', { room: currentRoom });

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:history', handleHistory);
      socket.off('chat:onlineCount', handleOnlineCount);
      socket.emit('chat:leave', { room: currentRoom });
    };
  }, [socket, currentRoom]);

  const sendMessage = async () => {
    if (!socket || !inputValue.trim() || !isAuthenticated || sending) return;

    setSending(true);
    socket.emit('chat:send', {
      room: currentRoom,
      message: inputValue.trim(),
    });
    setInputValue('');
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const changeRoom = (roomId: string) => {
    if (socket && roomId !== currentRoom) {
      socket.emit('chat:leave', { room: currentRoom });
      setCurrentRoom(roomId);
      setMessages([]);
    }
  };

  return (
    <>
      {/* Toggle Button (when closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-4 bottom-4 z-40 p-3 bg-dark-card rounded-full shadow-lg hover:bg-dark-lighter transition-colors"
        >
          <MessageCircle className="w-6 h-6 text-emerald-400" />
        </button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-dark-card border-l border-dark-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-dark-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  <h2 className="font-semibold">Chat</h2>
                </div>
                <button
                  onClick={onToggle}
                  className="p-1 hover:bg-dark-lighter rounded transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              {/* Room Tabs */}
              <div className="flex gap-1">
                {ROOMS.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => changeRoom(room.id)}
                    className={cn(
                      'flex-1 px-2 py-1.5 rounded text-sm transition-colors',
                      currentRoom === room.id
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                    )}
                  >
                    {room.flag ? room.flag : room.icon && <room.icon className="w-4 h-4 mx-auto" />}
                  </button>
                ))}
              </div>

              {/* Online Count */}
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                <Users className="w-3 h-3" />
                <span>{onlineCount} online</span>
                <span className={cn(
                  'w-2 h-2 rounded-full ml-1',
                  isConnected ? 'bg-emerald-500' : 'bg-red-500'
                )} />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs">Be the first to say something!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    isOwnMessage={msg.user.id === user?.id}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-dark-border">
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    maxLength={200}
                    className="flex-1 bg-dark-lighter rounded-lg px-3 py-2 text-sm border border-dark-border focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || sending}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm">
                  Log in to chat
                </p>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// Individual chat message
function ChatMessageItem({
  message,
  isOwnMessage,
}: {
  message: ChatMessage;
  isOwnMessage: boolean;
}) {
  const tierColors: Record<string, string> = {
    bronze: 'text-amber-700',
    silver: 'text-gray-300',
    gold: 'text-yellow-400',
    platinum: 'text-gray-100',
    diamond: 'text-cyan-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className={cn('flex gap-2', isOwnMessage && 'flex-row-reverse')}>
      <Avatar
        src={message.user.avatarUrl}
        alt={message.user.username}
        size="sm"
      />
      <div className={cn('flex-1 min-w-0', isOwnMessage && 'text-right')}>
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              'font-medium text-sm',
              tierColors[message.user.vipTier] || 'text-white'
            )}
          >
            {message.user.username}
          </span>
          <span className="text-xs text-gray-600">
            Lv.{message.user.level}
          </span>
        </div>
        <p className="text-sm text-gray-300 break-words">{message.message}</p>
        <span className="text-xs text-gray-600">
          {formatTimeAgo(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
