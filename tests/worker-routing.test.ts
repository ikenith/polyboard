import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {}
}));

import worker, { Env } from "../src/server/worker";

describe("Worker Routing and SPA Fallback", () => {
  function createMockEnv() {
    const stubFetch = vi.fn().mockResolvedValue(new Response("DO response"));
    const getStub = vi.fn().mockReturnValue({ fetch: stubFetch });
    const idFromName = vi.fn().mockReturnValue("mock-do-id");

    const assetsFetch = vi.fn().mockResolvedValue(new Response("<html>SPA</html>", {
      headers: { "Content-Type": "text/html" }
    }));

    const env: Env = {
      ROOMS: {
        idFromName,
        get: getStub,
      } as any,
      ASSETS: {
        fetch: assetsFetch,
      } as any,
    };

    return { env, stubFetch, getStub, assetsFetch };
  }

  it("routes browser GET /room/ABCDEF to ASSETS (SPA fallback) instead of DO", async () => {
    const { env, stubFetch, assetsFetch } = createMockEnv();
    const req = new Request("https://example.com/room/ABC234", {
      method: "GET",
      headers: { "Accept": "text/html" }
    });

    const res = await worker.fetch(req, env, {} as any);
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(stubFetch).not.toHaveBeenCalled();
    const text = await res.text();
    expect(text).toBe("<html>SPA</html>");
  });

  it("routes WebSocket request on /room/ABC234 with Upgrade: websocket to DO", async () => {
    const { env, stubFetch, assetsFetch } = createMockEnv();
    const req = new Request("https://example.com/room/ABC234", {
      method: "GET",
      headers: { "Upgrade": "websocket" }
    });

    const res = await worker.fetch(req, env, {} as any);
    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(assetsFetch).not.toHaveBeenCalled();
    const text = await res.text();
    expect(text).toBe("DO response");
  });

  it("routes /ws/ABC234 path to DO", async () => {
    const { env, stubFetch, assetsFetch } = createMockEnv();
    const req = new Request("https://example.com/ws/ABC234", {
      method: "GET"
    });

    const res = await worker.fetch(req, env, {} as any);
    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(assetsFetch).not.toHaveBeenCalled();
    const text = await res.text();
    expect(text).toBe("DO response");
  });

  it("handles /api/games endpoint", async () => {
    const { env } = createMockEnv();
    const req = new Request("https://example.com/api/games", { method: "GET" });
    const res = await worker.fetch(req, env, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe("ludo");
  });

  it("handles /api/rooms POST endpoint to create a room", async () => {
    const { env, stubFetch } = createMockEnv();
    const req = new Request("https://example.com/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: "ludo" })
    });
    const res = await worker.fetch(req, env, {} as any);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.code).toBeDefined();
    expect(data.code.length).toBe(6);
    expect(data.url).toBe(`/room/${data.code}`);
    expect(stubFetch).toHaveBeenCalled(); // pre-warm
  });
});
