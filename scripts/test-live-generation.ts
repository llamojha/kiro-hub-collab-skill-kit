import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NOVA_LITE_MODEL_ID } from "../amplify/backend-config";
import {
  buildGenerationPrompt,
  extractSkillMarkdown,
  validateGenerateSkillRequest,
} from "../amplify/functions/generate-skill/validation";

async function main(): Promise<void> {
  if (process.env.RUN_LIVE_GENERATION !== "1") {
    console.log("Skipped live generation. Set RUN_LIVE_GENERATION=1 to invoke Nova Lite with local AWS credentials.");
    return;
  }

  const region = process.env.BEDROCK_REGION || process.env.AWS_REGION;
  if (!region) {
    throw new Error("Set BEDROCK_REGION or AWS_REGION before enabling live generation");
  }

  const validation = validateGenerateSkillRequest({
    prompt: "Create a Kiro skill for safely triaging a failed CI build and documenting the result.",
  });
  if (!validation.ok) throw new Error(validation.error);

  // BedrockRuntimeClient resolves only the operator's local AWS credential chain.
  // This script calls Converse and intentionally creates no AWS resources.
  const client = new BedrockRuntimeClient({ region });
  const response = await client.send(new ConverseCommand({
    modelId: NOVA_LITE_MODEL_ID,
    messages: [{
      role: "user",
      content: [{ text: buildGenerationPrompt(validation.value) }],
    }],
    inferenceConfig: { maxTokens: 1_500, temperature: 0.2, topP: 0.9 },
  }));

  const text = response.output?.message?.content
    ?.flatMap((block) => ("text" in block && block.text ? [block.text] : []))
    .join("")
    .trim();
  const extracted = extractSkillMarkdown(text ?? "");
  if (!extracted.valid) throw new Error(`Nova Lite output was not a valid SKILL.md: ${extracted.reason}`);

  console.log(JSON.stringify({
    modelId: NOVA_LITE_MODEL_ID,
    status: "valid-skill-generated",
    characters: extracted.markdown.length,
    stopReason: response.stopReason ?? "unknown",
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
