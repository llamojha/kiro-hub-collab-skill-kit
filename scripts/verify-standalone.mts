import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "package.json",
  "package-lock.json",
  ".npmignore",
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "src/main.tsx",
  "src/App.tsx",
  ".kiro/README.md",
  ".kiro/steering/product.md",
  ".kiro/steering/architecture.md",
  ".kiro/steering/tech.md",
  ".kiro/steering/spec-generation.md",
  ".kiro/prompts/generate-skill.md",
  ".kiro/skills/skill-authoring/SKILL.md",
];
const scanRoots = [
  "src",
  "shared",
  "amplify",
  ".kiro",
  ".env.example",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "NOTICE.md",
  "package.json",
  "amplify.yml",
  "index.html",
];
const forbiddenPatterns = [
  /KIROHUB_REGISTRY_ID/,
  /kirohub\.dev/,
  /KiroResource/,
  /from\s+["'](?:\/Users\/|[^"']*kiro-hub\/)/,
];

async function collectFiles(relativePath: string): Promise<string[]> {
  const fullPath = path.join(projectRoot, relativePath);
  const entry = await stat(fullPath);
  if (entry.isFile()) return [fullPath];
  const names = await readdir(fullPath);
  const nested = await Promise.all(names.map((name) => collectFiles(path.join(relativePath, name))));
  return nested.flat();
}

const errors: string[] = [];
for (const requiredFile of requiredFiles) {
  try {
    await stat(path.join(projectRoot, requiredFile));
  } catch {
    errors.push(`Missing required standalone asset: ${requiredFile}`);
  }
}

for (const scanRoot of scanRoots) {
  try {
    const files = await collectFiles(scanRoot);
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          errors.push(`Forbidden parent-project coupling in ${path.relative(projectRoot, file)}: ${pattern}`);
        }
      }
    }
  } catch {
    errors.push(`Missing scan target: ${scanRoot}`);
  }
}

if (errors.length) {
  console.error("Standalone verification failed:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Standalone verification passed.");
}
