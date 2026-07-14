import { randomUUID } from "node:crypto";
import { BedrockAgentCoreClient, InvokeHarnessCommand } from "@aws-sdk/client-bedrock-agentcore";
import {
  getClientIp,
  getRequestMethod,
  jsonResponse,
  parseJsonBody,
  type FunctionUrlEvent,
  type JsonResponse,
} from "../shared/http";
import { enforceRateLimit } from "../shared/rate-limit";
import {
  buildHarnessInvocationBody,
  parseHarnessResponseEvents,
  validateTestSkillRequest,
  type TestSkillRequest,
} from "./parser";

const TEST_RATE_LIMIT = {
  scope: "test-skill",
  limit: 10,
  windowSeconds: 60 * 60,
};
const DEFAULT_HARNESS_REGION = "eu-central-1";
const HARNESS_REQUEST_TIMEOUT_MS = 50_000;

export async function handler(event: FunctionUrlEvent): Promise<JsonResponse> {
  if (getRequestMethod(event) !== "POST") {
    return jsonResponse(405, { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported" });
  }

  let request: TestSkillRequest;
  try {
    const parsed = validateTestSkillRequest(parseJsonBody(event));
    if (!parsed.ok) return jsonResponse(400, { code: "INVALID_REQUEST", message: parsed.error });
    request = parsed.value;
  } catch (error) {
    return jsonResponse(400, { code: "INVALID_REQUEST", message: errorMessage(error) });
  }

  const harnessArn = process.env.HARNESS_ARN?.trim();
  if (!harnessArn) {
    return jsonResponse(503, {
      code: "CONFIGURATION_ERROR",
      message: "HARNESS_ARN is not configured",
    });
  }
  if (!isHarnessArn(harnessArn)) {
    return jsonResponse(503, {
      code: "CONFIGURATION_ERROR",
      message: "HARNESS_ARN is invalid",
    });
  }

  const rateLimitTableName = process.env.RATE_LIMIT_TABLE_NAME;
  if (!rateLimitTableName) {
    return jsonResponse(500, { code: "CONFIGURATION_ERROR", message: "Rate limiter is not configured" });
  }

  let rateLimit;
  try {
    rateLimit = await enforceRateLimit(rateLimitTableName, TEST_RATE_LIMIT, getClientIp(event));
  } catch (error) {
    console.error("Rate limiter failed", error);
    return jsonResponse(503, { code: "RATE_LIMIT_UNAVAILABLE", message: "Request limiter is temporarily unavailable" });
  }
  if (!rateLimit.allowed) {
    return jsonResponse(429, {
      code: "RATE_LIMITED",
      message: "Skill test request limit reached",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const sessionId = request.sessionId ?? `test-${randomUUID()}`;
  const startedAt = Date.now();
  try {
    const harnessEvents = await invokeHarness({
      harnessArn,
      region: process.env.HARNESS_REGION?.trim() || process.env.AWS_REGION || DEFAULT_HARNESS_REGION,
      sessionId,
      request,
    });
    const parsed = parseHarnessResponseEvents(harnessEvents);
    return jsonResponse(200, {
      sessionId,
      response: parsed.text,
      durationMs: Date.now() - startedAt,
      stopReason: parsed.stopReason,
      ...(parsed.harnessLatencyMs !== undefined ? { harnessLatencyMs: parsed.harnessLatencyMs } : {}),
      ...(parsed.usage ? { usage: parsed.usage } : {}),
    });
  } catch (error) {
    console.error("Harness invocation failed", error);
    return jsonResponse(502, {
      code: "HARNESS_INVOCATION_FAILED",
      message: "Skill test could not be completed",
    });
  }
}

interface InvokeHarnessOptions {
  harnessArn: string;
  region: string;
  sessionId: string;
  request: TestSkillRequest;
}

async function invokeHarness({ harnessArn, region, sessionId, request }: InvokeHarnessOptions): Promise<unknown[]> {
  const client = new BedrockAgentCoreClient({ region, maxAttempts: 2 });
  const response = await client.send(new InvokeHarnessCommand({
    harnessArn,
    runtimeSessionId: sessionId,
    ...buildHarnessInvocationBody(request),
  }), {
    abortSignal: AbortSignal.timeout(HARNESS_REQUEST_TIMEOUT_MS),
  });
  if (!response.stream) throw new Error("Harness response stream was missing");

  const events: unknown[] = [];
  for await (const event of response.stream) events.push(event);
  return events;
}

function isHarnessArn(value: string): boolean {
  return /^arn:[^:]+:bedrock-agentcore:[a-z0-9-]+:\d{12}:harness\/[A-Za-z][A-Za-z0-9_]{0,39}-[A-Za-z0-9]{10}$/.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request body is invalid";
}
