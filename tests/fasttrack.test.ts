import { describe, it, expect } from "vitest";
import { Interpreter } from "../src/scripting/interpreter";

describe("FastTrack support - Include registry", () => {
  it("resolves include statements from registry", () => {
    const interp = new Interpreter();
    interp.registerInclude("utils.praat", `
      procedure greet: .name$
        appendInfoLine: "Hello, ", .name$
      endproc
    `);

    const result = interp.execute(`
      include utils.praat
      @greet: "World"
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toContain("Hello, World");
  });

  it("prevents double-include", () => {
    const interp = new Interpreter();
    let count = 0;
    // The include file appends a line each time
    interp.registerInclude("counter.praat", `appendInfoLine: "included"`);

    const result = interp.execute(`
      include counter.praat
      include counter.praat
    `);
    expect(result.errors).toHaveLength(0);
    // Should only appear once due to include guard
    expect(result.output.split("included").length - 1).toBe(1);
  });

  it("resolves include by basename", () => {
    const interp = new Interpreter();
    interp.registerInclude("/path/to/helpers.praat", `
      procedure helper
        appendInfoLine: "helped"
      endproc
    `);

    const result = interp.execute(`
      include helpers.praat
      @helper
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toContain("helped");
  });

  it("registerIncludes batch method works", () => {
    const interp = new Interpreter();
    interp.registerIncludes({
      "a.praat": `procedure a\nappendInfoLine: "A"\nendproc`,
      "b.praat": `procedure b\nappendInfoLine: "B"\nendproc`,
    });

    const result = interp.execute(`
      include a.praat
      include b.praat
      @a
      @b
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toContain("A");
    expect(result.output).toContain("B");
  });
});

describe("FastTrack support - Table operations", () => {
  it("Create Table with column names", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "results", 3, "time F1 F2 F3"
      nRows = Get number of rows
      appendInfoLine: nRows
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("3");
    expect(result.objects[0].type).toBe("Table");
    expect(result.objects[0].data.columns).toEqual(["time", "F1", "F2", "F3"]);
  });

  it("Append row adds a row", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 0, "x y"
      Append row
      Append row
      nRows = Get number of rows
      appendInfoLine: nRows
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("2");
  });

  it("Set numeric value and Get value", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 2, "freq amp"
      Set numeric value: 1, "freq", 440
      Set numeric value: 2, "freq", 880
      val = Get value: 1, "freq"
      appendInfoLine: val
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("440");
  });

  it("Set string value and Get string value", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 1, "label value"
      Set string value: 1, "label", "vowel"
      val$ = Get string value: 1, "label"
      appendInfoLine: val$
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("vowel");
  });

  it("Sort rows by column", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 3, "x"
      Set numeric value: 1, "x", 30
      Set numeric value: 2, "x", 10
      Set numeric value: 3, "x", 20
      Sort rows: "x"
      v1 = Get value: 1, "x"
      v2 = Get value: 2, "x"
      v3 = Get value: 3, "x"
      appendInfoLine: v1, " ", v2, " ", v3
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("10 20 30");
  });

  it("Get column index", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 1, "a b c"
      idx = Get column index: "b"
      appendInfoLine: idx
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("2");
  });

  it("Get minimum and Get maximum", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 3, "val"
      Set numeric value: 1, "val", 5
      Set numeric value: 2, "val", 2
      Set numeric value: 3, "val", 8
      min = Get minimum: "val"
      max = Get maximum: "val"
      appendInfoLine: min, " ", max
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output.trim()).toBe("2 8");
  });

  it("Get standard deviation", () => {
    const interp = new Interpreter();
    const result = interp.execute(`
      Create Table with column names: "t", 3, "val"
      Set numeric value: 1, "val", 2
      Set numeric value: 2, "val", 4
      Set numeric value: 3, "val", 6
      sd = Get standard deviation: "val"
      appendInfoLine: sd
    `);
    expect(result.errors).toHaveLength(0);
    expect(Number(result.output.trim())).toBeCloseTo(2, 5);
  });
});

describe("FastTrack end-to-end simulation", () => {
  it("simulates FastTrack workflow: create table, fill with formant candidates, find best", () => {
    const interp = new Interpreter();
    // Simulate: register a FastTrack-like include, create table, populate, find min error
    interp.registerInclude("fasttrack_utils.praat", `
      procedure findBestRow: .tableName$
        select Table '.tableName$'
        .nRows = Get number of rows
        .minErr = 999999
        .bestRow = 1
        for .i from 1 to .nRows
          .err = Get value: .i, "error"
          if .err < .minErr
            .minErr = .err
            .bestRow = .i
          endif
        endfor
      endproc
    `);

    const result = interp.execute(`
      include fasttrack_utils.praat
      Create Table with column names: "candidates", 3, "setting error F1 F2"
      Set numeric value: 1, "setting", 1
      Set numeric value: 1, "error", 5.2
      Set numeric value: 1, "F1", 500
      Set numeric value: 1, "F2", 1500
      Set numeric value: 2, "setting", 2
      Set numeric value: 2, "error", 2.1
      Set numeric value: 2, "F1", 520
      Set numeric value: 2, "F2", 1480
      Set numeric value: 3, "setting", 3
      Set numeric value: 3, "error", 8.0
      Set numeric value: 3, "F1", 480
      Set numeric value: 3, "F2", 1520
      @findBestRow: "candidates"
      appendInfoLine: "Best row: ", findBestRow.bestRow
      appendInfoLine: "Min error: ", findBestRow.minErr
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toContain("Best row: 2");
    expect(result.output).toContain("Min error: 2.1");
  });
});
