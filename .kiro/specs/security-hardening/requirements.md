# Security hardening — requirements

## Scope

Harden the skill-builder's local and live paths against untrusted input, secret exposure, unsafe cross-origin use, excessive cloud work, and provenance mistakes. It applies to direct Bedrock generation, SSE, AgentCore Harness testing, and permitted local inspiration. It excludes a Registry, marketplace, publication, remote discovery, shared workspace, and human-human real-time collaboration.

## User story

As a developer using an AI-assisted skill builder, I want the application to protect my content and cloud access while remaining transparent about limits and provenance.

## Acceptance criteria

1. **When** browser input is submitted, **the system shall** validate schema, field count, encoded size, allowed inspiration label, and markdown/text type both before the request and in the backend.
2. **When** inspiration is not a bundled original first-party example or explicit user-provided local content, **the system shall** reject it and shall not retrieve a substitute from a remote source.
3. **When** a request is forwarded to a live backend, **the system shall** send no AWS credential, backend-only variable, browser secret, or unrelated session data.
4. **When** a live endpoint responds, **the system shall** accept responses only from the configured HTTPS origin and render data as text rather than executable markup.
5. **When** the backend emits SSE or a test result, **the system shall** use the configured allowed origin, explicit content type, bounded response sizes, and redaction before delivery.
6. **When** a direct Bedrock or Harness request is made, **the system shall** use least-privilege backend permissions, a configured timeout, input/output caps, and per-request resource bounds.
7. **When** a rate or concurrency limit is reached, **the system shall** refuse additional work with a retry-safe message and preserve the current local draft.
8. **When** a backend error is logged, **the system shall** use a request identifier and safe metadata without logging raw credentials, authorization headers, full sensitive prompts, or unredacted Harness output.
9. **When** the app is built or deployed, **the system shall** ensure only public endpoint URLs are exposed through `VITE_` variables and backend-only settings remain outside browser artifacts.
10. **When** an example, fixture, prompt, or skill is proposed for inclusion, **the system shall** accept it only if it is original first-party content or has completed the license, author, and source audit specified in `NOTICE.md`.
11. **When** a security control blocks an action, **the system shall** return a stable non-sensitive error code and user-facing remediation without suggesting bypasses.

## Out of scope

Hardening does not create an identity system, content publication service, centralized skill catalog, or shared team workspace. Such systems require independent threat modeling and specification.
