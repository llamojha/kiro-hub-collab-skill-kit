# Technology context — Kiro Collab Skill Kit

## Current stack

- **Runtime:** Node.js 22 or later
- **Frontend:** React 19, Vite 6, TypeScript 5.8
- **Tests:** Vitest 4
- **Backend framework:** AWS Amplify Gen 2
- **Live generation:** direct Amazon Bedrock runtime invocation
- **Live test execution:** AgentCore Harness
- **Streaming protocol:** Server-Sent Events over HTTPS

Exact versions are pinned in `package.json`; do not change them as part of documentation or feature work unless a separate dependency task authorizes it.

## Project commands

Run all commands from `kiro-collab-skill-kit/`:

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run verify:standalone
npm run sandbox
```

`npm run test:live:generation` is a deliberate non-zero guard until live direct-Bedrock wiring exists. Do not describe it as a passing live-test command before its implementation changes.

## Development modes

| Mode | Activation | Behavior |
| --- | --- | --- |
| Mock | `VITE_GENERATE_API_URL` and `VITE_TEST_SKILL_API_URL` blank | Deterministic local generation and test adapters; zero cloud calls. |
| Live generation | `VITE_GENERATE_API_URL` set | Browser consumes a backend SSE stream; backend calls Bedrock directly. |
| Live test | `VITE_TEST_SKILL_API_URL` set and backend Harness settings configured | Browser posts a validated test request; backend invokes AgentCore Harness. |

The `VITE_` prefix makes values visible in browser build output. They may contain only public endpoint URLs. Never place AWS credentials, model controls, `HARNESS_ARN`, `HARNESS_REGION`, or `ALLOWED_ORIGIN` in a `VITE_` variable.

## Code conventions

- Use strict TypeScript and keep common contracts in `shared/`.
- Prefer narrow, discriminated event/result types over `any` or unvalidated JSON.
- Keep browser networking in a dedicated adapter/hook rather than JSX components.
- Use `fetch`, `ReadableStream`, and `AbortController` for SSE; do not add a socket protocol for the MVP.
- Treat streamed text and Harness output as untrusted display data. Render text safely, not as arbitrary HTML.
- Use mock adapters matching the live contract so UI tests exercise the same states.

## Direct Bedrock integration

The generation function owns prompt construction and model invocation. The browser sends a constrained request, never provider credentials. Configure the model identifier and permissions in backend deployment configuration; validate the model response before emitting `draft` or `complete` events. Bound prompt length, output length, duration, and retry behavior.

Only two inspiration classes are valid: original first-party examples bundled with this project and explicitly user-provided local content. Never fetch or copy an external skill as an implementation shortcut.

## AgentCore Harness integration

The test function owns the configured Harness identifier and Region. It accepts a compiled draft and a bounded test case, applies a timeout, maps raw output to a small test-result contract, and redacts operational details. A Harness success is useful evidence, not a security certification or promise of production correctness.

## Validation expectations

Before presenting a change, run the targeted test, then `npm run typecheck`, `npm test`, `npm run build`, and `npm run verify:standalone` when affected assets permit it. If live backend work is not configured, document the limitation and verify mock behavior instead.

## Hosting

`amplify.yml` defines `kiro-collab-skill-kit` as the Amplify Hosting app root. Builds should run within this nested project, output `dist/`, and avoid exposing backend-only environment variables to the browser.
