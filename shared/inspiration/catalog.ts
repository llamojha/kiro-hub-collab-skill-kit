const testingWorkflowsSkill = `# Testing Workflow Assistant

## Purpose

Help an engineering team turn a change request into a focused, repeatable test plan before implementation and release.

## Workflow

1. Identify the behavior being changed and the user-visible risk.
2. Propose the smallest unit, integration, and manual checks that prove the behavior.
3. Name concrete test cases, including one failure path and one boundary case.
4. Run the narrowest relevant test command first, then broaden validation only if needed.
5. Report what was verified, what was not verified, and why.

## Guardrails

- Do not claim a test passed unless its output was observed.
- Keep fixtures synthetic and free of production credentials or customer data.
- Preserve existing assertions unless the product behavior intentionally changes.
- Prefer deterministic tests over timing-dependent retries.

## Output

Return a compact checklist with test names, commands, expected signals, and remaining risks.`;

const awsOperationsSkill = `# AWS Operations Runbook Assistant

## Purpose

Guide a human operator through a safe AWS operational investigation or change using explicit scope, evidence, and rollback thinking.

## Workflow

1. Restate the affected workload, AWS account, Region, and expected outcome.
2. Collect read-only evidence before proposing a mutating command.
3. Identify blast radius, dependencies, alarms, and a reversible rollback path.
4. Present AWS CLI commands with placeholders instead of credentials or account identifiers.
5. Verify the expected state with a follow-up read-only command and record the result.

## Guardrails

- Never execute destructive or production-changing actions without explicit confirmation.
- Do not print credentials, secrets, or token material.
- Prefer least-privilege and targeted resource identifiers.
- State when evidence is unavailable instead of inferring success.

## Output

Provide an ordered runbook with pre-checks, commands, expected observations, rollback, and verification.`;

const productPlanningSkill = `# Product Planning Partner

## Purpose

Turn a product idea into a small, testable plan that gives stakeholders clear decisions without inventing customer evidence.

## Workflow

1. Clarify the target user, job to be done, desired outcome, and constraints.
2. Separate confirmed evidence from assumptions and unknowns.
3. Define a thin first release with explicit non-goals.
4. Write observable acceptance criteria and identify leading success signals.
5. List the highest-risk assumptions and the cheapest validation step for each.

## Guardrails

- Do not present assumptions as customer research.
- Avoid date estimates; use scope and sequencing instead.
- Keep the first release narrow enough to evaluate one core value proposition.
- Name trade-offs when requirements conflict.

## Output

Return a concise problem statement, release slice, acceptance criteria, metrics, open questions, and risks.`;

/** All catalog entries are original, local examples maintained with this standalone kit. */
export interface InspirationSource {
  id: string;
  title: string;
  description: string;
  attribution: string;
  sourcePath: string;
  keywords: readonly string[];
  content: string;
}

export interface MatchedInspiration extends InspirationSource {
  score: number;
}

export const MAX_MATCHED_SOURCES = 3;
export const MAX_SOURCE_CONTEXT_CHARACTERS = 1_200;
export const MAX_INSPIRATION_CONTEXT_CHARACTERS = 3_200;
export const MAX_REFERENCE_CONTEXT_CHARACTERS = 2_400;

export const INSPIRATION_CATALOG: readonly InspirationSource[] = [
  {
    id: "testing-workflows",
    title: "Testing Workflow Assistant",
    description: "A repeatable test-planning and evidence-reporting workflow.",
    attribution: "First-party original example — Kiro Collab Skill Kit",
    sourcePath: "shared/inspiration/examples/testing-workflows.SKILL.md",
    keywords: ["test", "testing", "quality", "coverage", "regression", "fixture", "validation", "release"],
    content: testingWorkflowsSkill,
  },
  {
    id: "aws-operations",
    title: "AWS Operations Runbook Assistant",
    description: "A safety-first operational runbook for AWS investigations and changes.",
    attribution: "First-party original example — Kiro Collab Skill Kit",
    sourcePath: "shared/inspiration/examples/aws-operations.SKILL.md",
    keywords: ["aws", "cloud", "operations", "runbook", "incident", "infrastructure", "rollback", "deploy"],
    content: awsOperationsSkill,
  },
  {
    id: "product-planning",
    title: "Product Planning Partner",
    description: "A thin-slice planning workflow grounded in evidence and acceptance criteria.",
    attribution: "First-party original example — Kiro Collab Skill Kit",
    sourcePath: "shared/inspiration/examples/product-planning.SKILL.md",
    keywords: ["product", "planning", "roadmap", "user", "requirements", "acceptance", "metrics", "research"],
    content: productPlanningSkill,
  },
] as const;

function normalizedText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function includesKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = normalizedText(keyword);
  return normalizedKeyword.length > 0 && (` ${text} `).includes(` ${normalizedKeyword} `);
}

/**
 * Match only explicit catalog keywords. The score and title tie-break make results
 * stable across browsers and avoid opaque semantic-ranking behavior.
 */
export function matchInspiration(
  prompt: string,
  catalog: readonly InspirationSource[] = INSPIRATION_CATALOG,
): MatchedInspiration[] {
  const text = normalizedText(prompt);

  return catalog
    .map((source) => {
      const score = source.keywords.reduce((total, keyword) => total + (includesKeyword(text, keyword) ? 1 : 0), 0);
      return { ...source, score };
    })
    .filter((source) => source.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, MAX_MATCHED_SOURCES);
}

export function capReferenceContent(content: string): string {
  return content.trim().slice(0, MAX_REFERENCE_CONTEXT_CHARACTERS);
}

/** Build bounded, attributed source material suitable for a generation request. */
export function buildInspirationContext(matches: readonly InspirationSource[]): InspirationSource[] {
  let remainingCharacters = MAX_INSPIRATION_CONTEXT_CHARACTERS;

  return matches.slice(0, MAX_MATCHED_SOURCES).flatMap((source) => {
    if (remainingCharacters <= 0) return [];
    const allowedCharacters = Math.min(MAX_SOURCE_CONTEXT_CHARACTERS, remainingCharacters);
    const content = source.content.trim().slice(0, allowedCharacters);
    remainingCharacters -= content.length;
    return content.length > 0 ? [{ ...source, content }] : [];
  });
}
