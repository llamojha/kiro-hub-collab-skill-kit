import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INSPIRATION_CATALOG,
  buildInspirationContext,
  matchInspiration,
  type InspirationSource,
} from "../shared/inspiration/catalog";
import {
  ApiRequestError,
  buildMockSkill,
  downloadSkill,
  generateSkill,
  generationModeLabel,
  harnessModeLabel,
  hasConfiguredEndpoint,
  runMockHarnessTest,
  testSkillWithHarness,
  type GenerationInput,
  type HarnessResult,
} from "./skillBuilder";

export const APP_NAME = "Kiro Collab Skill Kit";

const generateApiUrl = import.meta.env.VITE_GENERATE_API_URL?.trim();
const testSkillApiUrl = import.meta.env.VITE_TEST_SKILL_API_URL?.trim();
const initialDraft = `# Untitled Collaborative Skill

## Purpose

Describe the outcome this skill helps a person achieve.

## Workflow

1. Clarify the user's goal and constraints.
2. Take the smallest safe next action.
3. Report evidence and any remaining questions.

## Guardrails

- Preserve existing work.
- Ask before high-impact or destructive changes.
`;

type ChatRole = "human" | "ai";

interface ChatMessage {
  id: number;
  role: ChatRole;
  body: string;
}

function messageId(): number {
  return Date.now() + Math.floor(Math.random() * 1_000);
}

function ModeBadge({ label, live }: { label: string; live: boolean }) {
  return (
    <p
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        live
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-amber-300/30 bg-amber-300/10 text-amber-100"
      }`}
    >
      {label}
    </p>
  );
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-400">{detail}</p>
    </div>
  );
}

function SourceDetail({ source }: { source: InspirationSource }) {
  return (
    <article className="rounded-xl border border-zinc-700/80 bg-zinc-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-100">{source.title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{source.description}</p>
        </div>
        <span className="rounded bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-200">Local source</span>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{source.attribution}</p>
      <p className="mt-1 font-mono text-xs text-zinc-600">{source.sourcePath}</p>
      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-xs leading-5 text-zinc-300">
        {source.content}
      </pre>
    </article>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState(initialDraft);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [referenceLabel, setReferenceLabel] = useState("My reference SKILL.md");
  const [referenceContent, setReferenceContent] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState(INSPIRATION_CATALOG[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "ai",
      body: "I am ready to shape a Kiro SKILL.md with you. Your draft stays local until you download it.",
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | undefined>();
  const [downloadNotice, setDownloadNotice] = useState("");
  const [testScenario, setTestScenario] = useState("Review the skill's workflow and guardrails for a realistic user request.");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<HarnessResult>();
  const [testError, setTestError] = useState("");

  const matchingSources = useMemo(() => matchInspiration(prompt), [prompt]);
  const boundedSources = useMemo(() => buildInspirationContext(matchingSources), [matchingSources]);
  const selectedSource = useMemo(
    () => INSPIRATION_CATALOG.find((source) => source.id === selectedSourceId) ?? INSPIRATION_CATALOG[0],
    [selectedSourceId],
  );
  const generationIsLive = hasConfiguredEndpoint(generateApiUrl);
  const harnessIsLive = hasConfiguredEndpoint(testSkillApiUrl);

  useEffect(() => {
    if (!retryAfterSeconds || retryAfterSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfterSeconds((seconds) => (seconds && seconds > 1 ? seconds - 1 : undefined));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

  const generationInput = useCallback((): GenerationInput => ({
    prompt,
    currentDraft: draft,
    reference: referenceContent.trim() ? { label: referenceLabel, content: referenceContent } : undefined,
    inspiration: boundedSources,
  }), [boundedSources, draft, prompt, referenceContent, referenceLabel]);

  const addMessage = useCallback((role: ChatRole, body: string) => {
    setMessages((current) => [...current, { id: messageId(), role, body }]);
  }, []);

  const requestGeneration = useCallback(
    async (isRetry = false) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setGenerationError("Describe the skill you want to create before generating a draft.");
        return;
      }
      if (retryAfterSeconds && retryAfterSeconds > 0) return;

      setGenerationError("");
      setGeneratedPreview("");
      setGenerationProgress(generationIsLive ? "Preparing a bounded generation request…" : "Creating a clearly labeled local mock draft…");
      setIsGenerating(true);
      if (!isRetry) addMessage("human", trimmedPrompt);

      try {
        const input = generationInput();
        if (!generateApiUrl) {
          const localDraft = buildMockSkill(input);
          setGeneratedPreview(localDraft);
          setDraft(localDraft);
          setView("editor");
          addMessage("ai", "Local mock draft generated. No API request was made; review and edit it before downloading.");
          setGenerationProgress("Local mock draft ready.");
          return;
        }

        const generated = await generateSkill(generateApiUrl, input, (event) => {
          setGenerationProgress(event.message);
          if (event.content) setGeneratedPreview(event.content);
        });
        if (!generated?.trim()) throw new ApiRequestError("The generation API completed without a SKILL.md draft.");

        // The editor changes only after a successful final response. Errors leave it untouched.
        setDraft(generated);
        setView("editor");
        addMessage("ai", "Live API draft received. Review the editor, then run a Harness check or download it.");
        setGenerationProgress("Live draft ready.");
      } catch (error) {
        const apiError = error instanceof ApiRequestError ? error : new ApiRequestError("Unable to generate a draft. Please retry.");
        setGenerationError(apiError.message);
        setRetryAfterSeconds(apiError.retryAfterSeconds);
        setGenerationProgress("");
        addMessage("ai", `Generation did not replace your editor: ${apiError.message}`);
      } finally {
        setIsGenerating(false);
      }
    },
    [addMessage, generateApiUrl, generationInput, generationIsLive, prompt, retryAfterSeconds],
  );

  const runHarness = useCallback(async () => {
    if (!draft.trim()) {
      setTestError("Add a draft before running the Harness check.");
      return;
    }

    setIsTesting(true);
    setTestError("");
    setTestResult(undefined);
    try {
      const input = { skillContent: draft, scenario: testScenario };
      const result = testSkillApiUrl
        ? await testSkillWithHarness(testSkillApiUrl, input)
        : runMockHarnessTest(input);
      setTestResult(result);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Harness testing failed. Please retry.");
    } finally {
      setIsTesting(false);
    }
  }, [draft, testScenario]);

  const handleDownload = useCallback(() => {
    if (!draft.trim()) return;
    const fileName = downloadSkill(draft);
    setDownloadNotice(`Downloaded ${fileName}`);
  }, [draft]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950/30 p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Human + AI workspace</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{APP_NAME}</h1>
              <p className="mt-3 text-base leading-7 text-zinc-300">
                Shape a Kiro <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-violet-200">SKILL.md</code> with a human in control.
                This standalone workspace has no account, router, or publishing flow.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <ModeBadge label={generationModeLabel(generateApiUrl)} live={generationIsLive} />
              <ModeBadge label={harnessModeLabel(testSkillApiUrl)} live={harnessIsLive} />
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <section className="space-y-6" aria-label="Collaborative prompt and source workspace">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5 shadow-xl shadow-black/20">
              <SectionHeading
                eyebrow="Prompt chat"
                title="Tell your AI teammate what to build"
                detail="Matched local examples are bounded to three sources and shown below before each request."
              />
              <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1" aria-live="polite">
                {messages.map((message) => (
                  <div
                    className={`rounded-xl border p-3 text-sm leading-6 ${
                      message.role === "human"
                        ? "ml-7 border-violet-400/25 bg-violet-500/10 text-violet-50"
                        : "mr-7 border-zinc-700 bg-zinc-950/80 text-zinc-300"
                    }`}
                    key={message.id}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {message.role === "human" ? "You" : "AI teammate"}
                    </p>
                    {message.body}
                  </div>
                ))}
              </div>
              <label className="mt-5 block text-sm font-medium text-zinc-200" htmlFor="skill-prompt">
                What skill do you need?
              </label>
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:cursor-wait disabled:opacity-70"
                disabled={isGenerating}
                id="skill-prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: Create a safety-first AWS incident triage skill with a verification checklist."
                value={prompt}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">
                  {generationIsLive ? "A configured API receives only the bounded context shown here." : "No API is configured; generation stays in this browser."}
                </span>
                <button
                  className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isGenerating || Boolean(retryAfterSeconds && retryAfterSeconds > 0)}
                  onClick={() => void requestGeneration()}
                  type="button"
                >
                  {isGenerating ? "Generating…" : generationIsLive ? "Generate with API" : "Generate local mock"}
                </button>
              </div>
              {generationProgress ? <p className="mt-3 text-sm text-emerald-200">{generationProgress}</p> : null}
              {generationError ? (
                <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">
                  <p>{generationError}</p>
                  <p className="mt-1 text-xs text-rose-200/80">Your editor content was preserved.</p>
                  {retryAfterSeconds && retryAfterSeconds > 0 ? (
                    <p className="mt-2 text-xs font-semibold">Rate limit: retry available in {retryAfterSeconds}s.</p>
                  ) : (
                    <button
                      className="mt-2 rounded border border-rose-300/40 px-2 py-1 text-xs font-semibold hover:bg-rose-300/10"
                      onClick={() => void requestGeneration(true)}
                      type="button"
                    >
                      Retry generation
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5 shadow-xl shadow-black/20">
              <SectionHeading
                eyebrow="Reference source"
                title="Paste a SKILL.md you want to learn from"
                detail="Give the reference a human-readable source label. It is optional and is capped before any API request."
              />
              <label className="mt-4 block text-sm font-medium text-zinc-200" htmlFor="reference-label">Source label</label>
              <input
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                id="reference-label"
                maxLength={120}
                onChange={(event) => setReferenceLabel(event.target.value)}
                value={referenceLabel}
              />
              <label className="mt-4 block text-sm font-medium text-zinc-200" htmlFor="reference-skill">Reference SKILL.md</label>
              <textarea
                className="mt-2 min-h-40 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-xs leading-5 text-zinc-200 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                id="reference-skill"
                onChange={(event) => setReferenceContent(event.target.value)}
                placeholder="# A reference skill\n\nPaste only material you have permission to use."
                value={referenceContent}
              />
              <p className="mt-2 text-xs text-zinc-500">Source material remains in the browser for mock mode. A configured generation API receives at most 2,400 characters.</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5 shadow-xl shadow-black/20">
              <SectionHeading
                eyebrow="Local inspiration"
                title="Auditable, first-party examples"
                detail="These original examples are local files, not an external registry. Matching is deterministic keyword scoring."
              />
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Select a local source to inspect">
                {INSPIRATION_CATALOG.map((source) => (
                  <button
                    aria-pressed={source.id === selectedSourceId}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      source.id === selectedSourceId
                        ? "border-violet-300/50 bg-violet-400/15 text-violet-100"
                        : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                    key={source.id}
                    onClick={() => setSelectedSourceId(source.id)}
                    type="button"
                  >
                    {source.title}
                  </button>
                ))}
              </div>
              <div className="mt-4">{selectedSource ? <SourceDetail source={selectedSource} /> : null}</div>
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-sm font-semibold text-zinc-200">Context selected for the next draft</p>
                {boundedSources.length ? (
                  <ul className="mt-2 space-y-2 text-sm text-zinc-400">
                    {boundedSources.map((source) => (
                      <li key={source.id}>
                        <span className="font-medium text-zinc-200">{source.title}</span> · {source.attribution}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No catalog keywords match yet. Add terms such as testing, AWS, or product planning to use an example.</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-6" aria-label="Skill draft editor and validation workspace">
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/75 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 sm:flex-row sm:items-end sm:justify-between">
                <SectionHeading
                  eyebrow="Current draft"
                  title="Edit, preview, and keep control"
                  detail="Generation never publishes. Download only the version you approve."
                />
                <div className="flex rounded-lg border border-zinc-700 bg-zinc-950 p-1" role="group" aria-label="Draft view">
                  <button
                    aria-pressed={view === "editor"}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "editor" ? "bg-violet-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
                    onClick={() => setView("editor")}
                    type="button"
                  >
                    Editor
                  </button>
                  <button
                    aria-pressed={view === "preview"}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "preview" ? "bg-violet-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
                    onClick={() => setView("preview")}
                    type="button"
                  >
                    Preview
                  </button>
                </div>
              </div>
              <div className="p-5">
                {view === "editor" ? (
                  <label className="block" htmlFor="skill-draft">
                    <span className="sr-only">Current SKILL.md draft</span>
                    <textarea
                      className="min-h-[34rem] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-mono text-sm leading-6 text-zinc-100 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:cursor-wait disabled:opacity-70"
                      disabled={isGenerating}
                      id="skill-draft"
                      onChange={(event) => setDraft(event.target.value)}
                      spellCheck={false}
                      value={draft}
                    />
                  </label>
                ) : (
                  <article className="min-h-[34rem] rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-zinc-200">{draft || "Nothing to preview yet."}</pre>
                  </article>
                )}
                {generatedPreview && generationIsLive ? (
                  <details className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-violet-100">Latest staged API output</summary>
                    <p className="mt-2 text-xs text-violet-200/80">This is staged while the stream completes; errors do not overwrite your editor.</p>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">{generatedPreview}</pre>
                  </details>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500">{draft.length.toLocaleString()} characters · Markdown is downloaded locally.</span>
                  <button
                    className="rounded-lg border border-violet-300/40 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!draft.trim()}
                    onClick={handleDownload}
                    type="button"
                  >
                    Download SKILL.md
                  </button>
                </div>
                {downloadNotice ? <p className="mt-2 text-xs text-emerald-200">{downloadNotice}</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeading
                  eyebrow="Harness test"
                  title="Check the draft before sharing it"
                  detail="The local mock checks basic SKILL.md structure. A configured endpoint receives the current editor content."
                />
                <ModeBadge label={harnessModeLabel(testSkillApiUrl)} live={harnessIsLive} />
              </div>
              <label className="mt-4 block text-sm font-medium text-zinc-200" htmlFor="test-scenario">Test scenario</label>
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm leading-6 text-zinc-100 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                id="test-scenario"
                onChange={(event) => setTestScenario(event.target.value)}
                value={testScenario}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">Testing reads the draft but never changes it.</p>
                <button
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
                  disabled={isTesting || !draft.trim()}
                  onClick={() => void runHarness()}
                  type="button"
                >
                  {isTesting ? "Running test…" : harnessIsLive ? "Run Harness test" : "Run local mock test"}
                </button>
              </div>
              {testError ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">{testError}</p> : null}
              {testResult ? (
                <div className={`mt-4 rounded-xl border p-4 ${
                  testResult.passed === true
                    ? "border-emerald-400/30 bg-emerald-400/10"
                    : testResult.passed === false
                      ? "border-amber-400/30 bg-amber-400/10"
                      : "border-violet-400/30 bg-violet-400/10"
                }`}>
                  <p className={`text-sm font-semibold ${
                    testResult.passed === true
                      ? "text-emerald-100"
                      : testResult.passed === false
                        ? "text-amber-100"
                        : "text-violet-100"
                  }`}>
                    {testResult.passed === true ? "Passed" : testResult.passed === false ? "Needs revision" : "Completed — review output"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-200">{testResult.summary}</p>
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-950/70 p-3 text-xs leading-5 text-zinc-400">{testResult.output}</pre>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
