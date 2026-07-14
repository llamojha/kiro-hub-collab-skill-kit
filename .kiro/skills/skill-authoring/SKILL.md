---
name: skill-authoring
description: Author, review, and test a local Kiro SKILL.md using only permitted inspiration.
---

# Skill authoring

## Purpose

Use this skill to transform a well-defined developer workflow into a reviewable Kiro `SKILL.md`. It applies to local authoring in Kiro Collab Skill Kit and preserves the project's local-first provenance and security boundaries.

## Before writing

Gather:

1. A one-sentence user outcome.
2. The intended audience and execution environment.
3. Inputs, prerequisites, and safe defaults.
4. Verification signals that prove each workflow step worked.
5. The smallest permitted inspiration set: bundled original first-party examples and/or content the user explicitly provided.

Do not use external skills, remote repositories, Registry content, marketplace listings, or copied templates. For any future Kiro Hub-derived material, require the license, author, and source audit described in `NOTICE.md` before using any text.

## Authoring workflow

1. **Define the boundary.** State what the skill does and does not do. Do not expand the task into publication, remote discovery, shared workspace, or human-human real-time collaboration capabilities.
2. **Write a specific title and purpose.** The title should name the task, not a broad team or product area.
3. **Declare when to use it.** Give observable trigger conditions and say when a different process is appropriate.
4. **List inputs and prerequisites.** Use explicit variable names and placeholders. Never write a live credential, secret, account identifier, or private endpoint into the skill.
5. **Create an ordered workflow.** Make each step imperative, narrow, and reversible when feasible. State expected output after meaningful steps.
6. **Add validation.** Include commands, assertions, or observable checks that confirm the intended outcome. Do not treat an AgentCore Harness result as a guarantee of security or production correctness.
7. **Describe failures.** Name likely validation, availability, or input errors and the safe action for each. Never ask a user to bypass controls or expose secrets to diagnose a problem.
8. **Record provenance.** Identify permitted inspiration only by its project-local label or user-provided label; do not reproduce unreviewed third-party material.
9. **Review for clarity.** A developer unfamiliar with the author should be able to follow the workflow without hidden context.

## Recommended template

```markdown
# <Specific task>

## Purpose
<Outcome and boundary.>

## When to use
<Observable triggers and exclusions.>

## Inputs and prerequisites
- `<input>` — <meaning, validation, safe placeholder>

## Workflow
1. <Action and expected result.>
2. <Action and expected result.>

## Verification
- <Observable check or command.>

## Failure handling
- <Condition> — <safe recovery action.>

## Security and provenance
- <Secrets, permissions, and permitted-inspiration notes.>
```

## Review checklist

- [ ] The goal, intended audience, and non-goals are clear.
- [ ] All paths, commands, and inputs are project-local or explicitly supplied by the user.
- [ ] The workflow has a verification step and a safe failure path.
- [ ] Secrets, tokens, and private infrastructure identifiers are absent.
- [ ] Inspiration is first-party or user-provided, with a source label.
- [ ] No external skills, Registry, marketplace, or publication mechanics appear.
- [ ] The text is concise enough to follow during real work.

## Testing in this project

First exercise the skill with the deterministic local mock test flow. When backend configuration is available, submit the reviewed draft and bounded test case to the AgentCore Harness test route. Inspect normalized results, redact sensitive material before sharing them, and revise the skill based on concrete failures.
