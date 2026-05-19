import { describe, it, expect } from "vitest";
import { praatScriptGrammar } from "../src/scripting/praatGrammar";

describe("praatScriptGrammar", () => {
  it("has required TextMate grammar properties", () => {
    expect(praatScriptGrammar.name).toBe("praat");
    expect(praatScriptGrammar.scopeName).toBe("source.praat");
    expect(praatScriptGrammar.patterns!.length).toBeGreaterThan(0);
    expect(praatScriptGrammar.repository).toBeDefined();
  });

  it("defines comment patterns", () => {
    const repo = praatScriptGrammar.repository as Record<string, unknown>;
    expect(repo.comment).toBeDefined();
  });

  it("defines keyword patterns including control flow", () => {
    const repo = praatScriptGrammar.repository as Record<string, unknown>;
    expect(repo.keyword).toBeDefined();
    const kw = repo.keyword as { patterns: Array<{ match: string }> };
    const controlMatch = kw.patterns[0].match;
    expect(controlMatch).toContain("for");
    expect(controlMatch).toContain("endfor");
    expect(controlMatch).toContain("if");
    expect(controlMatch).toContain("procedure");
  });

  it("defines builtin function patterns", () => {
    const repo = praatScriptGrammar.repository as Record<string, unknown>;
    expect(repo.builtin).toBeDefined();
    const b = repo.builtin as { patterns: Array<{ match: string }> };
    expect(b.patterns.length).toBeGreaterThanOrEqual(2);
  });

  it("defines string patterns with double-quote", () => {
    const repo = praatScriptGrammar.repository as Record<string, unknown>;
    const str = repo.string as { patterns: Array<{ begin: string; end: string }> };
    expect(str.patterns[0].begin).toBe('"');
    expect(str.patterns[0].end).toBe('"');
  });
});
