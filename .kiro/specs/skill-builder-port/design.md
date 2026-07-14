# Skill-builder port — design

## Approach

Build the workflow as a project-local React feature with a single session draft as the source of truth. Use a transport interface so the UI works with a deterministic mock adapter by default and a direct-Bedrock SSE adapter only when a public endpoint is configured. The port reimplements the defined behavior in this repository; it does not import code, prompts, or skills from another project.

## Planned paths

| Path | Responsibility |
| --- | --- |
| `src/features/skill-builder/SkillBuilderPage.tsx` | Compose goal, inspiration, progress, editor, test, and download controls. |
| `src/features/skill-builder/SkillRequestForm.tsx` | Validate and collect goal, constraints, and local inspiration. |
| `src/features/skill-builder/SkillEditor.tsx` | Controlled markdown editor with dirty-state handling. |
| `src/features/skill-builder/useSkillGeneration.ts` | Own request lifecycle, cancellation, mock/live transport selection, and typed events. |
| `src/features/skill-builder/generationTransport.ts` | Define mock and SSE transport implementations. |
| `src/features/skill-builder/downloadSkill.ts` | Create a local `SKILL.md` blob download only. |
| `src/features/skill-builder/*.test.tsx` | Exercise mock flow, validation, editing, cancellation, and download behavior. |
| `shared/skillContracts.ts` | Request, inspiration, event, draft, and test-panel types plus validators. |

## Browser state

Use one reducer or equivalent typed state model:

```ts
type Inspiration =
  | { kind: "first-party-example"; id: string; label: string; content: string }
  | { kind: "user-provided"; label: string; content: string };

type GenerationState =
  | { status: "idle"; draft: string; error?: string }
  | { status: "running"; requestId: string; stage: string; draft: string }
  | { status: "completed"; requestId: string; draft: string }
  | { status: "failed"; draft: string; error: string; retryable: boolean }
  | { status: "cancelled"; draft: string };
```

The editor value is preserved across failed, cancelled, malformed, and unrelated events. Starting a new request requires an explicit user action and creates a new `requestId`.

## Generation transport contract

Both adapters expose a common asynchronous event interface:

```ts
type GenerationEvent =
  | { type: "status"; requestId: string; stage: "accepted" | "validating" | "generating" | "finalizing"; message: string }
  | { type: "draft"; requestId: string; markdown: string }
  | { type: "complete"; requestId: string; markdown: string }
  | { type: "error"; requestId: string; code: string; message: string; retryable: boolean };
```

The mock adapter yields deterministic events asynchronously so UI tests cover the same ordering and terminal logic. The live adapter uses `fetch` and parses a `text/event-stream` response; it does not use a socket or an external stream abstraction. It attaches an `AbortSignal` and rejects invalid content type, oversize chunks, unexpected event names, invalid JSON, and mismatched request IDs.

## Local inspiration design

Bundled examples are a constant project-local collection with source kind `first-party-example`. User-provided content is held only in browser session state. The UI shows source kind and label for every selected item. It has no URL field, no remote fetch button, and no automatic search behavior.

The request builder enforces maximum item count and character limits defined in the shared validator. It copies only validated selected content into the request; it does not retain original browser file handles or unrelated page data.

## Error handling

- Invalid form data stays local and focuses the relevant input.
- Stream failure preserves the last valid draft and exposes retry only when the event says it is safe.
- Cancellation calls `AbortController.abort()`, stops iteration, and marks the state cancelled.
- A malformed draft event does not overwrite the editor.
- Download validates non-empty markdown, builds a UTF-8 `text/markdown` Blob, and revokes the object URL after the click.

## Test strategy

Unit-test the request validator, download helper, SSE parser, reducer, source labeling, duplicate-submit lock, cancellation, and failure preservation. Component-test mock mode because it requires neither AWS nor browser secrets. Add contract tests shared with the planned direct-generation function so browser and backend agree on event names and field bounds.
