import { defineBackend } from "@aws-amplify/backend";
import { CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { functionUrlCors, NOVA_LITE_MODEL_ID, resolveAllowedOrigin } from "./backend-config";
import { generateSkill } from "./functions/generate-skill/resource";
import { testSkill } from "./functions/test-skill/resource";

const backend = defineBackend({
  generateSkill,
  testSkill,
});

const allowedOrigin = resolveAllowedOrigin(process.env.ALLOWED_ORIGIN);
const rateLimitTable = new dynamodb.Table(backend.stack, "SkillRateLimits", {
  partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: "expiresAt",
  removalPolicy: RemovalPolicy.RETAIN,
});

for (const functionResource of [backend.generateSkill, backend.testSkill]) {
  functionResource.addEnvironment("RATE_LIMIT_TABLE_NAME", rateLimitTable.tableName);
  rateLimitTable.grantReadWriteData(functionResource.resources.lambda);
}

backend.testSkill.addEnvironment("HARNESS_ARN", process.env.HARNESS_ARN?.trim() ?? "");
backend.testSkill.addEnvironment(
  "HARNESS_REGION",
  process.env.HARNESS_REGION?.trim() || process.env.AWS_REGION || "eu-central-1",
);

backend.generateSkill.resources.lambda.addToRolePolicy(new iam.PolicyStatement({
  sid: "InvokeNovaLiteOnly",
  actions: ["bedrock:InvokeModel"],
  resources: [
    `arn:${backend.stack.partition}:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0`,
    `arn:${backend.stack.partition}:bedrock:${backend.stack.region}:${backend.stack.account}:inference-profile/${NOVA_LITE_MODEL_ID}`,
  ],
}));

backend.testSkill.resources.lambda.addToRolePolicy(new iam.PolicyStatement({
  sid: "InvokeConfiguredAgentCoreHarness",
  actions: ["bedrock-agentcore:InvokeHarness", "bedrock-agentcore:InvokeAgentRuntime"],
  // The harness ARN is deployment-time configuration, so scope to Harness
  // resources in this account rather than granting any AgentCore action.
  resources: [`arn:${backend.stack.partition}:bedrock-agentcore:*:${backend.stack.account}:harness/*`],
}));

const generateSkillUrl = backend.generateSkill.resources.lambda.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
  cors: functionUrlCors(allowedOrigin),
});
const testSkillUrl = backend.testSkill.resources.lambda.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
  invokeMode: lambda.InvokeMode.BUFFERED,
  cors: functionUrlCors(allowedOrigin),
});

new CfnOutput(backend.stack, "GenerateSkillFunctionUrl", {
  value: generateSkillUrl.url,
  description: "Unauthenticated, rate-limited SSE endpoint for direct Nova Lite skill generation",
});
new CfnOutput(backend.stack, "TestSkillFunctionUrl", {
  value: testSkillUrl.url,
  description: "Unauthenticated, rate-limited endpoint for AgentCore Harness skill tests",
});
new CfnOutput(backend.stack, "SkillRateLimitsTableName", {
  value: rateLimitTable.tableName,
  description: "DynamoDB TTL table used by both Function URL rate limiters",
});

export default backend;
