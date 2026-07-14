import { describe, expect, it } from "vitest";
import { APP_NAME } from "./App";

describe("Kiro Collab Skill Kit", () => {
  it("exposes the standalone application name", () => {
    expect(APP_NAME).toBe("Kiro Collab Skill Kit");
  });
});
