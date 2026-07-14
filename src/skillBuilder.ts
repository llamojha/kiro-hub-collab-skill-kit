import {
  buildInspirationContext,
  capReferenceContent,
  type InspirationSource,
} from "../shared/inspiration/catalog";

export interface ReferenceSource {
  label: string;
  content: string;
}

export interface GenerationInput {
  prompt: string;
  currentDraft: string;
  reference?: ReferenceSource;
  inspiration: readonly InspirationSource[];
}

export interface GenerationEvent {
  kind: "status" | "draft" | "complete" | "error";
  message: string;
  content?: string;
  retryAfterSeconds?: number;
}

export interface HarnessInput {
  skillContent: string;
  scenario: string;
}

export interface HarnessResult {
  /** Undefined means the live Harness completed but returned narrative rather than a pass/fail verdict. */
  passed?: boolean;
  summary: string;
  output: string;
}

export class ApiRequestError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.ceil(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function apiEventKind(value: string): GenerationEvent["kind"] {
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes("error") || normalized.includes("fail")) return "error";
  if (normalized.includes("complete") || normalized === "done" || normalized === "result") return "complete";
  if (normalized.includes("draft") || normalized.includes("skill")) return "draft";
  return "status";
}

/** Parse a JSON generation event from an SSE data line or a JSON HTTP response. */
export function parseGenerationPayload(rawPayload: string, eventName = "message"): GenerationEvent {
  let payload: unknown = rawPayload.trim();
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    // Plain text status events are valid SSE payloads.
  }

  if (!isRecord(payload)) {
    const kind = apiEventKind(eventName);
    return {
      kind,
      message: typeof payload === "string" ? payload : "Generation update received.",
      content: kind === "draft" || kind === "complete" ? String(payload) : undefined,
    };
  }

  const nestedData = isRecord(payload.data) ? payload.data : undefined;
  const type = firstString(payload.type, payload.event, nestedData?.type, eventName) ?? "status";
  const kind = apiEventKind(type);
  const errorMessage = firstString(
    typeof payload.error === "string" ? payload.error : undefined,
    isRecord(payload.error) ? payload.error.message : undefined,
    nestedData?.error,
  );
  const content = firstString(
    payload.skillMarkdown,
    payload.skillMd,
    payload.skillContent,
    payload.draft,
    payload.content,
    nestedData?.skillMarkdown,
    nestedData?.skillMd,
    nestedData?.skillContent,
    nestedData?.draft,
    nestedData?.content,
  );
  const message = errorMessage ?? firstString(
    payload.message,
    payload.stage,
    payload.status,
    nestedData?.message,
    nestedData?.stage,
    nestedData?.status,
  ) ?? (content ? "Draft update received." : "Generation update received.");
  const retryAfterSeconds = numberValue(payload.retryAfterSeconds) ?? numberValue(payload.retryAfter) ??
    numberValue(nestedData?.retryAfterSeconds) ?? numberValue(nestedData?.retryAfter);

  return {
    kind: errorMessage ? "error" : kind,
    message,
    content: kind === "draft" || kind === "complete" ? content : undefined,
    retryAfterSeconds,
  };
}

export function serializeGenerationRequest(input: GenerationInput): string {
  const reference = input.reference?.content.trim()
    ? {
        label: input.reference.label.trim().slice(0, 120) || "User-provided reference",
        content: capReferenceContent(input.reference.content),
      }
    : undefined;

  return JSON.stringify({
    prompt: input.prompt.trim().slice(0, 6_000),
    ...(input.currentDraft.trim() ? { currentDraft: input.currentDraft.trim().slice(0, 4_000) } : {}),
    ...(reference ? { reference } : {}),
  });
}

function retryAfterFromHeader(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = numberValue(header);
  if (seconds) return seconds;
  const retryAt = Date.parse(header);
  return Number.isFinite(retryAt) ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : undefined;
}

function messageFromResponse(body: string, fallback: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed)) {
      return firstString(
        typeof parsed.error === "string" ? parsed.error : undefined,
        isRecord(parsed.error) ? parsed.error.message : undefined,
        parsed.message,
      ) ?? fallback;
    }
  } catch {
    const sseFrame = parseSseBlock(body);
    if (sseFrame) return parseGenerationPayload(sseFrame.payload, sseFrame.eventName).message;
    // A text response is still useful as an error message.
  }
  return body.trim() || fallback;
}

function assertSuccess(response: Response, body: string): void {
  if (response.ok) return;
  const sseFrame = parseSseBlock(body);
  const sseError = sseFrame ? parseGenerationPayload(sseFrame.payload, sseFrame.eventName) : undefined;
  const retryAfterSeconds = response.status === 429
    ? retryAfterFromHeader(response.headers.get("retry-after")) ?? sseError?.retryAfterSeconds
    : undefined;
  throw new ApiRequestError(messageFromResponse(body, `Request failed (${response.status}).`), retryAfterSeconds);
}

function parseSseBlock(block: string): { eventName: string; payload: string } | undefined {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) eventName = line.slice("event:".length).trim() || "message";
    if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
  }
  const payload = dataLines.join("\n");
  return payload ? { eventName, payload } : undefined;
}

/**
 * Send a generation request and consume either a standard JSON reply or an SSE
 * stream. Draft chunks are returned, rather than written to an editor directly,
 * so callers can preserve user content if the stream subsequently fails.
 */
export async function generateSkill(
  endpoint: string,
  input: GenerationInput,
  onEvent: (event: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "text/event-stream, application/json", "Content-Type": "application/json" },
    body: serializeGenerationRequest(input),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    assertSuccess(response, body);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const body = await response.text();
    const event = parseGenerationPayload(body, "complete");
    onEvent(event);
    if (event.kind === "error") throw new ApiRequestError(event.message, event.retryAfterSeconds);
    return event.content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let latestContent: string | undefined;

  const emit = (block: string) => {
    const frame = parseSseBlock(block);
    if (!frame || frame.payload === "[DONE]") return;
    const event = parseGenerationPayload(frame.payload, frame.eventName);
    onEvent(event);
    if (event.content) latestContent = event.content;
    if (event.kind === "error") throw new ApiRequestError(event.message, event.retryAfterSeconds);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        const separatorLength = buffer[boundary] === "\r" ? 4 : 2;
        buffer = buffer.slice(boundary + separatorLength);
        emit(block);
        boundary = buffer.search(/\r?\n\r?\n/);
      }
      if (done) break;
    }
    if (buffer.trim()) emit(buffer);
  } finally {
    reader.releaseLock();
  }

  return latestContent;
}

export function serializeHarnessRequest(input: HarnessInput): string {
  return JSON.stringify({
    skillMarkdown: input.skillContent,
    prompt: input.scenario.trim() || "Review the skill for a safe, actionable response.",
  });
}

/** Map the standalone Harness Lambda response and compatible structured result shapes. */
export function parseHarnessResponse(rawPayload: string): HarnessResult {
  let payload: unknown = rawPayload;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return { passed: false, summary: "Harness returned a non-JSON response.", output: rawPayload };
  }

  if (!isRecord(payload)) {
    return { passed: false, summary: "Harness returned an invalid response.", output: rawPayload };
  }
  const nestedResult = isRecord(payload.result) ? payload.result : undefined;
  const status = firstString(payload.status, nestedResult?.status)?.toLocaleLowerCase();
  const explicitPassed = typeof payload.passed === "boolean"
    ? payload.passed
    : typeof nestedResult?.passed === "boolean"
      ? nestedResult.passed
      : status === "passed" || status === "success" || status === "succeeded"
        ? true
        : status === "failed" || status === "failure"
          ? false
          : undefined;
  const output = firstString(payload.output, payload.response, nestedResult?.output, nestedResult?.response) ?? "No additional Harness output.";
  const stopReason = firstString(payload.stopReason);
  const summary = firstString(payload.summary, payload.message, nestedResult?.summary, nestedResult?.message) ??
    (explicitPassed === true
      ? "Harness completed successfully."
      : explicitPassed === false
        ? "Harness reported an unsuccessful result."
        : `Harness completed${stopReason ? ` (${stopReason})` : ""}. Review the agent output below.`);
  return { ...(explicitPassed === undefined ? {} : { passed: explicitPassed }), summary, output };
}

export async function testSkillWithHarness(
  endpoint: string,
  input: HarnessInput,
  signal?: AbortSignal,
): Promise<HarnessResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: serializeHarnessRequest(input),
    signal,
  });
  const body = await response.text();
  assertSuccess(response, body);
  return parseHarnessResponse(body);
}

export function buildMockSkill(input: GenerationInput): string {
  const titleWords = input.prompt
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);
  const title = titleWords.length ? titleWords.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") : "Collaborative Skill";
  const sourceLines = buildInspirationContext(input.inspiration)
    .map((source) => `- ${source.title} (${source.attribution})`)
    .join("\n") || "- No local examples matched this prompt.";
  const referenceLine = input.reference?.content.trim()
    ? `\n## User Reference\n\nUse the supplied reference from **${input.reference.label.trim() || "User-provided reference"}** as context. Verify uncertain details with the user.\n`
    : "";

  return `# ${title}\n\n## Purpose\n\nHelp the user with: ${input.prompt.trim() || "a clearly scoped task"}.\n\n## Workflow\n\n1. Confirm the goal, constraints, and the information that is already known.\n2. Propose a small, reversible next action before any high-impact change.\n3. Carry out the approved work and report concrete evidence.\n4. Call out assumptions, open questions, and sensible follow-up work.\n\n## Guardrails\n\n- Preserve existing user work and ask before destructive actions.\n- Do not expose secrets, credentials, or private data.\n- State what was verified instead of claiming unobserved success.\n${referenceLine}\n## Local Inspiration\n\n${sourceLines}\n`;
}

export function runMockHarnessTest(input: HarnessInput): HarnessResult {
  const hasTitle = /^#\s+.+/m.test(input.skillContent);
  const hasWorkflow = /^##\s+Workflow/m.test(input.skillContent);
  const passed = hasTitle && hasWorkflow && input.skillContent.trim().length >= 120;
  return {
    passed,
    summary: passed
      ? "Local mock Harness check passed: the draft has a title, workflow, and enough actionable detail."
      : "Local mock Harness check needs a title, a Workflow section, and at least 120 characters.",
    output: `Scenario: ${input.scenario.trim() || "Default skill review"}\nChecks: title=${hasTitle}, workflow=${hasWorkflow}, length=${input.skillContent.trim().length}`,
  };
}

export function hasConfiguredEndpoint(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function generationModeLabel(endpoint: string | undefined): string {
  return hasConfiguredEndpoint(endpoint)
    ? "Live generation API configured"
    : "Local mock generation — VITE_GENERATE_API_URL is not configured";
}

export function harnessModeLabel(endpoint: string | undefined): string {
  return hasConfiguredEndpoint(endpoint)
    ? "Live Harness API configured"
    : "Local mock Harness — VITE_TEST_SKILL_API_URL is not configured";
}

export function toSkillSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return slug || "untitled-skill";
}

export function createSkillDownloadName(): string {
  return "SKILL.md";
}

export function downloadSkill(markdown: string): string {
  const fileName = createSkillDownloadName();
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return fileName;
}
