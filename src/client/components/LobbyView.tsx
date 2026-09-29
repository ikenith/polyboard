import React, { useState } from "react";
import { PublicRoomState } from "../../shared/protocol";
import { Player, RoomSettings } from "../../games/types";
import { LUDO_COLORS, LUDO_ICONS } from "../../games/ludo/config";
import { ShapePreview } from "./ShapePreview";
import { SettingsModal } from "./SettingsModal";
import { TeamsManager } from "./TeamsManager";
import {
  Copy,
  Check,
  Share2,
  Crown,
  Settings,
  Play,
  UserX,
  Users,
} from "lucide-react";

interface LobbyViewProps {
  room: PublicRoomState;
  myPlayerId: string | null;
  isHost: boolean;
  onPickColor: (colorId: string) => void;
  onPickIcon: (iconId: string) => void;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  onKickPlayer: (playerId: string) => void;
  onStartGame: () => void;
  onRequestPartner: (targetPlayerId: string) => void;
  onAcceptPartner: (requesterPlayerId: string) => void;
  onRandomizeTeams: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  myPlayerId,
  isHost,
  onPickColor,
  onPickIcon,
  onUpdateSettings,
  onKickPlayer,
  onStartGame,
  onRequestPartner,
  onAcceptPartner,
  onRandomizeTeams,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const myPlayer = room.players.find(p => p.id === myPlayerId);
  const takenColors = new Set(room.players.map(p => p.colorId));
  const takenIcons = new Set(room.players.map(p => p.iconId));

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const canStart =
    room.players.length >= 2 &&
    (!room.settings.teamsEnabled ||
      (room.players.length >= 4 &&
        room.players.length % 2 === 0 &&
        room.players.every(p => !!p.partnerPlayerId)));

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-5 animate-pop-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* ── LEFT COLUMN: Room Code, Players, Start Action (7 cols on lg) ── */}
        <div className="lg:col-span-7 flex flex-col gap-4">

          {/* Room Code Card */}
          <div className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-slate-900/95 border-2 border-indigo-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(99,102,241,0.12)]">
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Room Invitation Code
              </span>
              <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                {room.players.length}/{room.maxPlayers} Players
              </span>
            </div>

            {/* Big Room Code */}
            <div className="flex items-center justify-center py-1">
              <span
                className="text-4xl sm:text-5xl font-mono font-black tracking-[0.35em] text-white pl-3 text-center"
                style={{
                  textShadow: "0 0 24px rgba(129,140,248,0.8), 0 2px 8px rgba(0,0,0,0.8)",
                  fontFamily: "'Poppins', monospace",
                }}
              >
                {room.code}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={copyCode}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white text-xs font-bold transition border border-slate-700 shadow active:scale-95 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition border border-indigo-400/40 shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share Invite</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Players List Card */}
          <div className="flex flex-col gap-2.5 p-5 rounded-3xl bg-slate-900/95 border-2 border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-0.5">
              <div className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Joined Players ({room.players.length}/{room.maxPlayers})</span>
              </div>

              {isHost && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition active:scale-95 border border-slate-700 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Settings</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {room.players.map((p) => {
                const colorDef = LUDO_COLORS.find(c => c.id === p.colorId);
                const iconDef = LUDO_ICONS.find(i => i.id === p.iconId);
                const isMe = p.id === myPlayerId;
                const primaryColor = colorDef?.primary || "#6366f1";

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                      isMe
                        ? "bg-slate-950/80 border-2"
                        : "bg-slate-950/50 border border-slate-800/80"
                    }`}
                    style={isMe ? { borderColor: primaryColor, boxShadow: `0 0 12px ${primaryColor}30` } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md flex-shrink-0"
                        style={{
                          background: `radial-gradient(circle at 35% 30%, ${primaryColor}ff, ${primaryColor}88)`,
                          boxShadow: `0 0 8px ${primaryColor}50, inset 0 2px 4px rgba(255,255,255,0.3)`,
                        }}
                      >
                        {iconDef ? iconDef.emoji : "♟️"}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-bold text-sm">
                          <span className="text-white">{p.name}</span>
                          {isMe && (
                            <span className="text-[9px] font-black text-indigo-300 bg-indigo-500/25 px-1.5 py-0.5 rounded-full">
                              YOU
                            </span>
                          )}
                          {p.isHost && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                              <Crown className="w-3 h-3 text-amber-400" />
                              HOST
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          Seat {p.seatIndex + 1} • {colorDef?.name || "Player"}
                          {room.settings.teamsEnabled && p.partnerPlayerId && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-indigo-300 font-bold">
                              <Users className="w-3 h-3" /> Teamed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isHost && !p.isHost && (
                      <button
                        onClick={() => onKickPlayer(p.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Remove Player"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start Game Action Button */}
          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`flex items-center justify-center gap-2.5 w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-150 shadow-xl ${
                canStart
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-emerald-500/30 active:scale-95 cursor-pointer"
                  : "bg-slate-900 border-2 border-slate-800 text-slate-500 cursor-not-allowed"
              }`}
              style={{
                fontFamily: "'Poppins', sans-serif",
                boxShadow: canStart ? "0 6px 28px rgba(16,185,129,0.45)" : undefined,
              }}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>
                {room.players.length < 2
                  ? "⏳ Waiting for Players (Min 2 to start)"
                  : room.settings.teamsEnabled && !canStart
                  ? room.players.length < 4 || room.players.length % 2 !== 0
                    ? "Teams Require 4 or 6 Players"
                    : "Pair All Players to Start"
                  : "🎲 Start Game!"}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <div className="text-xs text-slate-400 font-semibold">
                Waiting for the host to start the match…
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Shape Preview & Token Customization (5 cols on lg) ── */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* Board Shape Preview */}
          <ShapePreview playerCount={room.players.length} players={room.players} />

          {/* Token & Color Customization */}
          {myPlayer && (
            <div className="flex flex-col gap-3.5 p-5 rounded-3xl bg-slate-900/95 border-2 border-slate-800 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>Customize Your Token</span>
              </div>

              {/* Color Picker */}
              <div className="flex flex-col gap-2">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Select Color:
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {LUDO_COLORS.map((c) => {
                    const isSelected = myPlayer.colorId === c.id;
                    const isTaken = takenColors.has(c.id) && !isSelected;

                    return (
                      <button
                        key={c.id}
                        disabled={isTaken}
                        onClick={() => onPickColor(c.id)}
                        title={isTaken ? `${c.name} (Taken)` : c.name}
                        className={`relative aspect-square rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? "scale-110 shadow-lg ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                            : isTaken
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:scale-105 active:scale-95 shadow"
                        }`}
                        style={{
                          background: `radial-gradient(circle at 35% 30%, ${c.primary}ff, ${c.border}cc)`,
                        }}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-white drop-shadow stroke-[3]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Picker */}
              <div className="flex flex-col gap-2">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Select Pawn Crest:
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {LUDO_ICONS.map((i) => {
                    const isSelected = myPlayer.iconId === i.id;
                    const isTaken = takenIcons.has(i.id) && !isSelected;

                    return (
                      <button
                        key={i.id}
                        disabled={isTaken}
                        onClick={() => onPickIcon(i.id)}
                        title={isTaken ? `${i.name} (Taken)` : i.name}
                        className={`aspect-square rounded-2xl transition-all duration-150 flex items-center justify-center text-lg cursor-pointer ${
                          isSelected
                            ? "scale-110 shadow-lg bg-indigo-600 border-2 border-indigo-300 ring-2 ring-indigo-400/50"
                            : isTaken
                            ? "opacity-20 cursor-not-allowed bg-slate-950"
                            : "bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700/80 shadow"
                        }`}
                      >
                        <span>{i.emoji}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Teams Manager */}
          {room.settings.teamsEnabled && (
            <TeamsManager
              players={room.players}
              myPlayerId={myPlayerId}
              isHost={isHost}
              partnerRequests={room.partnerRequests}
              onRequestPartner={onRequestPartner}
              onAcceptPartner={onAcceptPartner}
              onRandomizeTeams={onRandomizeTeams}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={room.settings}
        playerCount={room.players.length}
        isHost={isHost}
        onClose={() => setIsSettingsOpen(false)}
        onUpdate={onUpdateSettings}
      />
    </div>
  );
};
