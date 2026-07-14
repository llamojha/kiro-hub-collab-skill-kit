# Skill-builder port — requirements

## Scope

Port the standalone browser experience for drafting, refining, testing, and downloading one Kiro skill. It may use local mock adapters, direct Amazon Bedrock generation through SSE, AgentCore Harness testing, and only bundled original first-party or user-provided local inspiration. The MVP explicitly excludes a Registry, marketplace, publication workflow, remote discovery, shared workspace, co-editing, presence, messaging, and human-human real-time collaboration.

## User story

As a developer with a workflow to automate or standardize, I want to describe it, provide permitted local inspiration, edit the resulting skill, test it, and download `SKILL.md` so I can review and use a focused artifact without depending on a hosted catalog.

## Acceptance criteria

1. **When** the app loads with both public endpoint variables blank, **the system shall** show a clearly labeled mock mode and make no network request to a live generation or test endpoint.
2. **When** the user enters a goal, **the system shall** validate that the goal is non-empty and within the documented client-side size limit before enabling generation.
3. **When** the user selects bundled inspiration, **the system shall** show it as an original first-party example and include only its local identifier and selected text in the request.
4. **When** the user pastes or uploads inspiration, **the system shall** label it user-provided, validate its type and size, and never fetch additional remote content.
5. **When** a valid request is generated in mock mode, **the system shall** produce deterministic status and complete events that satisfy the same browser contract as live SSE.
6. **When** a valid request is generated with a live endpoint configured, **the system shall** render ordered SSE status updates, replace the editor value only from a valid `draft` or `complete` event, and prevent a second concurrent generation for the same editor session.
7. **While** generation is active, **the system shall** provide cancellation and indicate that cancellation stops future event application.
8. **When** the user edits the generated markdown, **the system shall** preserve those edits until the user explicitly generates again, clears, or leaves the session.
9. **When** the user requests a download of non-empty markdown, **the system shall** download a local file named `SKILL.md` without sending the draft to any publication or discovery service.
10. **When** generation input, inspiration, or an SSE event is invalid, **the system shall** retain the last valid editor state and show a non-sensitive actionable error.
11. **When** the user opens the test panel, **the system shall** make it clear whether a mock test or configured AgentCore Harness test will run.
12. **When** no draft exists, **the system shall** disable generation-dependent download and test actions with an explanation.

## Out of scope

No requirement in this port adds persistent user accounts, cloud synchronization, remote imports, public sharing, collaboration between people, or content publication. Those require a future specification.
