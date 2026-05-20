import { describe, it, expect } from "vitest";
import { praatLanguage } from "../src/scripting/praatCodemirror";

describe("praatLanguage (CodeMirror)", () => {
  it("is a valid CodeMirror language", () => {
    expect(praatLanguage).toBeDefined();
    expect(praatLanguage.extension).toBeDefined();
  });
});
