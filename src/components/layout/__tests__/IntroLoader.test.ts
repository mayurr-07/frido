import { describe, expect, it } from "vitest";
import {
  SESSION_KEY,
  INTRO_DURATION_MS,
  INTRO_REDUCED_DURATION_MS,
  MAX_INTRO_MS,
} from "@/components/layout/IntroLoader";

describe("IntroLoader configuration and timing", () => {
  it("uses the canonical session storage key", () => {
    expect(SESSION_KEY).toBe("frido_intro_seen");
  });

  it("provides reasonable animation duration for normal and reduced motion", () => {
    expect(INTRO_DURATION_MS).toBeGreaterThan(1500);
    expect(INTRO_DURATION_MS).toBeLessThan(4000);
    expect(INTRO_REDUCED_DURATION_MS).toBeLessThan(INTRO_DURATION_MS);
    expect(INTRO_REDUCED_DURATION_MS).toBeGreaterThanOrEqual(500);
  });

  it("enforces an absolute maximum duration ceiling to prevent blocking", () => {
    expect(MAX_INTRO_MS).toBeGreaterThan(INTRO_DURATION_MS);
    expect(MAX_INTRO_MS).toBeLessThanOrEqual(10000);
  });
});
