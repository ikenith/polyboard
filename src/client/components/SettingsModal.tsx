import React from "react";
import { RoomSettings } from "../../games/types";
import { X, Clock, Zap, ShieldAlert, Users } from "lucide-react";

interface SettingsModalProps {
  settings: RoomSettings;
  playerCount: number;
  isOpen: boolean;
  isHost: boolean;
  onClose: () => void;
  onUpdate: (newSettings: Partial<RoomSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  playerCount,
  isOpen,
  isHost,
  onClose,
  onUpdate,
}) => {
  if (!isOpen) return null;

  const canEnableTeams = playerCount >= 4 && playerCount % 2 === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-pop-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-base font-bold text-slate-100">
            Room Settings
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setting 1: Turn Timer */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Turn Timer
            </span>
            <span className="text-indigo-400 font-bold">
              {settings.turnTimeSeconds === 0 ? "Unlimited" : `${settings.turnTimeSeconds}s`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[15, 30, 60, 90].map((t) => (
              <button
                key={t}
                disabled={!isHost}
                onClick={() => onUpdate({ turnTimeSeconds: t })}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${
                  settings.turnTimeSeconds === t
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>

        {/* Setting 2: Auto-move single legal move */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Auto-Move Single Option
            </span>
            <span className="text-[11px] text-slate-400">
              Automatically advance if only 1 legal move is available
            </span>
          </div>

          <input
            type="checkbox"
            disabled={!isHost}
            checked={settings.autoMoveSingle}
            onChange={(e) => onUpdate({ autoMoveSingle: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Setting 3: Blocks stop opponents passing */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Blocks Stop Opponents Passing
            </span>
            <span className="text-[11px] text-slate-400">
              2+ tokens create a barrier opponents cannot jump over
            </span>
          </div>

          <input
            type="checkbox"
            disabled={!isHost}
            checked={settings.blocksStopOpponents}
            onChange={(e) => onUpdate({ blocksStopOpponents: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Setting 4: Teams Mode */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-800">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Team Play (2 vs 2 or 3 vs 3)
            </span>
            <span className="text-[11px] text-slate-400">
              {canEnableTeams
                ? "Partners sit opposite and share blocks and victories"
                : "Requires 4 or 6 players to activate"}
            </span>
          </div>

          <input
            type="checkbox"
            disabled={!isHost || !canEnableTeams}
            checked={settings.teamsEnabled}
            onChange={(e) => onUpdate({ teamsEnabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:opacity-30"
          />
        </div>

        {!isHost && (
          <div className="text-[11px] text-slate-400 italic text-center">
            Only the room host can alter these settings.
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};
