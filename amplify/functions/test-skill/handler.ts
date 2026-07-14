import { randomUUID } from "node:crypto";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
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
  parseHarnessResponseBody,
  validateTestSkillRequest,
  type TestSkillRequest,
} from "./parser";

const TEST_RATE_LIMIT = {
  scope: "test-skill",
  limit: 10,
  windowSeconds: 60 * 60,
};
const DEFAULT_HARNESS_REGION = "eu-central-1";

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
    const harnessResponse = await invokeHarness({
      harnessArn,
      region: process.env.HARNESS_REGION?.trim() || process.env.AWS_REGION || DEFAULT_HARNESS_REGION,
      sessionId,
      request,
    });
    const parsed = parseHarnessResponseBody(harnessResponse);
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

async function invokeHarness({ harnessArn, region, sessionId, request }: InvokeHarnessOptions): Promise<string> {
  const hostname = `bedrock-agentcore.${region}.amazonaws.com`;
  const unsignedRequest = new HttpRequest({
    protocol: "https:",
    hostname,
    method: "POST",
    path: "/harnesses/invoke",
    query: { harnessArn },
    headers: {
      host: hostname,
      "content-type": "application/json",
      accept: "application/json",
      "x-amzn-bedrock-agentcore-runtime-session-id": sessionId,
    },
    body: JSON.stringify(buildHarnessInvocationBody(request)),
  });

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: "bedrock-agentcore",
    sha256: Sha256,
  });
  const signedRequest = await signer.sign(unsignedRequest);
  const response = await fetch(requestUrl(signedRequest), {
    method: signedRequest.method,
    headers: signedHeaders(signedRequest.headers),
    body: signedRequest.body,
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`Harness responded with HTTP ${response.status}`);
  }
  return responseBody;
}

interface SignedRequestLocation {
  protocol: string;
  hostname: string;
  path: string;
  query?: Record<string, string | string[] | null | undefined>;
}

function requestUrl(request: SignedRequestLocation): string {
  const url = new URL(`${request.protocol}//${request.hostname}${request.path}`);
  for (const [name, value] of Object.entries(request.query ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") url.searchParams.append(name, item);
      }
    } else if (typeof value === "string") {
      url.searchParams.set(name, value);
    }
  }
  return url.toString();
}

function signedHeaders(headers: Record<string, string | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) result.set(name, value);
  }
  return result;
}

function isHarnessArn(value: string): boolean {
  return /^arn:[^:]+:bedrock-agentcore:[a-z0-9-]+:\d{12}:harness\/[A-Za-z][A-Za-z0-9_]{0,39}-[A-Za-z0-9]{10}$/.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request body is invalid";
}
