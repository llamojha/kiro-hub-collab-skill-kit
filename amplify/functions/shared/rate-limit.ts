import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export interface RateLimitRule {
  scope: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface CommandSender {
  send(command: UpdateCommand): Promise<unknown>;
}

export interface RateLimitDependencies {
  client?: CommandSender;
  now?: () => number;
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function hashRateLimitIdentity(identity: string): string {
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}

export function rateLimitBucket(nowSeconds: number, windowSeconds: number): number {
  return Math.floor(nowSeconds / windowSeconds);
}

export function retryAfterSeconds(nowSeconds: number, windowSeconds: number): number {
  const remainder = nowSeconds % windowSeconds;
  return remainder === 0 ? windowSeconds : windowSeconds - remainder;
}

export function buildRateLimitKey(rule: RateLimitRule, identity: string, nowSeconds: number): string {
  return `${rule.scope}#${hashRateLimitIdentity(identity)}#${rateLimitBucket(nowSeconds, rule.windowSeconds)}`;
}

export function buildRateLimitUpdate(
  tableName: string,
  rule: RateLimitRule,
  identity: string,
  nowSeconds: number,
): UpdateCommand {
  if (rule.limit < 1 || rule.windowSeconds < 1) {
    throw new Error("Rate-limit rule values must be positive");
  }

  const bucket = rateLimitBucket(nowSeconds, rule.windowSeconds);
  return new UpdateCommand({
    TableName: tableName,
    Key: {
      id: buildRateLimitKey(rule, identity, nowSeconds),
    },
    // TTL deletion is asynchronous, but including the time bucket in the key
    // means an undeleted item can never affect a later window.
    UpdateExpression: "SET #expiresAt = if_not_exists(#expiresAt, :expiresAt) ADD #requestCount :one",
    ConditionExpression: "attribute_not_exists(#requestCount) OR #requestCount < :limit",
    ExpressionAttributeNames: {
      "#requestCount": "requestCount",
      "#expiresAt": "expiresAt",
    },
    ExpressionAttributeValues: {
      ":one": 1,
      ":limit": rule.limit,
      ":expiresAt": (bucket + 1) * rule.windowSeconds + rule.windowSeconds,
    },
  });
}

export async function enforceRateLimit(
  tableName: string,
  rule: RateLimitRule,
  identity: string,
  dependencies: RateLimitDependencies = {},
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor((dependencies.now?.() ?? Date.now()) / 1000);
  const command = buildRateLimitUpdate(tableName, rule, identity, nowSeconds);

  try {
    await (dependencies.client ?? documentClient).send(command);
    return { allowed: true, retryAfterSeconds: retryAfterSeconds(nowSeconds, rule.windowSeconds) };
  } catch (error) {
    if (isConditionalCheckFailure(error)) {
      return { allowed: false, retryAfterSeconds: retryAfterSeconds(nowSeconds, rule.windowSeconds) };
    }
    throw error;
  }
}

function isConditionalCheckFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error &&
    (error as { name?: unknown }).name === "ConditionalCheckFailedException";
}
