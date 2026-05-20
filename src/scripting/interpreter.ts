// Praat Script Interpreter

import { tokenize } from "./lexer";
import { parse, ASTNode, ExprNode, ParseError, CallNode, IndexExpr } from "./parser";
import { computeFormants, computePitch } from "../audio/analyzer";

export class RuntimeError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
    this.line = line;
  }
}

export interface PraatObject {
  id: number;
  type: string;
  name: string;
  data: Record<string, unknown>;
}

export interface InterpreterResult {
  output: string;
  errors: { line: number; message: string }[];
  objects: PraatObject[];
}

export class ExitScriptError extends Error {
  constructor(public msg?: string) { super(msg || 'exitScript'); }
}

export class Interpreter {
  private variables: Map<string, number | string | number[]> = new Map();
  private procedures: Map<string, { params: string[]; body: ASTNode[] }> = new Map();
  private objects: PraatObject[] = [];
  private selectedObject: PraatObject | null = null;
  private nextId = 1;
  private output = "";
  private maxIterations = 100000;
  // For procedure local scope
  private localScopes: Map<string, number | string | number[]>[] = [];
  private currentProcName: string | null = null;
  // Include registry: path → source code
  private includeRegistry: Map<string, string> = new Map();
  private includedPaths: Set<string> = new Set();

  /**
   * Register a script source that can be resolved by `include` statements.
   * Path matching is flexible: "utils.praat", "./utils.praat", or full path.
   */
  registerInclude(path: string, source: string): void {
    this.includeRegistry.set(path, source);
    // Also register the basename for convenience
    const basename = path.replace(/^.*[\/]/, "");
    if (basename !== path) {
      this.includeRegistry.set(basename, source);
    }
  }

  /**
   * Register multiple includes at once.
   */
  registerIncludes(files: Record<string, string>): void {
    for (const [path, source] of Object.entries(files)) {
      this.registerInclude(path, source);
    }
  }

  private mathFunctions: Record<string, (args: number[]) => number> = {
    sqrt: (a) => Math.sqrt(a[0]),
    abs: (a) => Math.abs(a[0]),
    sin: (a) => Math.sin(a[0]),
    cos: (a) => Math.cos(a[0]),
    tan: (a) => Math.tan(a[0]),
    arctan: (a) => Math.atan(a[0]),
    arctan2: (a) => Math.atan2(a[0], a[1]),
    log: (a) => Math.log(a[0]),
    log2: (a) => Math.log2(a[0]),
    log10: (a) => Math.log10(a[0]),
    exp: (a) => Math.exp(a[0]),
    ln: (a) => Math.log(a[0]),
    floor: (a) => Math.floor(a[0]),
    ceiling: (a) => Math.ceil(a[0]),
    round: (a) => Math.round(a[0]),
    min: (a) => Math.min(a[0], a[1]),
    max: (a) => Math.max(a[0], a[1]),
    randomUniform: (a) => a[0] + Math.random() * (a[1] - a[0]),
    randomInteger: (a) => Math.floor(a[0] + Math.random() * (a[1] - a[0] + 1)),
    randomGauss: (a) => {
      // Box-Muller
      const u1 = Math.random(), u2 = Math.random();
      return a[0] + a[1] * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    undefined: () => NaN,
  };

  execute(source: string, preloadedSound?: { samples: Float32Array; sampleRate: number }): InterpreterResult {
    this.variables.clear();
    this.procedures.clear();
    this.objects = [];
    this.selectedObject = null;
    this.nextId = 1;
    this.output = "";
    this.localScopes = [];
    this.currentProcName = null;
    this.includedPaths.clear();

    // Pre-load audio as a Sound object if provided
    if (preloadedSound && preloadedSound.samples.length > 0) {
      const sound: PraatObject = {
        id: this.nextId++,
        type: 'Sound',
        name: 'untitled',
        data: {
          samples: preloadedSound.samples,
          sampleRate: preloadedSound.sampleRate,
          duration: preloadedSound.samples.length / preloadedSound.sampleRate,
        },
      };
      this.objects.push(sound);
      this.selectedObject = sound;
    }

    const errors: { line: number; message: string }[] = [];

    try {
      const tokens = tokenize(source);
      const ast = parse(tokens);

      // First pass: collect procedures
      for (const node of ast) {
        if (node.type === "Procedure") {
          this.procedures.set(node.name, { params: node.params, body: node.body });
        }
      }

      // Second pass: execute
      this.executeBlock(ast);
    } catch (e) {
      if (e instanceof ExitScriptError) {
        if (e.msg && e.msg !== 'exitScript') {
          this.output += e.msg;
        }
      } else if (e instanceof ParseError || e instanceof RuntimeError) {
        errors.push({ line: e.line, message: e.message });
      } else {
        errors.push({ line: 0, message: String(e) });
      }
    }

    return { output: this.output, errors, objects: [...this.objects] };
  }

  private getVar(name: string): number | string | number[] | undefined {
    // Check local scope first
    if (this.localScopes.length > 0) {
      const top = this.localScopes[this.localScopes.length - 1];
      if (name.startsWith(".") && top.has(name)) {
        return top.get(name);
      }
      // Also check procName.varName pattern
      if (this.currentProcName && top.has(name)) {
        return top.get(name);
      }
    }
    return this.variables.get(name);
  }

  private setVar(name: string, value: number | string | number[]) {
    if (name.startsWith(".") && this.localScopes.length > 0) {
      this.localScopes[this.localScopes.length - 1].set(name, value);
    } else {
      this.variables.set(name, value);
    }
  }

  private executeBlock(nodes: ASTNode[]) {
    for (const node of nodes) {
      this.executeNode(node);
    }
  }

  private executeNode(node: ASTNode) {
    switch (node.type) {
      case "Assignment": {
        const val = this.evalExpr(node.value);
        this.setVar(node.name, val as number | string | number[]);
        break;
      }
      case "For": {
        const from = this.evalNumeric(node.from, node.line);
        const to = this.evalNumeric(node.to, node.line);
        let iterations = 0;
        for (let i = from; i <= to; i++) {
          if (++iterations > this.maxIterations) throw new RuntimeError("Too many iterations", node.line);
          this.setVar(node.variable, i);
          this.executeBlock(node.body);
        }
        break;
      }
      case "While": {
        let iterations = 0;
        while (this.isTruthy(this.evalExpr(node.condition))) {
          if (++iterations > this.maxIterations) throw new RuntimeError("Too many iterations", node.line);
          this.executeBlock(node.body);
        }
        break;
      }
      case "Repeat": {
        let iterations = 0;
        do {
          if (++iterations > this.maxIterations) throw new RuntimeError("Too many iterations", node.line);
          this.executeBlock(node.body);
        } while (!this.isTruthy(this.evalExpr(node.condition)));
        break;
      }
      case "If": {
        if (this.isTruthy(this.evalExpr(node.condition))) {
          this.executeBlock(node.thenBody);
        } else {
          let handled = false;
          for (const clause of node.elsifClauses) {
            if (this.isTruthy(this.evalExpr(clause.condition))) {
              this.executeBlock(clause.body);
              handled = true;
              break;
            }
          }
          if (!handled) {
            this.executeBlock(node.elseBody);
          }
        }
        break;
      }
      case "Call": {
        this.executeCall(node);
        if (node.assignTo) {
          const result = this.getVar("_lastResult") ?? this.getVar("_lastResult$") ?? 0;
          this.setVar(node.assignTo, result as number | string | number[]);
        }
        break;
      }
      case "Procedure": {
        // Already collected in first pass
        break;
      }
      case "Include": {
        const includePath = node.path;
        if (includePath && !this.includedPaths.has(includePath)) {
          this.includedPaths.add(includePath);
          // Try to resolve from registry
          const source = this.includeRegistry.get(includePath)
            ?? this.includeRegistry.get(includePath.replace(/^.*[\/]/, ""));
          if (source) {
            const tokens = tokenize(source);
            const ast = parse(tokens);
            // Collect procedures from included file
            for (const n of ast) {
              if (n.type === "Procedure") {
                this.procedures.set(n.name, { params: n.params, body: n.body });
              }
            }
            this.executeBlock(ast);
          }
          // If not found in registry, silently skip (web context)
        }
        break;
      }
      case "ExpressionStatement": {
        this.evalExpr(node.expression);
        break;
      }
    }
  }

  private interpolateString(s: string): string {
    // Replace 'varName$' and 'varName' interpolation patterns
    return s.replace(/'([^']+)'/g, (_, varName: string) => {
      const val = this.getVar(varName);
      if (val !== undefined) return String(val);
      // Try without $ suffix for numeric
      return String(this.getVar(varName) ?? "");
    });
  }

  private executeCall(node: CallNode) {
    let name = node.name;
    const args = node.args.map((a) => this.evalExpr(a));

    // Interpolate command name if it contains quotes
    if (name.includes("'")) {
      name = this.interpolateString(name);
    }

    // Built-in commands
    const nameLower = name.toLowerCase();

    if (nameLower === "appendinfoline" || nameLower === "appendinfo") {
      this.output += args.map(String).join("") + (nameLower === "appendinfoline" ? "\n" : "");
      return;
    }

    if (nameLower === "writeinfoline" || nameLower === "writeinfo") {
      this.output = args.map(String).join("") + (nameLower === "writeinfoline" ? "\n" : "");
      return;
    }

    if (nameLower === "exitscript" || nameLower === "exit") {
      throw new ExitScriptError(args.length > 0 ? String(args[0]) : undefined);
    }

    if (nameLower === "pausescript" || nameLower === "pause") {
      return; // No-op
    }

    if (nameLower === "print" || nameLower === "printline") {
      this.output += args.map(String).join("") + (nameLower === "printline" ? "\n" : "");
      return;
    }

    if (nameLower === "assert") {
      if (args.length > 0 && !this.isTruthy(args[0])) {
        throw new RuntimeError(`Assertion failed`, node.line);
      }
      return;
    }

    // selectObject
    if (nameLower === "selectobject" || name === "selectObject") {
      this.selectObjectByArg(args[0]);
      return;
    }

    if (nameLower === "plusobject" || name === "plusObject") {
      // In our simple model, just select (we don't do multi-selection)
      this.selectObjectByArg(args[0]);
      return;
    }

    if (nameLower === "removeobject" || name === "removeObject") {
      if (args.length > 0) {
        const id = typeof args[0] === "number" ? args[0] : null;
        if (id !== null) {
          this.objects = this.objects.filter(o => o.id !== id);
          if (this.selectedObject?.id === id) this.selectedObject = null;
        }
      }
      return;
    }

    if (nameLower === "select" || name === "select" || nameLower.startsWith("select ")) {
      // Handle both: select Table "name" (parsed as command "select Table", args=["name"])
      // and: select "Table name" (parsed as command "select", args=["Table name"])
      let fullName: string;
      if (nameLower.startsWith("select ")) {
        // command name includes the type, e.g. "select Table" + args=["results"]
        const typePart = name.slice(7); // after "select "
        fullName = typePart + (args.length > 0 ? " " + args.map(String).join(" ") : "");
      } else {
        fullName = args.map(String).join(" ");
      }
      const obj = this.objects.find((o) => `${o.type} ${o.name}` === fullName || o.name === fullName);
      if (obj) this.selectedObject = obj;
      return;
    }

    if (nameLower === "remove") {
      if (this.selectedObject) {
        this.objects = this.objects.filter((o) => o.id !== this.selectedObject!.id);
        this.selectedObject = null;
      }
      return;
    }

    // No-op drawing/UI commands
    const noopCommands = [
      "erase all", "select outer viewport", "font size", "line width",
      "draw inner box", "save as", "createdirectory", "create directory",
      "colour", "color", "paint", "draw", "garnish", "marks", "text",
      "one mark", "axes"
    ];
    if (noopCommands.some(c => nameLower.startsWith(c))) {
      return;
    }

    // editor/endeditor block — handled as no-op calls
    if (nameLower === "editor" || nameLower === "endeditor") {
      return;
    }

    // Create Table with column names: name, numRows, colNames (space-separated)
    if (name === "Create Table with column names" || name === "Create Table with column names:") {
      const tableName = String(args[0] ?? "table");
      const numRows = Number(args[1] ?? 0);
      const colNamesStr = String(args[2] ?? "");
      const columns = colNamesStr.split(/\s+/).filter(c => c.length > 0);
      const rows: (number | string)[][] = [];
      for (let i = 0; i < numRows; i++) {
        rows.push(columns.map(() => 0));
      }
      const obj: PraatObject = {
        id: this.nextId++,
        type: "Table",
        name: tableName,
        data: { columns, rows, numRows },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name === "Create simple Matrix" || name === "Create simple Matrix:") {
      const matName = String(args[0] ?? "matrix");
      const numRows = Number(args[1] ?? 1);
      const numCols = Number(args[2] ?? 1);
      // args[3] is formula, currently unused for Matrix creation
      void args[3];
      const obj: PraatObject = {
        id: this.nextId++,
        type: "Matrix",
        name: matName,
        data: { rows: numRows, cols: numCols, values: Array(numRows * numCols).fill(0) },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name === "Read from file") {
      const filename = String(args[0] ?? "");
      const obj: PraatObject = {
        id: this.nextId++,
        type: "Sound",
        name: filename.replace(/^.*\//, "").replace(/\.\w+$/, ""),
        data: { duration: 1.0, sampleRate: 44100 },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name === "To Pitch" || name.startsWith("To Pitch")) {
      if (!this.selectedObject) throw new RuntimeError("No object selected", node.line);
      const soundData = this.selectedObject.data;
      const samples = soundData.samples as Float32Array | undefined;
      const sr = soundData.sampleRate as number | undefined;
      const minPitch = Number(args[1]) || 75;
      const maxPitch = Number(args[2]) || 600;

      let pitchTimes: number[] = [];
      let pitchValues: (number | null)[] = [];

      if (samples && sr) {
        const pitchData = computePitch(samples, sr, { pitch: { minHz: minPitch, maxHz: maxPitch } } as Partial<import('../types').AnalysisSettings>);
        pitchTimes = pitchData.times;
        pitchValues = pitchData.frequencies;
      }

      const obj: PraatObject = {
        id: this.nextId++,
        type: "Pitch",
        name: this.selectedObject.name,
        data: {
          minPitch,
          maxPitch,
          times: pitchTimes,
          values: pitchValues,
        },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name.startsWith("To Formant")) {
      if (!this.selectedObject) throw new RuntimeError("No object selected", node.line);
      const soundData = this.selectedObject.data;
      const samples = soundData.samples as Float32Array | undefined;
      const sr = soundData.sampleRate as number | undefined;
      const timeStep = Number(args[0]) || 0.01;
      const maxFormant = Number(args[1]) || 5500;
      const numFormants = Number(args[2]) || 5;
      const lpcOrder = Math.round(2 * numFormants + 2);

      // Run real LPC formant analysis if we have audio
      let formantData: { times: number[]; tracked: Array<Array<number | null>>; f1: (number|null)[]; f2: (number|null)[]; f3: (number|null)[] } | null = null;
      if (samples && sr) {
        formantData = computeFormants(samples, sr, {
          formant: { maxFrequency: maxFormant, numberOfFormants: numFormants, lpcOrder },
        } as Partial<import('../types').AnalysisSettings>);
      }

      const obj: PraatObject = {
        id: this.nextId++,
        type: "Formant",
        name: this.selectedObject.name,
        data: {
          timestep: timeStep,
          maxFormant,
          numFormants,
          numFrames: formantData?.times.length ?? 0,
          times: formantData?.times ?? [],
          tracked: formantData?.tracked ?? [],
          f1: formantData?.f1 ?? [],
          f2: formantData?.f2 ?? [],
          f3: formantData?.f3 ?? [],
        },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name === "Down to Table") {
      if (!this.selectedObject) throw new RuntimeError("No object selected", node.line);
      const data = this.selectedObject.data;
      const times = data.times as number[] | undefined;
      const tracked = data.tracked as Array<Array<number | null>> | undefined;
      const numFrames = times?.length ?? 0;
      const numFormants = tracked?.length ?? 3;

      const columns = ["time(s)", "nformants"];
      for (let f = 1; f <= Math.min(numFormants, 4); f++) {
        columns.push(`F${f}(Hz)`, `B${f}(Hz)`);
      }

      const rows: (number | string)[][] = [];
      for (let r = 0; r < numFrames; r++) {
        const row: (number | string)[] = [times![r], numFormants];
        for (let f = 0; f < Math.min(numFormants, 4); f++) {
          const freq = tracked?.[f]?.[r] ?? 0;
          row.push(freq ?? 0, 50); // bandwidth placeholder
        }
        rows.push(row);
      }

      const obj: PraatObject = {
        id: this.nextId++,
        type: "Table",
        name: this.selectedObject.name,
        data: { columns, rows, numRows: numFrames },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    // Table operations
    if (this.selectedObject?.type === "Table") {
      const table = this.selectedObject;
      const columns = table.data.columns as string[];
      const rows = table.data.rows as (number | string)[][];

      if (name === "Get number of rows") {
        this.variables.set("_lastResult", rows.length);
        return;
      }

      if (name === "Get mean") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0) {
          const sum = rows.reduce((s, r) => s + Number(r[colIdx] ?? 0), 0);
          this.variables.set("_lastResult", rows.length > 0 ? sum / rows.length : 0);
        } else {
          this.variables.set("_lastResult", 0);
        }
        return;
      }

      if (name === "Get quantile") {
        const colName = String(args[0] ?? "");
        const quantile = Number(args[1] ?? 0.5);
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0) {
          const vals = rows.map(r => Number(r[colIdx] ?? 0)).sort((a, b) => a - b);
          const idx = Math.floor(quantile * (vals.length - 1));
          this.variables.set("_lastResult", vals[idx] ?? 0);
        } else {
          this.variables.set("_lastResult", 0);
        }
        return;
      }

      if (name === "Get value") {
        // Get value: rowNumber, columnName
        const rowNum = Number(args[0] ?? 1);
        const colName = String(args[1] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rowNum >= 1 && rowNum <= rows.length) {
          this.variables.set("_lastResult", Number(rows[rowNum - 1][colIdx] ?? 0));
        } else {
          this.variables.set("_lastResult", 0);
        }
        return;
      }

      if (name === "Append column") {
        columns.push(String(args[0] ?? "new"));
        for (const row of rows) row.push(0);
        return;
      }

      if (name === "Insert column") {
        const position = Number(args[0] ?? columns.length + 1);
        const colName = String(args[1] ?? "new");
        columns.splice(position - 1, 0, colName);
        for (const row of rows) row.splice(position - 1, 0, 0);
        return;
      }

      if (name === "Remove column") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0) {
          columns.splice(colIdx, 1);
          for (const row of rows) row.splice(colIdx, 1);
        }
        return;
      }

      if (name === "Set column label (label)") {
        const oldName = String(args[0] ?? "");
        const newName = String(args[1] ?? "");
        const idx = columns.indexOf(oldName);
        if (idx >= 0) columns[idx] = newName;
        return;
      }

      if (name === "Formula") {
        const colName = String(args[0] ?? "");
        const formula = String(args[1] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0) {
          for (let r = 0; r < rows.length; r++) {
            // Simple formula evaluation with self, row
            const rowVal = rows[r];
            let result: number | string = 0;
            try {
              result = this.evalTableFormula(formula, rowVal, columns, r + 1);
            } catch { /* ignore formula errors */ }
            rows[r][colIdx] = result;
          }
        }
        return;
      }

      if (name === "Extract rows where column (number)") {
        const colName = String(args[0] ?? "");
        const op = String(args[1] ?? "");
        const value = Number(args[2] ?? 0);
        const colIdx = columns.indexOf(colName);
        const filtered: (number | string)[][] = [];
        if (colIdx >= 0) {
          for (const row of rows) {
            const v = Number(row[colIdx] ?? 0);
            let match = false;
            if (op === "greater than" || op === ">") match = v > value;
            else if (op === "less than" || op === "<") match = v < value;
            else if (op === "equal to" || op === "==" || op === "=") match = v === value;
            else if (op === "greater than or equal to" || op === ">=") match = v >= value;
            else if (op === "less than or equal to" || op === "<=") match = v <= value;
            else if (op === "not equal to" || op === "!=") match = v !== value;
            if (match) filtered.push([...row]);
          }
        }
        const newTable: PraatObject = {
          id: this.nextId++,
          type: "Table",
          name: table.name + "_extracted",
          data: { columns: [...columns], rows: filtered, numRows: filtered.length },
        };
        this.objects.push(newTable);
        this.selectedObject = newTable;
        return;
      }

      if (name === "Copy") {
        const newName = String(args[0] ?? table.name);
        const copy: PraatObject = {
          id: this.nextId++,
          type: "Table",
          name: newName,
          data: { columns: [...columns], rows: rows.map(r => [...r]), numRows: rows.length },
        };
        this.objects.push(copy);
        this.selectedObject = copy;
        return;
      }

      if (name === "Rename") {
        table.name = String(args[0] ?? table.name);
        return;
      }

      if (name === "Append difference column") {
        const col1 = String(args[0] ?? "");
        const col2 = String(args[1] ?? "");
        const resultCol = String(args[2] ?? "diff");
        const idx1 = columns.indexOf(col1);
        const idx2 = columns.indexOf(col2);
        columns.push(resultCol);
        for (const row of rows) {
          const diff = idx1 >= 0 && idx2 >= 0 ? Number(row[idx1]) - Number(row[idx2]) : 0;
          row.push(diff);
        }
        return;
      }

      if (name === "Append row") {
        rows.push(columns.map(() => 0));
        table.data.numRows = rows.length;
        return;
      }

      if (name === "Set numeric value") {
        const rowNum = Number(args[0] ?? 1);
        const colName = String(args[1] ?? "");
        const value = Number(args[2] ?? 0);
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rowNum >= 1 && rowNum <= rows.length) {
          rows[rowNum - 1][colIdx] = value;
        }
        return;
      }

      if (name === "Set string value") {
        const rowNum = Number(args[0] ?? 1);
        const colName = String(args[1] ?? "");
        const value = String(args[2] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rowNum >= 1 && rowNum <= rows.length) {
          rows[rowNum - 1][colIdx] = value;
        }
        return;
      }

      if (name === "Get string value") {
        const rowNum = Number(args[0] ?? 1);
        const colName = String(args[1] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rowNum >= 1 && rowNum <= rows.length) {
          this.variables.set("_lastResult$", String(rows[rowNum - 1][colIdx] ?? ""));
          this.variables.set("_lastResult", String(rows[rowNum - 1][colIdx] ?? ""));
        } else {
          this.variables.set("_lastResult$", "");
          this.variables.set("_lastResult", "");
        }
        return;
      }

      if (name === "Get column index") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        this.variables.set("_lastResult", colIdx >= 0 ? colIdx + 1 : 0);
        return;
      }

      if (name === "Sort rows") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0) {
          rows.sort((a, b) => {
            const va = a[colIdx], vb = b[colIdx];
            if (typeof va === "number" && typeof vb === "number") return va - vb;
            return String(va).localeCompare(String(vb));
          });
        }
        return;
      }

      if (name === "Get minimum") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rows.length > 0) {
          const min = Math.min(...rows.map(r => Number(r[colIdx] ?? Infinity)));
          this.variables.set("_lastResult", min);
        } else {
          this.variables.set("_lastResult", 0);
        }
        return;
      }

      if (name === "Get maximum") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rows.length > 0) {
          const max = Math.max(...rows.map(r => Number(r[colIdx] ?? -Infinity)));
          this.variables.set("_lastResult", max);
        } else {
          this.variables.set("_lastResult", 0);
        }
        return;
      }

      if (name === "Get standard deviation") {
        const colName = String(args[0] ?? "");
        const colIdx = columns.indexOf(colName);
        if (colIdx >= 0 && rows.length > 1) {
          const vals = rows.map(r => Number(r[colIdx] ?? 0));
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
          this.variables.set("_lastResult", Math.sqrt(variance));
        } else {
          this.variables.set("_lastResult", 0);
        }
        return;
      }

      if (name === "To linear regression") {
        // Simple OLS: last column = dependent, others = independent
        // For simplicity: y = first col dependent, rest independent? 
        // Actually Praat uses all columns. We'll do simple: y=last col, x=other cols
        const nCols = columns.length;
        const nRows = rows.length;
        if (nCols < 2 || nRows < 2) {
          const lr: PraatObject = {
            id: this.nextId++,
            type: "LinearRegression",
            name: table.name,
            data: { coefficients: [], intercept: 0, info: "Linear regression (insufficient data)" },
          };
          this.objects.push(lr);
          this.selectedObject = lr;
          return;
        }
        // y = last column, X = all other columns
        const yIdx = nCols - 1;
        const xIndices = Array.from({ length: nCols - 1 }, (_, i) => i);
        const y = rows.map(r => Number(r[yIdx]));
        const X = rows.map(r => [...xIndices.map(i => Number(r[i])), 1]); // add intercept
        // OLS: beta = (X'X)^-1 X'y
        const beta = this.olsRegression(X, y);
        const intercept = beta[beta.length - 1];
        const coefficients = beta.slice(0, -1);
        let info = "Linear regression:\n";
        for (let i = 0; i < coefficients.length; i++) {
          info += `  ${columns[xIndices[i]]}: ${coefficients[i].toFixed(6)}\n`;
        }
        info += `  Intercept: ${intercept.toFixed(6)}\n`;
        const lr: PraatObject = {
          id: this.nextId++,
          type: "LinearRegression",
          name: table.name,
          data: { coefficients, intercept, info },
        };
        this.objects.push(lr);
        this.selectedObject = lr;
        return;
      }

      if (name === "Fit polynomial") {
        // Fit polynomial: xColumn$, yColumn$, order
        const xCol = String(args[0]);
        const yCol = String(args[1]);
        const order = Math.round(Number(args[2]) || 3);
        const xIdx = columns.indexOf(xCol);
        const yIdx = columns.indexOf(yCol);
        if (xIdx < 0) throw new RuntimeError(`Column '${xCol}' not found`, node.line);
        if (yIdx < 0) throw new RuntimeError(`Column '${yCol}' not found`, node.line);
        const xVals = rows.map(r => Number(r[xIdx]));
        const yVals = rows.map(r => Number(r[yIdx]));
        const coeffs = this.polyFit(xVals, yVals, order);
        let sse = 0;
        for (let i = 0; i < xVals.length; i++) {
          sse += (yVals[i] - this.polyEval(coeffs, xVals[i])) ** 2;
        }
        const rmse = Math.sqrt(sse / xVals.length);
        const poly: PraatObject = {
          id: this.nextId++,
          type: "Polynomial",
          name: `${table.name}_poly${order}`,
          data: { coefficients: coeffs, order, rmse, xColumn: xCol, yColumn: yCol },
        };
        this.objects.push(poly);
        this.selectedObject = poly;
        this.variables.set("_lastResult", rmse);
        return;
      }

      if (name === "Get fitting error" || name === "Get rmse") {
        // Get fitting error: xColumn$, yColumn$, order
        const xCol = String(args[0]);
        const yCol = String(args[1]);
        const order = Math.round(Number(args[2]) || 3);
        const xIdx = columns.indexOf(xCol);
        const yIdx = columns.indexOf(yCol);
        if (xIdx < 0 || yIdx < 0) { this.variables.set("_lastResult", 0); return; }
        const xVals = rows.map(r => Number(r[xIdx]));
        const yVals = rows.map(r => Number(r[yIdx]));
        const coeffs = this.polyFit(xVals, yVals, order);
        let sse = 0;
        for (let i = 0; i < xVals.length; i++) {
          sse += (yVals[i] - this.polyEval(coeffs, xVals[i])) ** 2;
        }
        this.variables.set("_lastResult", Math.sqrt(sse / xVals.length));
        return;
      }

      if (name === "Remove column") {
        const col = String(args[0]);
        const idx = columns.indexOf(col);
        if (idx >= 0) {
          columns.splice(idx, 1);
          for (const row of rows) row.splice(idx, 1);
        }
        return;
      }

      if (name === "Extract rows where" || name === "Extract rows where column") {
        // Extract rows where column: column$, operator$, value
        const col = String(args[0]);
        const op = String(args[1]);
        const val = Number(args[2]);
        const idx = columns.indexOf(col);
        if (idx < 0) throw new RuntimeError(`Column '${col}' not found`, node.line);
        const filtered = rows.filter(r => {
          const v = Number(r[idx]);
          switch (op) {
            case "<": return v < val;
            case ">": return v > val;
            case "<=": return v <= val;
            case ">=": return v >= val;
            case "=": case "==": return v === val;
            case "!=": case "<>": return v !== val;
            default: return true;
          }
        });
        const newTable: PraatObject = {
          id: this.nextId++,
          type: "Table",
          name: table.name + "_extract",
          data: { columns: [...columns], rows: filtered.map(r => [...r]) },
        };
        this.objects.push(newTable);
        this.selectedObject = newTable;
        return;
      }
    }

    // Info command for Polynomial
    if (name === "Info" && this.selectedObject?.type === "Polynomial") {
      const d = this.selectedObject.data;
      const coeffs = d.coefficients as number[];
      let info = `Polynomial of order ${d.order}\n`;
      info += `RMSE: ${(d.rmse as number).toFixed(6)}\n`;
      info += `Coefficients: ${coeffs.map((c: number) => c.toFixed(6)).join(", ")}\n`;
      this.output += info;
      return;
    }

    // Get value at time for Polynomial (evaluate)
    if ((name === "Get value at time" || name === "Get value") && this.selectedObject?.type === "Polynomial") {
      const t = Number(args[0]) || 0;
      const coeffs = this.selectedObject.data.coefficients as number[];
      this.variables.set("_lastResult", this.polyEval(coeffs, t));
      return;
    }

    // Info command for LinearRegression
    if (name === "Info" && this.selectedObject?.type === "LinearRegression") {
      this.output += String(this.selectedObject.data.info ?? "");
      return;
    }

    if (name === "Get mean") {
      if (this.selectedObject?.type === "Formant") {
        // Get mean of a formant track: args[0]=start, args[1]=end, args[2]=unit
        const data = this.selectedObject.data;
        const tracked = data.tracked as Array<Array<number | null>> | undefined;
        // Default to F1 mean
        const formantIdx = 0;
        if (tracked && tracked[formantIdx]) {
          const values = tracked[formantIdx].filter((v): v is number => v !== null && v > 0);
          const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          this.variables.set("_lastResult", mean);
        } else {
          this.variables.set("_lastResult", 0);
        }
      } else if (this.selectedObject?.type === "Pitch") {
        const data = this.selectedObject.data;
        const values = data.values as number[] | undefined;
        if (values) {
          const voiced = values.filter(v => v > 0);
          const mean = voiced.length > 0 ? voiced.reduce((a, b) => a + b, 0) / voiced.length : 0;
          this.variables.set("_lastResult", mean);
        } else {
          this.variables.set("_lastResult", 0);
        }
      } else {
        this.variables.set("_lastResult", 0);
      }
      return;
    }

    if (name === "Get value at time") {
      if (!this.selectedObject) { this.variables.set("_lastResult", 0); return; }
      const formantNum = Number(args[0]) || 1;
      const time = Number(args[1]) || 0;
      const data = this.selectedObject.data;
      const times = data.times as number[] | undefined;
      const tracked = data.tracked as Array<Array<number | null>> | undefined;

      if (times && tracked && tracked[formantNum - 1]) {
        // Find closest time frame
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < times.length; i++) {
          const dist = Math.abs(times[i] - time);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        }
        const val = tracked[formantNum - 1][bestIdx];
        this.variables.set("_lastResult", val ?? 0);
      } else {
        this.variables.set("_lastResult", 0);
      }
      return;
    }

    if (name === "Get number of rows" && this.selectedObject) {
      const rows = this.selectedObject.data.rows as unknown[];
      this.variables.set("_lastResult", rows ? rows.length : 0);
      return;
    }

    if (name === "Copy" && this.selectedObject) {
      const newName = String(args[0] ?? this.selectedObject.name);
      const copy: PraatObject = {
        id: this.nextId++,
        type: this.selectedObject.type,
        name: newName,
        data: JSON.parse(JSON.stringify(this.selectedObject.data)),
      };
      this.objects.push(copy);
      this.selectedObject = copy;
      return;
    }

    if (name === "Rename" && this.selectedObject) {
      this.selectedObject.name = String(args[0] ?? this.selectedObject.name);
      return;
    }

    // Check user-defined procedures
    const proc = this.procedures.get(name);
    if (proc) {
      this.callProcedure(name, proc, args);
      return;
    }

    // nocheck — if set, silently ignore errors
    if (node.nocheck) return;

    // Unknown command - just ignore for compatibility
  }

  private callProcedure(name: string, proc: { params: string[]; body: ASTNode[] }, args: (number | string | number[])[]) {
    const localScope = new Map<string, number | string | number[]>();
    const prevProcName = this.currentProcName;
    this.currentProcName = name;

    // Set params as local .param variables
    for (let i = 0; i < proc.params.length; i++) {
      const paramName = proc.params[i];
      const val = args[i] ?? (paramName.endsWith("$") ? "" : 0);
      // Store both as .param and as the param name directly
      if (paramName.startsWith(".")) {
        localScope.set(paramName, val as number | string | number[]);
      } else {
        localScope.set("." + paramName, val as number | string | number[]);
        localScope.set(paramName, val as number | string | number[]);
      }
    }

    this.localScopes.push(localScope);
    try {
      this.executeBlock(proc.body);
    } finally {
      this.localScopes.pop();
      // Expose procedure outputs as procName.varName
      for (const [key, val] of localScope) {
        if (key.startsWith(".")) {
          this.variables.set(name + key, val);
        }
      }
      this.currentProcName = prevProcName;
    }
  }

  private selectObjectByArg(arg: number | string | number[] | undefined) {
    if (arg === undefined) return;
    if (typeof arg === "number") {
      // Select by ID
      const obj = this.objects.find(o => o.id === arg);
      if (obj) this.selectedObject = obj;
    } else if (typeof arg === "string") {
      // "Type name" format
      const obj = this.objects.find(o => `${o.type} ${o.name}` === arg || o.name === arg);
      if (obj) this.selectedObject = obj;
    }
  }

  private evalTableFormula(formula: string, row: (number | string)[], columns: string[], rowNumber: number): number {
    // Very simple formula evaluator for table context
    // Supports: self, self[colName], row, basic arithmetic
    let expr = formula;
    // Replace self["colName"] or self$["colName"] patterns
    expr = expr.replace(/self\s*\[\s*"([^"]+)"\s*\]/g, (_, col) => {
      const idx = columns.indexOf(col);
      return idx >= 0 ? String(Number(row[idx] ?? 0)) : "0";
    });
    expr = expr.replace(/\brow\b/g, String(rowNumber));
    expr = expr.replace(/\bself\b/g, "0");
    try {
      // Safe-ish eval for simple math
      const result = Function(`"use strict"; return (${expr})`)();
      return Number(result) || 0;
    } catch {
      return 0;
    }
  }

  private olsRegression(X: number[][], y: number[]): number[] {
    // (X'X)^-1 X'y via simple approach
    const n = X.length;
    const p = X[0].length;
    // X'X
    const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < n; k++) {
          XtX[i][j] += X[k][i] * X[k][j];
        }
      }
    }
    // X'y
    const Xty: number[] = Array(p).fill(0);
    for (let i = 0; i < p; i++) {
      for (let k = 0; k < n; k++) {
        Xty[i] += X[k][i] * y[k];
      }
    }
    // Solve via Gaussian elimination
    const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
    for (let i = 0; i < p; i++) {
      // Partial pivot
      let maxRow = i;
      for (let k = i + 1; k < p; k++) {
        if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
      }
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
      if (Math.abs(aug[i][i]) < 1e-12) continue;
      const pivot = aug[i][i];
      for (let j = i; j <= p; j++) aug[i][j] /= pivot;
      for (let k = 0; k < p; k++) {
        if (k === i) continue;
        const factor = aug[k][i];
        for (let j = i; j <= p; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
    return aug.map(row => row[p]);
  }

  /**
   * Fit a polynomial of given order to (x, y) data.
   * Returns coefficients [a0, a1, ..., an] where y = a0 + a1*x + a2*x^2 + ... + an*x^n
   */
  private polyFit(x: number[], y: number[], order: number): number[] {
    const n = x.length;
    if (n === 0) return Array(order + 1).fill(0);
    // Build Vandermonde matrix
    const X = x.map(xi => {
      const row: number[] = [];
      for (let p = 0; p <= order; p++) {
        row.push(xi ** p);
      }
      return row;
    });
    return this.olsRegression(X, y);
  }

  /**
   * Evaluate polynomial at x. coeffs = [a0, a1, ..., an]
   */
  private polyEval(coeffs: number[], x: number): number {
    let result = 0;
    for (let i = 0; i < coeffs.length; i++) {
      result += coeffs[i] * (x ** i);
    }
    return result;
  }

  private evalExpr(node: ExprNode): number | string | number[] {
    switch (node.type) {
      case "NumberLiteral":
        return node.value;
      case "StringLiteral":
        return this.interpolateString(node.value);
      case "VariableRef": {
        const name = node.name;
        // Interpolation tokens: 'varName$' wrapped in quotes from lexer
        if (name.startsWith("'") && name.endsWith("'")) {
          const inner = name.slice(1, -1);
          const val = this.getVar(inner);
          if (val !== undefined) return val;
          return "";
        }
        // Special string constants
        if (name === "tab$") return "\t";
        if (name === "newline$") return "\n";
        if (name === "praatVersion") return 6;
        if (name === "praatVersion$") return "6.0.0";
        if (name === "macintosh" || name === "windows" || name === "unix") return 0;
        if (name === "undefined") return NaN;
        const val = this.getVar(name);
        if (val !== undefined) return val;
        // Try as procName.varName (already stored)
        if (name.includes(".")) {
          const stored = this.variables.get(name);
          if (stored !== undefined) return stored;
        }
        // String variables default to empty
        if (name.endsWith("$")) return "";
        // Dot-prefixed or proc.var defaults to 0
        if (name.startsWith(".") || name.includes(".")) return 0;
        throw new RuntimeError(`Undefined variable: ${name}`, 0);
      }
      case "BinaryExpr":
        return this.evalBinary(node);
      case "UnaryExpr": {
        const operand = this.evalExpr(node.operand);
        if (node.op === "-") return -(operand as number);
        if (node.op === "not") return this.isTruthy(operand) ? 0 : 1;
        return operand;
      }
      case "FunctionCall":
        return this.evalFunctionCall(node);
      case "IndexExpr":
        return this.evalIndex(node);
    }
  }

  private evalIndex(node: IndexExpr): number | string {
    const obj = this.evalExpr(node.object);
    const idx = this.evalExpr(node.index) as number;
    if (Array.isArray(obj)) {
      return obj[Math.round(idx) - 1] ?? 0; // 1-based
    }
    return 0;
  }

  private evalBinary(node: { op: string; left: ExprNode; right: ExprNode }): number | string {
    const left = this.evalExpr(node.left);
    const right = this.evalExpr(node.right);

    // String concatenation
    if (node.op === "+" && (typeof left === "string" || typeof right === "string")) {
      return String(left) + String(right);
    }

    const l = left as number;
    const r = right as number;

    switch (node.op) {
      case "+": return l + r;
      case "-": return l - r;
      case "*": return l * r;
      case "/": return r === 0 ? 0 : l / r;
      case "^": return Math.pow(l, r);
      case "mod": return r === 0 ? 0 : l % r;
      case "<": return l < r ? 1 : 0;
      case ">": return l > r ? 1 : 0;
      case "<=": return l <= r ? 1 : 0;
      case ">=": return l >= r ? 1 : 0;
      case "==": return left === right ? 1 : 0;
      case "!=": return left !== right ? 1 : 0;
      case "<>": return left !== right ? 1 : 0;
      case "and": return (this.isTruthy(left) && this.isTruthy(right)) ? 1 : 0;
      case "or": return (this.isTruthy(left) || this.isTruthy(right)) ? 1 : 0;
      default: return 0;
    }
  }

  private evalFunctionCall(node: { name: string; args: ExprNode[] }): number | string | number[] {
    const name = node.name;
    const args = node.args.map((a) => this.evalExpr(a));

    // Vector/Array functions
    if (name === "zero#") {
      const n = Number(args[0]) || 0;
      return new Array(Math.max(0, Math.round(n))).fill(0);
    }
    if (name === "sum") {
      const arr = args[0];
      if (Array.isArray(arr)) return arr.reduce((s, v) => s + v, 0);
      return Number(arr) || 0;
    }
    if (name === "size") {
      const arr = args[0];
      if (Array.isArray(arr)) return arr.length;
      return 0;
    }

    // String functions
    if (name === "length" || name === "length$") return String(args[0]).length;
    if (name === "left$") return String(args[0]).slice(0, Number(args[1]));
    if (name === "right$") return String(args[0]).slice(-Number(args[1]));
    if (name === "mid$") return String(args[0]).slice(Number(args[1]) - 1, Number(args[1]) - 1 + Number(args[2]));
    if (name === "number") return Number(args[0]) || 0;
    if (name === "string$") return String(args[0]);
    if (name === "fixed$") return (Number(args[0])).toFixed(Number(args[1]));
    if (name === "percent$") return (Number(args[0]) * 100).toFixed(Number(args[1])) + "%";
    if (name === "index") return String(args[0]).indexOf(String(args[1])) + 1;
    if (name === "rindex") return String(args[0]).lastIndexOf(String(args[1])) + 1;
    if (name === "startsWith") return String(args[0]).startsWith(String(args[1])) ? 1 : 0;
    if (name === "endsWith") return String(args[0]).endsWith(String(args[1])) ? 1 : 0;
    if (name === "replace$") {
      const s = String(args[0]);
      const find = String(args[1]);
      const repl = String(args[2]);
      const count = Number(args[3] ?? 0);
      if (count === 0) return s.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), repl);
      let result = s;
      for (let i = 0; i < count; i++) result = result.replace(find, repl);
      return result;
    }
    if (name === "replace_regex$") {
      try {
        return String(args[0]).replace(new RegExp(String(args[1]), "g"), String(args[2]));
      } catch { return String(args[0]); }
    }

    if (name === "extractNumber") {
      const s = String(args[0]);
      const pattern = String(args[1]);
      const idx = s.indexOf(pattern);
      if (idx < 0) return NaN;
      const after = s.slice(idx + pattern.length).trim();
      const match = after.match(/^-?[\d.]+([eE][+-]?\d+)?/);
      return match ? parseFloat(match[0]) : NaN;
    }

    if (name === "extractWord$") {
      const s = String(args[0]);
      const pattern = String(args[1]);
      const idx = s.indexOf(pattern);
      if (idx < 0) return "";
      const after = s.slice(idx + pattern.length).trim();
      const match = after.match(/^\S+/);
      return match ? match[0] : "";
    }

    if (name === "extractLine$") {
      const s = String(args[0]);
      const pattern = String(args[1]);
      const idx = s.indexOf(pattern);
      if (idx < 0) return "";
      const after = s.slice(idx + pattern.length);
      const nl = after.indexOf("\n");
      return nl >= 0 ? after.slice(0, nl) : after;
    }

    // selected / selected$
    if (name === "selected") {
      // selected("Type") → returns ID of selected object of that type
      const type = String(args[0] ?? "");
      if (this.selectedObject && (type === "" || this.selectedObject.type === type)) {
        return this.selectedObject.id;
      }
      // Search
      const obj = this.objects.find(o => o.type === type);
      return obj ? obj.id : 0;
    }
    if (name === "selected$") {
      const type = String(args[0] ?? "");
      if (this.selectedObject && (type === "" || this.selectedObject.type === type)) {
        return this.selectedObject.name;
      }
      return "";
    }

    if (name === "numberOfSelected") {
      // In our simple model, always 1 or 0
      const type = String(args[0] ?? "");
      if (type === "" && this.selectedObject) return 1;
      if (this.selectedObject?.type === type) return 1;
      return 0;
    }

    if (name === "do" || name === "do$") {
      // do("command", args...) — execute a command and return result
      // For now just return 0 / ""
      return name === "do$" ? "" : 0;
    }

    // Math functions
    const mathFn = this.mathFunctions[node.name];
    if (mathFn) return mathFn(args.map(Number));

    // undefined function → 0
    return 0;
  }

  private evalNumeric(node: ExprNode, line: number): number {
    const val = this.evalExpr(node);
    if (typeof val === "string") throw new RuntimeError(`Expected number, got string`, line);
    if (Array.isArray(val)) throw new RuntimeError(`Expected number, got array`, line);
    return val;
  }

  private isTruthy(val: number | string | number[]): boolean {
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "string") return val.length > 0;
    return val !== 0 && !isNaN(val);
  }
}

// Convenience function
export function runPraatScript(source: string, audio?: { samples: Float32Array; sampleRate: number }): InterpreterResult {
  const interpreter = new Interpreter();
  return interpreter.execute(source, audio);
}
