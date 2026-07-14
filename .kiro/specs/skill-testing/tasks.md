# Skill testing — tasks

## Scope guard

Implement only deterministic mock testing and a backend-mediated AgentCore Harness test flow for the current local draft. Do not add publication, remote test discovery, a Registry, marketplace integration, persistent histories, shared workspaces, or human-human real-time collaboration.

- [ ] **1. Define test contracts and limits.** Create `shared/skillTestContracts.ts` plus tests for request identifiers, draft/test-case limits, result statuses, finding levels, and unknown fields. Run the targeted contract test.
- [ ] **2. Build deterministic mock results.** Create `src/features/skill-test/mockTestTransport.ts` with documented markers that yield stable passed, failed, and retryable-error results. Test that it makes no network call and produces only valid shared-contract results.
- [ ] **3. Build the test transport.** Create `src/features/skill-test/testTransport.ts` to select mock mode when `VITE_TEST_SKILL_API_URL` is blank and otherwise issue a cancellable JSON request. Test method, headers, request body, matching request ID, and content-type rejection.
- [ ] **4. Implement test lifecycle state.** Create `src/features/skill-test/useSkillTest.ts` with draft validation, one-active-test lock, `AbortController`, result state, error mapping, and late-result ignore behavior. Test empty-draft block, duplicate prevention, cancellation, and retry-safe errors.
- [ ] **5. Implement the test panel.** Create `src/features/skill-test/SkillTestPanel.tsx` and mount it from `SkillBuilderPage.tsx`. Display whether the run is mock or Harness-backed, render findings as text, and include the non-certification wording for a pass. Add component tests for all result statuses and hostile strings.
- [ ] **6. Create the backend function boundary.** Create `amplify/functions/test-skill/resource.ts` and `amplify/functions/test-skill/handler.ts`. Bind backend-only Harness configuration, validate origin and request data, and return typed safe errors when configuration is absent.
- [ ] **7. Add controlled Harness invocation.** In `handler.ts`, invoke only the configured AgentCore Harness with an allowlisted bounded payload and timeout. Implement cancellation/disconnect cleanup when supported; never return raw invocation data.
- [ ] **8. Normalize and redact Harness output.** Create `amplify/functions/test-skill/resultMapper.ts` plus tests for valid mapping, unknown shapes, duration/size limits, credential-like string redaction, private-identifier redaction, and truncation.
- [ ] **9. Add backend tests.** Test request validation, CORS allow/deny behavior, timeout mapping, safe error codes, output redaction, and no raw input/output logging. Run targeted function tests before broader checks.
- [ ] **10. Add sandbox-only live verification.** After least-privilege backend configuration is deployed, run a bounded known-safe draft/test case through the configured Harness. Record only request ID, normalized status, and safe summary; do not commit output or settings.
- [ ] **11. Checkpoint — validate mock and live boundaries.** Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify:standalone`. Confirm blank endpoint variables exercise mock mode and browser bundle inspection contains no Harness configuration.
