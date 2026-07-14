export interface FunctionUrlEvent {
  body?: string | null;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    http?: {
      method?: string;
      sourceIp?: string;
    };
  };
}

export interface JsonResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function parseJsonBody(event: FunctionUrlEvent): unknown {
  if (!event.body) throw new Error("A JSON request body is required");
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

export function getRequestMethod(event: FunctionUrlEvent): string {
  return event.requestContext?.http?.method?.toUpperCase() ?? "POST";
}

/**
 * Function URL sourceIp is populated by Lambda. Do not trust a user-provided
 * X-Forwarded-For header for a public, unauthenticated cost-control boundary.
 */
export function getClientIp(event: FunctionUrlEvent): string {
  return event.requestContext?.http?.sourceIp ?? "unknown";
}

export function jsonResponse(statusCode: number, body: unknown): JsonResponse {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseHeaders(): Record<string, string> {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
