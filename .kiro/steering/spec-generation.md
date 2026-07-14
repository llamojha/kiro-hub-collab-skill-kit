---
inclusion: manual
---

# Spec generation guide — Kiro Collab Skill Kit

Use this guide when proposing a new feature for this nested project. Read `steering/product.md`, `steering/architecture.md`, and `steering/tech.md` first. Keep every path relative to `kiro-collab-skill-kit/`.

## Required output

Create a directory under `.kiro/specs/<feature-slug>/` containing:

- `requirements.md` — one user story and verifiable EARS acceptance criteria.
- `design.md` — bounded technical approach, data/event contracts, errors, and test strategy.
- `tasks.md` — small dependency-ordered implementation tasks plus a final checkpoint.

Do not estimate elapsed time. Keep tasks small enough for one focused session and include exact target paths and validation commands.

## Mandatory scope section

Every spec begins by naming whether it affects mock mode, direct Bedrock generation, SSE, AgentCore Harness testing, or local inspiration. It must also state that the MVP excludes a Registry, marketplace, publication path, remote content discovery, shared workspace, co-editing, presence, messaging, and human-human real-time collaboration.

A spec that requires any excluded capability is a future-extension proposal, not an MVP implementation spec. It must be separated rather than folded into the current work.

## Requirements format

Use EARS language:

- **When** a condition happens, **the system shall** produce an observable result.
- **If** a condition is invalid or fails, **the system shall** fail safely and give the user an actionable, non-sensitive message.
- **While** an operation is active, **the system shall** expose the relevant status and cancellation behavior.

Include acceptance criteria for mock behavior, empty state, failure state, input bounds, and tests where relevant.

## Design checklist

- Name only existing or planned project-local paths in `src/`, `shared/`, and `amplify/functions/`.
- For generation, specify a direct Bedrock request boundary and the named SSE event sequence.
- For testing, specify AgentCore Harness invocation boundaries, timeout, output normalization, and redaction.
- For inspiration, permit only original first-party bundled examples and explicit user-provided local content.
- Define request/response schemas and ownership of backend-only variables.
- State no-persistence behavior unless persistence is explicitly designed with consent, retention, and authorization controls.
- Include cancellation, retry, idempotency, and malformed-response behavior as applicable.

## Provenance checklist

Never copy an external skill into a feature spec, fixture, prompt, or example. If future work considers Kiro Hub-derived material, stop and require a completed license, author, and source audit according to `NOTICE.md` before using any content.

## Prompt template

```text
Create a complete spec for "<feature>" in `.kiro/specs/<feature-slug>/`.

Use `.kiro/steering/product.md`, `.kiro/steering/architecture.md`, and
`.kiro/steering/tech.md`. Produce requirements.md, design.md, and tasks.md.

The feature may use only direct Amazon Bedrock generation, local first-party or
user-provided inspiration, AgentCore Harness testing, SSE, and project-local
paths. Explicitly exclude Registry, marketplace, publication, remote discovery,
shared workspaces, and human-human real-time collaboration from the MVP.

Use EARS acceptance criteria, list secure failure behavior, and add a final
validation checkpoint. Do not include external skill content or live secrets.
```

## Existing implementation specs

- `skill-builder-port/` — browser flow, local inspiration, editor, and download.
- `skill-testing/` — deterministic mock test flow and controlled Harness test.
- `generation-reliability/` — direct Bedrock SSE lifecycle and recovery behavior.
- `security-hardening/` — validation, provenance, redaction, and deployment controls.
