# Skill testing — design

## Approach

Add a small test panel attached to the current local draft. The panel uses a shared request/result contract and selects a deterministic browser mock when no test URL is configured. A live test posts to `amplify/functions/test-skill/`, where backend-only configuration identifies the AgentCore Harness. No test content is published, discovered remotely, or shared with other people.

## Planned paths

| Path | Responsibility |
| --- | --- |
| `src/features/skill-test/SkillTestPanel.tsx` | Collect bounded test input, show mock/live mode, pending state, and normalized results. |
| `src/features/skill-test/useSkillTest.ts` | Validate browser input, cancel request, prevent duplicates, select adapter. |
| `src/features/skill-test/testTransport.ts` | Mock and HTTPS test adapters. |
| `shared/skillTestContracts.ts` | Test request, result, finding, status, and validation schemas. |
| `amplify/functions/test-skill/handler.ts` | Backend validation, Harness invocation, timeout, normalization, and redaction. |
| `amplify/functions/test-skill/resource.ts` | Function definition and backend-only environment-variable binding. |
| `src/features/skill-test/*.test.tsx` | Mock, validation, pending, pass/fail, cancellation, and redaction display tests. |
| `amplify/functions/test-skill/*.test.ts` | Request validation, raw-output normalization, redaction, and timeout tests. |

## Contract

```ts
type SkillTestRequest = {
  requestId: string;
  skillMarkdown: string;
  caseName: string;
  testInput: string;
};

type SkillTestResult = {
  requestId: string;
  status: "passed" | "failed" | "error" | "cancelled";
  summary: string;
  findings: Array<{ level: "info" | "warning" | "error"; message: string }>;
  retryable: boolean;
};
```

Both request and response have strict character, collection, and encoding limits. The browser renders `summary` and `findings` as escaped text. It does not render raw Harness output, arbitrary HTML, or provider-specific objects.

## Live flow

1. The browser validates the current draft and test fields, creates `requestId`, and marks the panel pending.
2. It `POST`s JSON to `VITE_TEST_SKILL_API_URL` with an `AbortSignal`.
3. The function verifies allowed origin, schema, sizes, and backend environment before doing work.
4. The function invokes only the configured AgentCore Harness with a bounded payload and deadline.
5. The result mapper selects an allowlisted result shape, truncates fields, redacts sensitive patterns and backend identifiers, and returns the typed result.
6. The browser accepts only a result matching the active request and transitions out of pending state.

## Mock flow

A local adapter maps deterministic markers in a test case to a stable pass/fail/error result. It must exercise the same typed result state machine as the live adapter and never make a cloud request. This lets contributors verify the UI without AWS access.

## Error and cancellation handling

The backend maps validation failures to safe, non-retryable codes and transient service failures to retryable codes. Timeouts return a stable `error` result after cleanup. Browser cancellation aborts the request and ignores any late result. In all failure paths, the editor draft remains unchanged.

## Security and observability

Only the function has access to `HARNESS_ARN` and `HARNESS_REGION`. Logs include the `requestId`, result category, duration bucket, and safe counters—not raw skill content, test input, credentials, or unredacted output. A passing Harness result must be described as test evidence for the provided case, never as security certification.

## Test strategy

Use contract tests for request validation and result mapping; unit-test redaction and truncation independently. Component tests cover blank endpoint mock selection, invalid draft block, pending duplicate prevention, cancellation, pass/fail rendering, and safe rendering of hostile strings. Integration tests in a sandbox exercise the configured Harness only after mock coverage passes.
