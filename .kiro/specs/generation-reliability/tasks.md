# Generation reliability — tasks

## Scope guard

Implement reliability only for direct Amazon Bedrock generation with project-local inspiration and SSE. Do not add a queue, Registry, marketplace, publication flow, remote import, persistent session store, shared workspace, or human-human real-time collaboration.

- [ ] **1. Specify and test the generation wire contract.** Create `shared/generationContracts.ts` and `shared/generationContracts.test.ts` for request IDs, permitted inspiration kinds, event schemas, status order, and one-terminal-event rules.
- [ ] **2. Add an event serializer.** Create `amplify/functions/generate-skill/sse.ts` with named SSE formatting and event-size validation. Test correct framing, JSON encoding, unknown event rejection, and terminal-event enforcement.
- [ ] **3. Add a browser event parser.** Extend `src/features/skill-builder/generationTransport.ts` with a bounded incremental SSE parser that validates content type and event JSON. Test split chunks, malformed JSON, oversize chunks, duplicate terminals, and mismatched request IDs.
- [ ] **4. Implement deterministic mock parity.** Extend the mock transport to produce accepted, validating, generating, finalizing, and complete events; add fixtures for interrupted and terminal-error flows. Test abort stops all future event application.
- [ ] **5. Create the generation function resource.** Create `amplify/functions/generate-skill/resource.ts` with a dedicated execution role, backend-only model configuration, allowed origin binding, and only the required direct-Bedrock permission.
- [ ] **6. Validate request and origin before live work.** Create `amplify/functions/generate-skill/handler.ts` request guards for method, origin, body size, schema, request ID, source labels, item counts, and text limits. Test failures emit a single safe terminal error and make no Bedrock call.
- [ ] **7. Assemble the project-local prompt safely.** Read the generation contract from `.kiro/prompts/generate-skill.md`, interpolate only validated request fields, and keep prompt size bounded. Test that invalid source labels, remote URLs, and instruction-conflicting inspiration cannot broaden the contract.
- [ ] **8. Call Bedrock directly and validate output.** Add the direct provider call with deadline, maximum output, bounded transient retry policy, and response markdown validation. Test invalid/oversize/empty responses map to safe terminal errors.
- [ ] **9. Add progress, heartbeat, and cancellation.** Emit ordered status signals, detect aborted client connection where supported, stop unnecessary work, and prevent emission after terminal state. Test completion, provider error, timeout, disconnect, and cancellation paths.
- [ ] **10. Harden browser recovery.** Update `useSkillGeneration.ts` to preserve the last valid draft, classify interrupted streams, offer explicit new-request retry, and clear active state on terminal/cancel. Test late events cannot mutate state.
- [ ] **11. Run controlled integration verification.** In an isolated sandbox with a budgeted direct-Bedrock configuration, generate from a first-party example and verify event sequence, cancellation, safe error behavior, and no browser-side secret exposure.
- [ ] **12. Checkpoint — validate all layers.** Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify:standalone`, then repeat the mock challenge demo before any live deployment.
