import { DurableObject } from "cloudflare:workers";
import { 
  ClientMessage, 
  ServerMessage, 
  PublicRoomState, 
  MAX_MESSAGE_SIZE_BYTES, 
  RATE_LIMIT_WINDOW_MS, 
  MAX_MESSAGES_PER_WINDOW,
  generateSessionToken 
} from "../shared/protocol";
import { Player, RoomSettings } from "../games/types";
import { getGameModule } from "../games/registry";
import { LUDO_COLORS, LUDO_ICONS } from "../games/ludo/config";

interface StoredPlayer {
  id: string;
  name: string;
  sessionToken: string;
  colorId: string;
  iconId: string;
  seatIndex: number;
  isHost: boolean;
  partnerPlayerId?: string;
}

interface WsAttachment {
  playerId: string;
  msgCount: number;
  windowStart: number;
}

export class RoomDO extends DurableObject {
  private code: string = "";
  private gameId: string = "ludo";
  private status: "LOBBY" | "PLAYING" | "GAME_OVER" = "LOBBY";
  private players: Map<string, StoredPlayer> = new Map();
  private maxPlayers: number = 7;
  private settings: RoomSettings = {
    turnTimeSeconds: 60,
    autoMoveSingle: true,
    blocksStopOpponents: false,
    teamsEnabled: false,
  };
  private partnerRequests: Map<string, string> = new Map(); // requesterId -> targetId
  private gameState: any = null;
  private turnDeadline: number | null = null;
  private logs: string[] = [];
  private isInitialized = false;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initDatabase();
      await this.loadState();
    });
  }

  private async initDatabase() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        session_token TEXT NOT NULL,
        color_id TEXT NOT NULL,
        icon_id TEXT NOT NULL,
        seat_index INTEGER NOT NULL,
        is_host INTEGER NOT NULL,
        partner_id TEXT
      );
    `);
  }

  private async loadState() {
    const metaRows = this.ctx.storage.sql.exec(`SELECT key, value FROM room_meta`).toArray();
    const meta: Record<string, string> = {};
    for (const row of metaRows) {
      meta[row.key as string] = row.value as string;
    }

    if (meta.code) this.code = meta.code;
    if (meta.gameId) this.gameId = meta.gameId;
    if (meta.status) this.status = meta.status as any;
    if (meta.maxPlayers) this.maxPlayers = Number(meta.maxPlayers);
    if (meta.settings) this.settings = JSON.parse(meta.settings);
    if (meta.gameState) this.gameState = JSON.parse(meta.gameState);
    if (meta.turnDeadline) this.turnDeadline = Number(meta.turnDeadline);
    if (meta.logs) this.logs = JSON.parse(meta.logs);

    const playerRows = this.ctx.storage.sql.exec(`SELECT * FROM players ORDER BY seat_index ASC`).toArray();
    this.players.clear();
    for (const r of playerRows) {
      this.players.set(r.id as string, {
        id: r.id as string,
        name: r.name as string,
        sessionToken: r.session_token as string,
        colorId: r.color_id as string,
        iconId: r.icon_id as string,
        seatIndex: Number(r.seat_index),
        isHost: Number(r.is_host) === 1,
        partnerPlayerId: (r.partner_id as string) || undefined,
      });
    }

    this.isInitialized = true;
  }

  private saveMeta(key: string, value: string) {
    this.ctx.storage.sql.exec(`INSERT OR REPLACE INTO room_meta (key, value) VALUES (?, ?)`, key, value);
  }

  private savePlayer(p: StoredPlayer) {
    this.ctx.storage.sql.exec(`
      INSERT OR REPLACE INTO players (id, name, session_token, color_id, icon_id, seat_index, is_host, partner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, p.id, p.name, p.sessionToken, p.colorId, p.iconId, p.seatIndex, p.isHost ? 1 : 0, p.partnerPlayerId || null);
  }

  private deletePlayerFromDb(playerId: string) {
    this.ctx.storage.sql.exec(`DELETE FROM players WHERE id = ?`, playerId);
  }

  // Cryptographically secure RNG using standard Web Crypto
  private serverCryptoRng(): number {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xffffffff + 1);
  }

  // Handle incoming HTTP / WebSocket upgrade
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Initialize room with code if not yet initialized
    const codeParam = url.searchParams.get("code");
    const pathMatch = url.pathname.match(/^\/(?:ws|room)\/([A-Z0-9]{6})/i);
    const codeFromPath = pathMatch ? pathMatch[1].toUpperCase() : "";
    const resolvedCode = codeParam?.toUpperCase() || codeFromPath;
    if (resolvedCode && !this.code) {
      this.code = resolvedCode;
      this.saveMeta("code", this.code);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      // Regular HTTP info endpoint
      return new Response(JSON.stringify(this.getPublicRoomState()), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Upgrade WebSocket
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const initialAttachment: WsAttachment = {
      playerId: "",
      msgCount: 0,
      windowStart: Date.now(),
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(initialAttachment);

    // Anti-cheat & UX: Send initial room state immediately upon connection
    const pub = this.getPublicRoomState();
    server.send(JSON.stringify({ type: "state_update", room: pub }));

    return new Response(null, { status: 101, webSocket: client });
  }

  // WebSocket Message Handler
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") {
      this.sendError(ws, "Binary messages not supported");
      return;
    }

    // Anti-cheat: Message size limit
    if (message.length > MAX_MESSAGE_SIZE_BYTES) {
      this.sendError(ws, "Message size exceeds limit");
      return;
    }

    // Anti-cheat: Rate limiting per connection
    const attachment = (ws.deserializeAttachment() as WsAttachment) || { playerId: "", msgCount: 0, windowStart: Date.now() };
    const now = Date.now();
    if (now - attachment.windowStart > RATE_LIMIT_WINDOW_MS) {
      attachment.windowStart = now;
      attachment.msgCount = 1;
    } else {
      attachment.msgCount++;
      if (attachment.msgCount > MAX_MESSAGES_PER_WINDOW) {
        this.sendError(ws, "Rate limit exceeded. Please slow down.");
        return;
      }
    }
    ws.serializeAttachment(attachment);

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.sendError(ws, "Invalid JSON");
      return;
    }

    try {
      await this.handleClientIntent(ws, parsed, attachment);
    } catch (err: any) {
      this.sendError(ws, err.message || "Failed to process action");
    }
  }

  // WebSocket Close Handler
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.broadcastState();
  }

  // WebSocket Error Handler
  async webSocketError(ws: WebSocket, error: any) {
    this.broadcastState();
  }

  // Alarm Handler for Server Turn Timer
  async alarm() {
    if (this.status !== "PLAYING" || !this.gameState) return;

    const game = getGameModule(this.gameId);
    if (!game || !game.onTimerExpired) return;

    try {
      const res = game.onTimerExpired(this.gameState, () => this.serverCryptoRng());
      this.gameState = res.newState;
      if (res.logMessages) {
        this.addLogs(res.logMessages);
      }

      if (this.gameState.phase === "GAME_OVER") {
        this.status = "GAME_OVER";
        this.turnDeadline = null;
        this.saveMeta("status", this.status);
        try {
          this.ctx.storage.deleteAlarm();
        } catch {}
      } else {
        this.scheduleNextTurnTimer();
      }

      this.saveMeta("gameState", JSON.stringify(this.gameState));
      this.broadcastState();
    } catch (e) {
      console.error("Alarm error:", e);
    }
  }

  private scheduleNextTurnTimer() {
    if (this.settings.turnTimeSeconds > 0 && this.status === "PLAYING") {
      this.turnDeadline = Date.now() + this.settings.turnTimeSeconds * 1000;
      this.saveMeta("turnDeadline", String(this.turnDeadline));
      this.ctx.storage.setAlarm(this.turnDeadline);
    } else {
      this.turnDeadline = null;
      this.saveMeta("turnDeadline", "");
      try {
        this.ctx.storage.deleteAlarm();
      } catch {}
    }
  }

  // Process Client Intents
  private async handleClientIntent(ws: WebSocket, msg: ClientMessage, attachment: WsAttachment) {
    if (msg.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }

    // ---------------------------------------------------------
    // INTENT: JOIN
    // ---------------------------------------------------------
    if (msg.type === "join") {
      const name = (msg.name || "").trim().slice(0, 20);
      if (!name) {
        throw new Error("Player name is required");
      }

      let player: StoredPlayer | undefined;

      // Check session token reconnection
      if (msg.sessionToken) {
        for (const p of this.players.values()) {
          if (p.sessionToken === msg.sessionToken) {
            player = p;
            break;
          }
        }
      }

      if (player) {
        // Reconnected to seat!
        attachment.playerId = player.id;
        ws.serializeAttachment(attachment);

        this.send(ws, {
          type: "welcome",
          playerId: player.id,
          sessionToken: player.sessionToken,
          isHost: player.isHost,
        });

        this.addLogs([`${player.name} reconnected.`]);
        this.broadcastState();
        return;
      }

      // New player joining
      if (this.status !== "LOBBY") {
        throw new Error("Game is already in progress");
      }

      if (this.players.size >= this.maxPlayers) {
        throw new Error("Room is full");
      }

      // Assign first available color and icon
      const takenColors = new Set(Array.from(this.players.values()).map(p => p.colorId));
      const takenIcons = new Set(Array.from(this.players.values()).map(p => p.iconId));

      const freeColor = LUDO_COLORS.find(c => !takenColors.has(c.id))?.id || LUDO_COLORS[0].id;
      const freeIcon = LUDO_ICONS.find(i => !takenIcons.has(i.id))?.id || LUDO_ICONS[0].id;

      const isHost = this.players.size === 0;
      const newPlayerId = "p_" + crypto.randomUUID().slice(0, 8);
      const sessionToken = generateSessionToken();
      const seatIndex = this.players.size;

      const newPlayer: StoredPlayer = {
        id: newPlayerId,
        name,
        sessionToken,
        colorId: freeColor,
        iconId: freeIcon,
        seatIndex,
        isHost,
      };

      this.players.set(newPlayerId, newPlayer);
      this.savePlayer(newPlayer);

      attachment.playerId = newPlayerId;
      ws.serializeAttachment(attachment);

      this.send(ws, {
        type: "welcome",
        playerId: newPlayerId,
        sessionToken,
        isHost,
      });

      this.addLogs([`${name} joined the room.`]);
      this.broadcastState();
      return;
    }

    // For all other actions, connection must be authenticated with a valid playerId
    const player = this.players.get(attachment.playerId);
    if (!player) {
      throw new Error("Please join the room first");
    }

    // ---------------------------------------------------------
    // INTENT: PICK COLOR (Atomic Lock)
    // ---------------------------------------------------------
    if (msg.type === "pick_color") {
      if (this.status !== "LOBBY") throw new Error("Cannot change color during game");

      const colorExists = LUDO_COLORS.some(c => c.id === msg.colorId);
      if (!colorExists) throw new Error("Invalid color choice");

      // Atomic check: is another player currently using this color?
      for (const other of this.players.values()) {
        if (other.id !== player.id && other.colorId === msg.colorId) {
          throw new Error("That color is already taken by another player");
        }
      }

      player.colorId = msg.colorId;
      this.savePlayer(player);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: PICK ICON (Atomic Lock)
    // ---------------------------------------------------------
    if (msg.type === "pick_icon") {
      if (this.status !== "LOBBY") throw new Error("Cannot change icon during game");

      const iconExists = LUDO_ICONS.some(i => i.id === msg.iconId);
      if (!iconExists) throw new Error("Invalid icon choice");

      // Atomic check: is another player currently using this icon?
      for (const other of this.players.values()) {
        if (other.id !== player.id && other.iconId === msg.iconId) {
          throw new Error("That icon is already taken by another player");
        }
      }

      player.iconId = msg.iconId;
      this.savePlayer(player);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: TOGGLE TEAMS (Host only)
    // ---------------------------------------------------------
    if (msg.type === "toggle_teams") {
      this.requireHost(player);
      if (this.status !== "LOBBY") throw new Error("Cannot change team mode during game");

      const pCount = this.players.size;
      const canEnableTeams = pCount >= 4 && pCount % 2 === 0;
      if (msg.enabled && !canEnableTeams) {
        throw new Error("Teams require an even number of players (at least 4)");
      }

      this.settings.teamsEnabled = !!msg.enabled;
      // Clear partner pairings if disabled
      if (!this.settings.teamsEnabled) {
        for (const p of this.players.values()) {
          p.partnerPlayerId = undefined;
          this.savePlayer(p);
        }
        this.partnerRequests.clear();
      }
      this.saveMeta("settings", JSON.stringify(this.settings));
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: REQUEST PARTNER (Team Mode)
    // ---------------------------------------------------------
    if (msg.type === "request_partner") {
      if (!this.settings.teamsEnabled) throw new Error("Teams are not enabled");
      if (msg.targetPlayerId === player.id) throw new Error("Cannot partner with yourself");
      if (!this.players.has(msg.targetPlayerId)) throw new Error("Player not found");

      this.partnerRequests.set(player.id, msg.targetPlayerId);
      const target = this.players.get(msg.targetPlayerId)!;
      this.addLogs([`${player.name} sent a partner request to ${target.name}.`]);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: ACCEPT PARTNER (Team Mode)
    // ---------------------------------------------------------
    if (msg.type === "accept_partner") {
      if (!this.settings.teamsEnabled) throw new Error("Teams are not enabled");
      const requester = this.players.get(msg.requesterPlayerId);
      if (!requester) throw new Error("Requester not found");

      if (this.partnerRequests.get(requester.id) !== player.id) {
        throw new Error("No pending partner request from this player");
      }

      // Unpair any previous partners
      for (const p of this.players.values()) {
        if (p.partnerPlayerId === player.id || p.partnerPlayerId === requester.id) {
          p.partnerPlayerId = undefined;
          this.savePlayer(p);
        }
      }

      player.partnerPlayerId = requester.id;
      requester.partnerPlayerId = player.id;
      this.partnerRequests.delete(requester.id);
      this.partnerRequests.delete(player.id);

      this.savePlayer(player);
      this.savePlayer(requester);

      this.addLogs([`${player.name} and ${requester.name} are now partners!`]);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: RANDOMIZE TEAMS (Host only)
    // ---------------------------------------------------------
    if (msg.type === "randomize_teams") {
      this.requireHost(player);
      if (!this.settings.teamsEnabled) throw new Error("Teams are not enabled");

      const pList = Array.from(this.players.values());
      if (pList.length % 2 !== 0 || pList.length < 4) {
        throw new Error("Teams require an even number of players (at least 4)");
      }

      // Shuffle array
      for (let i = pList.length - 1; i > 0; i--) {
        const j = Math.floor(this.serverCryptoRng() * (i + 1));
        [pList[i], pList[j]] = [pList[j], pList[i]];
      }

      // Pair up adjacent in shuffled list
      for (let i = 0; i < pList.length; i += 2) {
        const p1 = pList[i];
        const p2 = pList[i + 1];
        p1.partnerPlayerId = p2.id;
        p2.partnerPlayerId = p1.id;
        this.savePlayer(p1);
        this.savePlayer(p2);
      }

      this.partnerRequests.clear();
      this.addLogs(["Host randomized the teams."]);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: UPDATE SETTINGS (Host only)
    // ---------------------------------------------------------
    if (msg.type === "update_settings") {
      this.requireHost(player);
      if (this.status !== "LOBBY") throw new Error("Cannot change settings during game");

      if (msg.settings.turnTimeSeconds !== undefined) {
        this.settings.turnTimeSeconds = Math.max(0, Math.min(180, Number(msg.settings.turnTimeSeconds)));
      }
      if (msg.settings.autoMoveSingle !== undefined) {
        this.settings.autoMoveSingle = !!msg.settings.autoMoveSingle;
      }
      if (msg.settings.blocksStopOpponents !== undefined) {
        this.settings.blocksStopOpponents = !!msg.settings.blocksStopOpponents;
      }
      if (msg.settings.teamsEnabled !== undefined) {
        const pCount = this.players.size;
        const canEnableTeams = pCount >= 4 && pCount % 2 === 0;
        if (msg.settings.teamsEnabled && !canEnableTeams) {
          throw new Error("Teams require an even number of players (at least 4)");
        }
        this.settings.teamsEnabled = !!msg.settings.teamsEnabled;
        if (!this.settings.teamsEnabled) {
          for (const p of this.players.values()) {
            p.partnerPlayerId = undefined;
            this.savePlayer(p);
          }
          this.partnerRequests.clear();
        }
      }

      this.saveMeta("settings", JSON.stringify(this.settings));
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: KICK PLAYER (Host only)
    // ---------------------------------------------------------
    if (msg.type === "kick_player") {
      this.requireHost(player);
      if (msg.targetPlayerId === player.id) throw new Error("Cannot kick yourself");

      const target = this.players.get(msg.targetPlayerId);
      if (!target) throw new Error("Player to kick not found");

      this.players.delete(target.id);
      this.deletePlayerFromDb(target.id);

      // Clean up partner references for remaining players
      for (const p of this.players.values()) {
        if (p.partnerPlayerId === target.id) {
          p.partnerPlayerId = undefined;
          this.savePlayer(p);
        }
      }
      for (const [k, v] of Array.from(this.partnerRequests.entries())) {
        if (k === target.id || v === target.id) {
          this.partnerRequests.delete(k);
        }
      }

      // Check if teams still valid after kick
      if (this.settings.teamsEnabled && (this.players.size < 4 || this.players.size % 2 !== 0)) {
        this.settings.teamsEnabled = false;
        for (const p of this.players.values()) {
          p.partnerPlayerId = undefined;
          this.savePlayer(p);
        }
        this.partnerRequests.clear();
        this.saveMeta("settings", JSON.stringify(this.settings));
      }

      // Re-index remaining player seats
      let s = 0;
      for (const p of this.players.values()) {
        p.seatIndex = s++;
        this.savePlayer(p);
      }

      // Disconnect kicked player WebSocket
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() as WsAttachment | null;
        if (att?.playerId === target.id) {
          this.send(ws, { type: "error", message: "You have been kicked from the room." });
          try {
            ws.close(1000, "Kicked");
          } catch {}
        }
      }

      this.addLogs([`${target.name} was kicked by the host.`]);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: START GAME (Host only)
    // ---------------------------------------------------------
    if (msg.type === "start_game") {
      this.requireHost(player);
      if (this.status !== "LOBBY") throw new Error("Game already started");

      const pCount = this.players.size;
      if (pCount < 2) throw new Error("Need at least 2 players to start");

      // Verify teams if enabled
      if (this.settings.teamsEnabled) {
        if (pCount % 2 !== 0 || pCount < 4) {
          throw new Error("Teams require 4 or 6 players");
        }
        for (const p of this.players.values()) {
          if (!p.partnerPlayerId || !this.players.has(p.partnerPlayerId)) {
            throw new Error("All players must be paired before starting in Team mode");
          }
        }

        // Re-arrange seats so partners sit opposite each other (seats i and i + N/2)
        const pairedSets: [StoredPlayer, StoredPlayer][] = [];
        const seen = new Set<string>();
        for (const p of this.players.values()) {
          if (!seen.has(p.id) && p.partnerPlayerId) {
            const partner = this.players.get(p.partnerPlayerId);
            if (partner && !seen.has(partner.id)) {
              pairedSets.push([p, partner]);
              seen.add(p.id);
              seen.add(partner.id);
            }
          }
        }

        const half = pCount / 2;
        pairedSets.forEach(([p1, p2], idx) => {
          p1.seatIndex = idx;
          p2.seatIndex = idx + half;
          this.savePlayer(p1);
          this.savePlayer(p2);
        });
      }

      const game = getGameModule(this.gameId);
      if (!game) throw new Error("Game engine not found");

      // Convert stored players to Game Player interface
      const gamePlayers: Player[] = Array.from(this.players.values())
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .map(p => ({
          id: p.id,
          name: p.name,
          colorId: p.colorId,
          iconId: p.iconId,
          seatIndex: p.seatIndex,
          isHost: p.isHost,
          connected: true,
          partnerPlayerId: p.partnerPlayerId,
        }));

      this.gameState = game.init(gamePlayers, this.settings);
      this.status = "PLAYING";

      this.saveMeta("gameState", JSON.stringify(this.gameState));
      this.saveMeta("status", this.status);

      this.scheduleNextTurnTimer();
      this.addLogs(["The game has started!"]);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: PLAY AGAIN (Any player or host)
    // ---------------------------------------------------------
    if (msg.type === "play_again") {
      if (this.status !== "GAME_OVER") throw new Error("Current game has not ended");

      this.status = "LOBBY";
      this.gameState = null;
      this.turnDeadline = null;

      try {
        this.ctx.storage.deleteAlarm();
      } catch {}

      this.saveMeta("status", this.status);
      this.saveMeta("gameState", "");
      this.saveMeta("turnDeadline", "");

      this.addLogs(["Returned to lobby for another game!"]);
      this.broadcastState();
      return;
    }

    // ---------------------------------------------------------
    // INTENT: GAME ACTIONS (roll, move)
    // ---------------------------------------------------------
    if (msg.type === "roll" || msg.type === "move") {
      if (this.status !== "PLAYING" || !this.gameState) {
        throw new Error("Game is not in PLAYING state");
      }

      const game = getGameModule(this.gameId);
      if (!game) throw new Error("Game module not found");

      const action = msg.type === "roll" ? { type: "roll" } : { type: "move", tokenId: msg.tokenId };
      const res = game.applyAction(this.gameState, player.id, action as any, () => this.serverCryptoRng());

      this.gameState = res.newState;
      if (res.logMessages) {
        this.addLogs(res.logMessages);
      }

      if (this.gameState.phase === "GAME_OVER") {
        this.status = "GAME_OVER";
        this.turnDeadline = null;
        this.saveMeta("status", this.status);
      } else {
        this.scheduleNextTurnTimer();
      }

      this.saveMeta("gameState", JSON.stringify(this.gameState));
      this.broadcastState();
      return;
    }

    throw new Error("Unknown message type");
  }

  private requireHost(player: StoredPlayer) {
    if (!player.isHost) {
      throw new Error("Only the room host can perform this action");
    }
  }

  private addLogs(msgs: string[]) {
    this.logs.push(...msgs);
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(-50);
    }
    this.saveMeta("logs", JSON.stringify(this.logs));
  }

  // Generate public state (NEVER exposing session tokens)
  private getPublicRoomState(): PublicRoomState {
    const connectedPlayerIds = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState === WebSocket.OPEN) {
        const att = ws.deserializeAttachment() as WsAttachment | null;
        if (att?.playerId) connectedPlayerIds.add(att.playerId);
      }
    }

    const host = Array.from(this.players.values()).find(p => p.isHost);
    const hostPlayerId = host ? host.id : "";

    const publicPlayers: Player[] = Array.from(this.players.values())
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map(p => ({
        id: p.id,
        name: p.name,
        colorId: p.colorId,
        iconId: p.iconId,
        seatIndex: p.seatIndex,
        isHost: p.isHost,
        connected: connectedPlayerIds.has(p.id),
        partnerPlayerId: p.partnerPlayerId,
      }));

    const requestsObj: Record<string, string> = {};
    for (const [k, v] of this.partnerRequests.entries()) {
      requestsObj[k] = v;
    }

    return {
      code: this.code,
      gameId: this.gameId,
      hostPlayerId,
      status: this.status,
      players: publicPlayers,
      maxPlayers: this.maxPlayers,
      settings: this.settings,
      partnerRequests: requestsObj,
      gameState: this.gameState,
      turnDeadline: this.turnDeadline,
      logs: this.logs,
    };
  }

  private broadcastState() {
    const pub = this.getPublicRoomState();
    const payload = JSON.stringify({ type: "state_update", room: pub });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch {}
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {}
    }
  }

  private sendError(ws: WebSocket, message: string) {
    this.send(ws, { type: "error", message });
  }
}
