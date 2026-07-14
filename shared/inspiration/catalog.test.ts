import { describe, expect, it } from "vitest";
import {
  INSPIRATION_CATALOG,
  MAX_INSPIRATION_CONTEXT_CHARACTERS,
  MAX_MATCHED_SOURCES,
  MAX_REFERENCE_CONTEXT_CHARACTERS,
  MAX_SOURCE_CONTEXT_CHARACTERS,
  buildInspirationContext,
  capReferenceContent,
  matchInspiration,
} from "./catalog";

describe("first-party inspiration catalog", () => {
  it("deterministically ranks keyword matches and limits selection to three sources", () => {
    const prompt = "Plan AWS testing and product acceptance metrics for a release.";
    const firstPass = matchInspiration(prompt);
    const secondPass = matchInspiration(prompt);

    expect(firstPass.map((source) => source.id)).toEqual(secondPass.map((source) => source.id));
    expect(firstPass).toHaveLength(MAX_MATCHED_SOURCES);
    expect(firstPass.map((source) => source.id)).toEqual([
      "product-planning",
      "testing-workflows",
      "aws-operations",
    ]);
  });

  it("caps user reference and local source context without dropping attribution", () => {
    const references = "x".repeat(MAX_REFERENCE_CONTEXT_CHARACTERS + 40);
    const expandedCatalog = INSPIRATION_CATALOG.map((source) => ({
      ...source,
      content: "y".repeat(MAX_SOURCE_CONTEXT_CHARACTERS + 100),
    }));

    const context = buildInspirationContext(expandedCatalog);

    expect(capReferenceContent(references)).toHaveLength(MAX_REFERENCE_CONTEXT_CHARACTERS);
    expect(context).toHaveLength(MAX_MATCHED_SOURCES);
    expect(context.every((source) => source.content.length <= MAX_SOURCE_CONTEXT_CHARACTERS)).toBe(true);
    expect(context.reduce((total, source) => total + source.content.length, 0)).toBeLessThanOrEqual(
      MAX_INSPIRATION_CONTEXT_CHARACTERS,
    );
    expect(context.every((source) => source.attribution.startsWith("First-party original"))).toBe(true);
  });
});
