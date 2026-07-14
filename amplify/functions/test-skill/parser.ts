import { isRecord } from "../shared/http";
import { validateSkillMarkdown } from "../generate-skill/validation";

export const MAX_TEST_PROMPT_CHARS = 2_000;
export const MAX_HARNESS_OUTPUT_CHARS = 12_000;
export const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-_]{32,99}$/;
const TEST_REQUEST_FIELDS = new Set(["skillMarkdown", "prompt", "sessionId"]);

export interface TestSkillRequest {
  skillMarkdown: string;
  prompt: string;
  sessionId?: string;
}

export type TestSkillValidation =
  | { ok: true; value: TestSkillRequest }
  | { ok: false; error: string };

export interface HarnessUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ParsedHarnessResponse {
  text: string;
  stopReason: string;
  harnessLatencyMs?: number;
  usage?: HarnessUsage;
}

export interface HarnessInvocationBody {
  maxIterations: number;
  maxTokens: number;
  timeoutSeconds: number;
  messages: Array<{
    role: "user";
    content: Array<{ text: string }>;
  }>;
}

export function validateTestSkillRequest(value: unknown): TestSkillValidation {
  if (!isRecord(value)) return { ok: false, error: "Request body must be a JSON object" };
  const unknownField = Object.keys(value).find((field) => !TEST_REQUEST_FIELDS.has(field));
  if (unknownField) return { ok: false, error: `Unknown request field: ${unknownField}` };
  if (typeof value.skillMarkdown !== "string") return { ok: false, error: "skillMarkdown must be a string" };

  const skillMarkdown = value.skillMarkdown.trim();
  const skillValidation = validateSkillMarkdown(skillMarkdown);
  if (!skillValidation.valid) return { ok: false, error: `skillMarkdown is invalid: ${skillValidation.reason}` };

  const prompt = value.prompt === undefined
    ? "Review the supplied skill and identify whether its workflow can be followed safely and completely."
    : value.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) return { ok: false, error: "prompt must be a non-empty string" };
  if (prompt.length > MAX_TEST_PROMPT_CHARS) {
    return { ok: false, error: `prompt must not exceed ${MAX_TEST_PROMPT_CHARS} characters` };
  }

  if (value.sessionId !== undefined && (typeof value.sessionId !== "string" || !SESSION_ID_PATTERN.test(value.sessionId))) {
    return { ok: false, error: "sessionId must be 33-100 URL-safe characters" };
  }

  return {
    ok: true,
    value: {
      skillMarkdown,
      prompt: prompt.trim(),
      ...(value.sessionId ? { sessionId: value.sessionId } : {}),
    },
  };
}

export function buildHarnessInvocationBody(request: TestSkillRequest): HarnessInvocationBody {
  return {
    maxIterations: 4,
    maxTokens: 1_500,
    timeoutSeconds: 45,
    messages: [{
      role: "user",
      content: [{
        text: [
          "Evaluate this Kiro SKILL.md using the supplied test prompt.",
          "Do not use unrequested tools or change any external state.",
          `<test-prompt>${request.prompt}</test-prompt>`,
          "<skill-md>",
          request.skillMarkdown,
          "</skill-md>",
        ].join("\n"),
      }],
    }],
  };
}

export function parseHarnessResponseBody(body: string): ParsedHarnessResponse {
  return parseHarnessResponseEvents(parseJsonEvents(body));
}

export function parseHarnessResponseEvents(events: readonly unknown[]): ParsedHarnessResponse {
  const textParts: string[] = [];
  let stopReason = "unknown";
  let harnessLatencyMs: number | undefined;
  let usage: HarnessUsage | undefined;

  for (const event of events) {
    if (!isRecord(event)) continue;
    if (event.internalServerException || event.validationException || event.runtimeClientError) {
      throw new Error("Harness response contained an error event");
    }

    const delta = getRecord(event.contentBlockDelta)?.delta;
    const deltaText = getString(getRecord(delta)?.text);
    if (deltaText) textParts.push(deltaText);

    const output = getRecord(event.output);
    const message = getRecord(output?.message);
    const messageContent = message?.content;
    if (Array.isArray(messageContent)) {
      for (const contentBlock of messageContent) {
        const text = getString(getRecord(contentBlock)?.text);
        if (text) textParts.push(text);
      }
    }

    const parsedStopReason = getString(getRecord(event.messageStop)?.stopReason);
    if (parsedStopReason) stopReason = parsedStopReason;

    const metadata = getRecord(event.metadata);
    const latency = getNumber(getRecord(metadata?.metrics)?.latencyMs);
    if (latency !== undefined) harnessLatencyMs = latency;
    const usageValue = getRecord(metadata?.usage);
    if (usageValue) {
      usage = {
        ...(getNumber(usageValue.inputTokens) !== undefined ? { inputTokens: getNumber(usageValue.inputTokens) } : {}),
        ...(getNumber(usageValue.outputTokens) !== undefined ? { outputTokens: getNumber(usageValue.outputTokens) } : {}),
        ...(getNumber(usageValue.totalTokens) !== undefined ? { totalTokens: getNumber(usageValue.totalTokens) } : {}),
      };
    }
  }

  const text = redactAndBoundHarnessOutput(textParts.join(""));
  if (!text) throw new Error("Harness response did not contain recognized text output");

  return {
    text,
    stopReason,
    ...(harnessLatencyMs !== undefined ? { harnessLatencyMs } : {}),
    ...(usage ? { usage } : {}),
  };
}

export function redactAndBoundHarnessOutput(value: string): string {
  const redacted = value
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED_AWS_ACCESS_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(?:authorization|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, (match) => `${match.split(/\s*[:=]\s*/, 1)[0]}=[REDACTED]`)
    .replace(/\barn:[^\s"'<>]+/gi, "[REDACTED_ARN]")
    .trim();
  if (redacted.length <= MAX_HARNESS_OUTPUT_CHARS) return redacted;
  return `${redacted.slice(0, MAX_HARNESS_OUTPUT_CHARS)}\n[OUTPUT_TRUNCATED]`;
}

function parseJsonEvents(body: string): unknown[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const events: unknown[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const candidate = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
      if (!candidate || candidate === "[DONE]") continue;
      try {
        events.push(JSON.parse(candidate));
      } catch {
        // Ignore framing or heartbeat lines. If no recognized text remains,
        // parseHarnessResponseEvents fails closed rather than returning raw output.
      }
    }
    return events;
  }
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
