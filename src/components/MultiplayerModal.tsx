import React, { useState } from 'react';
import { X, Users, Copy, Check, Radio, Send, ShieldCheck, Globe } from 'lucide-react';
import { MultiplayerPeer } from '../types/game';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  isHost: boolean;
  isConnected: boolean;
  peers: MultiplayerPeer[];
  onHostSession: (code?: string) => void;
  onJoinSession: (code: string) => void;
  onLeaveSession: () => void;
  onSendMessage: (text: string) => void;
  chatMessages: { sender: string; text: string; color: string; time: string }[];
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  isHost,
  isConnected,
  peers,
  onHostSession,
  onJoinSession,
  onLeaveSession,
  onSendMessage,
  chatMessages,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-2xl h-[560px] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">
                BROWSER-NATIVE P2P MULTIPLAYER
              </h2>
              <p className="text-xs text-slate-400">
                Co-Op Base Building, Joint Fauna Taming & Shared Harvesting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          {/* Connection Status & Setup */}
          {!isConnected ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Host Card */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-cyan-400">
                      <Radio className="w-5 h-5" />
                      <h3 className="font-tech font-bold text-white text-sm">HOST SESSION</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Host directly in your browser. Generates a secure session room code for fellow explorers to drop in.
                    </p>
                  </div>
                  <button
                    onClick={() => onHostSession()}
                    className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 font-tech font-bold text-xs text-slate-950 shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
                  >
                    START HOSTING WORLD
                  </button>
                </div>

                {/* Join Card */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-purple-400">
                      <Globe className="w-5 h-5" />
                      <h3 className="font-tech font-bold text-white text-sm">JOIN SESSION</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      Enter a 6-letter room code to connect over browser peer-to-peer channel.
                    </p>
                    <input
                      type="text"
                      maxLength={6}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="e.g. BIO77X"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono tracking-widest text-white text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <button
                    disabled={inputCode.length < 3}
                    onClick={() => onJoinSession(inputCode)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 font-tech font-bold text-xs text-white shadow-md shadow-purple-600/20 active:scale-95 transition-all"
                  >
                    JOIN SESSION
                  </button>
                </div>
              </div>

              {/* In-Browser P2P explanation */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200 block mb-0.5">Instant Zero-Server Browser Connection:</strong>
                  Multiple tabs or browser windows immediately synchronize when connected with the same session code. All base modifications, planted crops, and tamed fauna reflect in real-time.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Connected Header */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Active Session Code</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xl font-bold tracking-widest text-cyan-300">
                      {roomCode}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy code"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-tech font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                    {isHost ? 'HOST AUTHORITY' : 'GUEST EXPLORER'}
                  </span>
                  <button
                    onClick={onLeaveSession}
                    className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs font-tech transition-all"
                  >
                    DISCONNECT
                  </button>
                </div>
              </div>

              {/* Explorers List & Chat in Split View */}
              <div className="flex-1 flex gap-3 overflow-hidden">
                {/* Peer List */}
                <div className="w-1/3 bg-slate-900/40 rounded-2xl border border-slate-800 p-3 overflow-y-auto">
                  <h4 className="text-[11px] font-tech text-slate-400 uppercase tracking-wider mb-2">
                    In Sector ({peers.length + 1})
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="font-semibold text-slate-200">You ({isHost ? 'Host' : 'Peer'})</span>
                    </div>
                    {peers.map((peer) => (
                      <div
                        key={peer.id}
                        className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/20 border border-slate-800 text-xs"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: peer.color }}
                        />
                        <span className="text-slate-300">{peer.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* In-Session Chat Log */}
                <div className="w-2/3 bg-slate-900/40 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between">
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                        No transmissions yet. Greet your team!
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-bold mr-1" style={{ color: msg.color }}>
                            {msg.sender}:
                          </span>
                          <span className="text-slate-200">{msg.text}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Transmit message to sector..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-tech font-bold flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
