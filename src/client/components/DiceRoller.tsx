import React, { useEffect, useRef } from "react";
import { sound } from "../utils/audio";

interface DiceRollerProps {
  currentRoll: number | null;
  lastRoll?: number | null;
  phase?: string;
  canRoll: boolean;
  isMyTurn: boolean;
  currentTurnPlayerName: string;
  consecutiveSixes?: number;
  onRoll: () => void;
}

// Authentic dice pip positions: [row, col] on a 3x3 grid (0-2, 0-2)
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const DiceFace: React.FC<{ value: number | null; active?: boolean; size?: number }> = ({
  value,
  active = false,
  size = 80,
}) => {
  const dots = value ? DOT_POSITIONS[value] ?? [] : [];
  const padding = size * 0.16;
  const cellSize = (size - padding * 2) / 3;
  const dotRadius = Math.max(size * 0.08, 5);

  return (
    <div
      className={`dice-face flex items-center justify-center select-none relative overflow-hidden transition-transform ${
        active ? "dice-face-active" : "dice-face-idle"
      }`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "22%",
      }}
    >
      {/* 3D Specular Highlight reflection */}
      <div
        className="absolute"
        style={{
          top: "6%",
          left: "6%",
          width: "36%",
          height: "32%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {value ? (
        <svg
          width={size - padding * 2}
          height={size - padding * 2}
          viewBox={`0 0 ${cellSize * 3} ${cellSize * 3}`}
          style={{ position: "absolute", top: padding, left: padding }}
        >
          {dots.map(([r, c], idx) => {
            const isSingleOne = value === 1;
            return (
              <circle
                key={idx}
                cx={c * cellSize + cellSize / 2}
                cy={r * cellSize + cellSize / 2}
                r={isSingleOne ? dotRadius * 1.35 : dotRadius}
                fill={isSingleOne ? "#DC2626" : "#1E293B"}
                style={{
                  filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))",
                }}
              />
            );
          })}
        </svg>
      ) : (
        /* Empty dice preview */
        <span className="text-3xl text-slate-400 font-black opacity-60">🎲</span>
      )}
    </div>
  );
};

export const DiceRoller: React.FC<DiceRollerProps> = ({
  currentRoll,
  lastRoll,
  phase,
  canRoll,
  isMyTurn,
  currentTurnPlayerName,
  consecutiveSixes = 0,
  onRoll,
}) => {
  const prevIsMyTurnCanRoll = useRef(false);

  // Play gentle alert chime when your turn to roll arrives
  useEffect(() => {
    const isNowMyTurnToRoll = isMyTurn && canRoll;
    if (isNowMyTurnToRoll && !prevIsMyTurnCanRoll.current) {
      sound.playYourTurn();
    }
    prevIsMyTurnCanRoll.current = isNowMyTurnToRoll;
  }, [isMyTurn, canRoll]);

  const handleClick = () => {
    if (!isMyTurn || !canRoll) return;
    sound.playDiceRoll();
    onRoll();
  };

  const isInteractive = isMyTurn && canRoll;
  const displayRoll = currentRoll ?? lastRoll ?? null;
  const isFirstTurnPhase = phase === "ROLLING_FOR_FIRST_TURN";

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-xs px-2 py-1">
      {/* Dice Container / Tray */}
      <div className="relative flex items-center justify-center p-3 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-inner">
        <button
          onClick={handleClick}
          disabled={!isInteractive}
          aria-label="Roll dice"
          className={`relative transition-transform duration-150 select-none ${
            isInteractive ? "hover:scale-105 active:scale-95 cursor-pointer" : ""
          }`}
        >
          <DiceFace value={displayRoll} active={!!displayRoll} size={82} />
        </button>

        {/* Six badge */}
        {displayRoll === 6 && (
          <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center shadow-lg">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">6! Again</span>
          </div>
        )}
      </div>

      {/* Prominent ROLL DICE Action Button for tactile mobile play */}
      {isInteractive ? (
        <button
          onClick={handleClick}
          className="w-full py-2.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider text-white shadow-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
          style={{
            background: "#111827",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          <span className="text-base">🎲</span>
          <span>{isFirstTurnPhase ? "Roll For First Turn!" : "ROLL DICE"}</span>
        </button>
      ) : (
        <div className="text-center min-h-[2rem] flex flex-col items-center justify-center">
          {isFirstTurnPhase ? (
            <span className="text-xs text-slate-400">
              Waiting for <strong className="text-slate-200">{currentTurnPlayerName}</strong> to roll first…
            </span>
          ) : isMyTurn ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-pulse">
              <span>🎯</span>
              <span>Rolled {displayRoll}! Tap a glowing pawn to move</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              Waiting for <strong className="text-slate-200">{currentTurnPlayerName}</strong>…
            </span>
          )}

          {consecutiveSixes > 0 && (
            <div className="mt-1 text-[11px] font-bold text-amber-300">
              🔥 {consecutiveSixes} six{consecutiveSixes > 1 ? "es" : ""} in a row!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
