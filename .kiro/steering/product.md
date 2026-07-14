# Product context — Kiro Collab Skill Kit

## Vision

Kiro Collab Skill Kit helps one developer turn a focused workflow need into a reviewable Kiro `SKILL.md`, using an AI assistant without requiring a hosted catalog or external content source. The outcome is a local file the developer can inspect, test, and download.

## MVP user and outcome

The primary user is a developer who has a concrete automation, review, or operating workflow and wants a structured Kiro skill quickly. They provide a prompt and may provide local inspiration. The application returns an editable draft, exposes generation progress, runs an optional controlled test, and downloads `SKILL.md`.

Success means the user can complete that flow in mock mode without an AWS account and, when configured, with direct Amazon Bedrock generation and AgentCore Harness testing.

## MVP capabilities

- Draft and refine one skill in a browser session.
- Use bundled original first-party examples and user-provided local inspiration only.
- Generate a structured `SKILL.md` through direct Amazon Bedrock calls.
- Report ordered generation status through SSE.
- Edit and download the completed skill locally.
- Run a skill test through AgentCore Harness and present a bounded, redacted result.
- Offer a clearly labeled deterministic mock flow when live endpoints are absent.

## Explicit non-goals

The MVP has no Registry, marketplace, publication workflow, content discovery, remote skill import, or dependency on any parent project. It also has no shared workspace, presence, co-editing, messaging, or other human-human real-time collaboration functionality. Do not implement these features incidentally through backend contracts or UI labels.

## Provenance promise

Bundled inspiration must be original first-party material. External skills are not copied into prompts, examples, tests, or releases. Kiro Hub-derived material requires a completed license, author, and source audit before it can be considered; `NOTICE.md` defines the policy.

## Product guardrails

- Keep cloud use opt-in: blank endpoint variables must select mock behavior.
- Show the inspiration source and mode (mock or live) to the user.
- Treat generated content as a draft requiring human review.
- Do not promise that a Harness result certifies safety, correctness, or production readiness.
- Prefer small, transparent flows over hidden automation or persistent data collection.

## Future direction

A later release may evaluate optional Registry integration and shared workspaces as separately authorized, designed, and scoped extensions. They must not change the MVP's local-first provenance model or make mock mode dependent on cloud services.
