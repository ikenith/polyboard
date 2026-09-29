import { useState, useEffect, useRef, useCallback } from "react";
import { 
  ClientMessage, 
  ServerMessage, 
  PublicRoomState 
} from "../../shared/protocol";
import { Player, RoomSettings } from "../../games/types";
import { 
  playDiceRoll, 
  playMove, 
  playCapture, 
  playHome, 
  playTurnAlert 
} from "../utils/sound";

export interface UseRoomSocketReturn {
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  room: PublicRoomState | null;
  myPlayerId: string | null;
  myPlayer: Player | undefined;
  isHost: boolean;
  error: string | null;
  clearError: () => void;
  joinRoom: (name: string) => void;
  pickColor: (colorId: string) => void;
  pickIcon: (iconId: string) => void;
  toggleTeams: (enabled: boolean) => void;
  requestPartner: (targetPlayerId: string) => void;
  acceptPartner: (requesterPlayerId: string) => void;
  randomizeTeams: () => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  kickPlayer: (targetPlayerId: string) => void;
  startGame: () => void;
  rollDice: () => void;
  moveToken: (tokenId: number) => void;
  playAgain: () => void;
}

export function useRoomSocket(roomCode: string): UseRoomSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const previousTurnRef = useRef<string | null>(null);
  const previousRollRef = useRef<number | null>(null);
  const previousLogsLengthRef = useRef<number>(0);
  const myPlayerIdRef = useRef<string | null>(null);

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  // Send typed message
  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!roomCode) return;

    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;
      setConnectionStatus("connecting");

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/room/${roomCode.toUpperCase()}/ws`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        setConnectionStatus("connected");
        setError(null);

        // Auto-join with existing session token if present
        const savedToken = localStorage.getItem(`polyboard_session_${roomCode.toUpperCase()}`);
        const savedName = localStorage.getItem("polyboard_player_name") || "Player";

        if (savedToken) {
          sendMessage({
            type: "join",
            name: savedName,
            sessionToken: savedToken,
          });
        }
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg: ServerMessage = JSON.parse(event.data);

          if (msg.type === "welcome") {
            setMyPlayerId(msg.playerId);
            localStorage.setItem(`polyboard_session_${roomCode.toUpperCase()}`, msg.sessionToken);
          } else if (msg.type === "state_update") {
            const nextRoom = msg.room;

            // Audio cues based on state transitions
            if (nextRoom.gameState) {
              const currentRoll = nextRoom.gameState.currentDiceRoll;
              if (currentRoll !== null && currentRoll !== previousRollRef.current) {
                playDiceRoll();
              }
              previousRollRef.current = currentRoll;

              // Check if turn changed to me
              const currentTurn = nextRoom.gameState.currentTurnPlayerId;
              if (currentTurn && currentTurn !== previousTurnRef.current) {
                if (currentTurn === myPlayerIdRef.current) {
                  playTurnAlert();
                }
              }
              previousTurnRef.current = currentTurn;

              // Detect log updates for captures and home
              if (nextRoom.logs.length > previousLogsLengthRef.current) {
                const latest = nextRoom.logs[nextRoom.logs.length - 1] || "";
                if (latest.includes("captured")) {
                  playCapture();
                } else if (latest.includes("home")) {
                  playHome();
                } else if (latest.includes("moved") || latest.includes("start cell")) {
                  playMove();
                }
              }
              previousLogsLengthRef.current = nextRoom.logs.length;
            }

            setRoom(nextRoom);
          } else if (msg.type === "error") {
            setError(msg.message);
          }
        } catch (e) {
          console.error("Failed to parse server message", e);
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setConnectionStatus("disconnected");
        // Reconnect attempt after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = () => {
        if (isUnmounted) return;
        setConnectionStatus("error");
      };
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [roomCode, sendMessage]);

  // Actions
  const joinRoom = useCallback((name: string) => {
    localStorage.setItem("polyboard_player_name", name);
    const savedToken = localStorage.getItem(`polyboard_session_${roomCode.toUpperCase()}`);
    sendMessage({
      type: "join",
      name,
      sessionToken: savedToken || undefined,
    });
  }, [roomCode, sendMessage]);

  const pickColor = useCallback((colorId: string) => {
    sendMessage({ type: "pick_color", colorId });
  }, [sendMessage]);

  const pickIcon = useCallback((iconId: string) => {
    sendMessage({ type: "pick_icon", iconId });
  }, [sendMessage]);

  const toggleTeams = useCallback((enabled: boolean) => {
    sendMessage({ type: "toggle_teams", enabled });
  }, [sendMessage]);

  const requestPartner = useCallback((targetPlayerId: string) => {
    sendMessage({ type: "request_partner", targetPlayerId });
  }, [sendMessage]);

  const acceptPartner = useCallback((requesterPlayerId: string) => {
    sendMessage({ type: "accept_partner", requesterPlayerId });
  }, [sendMessage]);

  const randomizeTeams = useCallback(() => {
    sendMessage({ type: "randomize_teams" });
  }, [sendMessage]);

  const updateSettings = useCallback((settings: Partial<RoomSettings>) => {
    sendMessage({ type: "update_settings", settings });
  }, [sendMessage]);

  const kickPlayer = useCallback((targetPlayerId: string) => {
    sendMessage({ type: "kick_player", targetPlayerId });
  }, [sendMessage]);

  const startGame = useCallback(() => {
    sendMessage({ type: "start_game" });
  }, [sendMessage]);

  const rollDice = useCallback(() => {
    sendMessage({ type: "roll" });
  }, [sendMessage]);

  const moveToken = useCallback((tokenId: number) => {
    sendMessage({ type: "move", tokenId });
  }, [sendMessage]);

  const playAgain = useCallback(() => {
    sendMessage({ type: "play_again" });
  }, [sendMessage]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const myPlayer = room?.players.find(p => p.id === myPlayerId);
  const isHost = myPlayer?.isHost ?? false;

  return {
    connectionStatus,
    room,
    myPlayerId,
    myPlayer,
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
  };
}
