# Skill testing — requirements

## Scope

Add a bounded skill-testing flow that operates deterministically in local mock mode and invokes an AgentCore Harness only through the planned backend test function in live mode. It may consume a local draft, a user-provided test case, and normalized results. The MVP excludes a Registry, marketplace, publication workflow, remote discovery, shared workspace, and human-human real-time collaboration.

## User story

As a skill author, I want to run a focused test against my current draft and understand the result so I can improve it before downloading it.

## Acceptance criteria

1. **When** the test endpoint variable is blank, **the system shall** execute a deterministic local mock test and visibly identify the result as mock.
2. **When** the test endpoint variable is set, **the system shall** send only the current draft, selected local test case, and browser-generated request identifier to the configured test endpoint.
3. **When** a user starts a test with an empty or invalid draft, **the system shall** block the request and show the validation problem locally.
4. **When** a test case exceeds configured character or field limits, **the system shall** reject it before a Harness invocation.
5. **When** the backend receives a valid live request, **the system shall** validate the request, apply a timeout, and invoke only the configured AgentCore Harness.
6. **When** the Harness returns a result, **the system shall** convert it into a stable result containing status, concise summary, findings, and request identifier before returning it to the browser.
7. **When** Harness output contains operational details, credentials, tokens, private identifiers, or excessive output, **the system shall** redact or truncate them before the browser receives the result.
8. **When** a test is running, **the system shall** prevent duplicate submissions for that draft and allow the user to cancel the browser request.
9. **When** a test fails, times out, or returns an unrecognized shape, **the system shall** preserve the current draft, present a non-sensitive recovery message, and classify whether retry is safe.
10. **When** a test passes, **the system shall** state that the result is evidence for the supplied case and not a guarantee of production correctness or security.
11. **When** test results are displayed, **the system shall** render them as text/data rather than executable markup.

## Out of scope

The test flow does not publish a skill, discover tests from remote sources, persist test history, or let multiple people share a test session. Future extensions need separate authorization, retention, and provenance requirements.
