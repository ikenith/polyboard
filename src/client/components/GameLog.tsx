import React, { useRef, useEffect } from "react";

interface GameLogProps {
  logs: string[];
}

function getLogStyle(log: string): { cls: string; icon: string } {
  const lower = log.toLowerCase();
  if (lower.includes("captured") || lower.includes("sent back")) {
    return { cls: "log-entry-capture", icon: "💥" };
  }
  if (lower.includes("home") || lower.includes("goal") || lower.includes("finished")) {
    return { cls: "log-entry-home", icon: "🏠" };
  }
  if (lower.includes("forfeited") || lower.includes("skipped")) {
    return { cls: "log-entry-forfeit", icon: "⚠️" };
  }
  if (lower.includes("6") || lower.includes("six")) {
    return { cls: "log-entry-normal", icon: "🎲" };
  }
  if (lower.includes("roll")) {
    return { cls: "log-entry-normal", icon: "🎲" };
  }
  if (lower.includes("moved") || lower.includes("move")) {
    return { cls: "log-entry-normal", icon: "➡️" };
  }
  if (lower.includes("join") || lower.includes("start")) {
    return { cls: "log-entry-normal", icon: "🎮" };
  }
  return { cls: "log-entry-normal", icon: "▪️" };
}

export const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-auto sm:h-auto w-full rounded-2xl ludo-card p-3.5 overflow-hidden" style={{ maxHeight: 220 }}>
      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
        Game Log
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-1 text-xs"
        style={{ maxHeight: 160 }}
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-[11px] p-2 text-center">
            🎲 The game log will appear here…
          </div>
        ) : (
          logs.map((log, idx) => {
            const { cls, icon } = getLogStyle(log);
            const isLatest = idx === logs.length - 1;
            return (
              <div
                key={idx}
                className={`py-1.5 px-2.5 rounded-lg leading-snug flex items-start gap-1.5 ${cls} ${
                  isLatest ? "animate-log-entry" : ""
                }`}
              >
                <span className="text-[12px] flex-shrink-0 leading-4">{icon}</span>
                <span className="text-[11px] text-slate-300 leading-4">{log}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
