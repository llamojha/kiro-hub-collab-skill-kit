import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NOVA_LITE_MODEL_ID } from "../../backend-config";
import {
  getClientIp,
  getRequestMethod,
  parseJsonBody,
  sseEvent,
  sseHeaders,
  type FunctionUrlEvent,
} from "../shared/http";
import { enforceRateLimit } from "../shared/rate-limit";
import {
  buildGenerationPrompt,
  extractSkillMarkdown,
  sourceAttributions,
  validateGenerateSkillRequest,
  type GenerateSkillRequest,
} from "./validation";

const GENERATION_RATE_LIMIT = {
  scope: "generate-skill",
  limit: 5,
  windowSeconds: 60 * 60,
};
const MAX_ATTEMPTS = 2;
const bedrock = new BedrockRuntimeClient({});

type WritableResponse = NodeJS.WritableStream;
type StreamingHandler = (
  event: FunctionUrlEvent,
  responseStream: WritableResponse,
  context: unknown,
) => Promise<void>;

interface LambdaResponseStreaming {
  streamifyResponse(handler: StreamingHandler): StreamingHandler;
  HttpResponseStream: {
    from(responseStream: WritableResponse, metadata: { statusCode: number; headers: Record<string, string> }): WritableResponse;
  };
}

const responseStreaming = (globalThis as typeof globalThis & { awslambda?: LambdaResponseStreaming }).awslambda;
if (!responseStreaming) {
  throw new Error("Lambda response streaming is unavailable outside the Lambda runtime");
}

export const handler = responseStreaming.streamifyResponse(async (event, responseStream) => {
  const method = getRequestMethod(event);
  if (method !== "POST") {
    return writeSseError(responseStream, 405, "METHOD_NOT_ALLOWED", "Only POST is supported");
  }

  let request: GenerateSkillRequest;
  try {
    const parsed = validateGenerateSkillRequest(parseJsonBody(event));
    if (!parsed.ok) return writeSseError(responseStream, 400, "INVALID_REQUEST", parsed.error);
    request = parsed.value;
  } catch (error) {
    return writeSseError(responseStream, 400, "INVALID_REQUEST", errorMessage(error));
  }

  const rateLimitTableName = process.env.RATE_LIMIT_TABLE_NAME;
  if (!rateLimitTableName) {
    return writeSseError(responseStream, 500, "CONFIGURATION_ERROR", "Rate limiter is not configured");
  }

  let rateLimit;
  try {
    rateLimit = await enforceRateLimit(rateLimitTableName, GENERATION_RATE_LIMIT, getClientIp(event));
  } catch (error) {
    console.error("Rate limiter failed", error);
    return writeSseError(responseStream, 503, "RATE_LIMIT_UNAVAILABLE", "Request limiter is temporarily unavailable");
  }
  if (!rateLimit.allowed) {
    return writeSseError(responseStream, 429, "RATE_LIMITED", "Generation request limit reached", {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const stream = responseStreaming.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: sseHeaders(),
  });
  const emit = (name: string, data: unknown) => stream.write(sseEvent(name, data));
  emit("status", { stage: "accepted", maxAttempts: MAX_ATTEMPTS });

  let invalidReason = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    emit("status", { stage: attempt === 1 ? "generating" : "retrying", attempt });
    try {
      const modelOutput = await generateWithNova(request, invalidReason || undefined);
      const extracted = extractSkillMarkdown(modelOutput);
      if (extracted.valid) {
        emit("result", {
          skillMarkdown: extracted.markdown,
          sourceAttribution: sourceAttributions(request.sources),
          model: NOVA_LITE_MODEL_ID,
          attempts: attempt,
        });
        stream.end();
        return;
      }
      invalidReason = extracted.reason;
      console.warn("Generated invalid SKILL.md", { attempt, invalidReason });
    } catch (error) {
      console.error("Nova Lite generation failed", error);
      writeSseEvent(stream, "error", {
        code: "GENERATION_FAILED",
        message: "Skill generation could not be completed",
      });
      stream.end();
      return;
    }
  }

  writeSseEvent(stream, "error", {
    code: "INVALID_SKILL_OUTPUT",
    message: "The model did not return a valid SKILL.md after retrying",
  });
  stream.end();
});

async function generateWithNova(request: GenerateSkillRequest, retryReason?: string): Promise<string> {
  const response = await bedrock.send(new ConverseCommand({
    modelId: NOVA_LITE_MODEL_ID,
    messages: [{
      role: "user",
      content: [{ text: buildGenerationPrompt(request, retryReason) }],
    }],
    inferenceConfig: {
      maxTokens: 5_000,
      temperature: 0.2,
      topP: 0.9,
    },
  }));

  const text = response.output?.message?.content
    ?.flatMap((block) => ("text" in block && block.text ? [block.text] : []))
    .join("")
    .trim();
  if (!text) throw new Error("Nova Lite returned no text");
  return text;
}

function writeSseError(
  responseStream: WritableResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const stream = responseStreaming.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: sseHeaders(),
  });
  writeSseEvent(stream, "error", { code, message, ...details });
  stream.end();
}

function writeSseEvent(stream: WritableResponse, event: string, data: unknown): void {
  stream.write(sseEvent(event, data));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request body is invalid";
}
