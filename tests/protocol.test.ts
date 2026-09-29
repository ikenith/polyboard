import { describe, it, expect } from "vitest";
import { 
  generateRoomCode, 
  generateSessionToken, 
  MAX_MESSAGE_SIZE_BYTES,
  RATE_LIMIT_WINDOW_MS,
  MAX_MESSAGES_PER_WINDOW 
} from "../src/shared/protocol";

describe("Protocol & Security Standards", () => {
  it("generates 6-character uppercase alphanumeric room codes without ambiguous characters", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code.length).toBe(6);
      expect(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(code)).toBe(true);
      // Ensure no 0, O, 1, I
      expect(code).not.toMatch(/[01OI]/);
      codes.add(code);
    }
    // High entropy check
    expect(codes.size).toBe(100);
  });

  it("generates cryptographically secure session tokens", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(48); // 24 bytes in hex
    expect(/^[0-9a-f]{48}$/.test(token1)).toBe(true);
  });

  it("enforces message rate limits and size limits constants", () => {
    expect(MAX_MESSAGE_SIZE_BYTES).toBe(4096);
    expect(RATE_LIMIT_WINDOW_MS).toBe(1000);
    expect(MAX_MESSAGES_PER_WINDOW).toBe(12);
  });
});
