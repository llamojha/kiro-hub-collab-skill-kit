import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

export const LOCAL_DEVELOPMENT_ORIGIN = "http://localhost:5174";
export const NOVA_LITE_MODEL_ID = "eu.amazon.nova-2-lite-v1:0";

export function resolveAllowedOrigin(value: string | undefined): string {
  const origin = value?.trim();
  if (!origin) return LOCAL_DEVELOPMENT_ORIGIN;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("ALLOWED_ORIGIN must use http or https");
    }
    return parsed.origin;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ALLOWED_ORIGIN")) {
      throw error;
    }
    throw new Error("ALLOWED_ORIGIN must be a valid origin");
  }
}

export function functionUrlCors(allowedOrigin: string): lambda.FunctionUrlCorsOptions {
  return {
    allowedOrigins: [allowedOrigin],
    allowedMethods: [lambda.HttpMethod.POST],
    allowedHeaders: ["content-type"],
    maxAge: Duration.hours(1),
  };
}
