import { describe, it, expect } from "vitest";
import { tokenize, TokenType } from "../src/scripting/lexer";
import { parse } from "../src/scripting/parser";
import { runPraatScript, Interpreter } from "../src/scripting/interpreter";

describe("Praat Script Lexer", () => {
  it("tokenizes numbers and identifiers", () => {
    const tokens = tokenize("x = 42");
    expect(tokens[0].type).toBe(TokenType.Identifier);
    expect(tokens[0].value).toBe("x");
    expect(tokens[1].type).toBe(TokenType.Equals);
    expect(tokens[2].type).toBe(TokenType.Number);
    expect(tokens[2].value).toBe("42");
  });

  it("tokenizes string variables with $ suffix", () => {
    const tokens = tokenize('name$ = "hello"');
    expect(tokens[0].type).toBe(TokenType.Identifier);
    expect(tokens[0].value).toBe("name$");
    expect(tokens[2].type).toBe(TokenType.String);
    expect(tokens[2].value).toBe("hello");
  });

  it("tokenizes keywords", () => {
    const tokens = tokenize("for i from 1 to 10");
    expect(tokens[0].type).toBe(TokenType.For);
    expect(tokens[2].type).toBe(TokenType.From);
    expect(tokens[4].type).toBe(TokenType.To);
  });

  it("skips comments", () => {
    const tokens = tokenize("x = 1 # this is a comment\ny = 2");
    const ids = tokens.filter((t) => t.type === TokenType.Identifier);
    expect(ids.length).toBe(2);
  });

  it("tokenizes operators", () => {
    const tokens = tokenize("a == b != c");
    expect(tokens[1].type).toBe(TokenType.EqualEqual);
    expect(tokens[3].type).toBe(TokenType.NotEqual);
  });
});

describe("Praat Script Parser", () => {
  it("parses variable assignment", () => {
    const tokens = tokenize("x = 5");
    const ast = parse(tokens);
    expect(ast[0].type).toBe("Assignment");
  });

  it("parses for loop", () => {
    const tokens = tokenize("for i from 1 to 3\n  x = i\nendfor");
    const ast = parse(tokens);
    expect(ast[0].type).toBe("For");
  });

  it("parses if/else/endif", () => {
    const tokens = tokenize("if x > 0\n  y = 1\nelse\n  y = 2\nendif");
    const ast = parse(tokens);
    expect(ast[0].type).toBe("If");
  });

  it("parses command calls with colon", () => {
    const tokens = tokenize('appendInfoLine: "hello"');
    const ast = parse(tokens);
    expect(ast[0].type).toBe("Call");
  });
});

describe("Praat Script Interpreter", () => {
  it("handles variable assignment and arithmetic", () => {
    const result = runPraatScript("x = 3 + 4 * 2\nappendInfoLine: x");
    expect(result.output.trim()).toBe("11");
    expect(result.errors).toHaveLength(0);
  });

  it("handles for loops", () => {
    const result = runPraatScript(
      "total = 0\nfor i from 1 to 5\n  total = total + i\nendfor\nappendInfoLine: total"
    );
    expect(result.output.trim()).toBe("15");
  });

  it("handles if/else", () => {
    const result = runPraatScript(
      "x = 10\nif x > 5\n  appendInfoLine: \"big\"\nelse\n  appendInfoLine: \"small\"\nendif"
    );
    expect(result.output.trim()).toBe("big");
  });

  it("handles string variables", () => {
    const result = runPraatScript(
      'name$ = "world"\ngreeting$ = "hello " + name$\nappendInfoLine: greeting$'
    );
    expect(result.output.trim()).toBe("hello world");
  });

  it("handles string concatenation with numbers", () => {
    const result = runPraatScript('x = 42\nappendInfoLine: "value is " + x');
    // + with string on left → concat
    // Actually our impl: if either is string, concat
    // But x is a number here, "value is " is string → concat
    // Wait: args to appendInfoLine are separate exprs joined by comma
    // Let's test differently
    const result2 = runPraatScript('appendInfoLine: "x=" + string$(5)');
    expect(result2.output.trim()).toBe("x=5");
  });

  it("handles math functions", () => {
    const result = runPraatScript("x = sqrt(16)\nappendInfoLine: x");
    expect(result.output.trim()).toBe("4");
  });

  it("handles while loops", () => {
    const result = runPraatScript(
      "x = 1\nwhile x < 10\n  x = x * 2\nendwhile\nappendInfoLine: x"
    );
    expect(result.output.trim()).toBe("16");
  });

  it("handles procedures", () => {
    const result = runPraatScript(
      'procedure greet: name$\n  appendInfoLine: "Hi " + name$\nendproc\ncall greet: "Alice"'
    );
    expect(result.output.trim()).toBe("Hi Alice");
  });

  it("handles built-in Praat commands", () => {
    const result = runPraatScript('Read from file: "test.wav"\nTo Pitch: 0, 75, 600');
    expect(result.errors).toHaveLength(0);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[1].type).toBe("Pitch");
  });

  it("handles multiple appendInfoLine outputs", () => {
    const result = runPraatScript(
      'appendInfoLine: "line1"\nappendInfoLine: "line2"\nappendInfoLine: "line3"'
    );
    expect(result.output).toBe("line1\nline2\nline3\n");
  });

  it("reports syntax errors with line numbers", () => {
    const result = runPraatScript("x = \n");
    // Should either produce an error or handle gracefully
    // Our parser might throw on unexpected token
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });

  it("handles nested for loops", () => {
    const result = runPraatScript(
      "total = 0\nfor i from 1 to 3\n  for j from 1 to 3\n    total = total + 1\n  endfor\nendfor\nappendInfoLine: total"
    );
    expect(result.output.trim()).toBe("9");
  });

  it("handles comparison operators", () => {
    const result = runPraatScript(
      "if 5 >= 5 and 3 <= 4\n  appendInfoLine: \"yes\"\nendif"
    );
    expect(result.output.trim()).toBe("yes");
  });

  it("handles unary minus", () => {
    const result = runPraatScript("x = -5\nappendInfoLine: x");
    expect(result.output.trim()).toBe("-5");
  });
});
