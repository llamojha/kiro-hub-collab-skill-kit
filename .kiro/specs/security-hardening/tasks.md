# Security hardening — tasks

## Scope guard

Harden only the standalone local/mock and direct-Bedrock/Harness paths. Do not use hardening work to introduce a Registry, marketplace, publication workflow, remote discovery, account system, shared workspace, or human-human real-time collaboration.

- [ ] **1. Inventory external boundaries.** Create `docs/security-boundaries.md` in a future implementation change, listing browser input, SSE, test HTTP, direct Bedrock, AgentCore Harness, logging, environment variables, and bundled inspiration. Confirm each boundary has an owner and test plan.
- [ ] **2. Centralize shared validation.** Add strict request/result validators in `shared/` for all external shapes. Write tests for unknown fields, over-limit text, malformed encoding, invalid source kind, and missing request ID.
- [ ] **3. Enforce local inspiration provenance.** Add first-party example metadata and a test that examples carry project-local provenance. Reject all other kinds; add no remote URL acquisition path. Update `NOTICE.md` only if an approved first-party example set changes.
- [ ] **4. Harden browser rendering.** Test drafts, test findings, and error strings containing HTML-like text, scripts, event handlers, and unsafe links. Ensure components render them as text and never execute generated instructions automatically.
- [ ] **5. Harden environment boundaries.** Add a build-time test or static check asserting `VITE_` configuration contains only endpoint URLs and the source tree does not reference backend-only Harness or provider settings from browser modules.
- [ ] **6. Add exact-origin controls.** Implement and test backend allowed-origin checks for generation SSE and test requests. Verify valid origin gets required headers and unknown/missing origin fails without permissive reflection.
- [ ] **7. Bound live resources.** Configure and test request-body, input, output, event-count, event-size, time, retry, and concurrency limits in both functions. Ensure a rejected request never initiates direct Bedrock or Harness work.
- [ ] **8. Separate least-privilege backend roles.** Configure dedicated generation and test function permissions, one for the chosen direct Bedrock model and one for the chosen Harness. Review synthesized permissions and reject wildcard or cross-function access that is not required.
- [ ] **9. Implement safe logging and redaction.** Create redaction utilities and tests for credentials, authorization values, private identifiers, raw provider messages, and oversized output. Log safe request IDs and counters only.
- [ ] **10. Add security regression tests.** Add focused cases for CORS denial, malformed SSE, hostile model output, hostile Harness output, invalid backend configuration, cancellation, and rate/concurrency denial. Ensure every failure uses a non-sensitive stable code.
- [ ] **11. Review hosting configuration.** Verify `amplify.yml` builds from the repository root, artifacts are `dist/`, and no secret values are defined in source-controlled configuration. Verify `.env.local` remains ignored.
- [ ] **12. Checkpoint — evidence-based hardening review.** Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify:standalone`; inspect the browser build and deployed sandbox role/configuration before approving a live path. Record no secret, raw prompt, or raw test output in review notes.
