# Kiro Collab Skill Kit AI context

This directory contains project-local guidance for the standalone Kiro Collab Skill Kit. It is deliberately self-contained: all paths are relative to `kiro-collab-skill-kit/`, and no workflow depends on a parent application or hosted catalog.

## Contents

- `steering/` — product, architecture, technology, and spec-generation constraints.
- `prompts/generate-skill.md` — the generation contract used for direct Bedrock requests.
- `skills/skill-authoring/SKILL.md` — a local procedure for authoring and reviewing a Kiro skill.
- `specs/` — staged implementation requirements, design, and tasks.

## Non-negotiable boundaries

- Use direct Amazon Bedrock calls only for generation; do not introduce a Registry, marketplace, or publication path.
- Use only bundled first-party examples and user-provided local inspiration. Do not copy external skills.
- Use AgentCore Harness only for skill tests, and use SSE for generation progress.
- The MVP supports one user and an AI assistant. It excludes human-human real-time collaboration and shared workspaces.
- Never put secrets, cloud credentials, or backend-only configuration into frontend files or prompts.

Read `steering/product.md`, `steering/architecture.md`, and `steering/tech.md` before changing implementation or planning a feature.
