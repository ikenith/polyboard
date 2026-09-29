import React from "react";
import { Player } from "../../games/types";
import { LUDO_COLORS, LUDO_ICONS, LUDO_BOARD_CONFIG } from "../../games/ludo/config";
import { LudoPlayerState } from "../../games/ludo/types";
import { Crown, Users } from "lucide-react";

interface PlayerListProps {
  players: Player[];
  currentTurnPlayerId: string | null;
  myPlayerId: string | null;
  ludoPlayers?: LudoPlayerState[];
  turnDeadline?: number | null;
  teamsEnabled?: boolean;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  currentTurnPlayerId,
  myPlayerId,
  ludoPlayers,
  turnDeadline,
  teamsEnabled,
}) => {
  const [secondsRemaining, setSecondsRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!turnDeadline) {
      setSecondsRemaining(null);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline, currentTurnPlayerId]);

  const TOTAL_TOKENS = LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER;

  return (
    <div className="flex flex-col gap-2 w-full">
      {players.map((player) => {
        const isCurrentTurn = currentTurnPlayerId === player.id;
        const isMe = player.id === myPlayerId;
        const colorDef = LUDO_COLORS.find(c => c.id === player.colorId);
        const iconDef = LUDO_ICONS.find(i => i.id === player.iconId);
        const ludoState = ludoPlayers?.find(lp => lp.id === player.id);

        const homeCount = ludoState
          ? ludoState.tokens.filter(t => t.location.type === "home").length
          : 0;
        const isFinished = ludoState?.hasFinished ?? false;
        const rank = ludoState?.rank;
        const progressPct = (homeCount / TOTAL_TOKENS) * 100;
        const primaryColor = colorDef?.primary || "#6366f1";

        return (
          <div
            key={player.id}
            className={`relative flex flex-col gap-1.5 px-3 py-2.5 rounded-xl transition-all overflow-hidden ${
              isCurrentTurn
                ? "border-2"
                : "border border-slate-800/60 bg-slate-900/50"
            }`}
            style={
              isCurrentTurn
                ? {
                    borderColor: primaryColor,
                    background: `linear-gradient(135deg, ${primaryColor}18 0%, ${primaryColor}08 100%)`,
                    boxShadow: `0 0 16px ${primaryColor}30, 0 2px 8px rgba(0,0,0,0.4)`,
                  }
                : undefined
            }
          >
            {/* Thin color bar on left edge */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl"
              style={{ backgroundColor: primaryColor, opacity: isCurrentTurn ? 1 : 0.4 }}
            />

            <div className="flex items-center justify-between pl-1">
              {/* Left: Avatar + Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Color circle avatar */}
                <div
                  className="relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${primaryColor}ff, ${primaryColor}88)`,
                    boxShadow: isCurrentTurn
                      ? `0 0 10px ${primaryColor}80, inset 0 1px 2px rgba(255,255,255,0.3)`
                      : `0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.2)`,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{iconDef ? iconDef.emoji : "♟️"}</span>
                  {/* Connected indicator */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                      player.connected ? "bg-emerald-400" : "bg-rose-500"
                    }`}
                    style={{ borderColor: isCurrentTurn ? primaryColor + "33" : "#0f0b2d" }}
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1 text-xs font-bold truncate">
                    <span className="truncate" style={{ color: isCurrentTurn ? primaryColor : "#e2e8f0" }}>
                      {player.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] bg-indigo-500/25 text-indigo-300 font-black px-1.5 py-0.5 rounded-full flex-shrink-0">
                        YOU
                      </span>
                    )}
                    {player.isHost && (
                      <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    )}
                    {teamsEnabled && player.partnerPlayerId && (
                      <Users className="w-2.5 h-2.5 text-indigo-300 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Seat {player.seatIndex + 1}
                  </div>
                </div>
              </div>

              {/* Right: Rank or token count + timer */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isFinished ? (
                  <span
                    className="font-black text-xs px-2.5 py-1 rounded-full"
                    style={{
                      background: rank === 1 ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.08)',
                      color: rank === 1 ? '#1a0a00' : '#94a3b8',
                    }}
                  >
                    {rank === 1 ? "🥇 1st" : rank === 2 ? "🥈 2nd" : rank === 3 ? "🥉 3rd" : `#${rank}`}
                  </span>
                ) : (
                  <div className="flex items-center gap-1 text-xs font-bold">
                    {/* Token dots */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: TOTAL_TOKENS }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full transition-all"
                          style={{
                            backgroundColor: i < homeCount ? primaryColor : 'rgba(255,255,255,0.1)',
                            boxShadow: i < homeCount ? `0 0 4px ${primaryColor}80` : undefined,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{homeCount}/{TOTAL_TOKENS}</span>
                  </div>
                )}

                {isCurrentTurn && secondsRemaining !== null && (
                  <span
                    className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-lg ${
                      secondsRemaining <= 10
                        ? "bg-rose-500/20 text-rose-400 animate-pulse"
                        : "bg-slate-800/80 text-slate-300"
                    }`}
                  >
                    {secondsRemaining}s
                  </span>
                )}
              </div>
            </div>

            {/* Token progress bar */}
            {!isFinished && homeCount > 0 && (
              <div className="pl-1 pr-1">
                <div className="h-1 bg-slate-800/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full token-progress-bar"
                    style={{
                      width: `${progressPct}%`,
                      background: `linear-gradient(90deg, ${primaryColor}bb, ${primaryColor}ff)`,
                      boxShadow: `0 0 6px ${primaryColor}60`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
