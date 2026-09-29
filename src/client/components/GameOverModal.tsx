import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Player } from "../../games/types";
import { LudoState } from "../../games/ludo/types";
import { LUDO_COLORS, LUDO_ICONS } from "../../games/ludo/config";
import { RotateCcw } from "lucide-react";
import { sound } from "../utils/audio";

interface GameOverModalProps {
  gameState: LudoState;
  players: Player[];
  onPlayAgain: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameState,
  players,
  onPlayAgain,
}) => {
  useEffect(() => {
    sound.playWin();
    try {
      // Burst confetti from both sides
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: 0.2, y: 0.55 },
        colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { x: 0.8, y: 0.55 },
          colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'],
        });
      }, 300);
    } catch {}
  }, []);

  const isTeamMode = gameState.settings.teamsEnabled;

  const getRankBg = (idx: number) => {
    if (idx === 0) return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
    if (idx === 1) return 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)';
    if (idx === 2) return 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)';
    return 'rgba(255,255,255,0.06)';
  };

  const getRankTextColor = (idx: number) => idx <= 2 ? '#0a0518' : '#94a3b8';
  const medal = (idx: number) => idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-pop-in">
      <div className="ludo-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl flex flex-col gap-5 p-6 pb-8 sm:pb-6">
        {/* Confetti header */}
        <div className="flex flex-col items-center gap-2 text-center">
          {/* Trophy podium icon */}
          <div className="relative">
            <div
              className="w-18 h-18 rounded-full flex items-center justify-center shadow-2xl animate-scale-bounce"
              style={{
                width: 72, height: 72,
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                boxShadow: '0 0 32px rgba(255,200,0,0.7), 0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              <span style={{ fontSize: 32 }}>🏆</span>
            </div>
          </div>

          <div>
            <h2
              className="text-2xl font-black text-white"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {isTeamMode ? "Team Victory!" : "Game Over!"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isTeamMode ? "Team results are in!" : "Final standings"}
            </p>
          </div>
        </div>

        {/* Rankings */}
        <div className="flex flex-col gap-2 w-full">
          {isTeamMode && gameState.teamRankings && gameState.teamRankings.length > 0 ? (
            gameState.teamRankings.map((teamIdx, idx) => {
              const teamPlayers = gameState.players.filter(p => p.teamIndex === teamIdx);
              const teamTokensHome = teamPlayers.reduce(
                (sum, p) => sum + p.tokens.filter(t => t.location.type === "home").length,
                0
              );

              return (
                <div
                  key={teamIdx}
                  className={`flex flex-col gap-2 p-3.5 rounded-2xl border text-left ${
                    idx === 0 ? "border-yellow-500/50" : "border-slate-700/50"
                  }`}
                  style={{
                    background: idx === 0
                      ? 'linear-gradient(135deg, rgba(255,200,0,0.15) 0%, rgba(255,150,0,0.08) 100%)'
                      : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black">{medal(idx)}</span>
                      <span className="font-bold text-sm text-slate-100" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Team {teamIdx + 1}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full">
                      {teamTokensHome}/8 home
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pl-7">
                    {teamPlayers.map(tp => {
                      const player = players.find(p => p.id === tp.id);
                      const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
                      const iconDef = player ? LUDO_ICONS.find(i => i.id === player.iconId) : undefined;
                      const primaryColor = colorDef?.primary || "#6366f1";
                      return (
                        <div key={tp.id} className="flex items-center gap-1.5">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow"
                            style={{
                              background: `radial-gradient(circle at 35% 30%, ${primaryColor}ff, ${primaryColor}88)`,
                            }}
                          >
                            {iconDef ? iconDef.emoji : "♟️"}
                          </div>
                          <span className="text-xs text-slate-300 font-medium">
                            {player?.name || tp.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            gameState.rankings.map((pid, idx) => {
              const player = players.find(p => p.id === pid);
              const colorDef = player ? LUDO_COLORS.find(c => c.id === player.colorId) : undefined;
              const iconDef = player ? LUDO_ICONS.find(i => i.id === player.iconId) : undefined;
              const primaryColor = colorDef?.primary || "#6366f1";

              return (
                <div
                  key={pid}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    idx === 0
                      ? "border-yellow-500/60 scale-[1.02]"
                      : "border-slate-700/40"
                  }`}
                  style={{
                    background: idx === 0
                      ? 'linear-gradient(135deg, rgba(255,200,0,0.15) 0%, rgba(255,150,0,0.08) 100%)'
                      : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black w-7 text-center">{medal(idx)}</span>
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base shadow-lg"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, ${primaryColor}ff, ${primaryColor}88)`,
                        boxShadow: idx === 0
                          ? `0 0 16px ${primaryColor}80, inset 0 2px 4px rgba(255,255,255,0.3)`
                          : `0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.15)`,
                      }}
                    >
                      {iconDef ? iconDef.emoji : "♟️"}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-sm text-slate-100" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {player?.name || "Player"}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-bold text-yellow-400">Champion! 🏆</span>
                      )}
                    </div>
                  </div>

                  {idx === 0 && (
                    <div
                      className="text-[10px] font-black px-2.5 py-1 rounded-full"
                      style={{ background: getRankBg(idx), color: getRankTextColor(idx) }}
                    >
                      Winner!
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={onPlayAgain}
          className="flex items-center justify-center gap-2.5 w-full py-4 px-4 text-white font-black text-sm rounded-2xl shadow-xl transition active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            boxShadow: '0 6px 24px rgba(99,102,241,0.5)',
          }}
        >
          <RotateCcw className="w-4 h-4" />
          Play Again in Same Room
        </button>
      </div>
    </div>
  );
};
