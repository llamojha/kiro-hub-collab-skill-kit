import { defineFunction } from "@aws-amplify/backend";

export const testSkill = defineFunction({
  name: "test-skill",
  entry: "./handler.ts",
  timeoutSeconds: 60,
  memoryMB: 1_024,
});
