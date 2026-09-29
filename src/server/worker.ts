import { RoomDO } from "./room_do";
import { generateRoomCode } from "../shared/protocol";
import { listAvailableGames } from "../games/registry";

export { RoomDO };

export interface Env {
  ROOMS: DurableObjectNamespace<RoomDO>;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ---------------------------------------------------------
    // API: List Available Games
    // ---------------------------------------------------------
    if (pathname === "/api/games" && request.method === "GET") {
      return new Response(JSON.stringify(listAvailableGames()), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ---------------------------------------------------------
    // API: Create Room
    // ---------------------------------------------------------
    if (pathname === "/api/rooms" && request.method === "POST") {
      let body: any = {};
      try {
        body = await request.json();
      } catch {}

      const code = generateRoomCode();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);

      // Pre-warm DO with code
      await stub.fetch(new Request(`https://internal/init?code=${code}`));

      return new Response(JSON.stringify({ 
        code, 
        gameId: body.gameId || "ludo",
        url: `/room/${code}` 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ---------------------------------------------------------
    // WebSocket / Room Forwarding: /ws/:code or /room/:code/ws
    // ---------------------------------------------------------
    const isWebSocket = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
    const wsMatch = pathname.match(/^\/(?:ws|room)\/([A-Z0-9]{6})(?:\/ws)?$/i);
    if (wsMatch && (isWebSocket || pathname.toLowerCase().endsWith("/ws") || pathname.toLowerCase().startsWith("/ws/"))) {
      const code = wsMatch[1].toUpperCase();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    // ---------------------------------------------------------
    // Static Assets & SPA Fallback
    // ---------------------------------------------------------
    // Cloudflare Workers Static Assets binding automatically serves frontend assets
    // and falls back to index.html for SPA routes like /room/:code
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};
