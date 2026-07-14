import { describe, expect, it } from "vitest";
import {
  MAX_HARNESS_OUTPUT_CHARS,
  buildHarnessInvocationBody,
  parseHarnessResponseBody,
  redactAndBoundHarnessOutput,
  validateTestSkillRequest,
} from "./parser";

const validSkill = `# Release Safety Skill

## When to use this skill
Use this skill before releasing a customer-facing change that has dependencies on services outside the deployment unit.

## Workflow
1. Confirm the rollback command and owner before changing production.
2. Verify monitoring covers latency, errors, and the primary customer path.
3. Deploy in the approved increment and observe the declared signals.
4. Roll back when the agreed threshold is exceeded.
5. Record the decision and remaining follow-up work.
`;

describe("test-skill input validation", () => {
  it("accepts valid skill input and does not expose model or tool overrides", () => {
    const result = validateTestSkillRequest({ skillMarkdown: validSkill });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const body = buildHarnessInvocationBody(result.value);
    expect(body).toMatchObject({ maxIterations: 4, maxTokens: 1_500, timeoutSeconds: 45 });
    expect(body).not.toHaveProperty("model");
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("skills");
  });

  it("rejects a malformed Harness session ID before invoking AWS", () => {
    expect(validateTestSkillRequest({ skillMarkdown: validSkill, sessionId: "short" })).toMatchObject({
      ok: false,
      error: "sessionId must be 33-100 URL-safe characters",
    });
  });

  it("rejects unknown request fields before invoking AWS", () => {
    expect(validateTestSkillRequest({ skillMarkdown: validSkill, harnessArn: "client-controlled" })).toMatchObject({
      ok: false,
      error: "Unknown request field: harnessArn",
    });
  });

  it("rejects incomplete SKILL.md content before invoking AWS", () => {
    expect(validateTestSkillRequest({ skillMarkdown: "# Incomplete" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("skillMarkdown is invalid"),
    });
  });
});

describe("Harness response parsing", () => {
  it("collects deltas, stop reason, duration metadata, and token usage", () => {
    const parsed = parseHarnessResponseBody(JSON.stringify([
      { contentBlockDelta: { delta: { text: "Skill " } } },
      { contentBlockDelta: { delta: { text: "passed." } } },
      { messageStop: { stopReason: "end_turn" } },
      { metadata: { metrics: { latencyMs: 321 }, usage: { inputTokens: 40, outputTokens: 12, totalTokens: 52 } } },
    ]));

    expect(parsed).toEqual({
      text: "Skill passed.",
      stopReason: "end_turn",
      harnessLatencyMs: 321,
      usage: { inputTokens: 40, outputTokens: 12, totalTokens: 52 },
    });
  });

  it("parses newline-framed event data", () => {
    const parsed = parseHarnessResponseBody([
      'data: {"contentBlockDelta":{"delta":{"text":"Checked"}}}',
      'data: {"messageStop":{"stopReason":"max_tokens"}}',
      "data: [DONE]",
    ].join("\n"));
    expect(parsed).toMatchObject({ text: "Checked", stopReason: "max_tokens" });
  });

  it("redacts sensitive identifiers and bounds output before returning it", () => {
    const output = redactAndBoundHarnessOutput(
      `authorization: Bearer example-token arn:aws:bedrock-agentcore:eu-central-1:123456789012:harness/private ${"x".repeat(MAX_HARNESS_OUTPUT_CHARS)}`,
    );
    expect(output).not.toContain("example-token");
    expect(output).not.toContain("123456789012");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("[REDACTED_ARN]");
    expect(output.endsWith("[OUTPUT_TRUNCATED]")).toBe(true);
  });

  it("rejects empty or unrecognized Harness responses", () => {
    expect(() => parseHarnessResponseBody('{"unexpected":"shape"}')).toThrow(
      "Harness response did not contain recognized text output",
    );
  });
});
