import { describe, it, expect, vi } from "vitest";

// Mock cloudflare:workers DurableObject base class
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: any;
    env: any;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
    }
  }
}));

import { RoomDO } from "../src/server/room_do";

class MockWebSocket {
  readyState = 1; // WebSocket.OPEN
  sentMessages: string[] = [];
  closed = false;
  closeCode?: number;
  closeReason?: string;
  attachment: any = null;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3; // CLOSED
  }

  serializeAttachment(att: any) {
    this.attachment = att;
  }

  deserializeAttachment() {
    return this.attachment;
  }
}

class MockWebSocketPair {
  [0]: MockWebSocket;
  [1]: MockWebSocket;

  constructor() {
    this[0] = new MockWebSocket();
    this[1] = new MockWebSocket();
  }
}

(globalThis as any).WebSocketPair = MockWebSocketPair;
(globalThis as any).WebSocket = { OPEN: 1, CLOSED: 3 };

const OriginalResponse = globalThis.Response;
const WorkerResponse: any = class extends (OriginalResponse as any) {
  webSocket: any = null;

  constructor(body?: any, init?: any) {
    if (init && init.status === 101) {
      super(body, { ...init, status: 200 });
      Object.defineProperty(this, "status", { value: 101 });
      this.webSocket = init.webSocket;
      return;
    }
    super(body, init);
  }
};
(globalThis as any).Response = WorkerResponse;

const asWs = (ws: MockWebSocket) => ws as unknown as WebSocket;

function createMockRoomDO(code: string = "TEST01") {
  const activeSockets: MockWebSocket[] = [];
  const storedSql: Record<string, any[]> = {
    room_meta: [{ key: "code", value: code }],
    players: []
  };

  const execMock = vi.fn().mockImplementation((query: string, ...args: any[]) => {
    return {
      toArray: () => {
        if (query.includes("FROM room_meta")) return storedSql.room_meta;
        if (query.includes("FROM players")) return storedSql.players;
        return [];
      }
    };
  });

  const ctx: any = {
    storage: {
      sql: { exec: execMock },
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => {
      await fn();
    },
    acceptWebSocket: vi.fn((ws: MockWebSocket) => {
      activeSockets.push(ws);
    }),
    getWebSockets: vi.fn(() => activeSockets),
  };

  const roomDO = new RoomDO(ctx, {});
  return { roomDO, ctx, activeSockets };
}

describe("RoomDO Durable Object & Anti-Cheat Logic", () => {
  it("resolves room code from pathname if not pre-warmed", async () => {
    const { roomDO } = createMockRoomDO("");
    const req = new Request("https://example.com/room/XYZ999/ws", {
      headers: { Upgrade: "websocket" }
    });

    const res = await roomDO.fetch(req);
    expect(res.status).toBe(101);

    const httpReq = new Request("https://example.com/info");
    const httpRes = await roomDO.fetch(httpReq);
    const data = await httpRes.json() as any;
    expect(data.code).toBe("XYZ999");
  });

  it("sends initial state_update immediately upon WebSocket connection accept", async () => {
    const { roomDO, activeSockets } = createMockRoomDO("CONN01");
    const req = new Request("https://example.com/room/CONN01/ws", {
      headers: { Upgrade: "websocket" }
    });

    const res = await roomDO.fetch(req);
    expect(res.status).toBe(101);
    expect(activeSockets.length).toBe(1);

    // Verify initial message was pushed to the server socket
    const initialMsg = JSON.parse(activeSockets[0].sentMessages[0]);
    expect(initialMsg.type).toBe("state_update");
    expect(initialMsg.room.code).toBe("CONN01");
    expect(initialMsg.room.status).toBe("LOBBY");
  });

  it("handles update_settings for teamsEnabled with player count validation", async () => {
    const { roomDO, activeSockets } = createMockRoomDO("TEAM01");
    // Connect host
    await roomDO.fetch(new Request("https://example.com/room/TEAM01/ws", { headers: { Upgrade: "websocket" } }));
    const hostWs = activeSockets[0];

    // Host joins
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({ type: "join", name: "Host" }));
    expect(hostWs.sentMessages.some(m => m.includes('"welcome"'))).toBe(true);

    // Attempt to enable teams with only 1 player -> should fail with error
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({
      type: "update_settings",
      settings: { teamsEnabled: true }
    }));
    const lastMsg = JSON.parse(hostWs.sentMessages[hostWs.sentMessages.length - 1]);
    expect(lastMsg.type).toBe("error");
    expect(lastMsg.message).toContain("Teams require an even number of players");

    // Add 3 more players (total 4)
    for (let i = 2; i <= 4; i++) {
      await roomDO.fetch(new Request("https://example.com/room/TEAM01/ws", { headers: { Upgrade: "websocket" } }));
      const playerWs = activeSockets[activeSockets.length - 1];
      await roomDO.webSocketMessage(asWs(playerWs), JSON.stringify({ type: "join", name: `Player ${i}` }));
    }

    // Now host enables teams -> should succeed
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({
      type: "update_settings",
      settings: { teamsEnabled: true }
    }));

    const stateUpdate = JSON.parse(hostWs.sentMessages[hostWs.sentMessages.length - 1]);
    expect(stateUpdate.type).toBe("state_update");
    expect(stateUpdate.room.settings.teamsEnabled).toBe(true);
  });

  it("disconnects kicked player's WebSocket and gracefully falls back teams mode if < 4 players", async () => {
    const { roomDO, activeSockets } = createMockRoomDO("KICK01");
    // Connect host
    await roomDO.fetch(new Request("https://example.com/room/KICK01/ws", { headers: { Upgrade: "websocket" } }));
    const hostWs = activeSockets[0];
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({ type: "join", name: "Host" }));

    // Connect 3 more players
    const otherWsList: MockWebSocket[] = [];
    const playerIds: string[] = [];

    for (let i = 2; i <= 4; i++) {
      await roomDO.fetch(new Request("https://example.com/room/KICK01/ws", { headers: { Upgrade: "websocket" } }));
      const ws = activeSockets[activeSockets.length - 1];
      otherWsList.push(ws);
      await roomDO.webSocketMessage(asWs(ws), JSON.stringify({ type: "join", name: `Player ${i}` }));
      const welcome = ws.sentMessages.map(m => JSON.parse(m)).find(m => m.type === "welcome");
      playerIds.push(welcome.playerId);
    }

    // Enable teams with 4 players
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({
      type: "update_settings",
      settings: { teamsEnabled: true }
    }));

    // Host kicks Player 4
    const victimWs = otherWsList[2];
    const victimId = playerIds[2];
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({
      type: "kick_player",
      targetPlayerId: victimId
    }));

    // Victim should receive error and socket closed
    expect(victimWs.closed).toBe(true);
    expect(victimWs.closeCode).toBe(1000);
    const victimMsg = JSON.parse(victimWs.sentMessages[victimWs.sentMessages.length - 1]);
    expect(victimMsg.type).toBe("error");
    expect(victimMsg.message).toContain("kicked");

    // Teams mode should automatically turn off because player count dropped to 3
    const latestState = JSON.parse(hostWs.sentMessages[hostWs.sentMessages.length - 1]);
    expect(latestState.room.players.length).toBe(3);
    expect(latestState.room.settings.teamsEnabled).toBe(false);
  });

  it("play_again deletes scheduled alarms and resets room state to LOBBY", async () => {
    const { roomDO, ctx, activeSockets } = createMockRoomDO("RESET1");
    // Connect host
    await roomDO.fetch(new Request("https://example.com/room/RESET1/ws", { headers: { Upgrade: "websocket" } }));
    const hostWs = activeSockets[0];
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({ type: "join", name: "Host" }));

    // Connect player 2
    await roomDO.fetch(new Request("https://example.com/room/RESET1/ws", { headers: { Upgrade: "websocket" } }));
    const p2Ws = activeSockets[1];
    await roomDO.webSocketMessage(asWs(p2Ws), JSON.stringify({ type: "join", name: "P2" }));

    // Start game
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({ type: "start_game" }));
    expect(ctx.storage.setAlarm).toHaveBeenCalled();

    // End game artificially by setting status
    (roomDO as any).status = "GAME_OVER";

    // Play again
    await roomDO.webSocketMessage(asWs(hostWs), JSON.stringify({ type: "play_again" }));
    expect(ctx.storage.deleteAlarm).toHaveBeenCalled();

    const lastMsg = JSON.parse(hostWs.sentMessages[hostWs.sentMessages.length - 1]);
    expect(lastMsg.room.status).toBe("LOBBY");
    expect(lastMsg.room.gameState).toBeNull();
  });
});
