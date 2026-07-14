import { defineFunction } from "@aws-amplify/backend";

export const generateSkill = defineFunction({
  name: "generate-skill",
  entry: "./handler.ts",
  timeoutSeconds: 60,
  memoryMB: 1_024,
});
