# Generation reliability — requirements

## Scope

Make direct Amazon Bedrock generation reliable and observable through a defined SSE lifecycle. This scope covers browser cancellation, input validation, event ordering, error recovery, and deterministic mock parity. It permits only local first-party or user-provided inspiration. It excludes a Registry, marketplace, publication, remote discovery, shared workspace, and human-human real-time collaboration.

## User story

As a developer generating a skill, I want clear, trustworthy progress and recoverable failures so that a slow or interrupted live request never corrupts my reviewed draft.

## Acceptance criteria

1. **When** a generation request begins, **the system shall** create a unique request identifier and emit or simulate an `accepted` status before generation work begins.
2. **When** the request is valid, **the system shall** emit status events in the order `accepted`, `validating`, `generating`, and `finalizing`, allowing repeated status/heartbeat messages without changing stage order.
3. **When** a complete replacement draft is available, **the system shall** emit a valid `draft` or terminal `complete` event containing the same request identifier.
4. **When** the server receives malformed input, an unsupported inspiration source, or an over-limit request, **the system shall** emit one terminal `error` event with a non-sensitive code and no direct Bedrock invocation.
5. **When** Bedrock returns an invalid, incomplete, or over-limit response, **the system shall** not emit it as a draft and shall return a terminal, non-sensitive error event.
6. **While** a connection is active, **the system shall** emit a bounded heartbeat or status signal often enough for the browser to distinguish progress from a stalled connection.
7. **When** the browser cancels or navigates away, **the system shall** stop applying events, close the stream, and request backend cancellation where supported.
8. **When** an SSE stream disconnects before a terminal event, **the system shall** retain the last valid draft, report an interrupted request, and offer a deliberate retry rather than silently resubmitting.
9. **When** events are duplicated, late, malformed, or belong to another request identifier, **the system shall** ignore them without changing the current editor state.
10. **When** mock mode is enabled, **the system shall** use the same event schema, terminal semantics, cancellation rules, and error rendering as live mode.
11. **When** an internal failure occurs, **the system shall** log structured operational context server-side without returning cloud identifiers, stack traces, credentials, or raw provider errors to the browser.

## Out of scope

Reliability work does not add a queue, long-term storage, an external content source, publication, or multi-person collaboration. Each request remains a bounded session operation.
