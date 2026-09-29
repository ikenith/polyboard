import React, { useState, useEffect } from "react";
import { useRoomSocket } from "./hooks/useRoomSocket";
import { LobbyView } from "./components/LobbyView";
import { GameView } from "./components/GameView";
import { Plus, LogIn, AlertCircle, ArrowLeft } from "lucide-react";

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  const roomMatch = currentPath.match(/^\/room\/([a-zA-Z0-9]{6})$/i);
  const roomCode = roomMatch ? roomMatch[1].toUpperCase() : null;

  if (roomCode) {
    return <RoomPage roomCode={roomCode} onLeave={() => navigateTo("/")} />;
  }

  return <HomePage onJoinRoom={(code) => navigateTo(`/room/${code.toUpperCase()}`)} />;
};

interface HomePageProps {
  onJoinRoom: (code: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onJoinRoom }) => {
  const [name, setName] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("polyboard_player_name") || "" : ""
  );
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setHomeError("Please enter your display name");
      return;
    }
    localStorage.setItem("polyboard_player_name", trimmed);
    setIsCreating(true);
    setHomeError(null);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: "ludo" }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      const data = (await res.json()) as { code: string; url: string };
      onJoinRoom(data.code);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create room. Please try again.";
      setHomeError(msg);
      setIsCreating(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setHomeError("Please enter your display name");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setHomeError("Room code must be 6 characters");
      return;
    }
    localStorage.setItem("polyboard_player_name", trimmed);
    onJoinRoom(code);
  };

  return (
    <div className="home-page-root relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Layered background — pure CSS, no extra elements */}
      <div
        className="home-bg-layer absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 15% 12%, rgba(229,57,53,0.13) 0%, transparent 60%)," +
            "radial-gradient(ellipse 70% 55% at 85% 88%, rgba(30,136,229,0.13) 0%, transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 85% 12%, rgba(67,160,71,0.08) 0%, transparent 55%)," +
            "radial-gradient(ellipse 60% 50% at 15% 88%, rgba(253,216,53,0.08) 0%, transparent 55%)," +
            "linear-gradient(160deg, #0a0518 0%, #0d0820 50%, #0a0518 100%)",
        }}
      />

      {/* Centered content */}
      <div className="home-card-wrapper relative z-10 flex flex-col items-center gap-6 w-full max-w-sm animate-pop-in">

        {/* ── Hero ── */}
        <div className="flex flex-col items-center gap-4">
          {/* Classic Ludo board icon */}
          <svg
            viewBox="0 0 88 88"
            className="w-24 h-24 drop-shadow-2xl"
            style={{ animation: "board-bob 4s ease-in-out infinite" }}
            aria-hidden="true"
          >
            <defs>
              <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.6)" />
              </filter>
            </defs>
            <rect x="2" y="2" width="84" height="84" rx="18" fill="#1a1040" filter="url(#iconShadow)" />
            <rect x="2" y="2" width="84" height="84" rx="18" fill="#1a1040" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
            <rect x="4"  y="4"  width="37" height="37" rx="13" fill="#E53935" />
            <rect x="47" y="4"  width="37" height="37" rx="13" fill="#1E88E5" />
            <rect x="4"  y="47" width="37" height="37" rx="13" fill="#43A047" />
            <rect x="47" y="47" width="37" height="37" rx="13" fill="#FDD835" />
            {/* white cross track */}
            <rect x="4"  y="40" width="80" height="8" fill="rgba(255,255,255,0.96)" />
            <rect x="40" y="4"  width="8"  height="80" fill="rgba(255,255,255,0.96)" />
            {/* center medallion */}
            <circle cx="44" cy="44" r="10" fill="#1a1040" stroke="rgba(255,215,0,0.8)" strokeWidth="2" />
            <text x="44" y="49" textAnchor="middle" fill="#FFD700" fontSize="11" fontWeight="bold" style={{userSelect:"none"}}>★</text>
            {/* token nests – red */}
            {([[13,13],[24,13],[13,24],[24,24]] as [number,number][]).map(([x,y],i) => <circle key={`r${i}`} cx={x} cy={y} r="4" fill="rgba(255,255,255,0.9)" />)}
            {/* blue */}
            {([[57,13],[68,13],[57,24],[68,24]] as [number,number][]).map(([x,y],i) => <circle key={`b${i}`} cx={x} cy={y} r="4" fill="rgba(255,255,255,0.9)" />)}
            {/* green */}
            {([[13,57],[24,57],[13,68],[24,68]] as [number,number][]).map(([x,y],i) => <circle key={`g${i}`} cx={x} cy={y} r="4" fill="rgba(255,255,255,0.9)" />)}
            {/* yellow */}
            {([[57,57],[68,57],[57,68],[68,68]] as [number,number][]).map(([x,y],i) => <circle key={`y${i}`} cx={x} cy={y} r="4" fill="rgba(255,255,255,0.9)" />)}
          </svg>

          <div className="text-center">
            <h1
              className="home-title text-5xl font-black tracking-tight leading-none ludo-title-gradient-2"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              LUDO
            </h1>
            <p className="home-subtitle text-sm text-slate-400 mt-2 font-medium">
              The classic board game — now online!
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            </div>
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="home-form-card flex flex-col gap-4 w-full p-6 rounded-3xl bg-slate-900/95 border-2 border-indigo-500/30 shadow-[0_12px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(99,102,241,0.15)] backdrop-blur-xl">
          {/* Name field */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => { setName(e.target.value); setHomeError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoom(); }}
              placeholder="e.g. Alex, Rahul, Sam…"
              className="w-full px-4 py-3.5 bg-slate-950/90 border-2 border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/25 rounded-2xl text-white font-bold placeholder:text-slate-500 text-sm shadow-inner transition outline-none"
            />
          </div>

          {/* Error */}
          {homeError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{homeError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Create button */}
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="home-create-btn flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wide transition active:scale-95 disabled:opacity-50 shadow-xl cursor-pointer"
              style={{
                background: isCreating
                  ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                  : "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)",
                boxShadow: isCreating ? undefined : "0 6px 28px rgba(255,160,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
                color: isCreating ? "#fff" : "#1a0a00",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>{isCreating ? "Creating Room…" : "🎲 Create New Game"}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-0.5">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">or join existing</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Join by code */}
            <form onSubmit={handleJoinByCode} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setHomeError(null); }}
                maxLength={6}
                placeholder="ROOM CODE"
                className="flex-1 px-4 py-3.5 bg-slate-950/90 border-2 border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/25 rounded-2xl text-white font-mono font-black tracking-widest uppercase placeholder:text-slate-500 text-sm text-center shadow-inner transition outline-none"
              />
              <button
                type="submit"
                className="home-join-btn flex items-center justify-center px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl border-2 border-indigo-400/40 transition active:scale-95 shadow-lg shadow-indigo-600/30 cursor-pointer"
                title="Join Game"
              >
                <LogIn className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-semibold tracking-wide">
          2–7 players • Cross-platform • Instant play
        </p>
      </div>
    </div>
  );
};

interface RoomPageProps {
  roomCode: string;
  onLeave: () => void;
}

const RoomPage: React.FC<RoomPageProps> = ({ roomCode, onLeave }) => {
  const {
    connectionStatus,
    room,
    myPlayerId,
    isHost,
    error,
    clearError,
    joinRoom,
    pickColor,
    pickIcon,
    toggleTeams,
    requestPartner,
    acceptPartner,
    randomizeTeams,
    updateSettings,
    kickPlayer,
    startGame,
    rollDice,
    moveToken,
    playAgain,
  } = useRoomSocket(roomCode);

  const [promptName, setPromptName] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("polyboard_player_name") || "" : ""
  );
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  useEffect(() => {
    if (connectionStatus === "connected" && !myPlayerId) {
      const savedToken =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(`polyboard_session_${roomCode.toUpperCase()}`)
          : null;
      if (savedToken) return;
      const existingName =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("polyboard_player_name")
          : null;
      if (existingName) {
        joinRoom(existingName);
      } else {
        setJoinModalOpen(true);
      }
    }
  }, [connectionStatus, myPlayerId, joinRoom, roomCode]);

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptName.trim()) return;
    joinRoom(promptName.trim());
    setJoinModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0518" }}>
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40">
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/60 shadow active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>

        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow">
            <rect x="1" y="1" width="10" height="10" rx="3" fill="#E53935" />
            <rect x="13" y="1" width="10" height="10" rx="3" fill="#1E88E5" />
            <rect x="1" y="13" width="10" height="10" rx="3" fill="#43A047" />
            <rect x="13" y="13" width="10" height="10" rx="3" fill="#FDD835" />
          </svg>
          <span
            className="font-black text-sm tracking-wider text-white"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            LUDO
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono font-bold text-amber-300">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-sans">ROOM</span>
          <span>{roomCode}</span>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 text-white shadow-xl text-xs font-bold animate-pop-in max-w-[90vw]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{error}</span>
          <button onClick={clearError} className="ml-2 hover:opacity-75 flex-shrink-0 text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center">
        {!room ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-400 text-sm">
            <div className="w-11 h-11 rounded-2xl border-4 border-indigo-800 border-t-indigo-400 animate-spin" />
            <span className="font-medium">
              Connecting to room <span className="text-white font-bold">{roomCode}</span>…
            </span>
          </div>
        ) : room.status === "LOBBY" ? (
          <LobbyView
            room={room}
            myPlayerId={myPlayerId}
            isHost={isHost}
            onPickColor={pickColor}
            onPickIcon={pickIcon}
            onUpdateSettings={updateSettings}
            onKickPlayer={kickPlayer}
            onStartGame={startGame}
            onRequestPartner={requestPartner}
            onAcceptPartner={acceptPartner}
            onRandomizeTeams={randomizeTeams}
          />
        ) : (
          <GameView
            room={room}
            myPlayerId={myPlayerId}
            connectionStatus={connectionStatus}
            onRollDice={rollDice}
            onMoveToken={moveToken}
            onPlayAgain={playAgain}
          />
        )}
      </main>

      {/* Join Room Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-pop-in">
          <form
            onSubmit={handleManualJoin}
            className="flex flex-col gap-5 w-full max-w-sm p-7 rounded-3xl bg-slate-900/95 border-2 border-indigo-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(99,102,241,0.2)]"
          >
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <svg viewBox="0 0 60 60" className="w-14 h-14 drop-shadow-xl">
                  <rect x="2" y="2" width="56" height="56" rx="14" fill="#1a1040" stroke="rgba(139,92,246,0.4)" strokeWidth="2"/>
                  <rect x="4"  y="4"  width="25" height="25" rx="8" fill="#E53935" opacity="0.95"/>
                  <rect x="31" y="4"  width="25" height="25" rx="8" fill="#1E88E5" opacity="0.95"/>
                  <rect x="4"  y="31" width="25" height="25" rx="8" fill="#43A047" opacity="0.95"/>
                  <rect x="31" y="31" width="25" height="25" rx="8" fill="#FDD835" opacity="0.95"/>
                  <circle cx="30" cy="30" r="7" fill="#1a1040"/>
                  <text x="30" y="35" textAnchor="middle" fill="#FFD700" fontSize="9" style={{userSelect:"none"}}>★</text>
                </svg>
              </div>
              <h3 className="text-2xl font-black text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Join Game
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Room <span className="font-mono font-black text-amber-300 tracking-wider">{roomCode}</span> — Enter your name
              </p>
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300">Your Name</label>
              <input
                type="text"
                value={promptName}
                maxLength={20}
                autoFocus
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="e.g. Alex, Sam, Jordan…"
                className="w-full px-4 py-3.5 bg-slate-950/90 border-2 border-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/25 rounded-2xl text-white font-bold placeholder:text-slate-500 text-sm shadow-inner transition outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!promptName.trim()}
              className="w-full py-4 font-black text-slate-950 text-sm uppercase tracking-wider rounded-2xl shadow-xl transition active:scale-95 disabled:opacity-40 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)",
                boxShadow: promptName.trim() ? "0 6px 28px rgba(255,160,0,0.5), 0 2px 8px rgba(0,0,0,0.4)" : undefined,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              🎲 Enter Game
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
