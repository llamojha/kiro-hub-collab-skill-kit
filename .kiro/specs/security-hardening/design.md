# Security hardening — design

## Approach

Apply defense in depth at browser, HTTP, function, direct-Bedrock, Harness, logging, deployment, and content-provenance boundaries. The security design preserves a useful mock-only workflow and limits live work to the two required backend operations: direct Bedrock generation and AgentCore Harness testing.

## Planned control map

| Boundary | Planned location | Control |
| --- | --- | --- |
| Browser input | `shared/*Contracts.ts`, `src/features/**` | Schema validation, UTF-8/text checks, character and item caps, visible source labels. |
| Browser display | `src/features/**` | Escape text, never inject model/Harness output as HTML, clear transient drafts on explicit user action only. |
| SSE generation | `amplify/functions/generate-skill/handler.ts` | Origin check, request validation, event/output caps, deadline, safe errors, direct Bedrock permission. |
| Harness test | `amplify/functions/test-skill/handler.ts` | Origin check, bounded payload, deadline, output allowlist, redaction, specific Harness permission. |
| Backend configuration | `amplify/functions/*/resource.ts` | Backend-only environment variables; no secret or identifier enters a frontend build. |
| Hosting | `amplify.yml` | Nested app root, reproducible build command, static `dist/` artifacts only. |
| Provenance | `NOTICE.md`, `.kiro/**` | First-party/user-provided policy and required license/author/source audit. |

## Input validation

Create shared validators that enforce a versioned JSON shape; non-empty, normalized strings; allowed source discriminators; maximum collection entries; byte and character limits; and no unknown fields at external boundaries. Apply the same validator in the browser for usability and in functions for authority. Reject uploads or pasted material that cannot be interpreted as bounded UTF-8 text.

Never retrieve remote content based on a URL, identifier, prompt instruction, or model output. The permitted inspiration union is closed: `first-party-example` and `user-provided` only.

## HTTP, streaming, and rendering

Use exact configured origin comparison rather than reflection. Send CORS headers only after allowed-origin validation, return JSON errors with stable codes, and use SSE headers only for valid generation requests. Limit request body size before parsing, limit SSE chunks/events, terminate after deadline or disconnect, and reject unexpected content type.

Render drafts, findings, and errors as text. If Markdown preview is added, use a renderer configured to block raw HTML, unsafe links, and script execution. Never dynamically execute a command suggested by generated content.

## Cloud permissions and data handling

Give the generation function only permission to invoke the configured direct Bedrock model. Give the test function only permission to invoke its configured AgentCore Harness. Separate the function roles and scope configuration values. Keep `HARNESS_ARN`, `HARNESS_REGION`, origin settings, and model configuration backend-only. `VITE_` variables may contain only public HTTPS endpoints.

Use request IDs for correlation. Logs record timestamp, route, safe status code, duration bucket, byte counts, and request ID. Exclude authorization headers, cookies, credentials, raw prompts, raw inspiration, generated drafts, and raw Harness/model output by default. Add explicit review before any telemetry expansion.

## Resource controls

Set server-side maximum body, input/output, event, duration, retry, and per-origin/per-user concurrency limits. Fail closed when configuration is absent or invalid. Make mock mode the default so contributors can develop without live spending. Display that live Bedrock and Harness work may incur charges before users initiate it.

## Provenance controls

Bundled examples must be original first-party material. A contributor proposing any Kiro Hub-derived item supplies a recorded license, author/rightsholder, canonical source/revision, redistribution assessment, required notices, and reviewer approval before copying any content. If the audit is incomplete, exclude the item. Do not include unreviewed external skills in test fixtures or generation prompts.

## Verification strategy

Automated checks cover invalid/oversize input, source-kind rejection, hostile output rendering, CORS allow/deny behavior, error redaction, configuration absence, request cancellation, event limits, test-output truncation, and documentation-policy assertions. The deployment review confirms least-privilege roles and that browser bundles contain no backend-only variable values. Mock tests remain mandatory even when sandbox integration testing is available.
