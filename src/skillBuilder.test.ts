import { describe, expect, it } from "vitest";
import { INSPIRATION_CATALOG, MAX_REFERENCE_CONTEXT_CHARACTERS } from "../shared/inspiration/catalog";
import {
  buildMockSkill,
  createSkillDownloadName,
  generationModeLabel,
  harnessModeLabel,
  parseGenerationPayload,
  parseHarnessResponse,
  serializeGenerationRequest,
  serializeHarnessRequest,
  toSkillSlug,
} from "./skillBuilder";

describe("Skill Builder API contracts", () => {
  it("serializes bounded human input while the server selects local inspiration", () => {
    const payload = JSON.parse(
      serializeGenerationRequest({
        prompt: "  Build an AWS test plan  ",
        currentDraft: "# Existing draft",
        reference: { label: "  Team Runbook  ", content: "r".repeat(MAX_REFERENCE_CONTEXT_CHARACTERS + 20) },
        inspiration: INSPIRATION_CATALOG,
      }),
    );

    expect(payload).toEqual({
      prompt: "Build an AWS test plan",
      currentDraft: "# Existing draft",
      reference: {
        label: "Team Runbook",
        content: "r".repeat(MAX_REFERENCE_CONTEXT_CHARACTERS),
      },
    });
    expect(payload.sources).toBeUndefined();
  });

  it("parses status, completed drafts, and rate-limited error payloads", () => {
    expect(parseGenerationPayload('{"type":"status","message":"Searching local context"}')).toEqual({
      kind: "status",
      message: "Searching local context",
      content: undefined,
      retryAfterSeconds: undefined,
    });
    expect(parseGenerationPayload('{"event":"result","skillMarkdown":"# Ready"}')).toMatchObject({
      kind: "complete",
      content: "# Ready",
    });
    expect(parseGenerationPayload('{"error":{"message":"Slow down"},"retryAfter":12}')).toMatchObject({
      kind: "error",
      message: "Slow down",
      retryAfterSeconds: 12,
    });
  });

  it("maps Harness request and common response fields", () => {
    expect(JSON.parse(serializeHarnessRequest({ skillContent: "# Skill", scenario: "  validate an incident  " }))).toEqual({
      skillMarkdown: "# Skill",
      prompt: "validate an incident",
    });
    expect(parseHarnessResponse('{"response":"All checks passed","stopReason":"end_turn"}')).toEqual({
      summary: "Harness completed (end_turn). Review the agent output below.",
      output: "All checks passed",
    });
  });
});

describe("offline-first behavior", () => {
  it("clearly labels missing endpoints as local mock flows", () => {
    expect(generationModeLabel(undefined)).toContain("Local mock generation");
    expect(harnessModeLabel("")).toContain("Local mock Harness");
    expect(generationModeLabel("https://example.test/generate")).toBe("Live generation API configured");
  });

  it("creates a deterministic, safe download filename", () => {
    expect(toSkillSlug("AWS: Café / Incident Plan!")).toBe("aws-cafe-incident-plan");
    expect(createSkillDownloadName()).toBe("SKILL.md");
  });

  it("marks generated offline content with attributed local sources", () => {
    const skill = buildMockSkill({
      prompt: "Create a test plan",
      currentDraft: "",
      inspiration: INSPIRATION_CATALOG,
    });

    expect(skill).toContain("## Local Inspiration");
    expect(skill).toContain("First-party original example");
  });
});
