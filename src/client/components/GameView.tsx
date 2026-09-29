import React, { useMemo, useState, useEffect } from "react";
import { PublicRoomState } from "../../shared/protocol";
import { LudoState } from "../../games/ludo/types";
import { getLegalActions } from "../../games/ludo/engine";
import { BoardRenderer } from "./BoardRenderer";
import { DiceRoller } from "./DiceRoller";
import { PlayerList } from "./PlayerList";
import { GameLog } from "./GameLog";
import { GameOverModal } from "./GameOverModal";
import { LUDO_COLORS, LUDO_ICONS, LUDO_BOARD_CONFIG } from "../../games/ludo/config";
import { WifiOff, Volume2, VolumeX, Copy, Check, Clock } from "lucide-react";
import { sound } from "../utils/audio";

interface GameViewProps {
  room: PublicRoomState;
  myPlayerId: string | null;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  onRollDice: () => void;
  onMoveToken: (tokenId: number) => void;
  onPlayAgain: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  room,
  myPlayerId,
  connectionStatus,
  onRollDice,
  onMoveToken,
  onPlayAgain,
}) => {
  const gameState: LudoState | null = room.gameState;
  const [isMuted, setIsMuted] = useState(() => sound.muted);
  const [copiedCode, setCopiedCode] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Turn timer countdown
  useEffect(() => {
    if (!room.turnDeadline) {
      setSecondsRemaining(null);
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.ceil((room.turnDeadline! - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [room.turnDeadline, gameState?.currentTurnPlayerId]);

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const legalActions = useMemo(() => {
    if (!gameState || !myPlayerId) return [];
    try {
      return getLegalActions(gameState, myPlayerId);
    } catch {
      return [];
    }
  }, [gameState, myPlayerId]);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400 font-medium">
        Loading game state…
      </div>
    );
  }

  const currentTurnPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const turnColorDef = currentTurnPlayer
    ? LUDO_COLORS.find(c => c.id === currentTurnPlayer.colorId)
    : undefined;
  const turnIconDef = currentTurnPlayer
    ? LUDO_ICONS.find(i => i.id === currentTurnPlayer.iconId)
    : undefined;

  const turnColor = turnColorDef?.primary || "#ef4444";

  return (
    <div className="game-shell w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-3 sm:py-5 pb-12 animate-pop-in">
      {/* Top Sub-Bar */}
      <div className="flex items-center justify-between w-full px-2 py-1 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {gameState.phase === "ROLLING_FOR_FIRST_TURN"
              ? "Roll to Decide Who Starts"
              : isMyTurn
              ? "Your Move!"
              : `${currentTurnPlayer?.name || "Opponent"}'s Turn`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden sm:inline text-[11px]">{isMuted ? "Muted" : "Sound"}</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-bold">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
            <span className="text-slate-400 font-mono text-[10px]">{connectionStatus === "connected" ? "LIVE" : "RECONNECTING"}</span>
          </div>
        </div>
      </div>

      {/* Dice stays above the board so the primary action is always visible on mobile. */}
      <div className="game-dice-rail game-dice-rail-top w-full flex justify-center mb-4">
        <div className="game-dice-panel flex flex-col items-center p-3 sm:p-4 rounded-3xl w-full max-w-md">
          <DiceRoller
            currentRoll={gameState.currentDiceRoll}
            lastRoll={gameState.lastDiceRoll}
            phase={gameState.phase}
            canRoll={gameState.canRoll}
            isMyTurn={isMyTurn}
            currentTurnPlayerName={currentTurnPlayer?.name || "Player"}
            consecutiveSixes={gameState.consecutiveSixes}
            onRoll={onRollDice}
          />
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-7 items-start">

        {/* ── Left Column: Board ── */}
        <div className="game-board-column lg:col-span-8 flex flex-col items-center gap-4">
          <div className="game-board-heading w-full max-w-[680px] flex items-end justify-between gap-4 px-1">
            <div>
              <p className="game-eyebrow">Live match</p>
              <h1 className="game-heading">Make your move</h1>
            </div>
            <div className="game-rule-chip hidden sm:flex">
              <span className="game-rule-dot" style={{ backgroundColor: turnColor }} />
              {gameState.settings.teamsEnabled ? "Team rules" : "Classic rules"}
            </div>
          </div>
          {/* Central Board */}
          <div className="game-board-stage w-full flex flex-col items-center">
            <div className="game-board-canvas w-full flex justify-center">
              <BoardRenderer
                gameState={gameState}
                myPlayerId={myPlayerId}
                legalActions={legalActions}
                onMoveToken={onMoveToken}
              />
            </div>
          </div>

        </div>

        {/* ── Right Column (lg:col-span-5): Turn Banner, Players, Log ── */}
        <div className="game-sidebar lg:col-span-4 flex flex-col gap-3">

          {/* Turn Banner with Timer Bar */}
          <div
            className={`relative flex flex-col w-full rounded-2xl border-2 transition-all overflow-hidden ${
              isMyTurn ? "turn-banner-glow" : ""
            }`}
            style={{
              borderColor: turnColor,
              background: `linear-gradient(135deg, ${turnColor}22 0%, rgba(15,10,35,0.96) 100%)`,
            }}
          >
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                {/* Player Avatar */}
                <div
                  className="relative w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shadow-lg flex-shrink-0"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${turnColor}ff, ${turnColor}aa)`,
                    boxShadow: `0 0 14px ${turnColor}88, inset 0 2px 4px rgba(255,255,255,0.4)`,
                  }}
                >
                  {turnIconDef ? turnIconDef.emoji : "♟️"}
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: turnColor }}>
                    {gameState.phase === "ROLLING_FOR_FIRST_TURN"
                      ? "Roll for first turn"
                      : isMyTurn
                      ? "🎯 YOUR TURN"
                      : "CURRENT TURN"}
                  </span>
                  <span className="text-base font-black text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {isMyTurn ? "You" : currentTurnPlayer?.name || "Player"}
                  </span>
                </div>
              </div>

              {/* Timer seconds badge */}
              {secondsRemaining !== null && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black shadow ${
                    secondsRemaining <= 10
                      ? "bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse"
                      : "bg-slate-900/90 text-amber-300 border border-slate-700"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{secondsRemaining}s</span>
                </div>
              )}
            </div>

            {/* Action Description Strip */}
            {gameState.lastActionDescription && (
              <div className="px-3.5 pb-2 text-xs text-slate-300 truncate italic">
                {gameState.lastActionDescription}
              </div>
            )}

            {/* Live Timer Progress Line */}
            {secondsRemaining !== null && (
              <div className="w-full h-1 bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (secondsRemaining / (room.settings.turnTimeSeconds || 60)) * 100)}%`,
                    backgroundColor: secondsRemaining <= 10 ? "#ef4444" : turnColor,
                  }}
                />
              </div>
            )}
          </div>

          {/* Quick Player Token Progress Bar */}
          <div className="flex items-center gap-2 flex-wrap w-full p-2 rounded-2xl bg-slate-900/80 border border-slate-800">
            {gameState.players.map((p) => {
              const colorDef = LUDO_COLORS.find(c => c.id === p.colorId);
              const iconDef = LUDO_ICONS.find(i => i.id === p.iconId);
              const homeTokens = p.tokens.filter(t => t.location.type === "home").length;
              const isTurn = p.id === gameState.currentTurnPlayerId;
              const pc = colorDef?.primary || "#ef4444";

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                    isTurn
                      ? "bg-slate-800 border-2 shadow-md"
                      : "bg-slate-950/60 border border-slate-800/80 opacity-80"
                  }`}
                  style={{ borderColor: isTurn ? pc : undefined }}
                >
                  <span className="text-sm">{iconDef ? iconDef.emoji : "♟️"}</span>
                  <span className="text-xs font-bold text-slate-200 truncate max-w-[80px]">{p.name}</span>
                  <div className="flex gap-1 ml-1">
                    {Array.from({ length: LUDO_BOARD_CONFIG.TOKENS_PER_PLAYER }).map((_, i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: i < homeTokens ? "#F59E0B" : "rgba(255,255,255,0.2)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leaderboard & Players Card */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Leaderboard &amp; Players</span>
            </div>
            <PlayerList
              players={room.players}
              currentTurnPlayerId={gameState.currentTurnPlayerId}
              myPlayerId={myPlayerId}
              ludoPlayers={gameState.players}
              turnDeadline={room.turnDeadline}
              teamsEnabled={room.settings.teamsEnabled}
            />
          </div>

          {/* The player list remains below the board controls; the log is last. */}
        </div>
      </div>

      {/* Quiet live feed stays at the end of the game layout. */}
      <aside className="game-log-dock game-log-dock-end" aria-label="Game log">
        <GameLog logs={room.logs} />
      </aside>

      {/* Game Over Modal */}
      {room.status === "GAME_OVER" && (
        <GameOverModal
          gameState={gameState}
          players={room.players}
          onPlayAgain={onPlayAgain}
        />
      )}
    </div>
  );
};
