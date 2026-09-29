import React from "react";
import { Player } from "../../games/types";
import { Users, Shuffle, Check, Send } from "lucide-react";
import { LUDO_COLORS, LUDO_ICONS } from "../../games/ludo/config";

interface TeamsManagerProps {
  players: Player[];
  myPlayerId: string | null;
  isHost: boolean;
  partnerRequests: Record<string, string>;
  onRequestPartner: (targetPlayerId: string) => void;
  onAcceptPartner: (requesterPlayerId: string) => void;
  onRandomizeTeams: () => void;
}

export const TeamsManager: React.FC<TeamsManagerProps> = ({
  players,
  myPlayerId,
  isHost,
  partnerRequests,
  onRequestPartner,
  onAcceptPartner,
  onRandomizeTeams,
}) => {
  const myPlayer = players.find(p => p.id === myPlayerId);
  const myPartnerId = myPlayer?.partnerPlayerId;
  const myPartner = players.find(p => p.id === myPartnerId);

  // Incoming requests for me
  const incomingRequesters = Object.entries(partnerRequests)
    .filter(([_, targetId]) => targetId === myPlayerId)
    .map(([reqId]) => players.find(p => p.id === reqId))
    .filter((p): p is Player => !!p);

  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-2xl glass-panel w-full border border-indigo-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
          <Users className="w-4 h-4 text-indigo-400" />
          Team Pairings
        </div>

        {isHost && (
          <button
            onClick={onRandomizeTeams}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 rounded-lg text-xs font-semibold transition"
          >
            <Shuffle className="w-3 h-3" />
            Randomize Teams
          </button>
        )}
      </div>

      {/* My Current Pairing */}
      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
        {myPartner ? (
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Your Partner:</span>
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              {myPartner.name}
            </div>
          </div>
        ) : (
          <div className="text-amber-400 font-medium text-center">
            You do not have a partner yet! Request one below.
          </div>
        )}
      </div>

      {/* Incoming Requests */}
      {incomingRequesters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] font-semibold text-slate-400">Incoming Requests:</div>
          {incomingRequesters.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs"
            >
              <span className="font-semibold text-slate-200">{req.name}</span>
              <button
                onClick={() => onAcceptPartner(req.id)}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition"
              >
                Accept
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Player List with Request Buttons */}
      <div className="flex flex-col gap-1">
        <div className="text-[11px] font-semibold text-slate-400">All Players:</div>
        {players.map((p) => {
          if (p.id === myPlayerId) return null;
          const partner = players.find(x => x.id === p.partnerPlayerId);
          const hasSentRequest = partnerRequests[myPlayerId || ""] === p.id;
          const colorDef = LUDO_COLORS.find(c => c.id === p.colorId);
          const iconDef = LUDO_ICONS.find(i => i.id === p.iconId);

          return (
            <div
              key={p.id}
              className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                  style={{ backgroundColor: colorDef?.primary || "#475569" }}
                >
                  {iconDef ? iconDef.emoji : "♟️"}
                </span>
                <span className="font-medium text-slate-200">{p.name}</span>
              </div>

              {partner ? (
                <span className="text-[10px] text-slate-400 italic">
                  Partnered with {partner.name}
                </span>
              ) : (
                <button
                  disabled={hasSentRequest || myPartnerId === p.id}
                  onClick={() => onRequestPartner(p.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${
                    hasSentRequest
                      ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
                >
                  <Send className="w-2.5 h-2.5" />
                  {hasSentRequest ? "Sent" : "Request"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
