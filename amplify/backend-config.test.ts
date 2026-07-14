import { describe, expect, it } from "vitest";
import {
  LOCAL_DEVELOPMENT_ORIGIN,
  NOVA_LITE_MODEL_ID,
  resolveAllowedOrigin,
} from "./backend-config";

describe("backend configuration", () => {
  it("uses the local development origin when ALLOWED_ORIGIN is missing", () => {
    expect(resolveAllowedOrigin(undefined)).toBe(LOCAL_DEVELOPMENT_ORIGIN);
  });

  it("normalizes an explicit HTTPS origin", () => {
    expect(resolveAllowedOrigin("https://skills.example.com/path")).toBe("https://skills.example.com");
  });

  it("rejects a non-HTTP CORS origin", () => {
    expect(() => resolveAllowedOrigin("file:///tmp/skill-kit")).toThrow("ALLOWED_ORIGIN");
  });

  it("pins direct generation to Nova Lite", () => {
    expect(NOVA_LITE_MODEL_ID).toBe("eu.amazon.nova-2-lite-v1:0");
  });
});
