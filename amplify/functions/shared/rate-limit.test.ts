import { describe, expect, it } from "vitest";
import {
  buildRateLimitKey,
  buildRateLimitUpdate,
  enforceRateLimit,
  retryAfterSeconds,
  type RateLimitRule,
} from "./rate-limit";

const rule: RateLimitRule = { scope: "generate-skill", limit: 5, windowSeconds: 3_600 };

function now(): number {
  return 1_700_000_125_000;
}

describe("DynamoDB TTL rate limiter", () => {
  it("uses a privacy-preserving identity hash and a time bucket in the key", () => {
    const key = buildRateLimitKey(rule, "203.0.113.10", Math.floor(now() / 1_000));
    expect(key).toMatch(/^generate-skill#[a-f0-9]{32}#472222$/);
    expect(key).not.toContain("203.0.113.10");
  });

  it("builds a conditional increment with a TTL after the current window", () => {
    const nowSeconds = Math.floor(now() / 1_000);
    const command = buildRateLimitUpdate("RateLimits", rule, "203.0.113.10", nowSeconds);
    expect(command.input).toMatchObject({
      TableName: "RateLimits",
      UpdateExpression: "SET #expiresAt = if_not_exists(#expiresAt, :expiresAt) ADD #requestCount :one",
      ConditionExpression: "attribute_not_exists(#requestCount) OR #requestCount < :limit",
      ExpressionAttributeValues: {
        ":one": 1,
        ":limit": 5,
        ":expiresAt": (472222 + 1) * 3_600 + 3_600,
      },
    });
  });

  it("denies a request when DynamoDB rejects the conditional update", async () => {
    const result = await enforceRateLimit("RateLimits", rule, "203.0.113.10", {
      client: {
        send: async () => {
          throw { name: "ConditionalCheckFailedException" };
        },
      },
      now,
    });

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 2_675 });
  });

  it("calculates reset time at the next fixed window boundary", () => {
    expect(retryAfterSeconds(7_200, 3_600)).toBe(3_600);
    expect(retryAfterSeconds(7_201, 3_600)).toBe(3_599);
  });
});
