# Generation reliability — design

## Approach

Use one direct-Bedrock generation endpoint that responds as SSE. The backend validates each bounded request, builds the project-local generation prompt, invokes the configured Bedrock model directly, and emits typed lifecycle events. The browser consumes a stream with a state machine that protects the last valid editor draft from stale, duplicate, malformed, and late data.

## Planned paths

| Path | Responsibility |
| --- | --- |
| `shared/generationContracts.ts` | Request, inspiration, SSE event, error code, and validator definitions. |
| `src/features/skill-builder/generationTransport.ts` | Fetch/SSE parser, chunk bounds, request correlation, abort handling. |
| `src/features/skill-builder/useSkillGeneration.ts` | Event reducer, timeout presentation, retry decision, and mock parity. |
| `amplify/functions/generate-skill/handler.ts` | HTTP/SSE response, validation, prompt assembly, direct Bedrock call, event serialization. |
| `amplify/functions/generate-skill/resource.ts` | Function resource configuration and least-privilege direct-generation permission. |
| `amplify/functions/generate-skill/*.test.ts` | Event order, invalid request, response validation, redaction, and error mapping tests. |

## Protocol

The response has `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and an allowed-origin CORS response. Each event includes one `event:` line and one JSON `data:` line, ending in a blank line. Only `status`, `draft`, `complete`, and `error` are accepted.

```text
event: status
data: {"requestId":"...","stage":"generating","message":"Creating the draft"}

event: complete
data: {"requestId":"...","markdown":"# ..."}
```

`status` is non-terminal. `draft` is a complete replacement candidate and may occur before terminal completion. Exactly one terminal `complete` or `error` event is permitted. A periodic bounded status signal serves as heartbeat without exposing provider internals.

## Backend state machine

1. Validate request schema, origin, request ID, goal, constraints, inspiration kinds, count, and sizes.
2. Emit `accepted`, then `validating`.
3. Build a prompt from `.kiro/prompts/generate-skill.md` and only validated local content. Emit `generating`.
4. Invoke the configured Bedrock model directly with explicit input/output bounds and a deadline.
5. Validate the returned markdown and character limit. Emit `finalizing`, then `complete`.
6. On any expected validation, provider, timeout, cancellation, or parsing error, emit one safe `error` and close the stream.

Prompt content, raw model text, and cloud configuration must not be emitted in status messages or logs without approved privacy controls.

## Browser state machine

The browser records active `requestId`, current stage, `AbortController`, and last valid draft. It accepts an event only while active and only when the identifier matches. It validates all event data before reducer dispatch. A terminal event clears the controller. Stream disconnect before a terminal event becomes an interrupted, retryable failure; retry creates a new request rather than continuing the old one.

The mock transport yields the same validated sequence on a timer and responds to abort. It must support fixtures for malformed event, interruption, and safe terminal failure states.

## Backpressure and limits

Bound request bodies, individual inspiration text, total prompt content, model output, SSE event size, number of events, and elapsed time. Reject over-limit data before Bedrock invocation. Use a single live generation per browser session/editor; avoid hidden retries. If retry logic is added backend-side for a transient direct-Bedrock error, it must be limited, observable, idempotency-aware, and must not duplicate terminal events.

## Test strategy

Contract-test event serialization/deserialization in shared code. Unit-test event ordering, one-terminal-event enforcement, malformed/oversize input rejection, disconnect classification, cancellation, and redaction. Use a controlled direct-Bedrock integration test in an isolated sandbox only after mock and handler tests pass.
