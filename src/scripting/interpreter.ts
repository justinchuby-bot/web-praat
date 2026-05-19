// Praat Script Interpreter

import { tokenize } from "./lexer";
import { parse, ASTNode, ExprNode, ParseError, CallNode } from "./parser";

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
  constructor() { super('exitScript'); }
}

export class Interpreter {
  private variables: Map<string, number | string> = new Map();
  private procedures: Map<string, { params: string[]; body: ASTNode[] }> = new Map();
  private objects: PraatObject[] = [];
  private selectedObject: PraatObject | null = null;
  private nextId = 1;
  private output = "";
  private maxIterations = 100000;

  private mathFunctions: Record<string, (args: number[]) => number> = {
    sqrt: (a) => Math.sqrt(a[0]),
    abs: (a) => Math.abs(a[0]),
    sin: (a) => Math.sin(a[0]),
    cos: (a) => Math.cos(a[0]),
    log: (a) => Math.log(a[0]),
    exp: (a) => Math.exp(a[0]),
    ln: (a) => Math.log(a[0]),
    floor: (a) => Math.floor(a[0]),
    ceiling: (a) => Math.ceil(a[0]),
    round: (a) => Math.round(a[0]),
    min: (a) => Math.min(a[0], a[1]),
    max: (a) => Math.max(a[0], a[1]),
    randomUniform: (a) => a[0] + Math.random() * (a[1] - a[0]),
    randomInteger: (a) => Math.floor(a[0] + Math.random() * (a[1] - a[0] + 1)),
  };

  execute(source: string): InterpreterResult {
    this.variables.clear();
    this.procedures.clear();
    this.objects = [];
    this.selectedObject = null;
    this.nextId = 1;
    this.output = "";

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
        // Normal script exit
      } else if (e instanceof ParseError || e instanceof RuntimeError) {
        errors.push({ line: e.line, message: e.message });
      } else {
        errors.push({ line: 0, message: String(e) });
      }
    }

    return { output: this.output, errors, objects: [...this.objects] };
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
        this.variables.set(node.name, val);
        break;
      }
      case "For": {
        const from = this.evalNumeric(node.from, node.line);
        const to = this.evalNumeric(node.to, node.line);
        let iterations = 0;
        for (let i = from; i <= to; i++) {
          if (++iterations > this.maxIterations) throw new RuntimeError("Too many iterations", node.line);
          this.variables.set(node.variable, i);
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
        break;
      }
      case "Procedure": {
        // Already collected in first pass
        break;
      }
      case "ExpressionStatement": {
        this.evalExpr(node.expression);
        break;
      }
    }
  }

  private executeCall(node: CallNode) {
    const name = node.name;
    const args = node.args.map((a) => this.evalExpr(a));

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

    if (nameLower === "exitscript") {
      throw new ExitScriptError();
    }

    if (nameLower === "pausescript") {
      // No-op in web environment
      return;
    }

    if (nameLower === "print" || nameLower === "printline") {
      this.output += args.map(String).join("") + (nameLower === "printline" ? "\n" : "");
      return;
    }

    if (nameLower === "select") {
      // select Type name
      const fullName = args.map(String).join(" ");
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

    if (name === "To Pitch") {
      if (!this.selectedObject) throw new RuntimeError("No object selected", node.line);
      const obj: PraatObject = {
        id: this.nextId++,
        type: "Pitch",
        name: this.selectedObject.name,
        data: {
          timestep: args[0] ?? 0,
          minPitch: args[1] ?? 75,
          maxPitch: args[2] ?? 600,
        },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name.startsWith("To Formant")) {
      if (!this.selectedObject) throw new RuntimeError("No object selected", node.line);
      const obj: PraatObject = {
        id: this.nextId++,
        type: "Formant",
        name: this.selectedObject.name,
        data: {
          timestep: args[0] ?? 0,
          maxFormant: args[1] ?? 5500,
          numFormants: args[2] ?? 5,
        },
      };
      this.objects.push(obj);
      this.selectedObject = obj;
      return;
    }

    if (name === "Get mean") {
      // Returns a numeric value
      this.variables.set("_lastResult", 150.0);
      return;
    }

    if (name === "Get value at time") {
      this.variables.set("_lastResult", 200.0);
      return;
    }

    // Check user-defined procedures
    const proc = this.procedures.get(name);
    if (proc) {
      const savedVars = new Map(this.variables);
      for (let i = 0; i < proc.params.length; i++) {
        this.variables.set(proc.params[i], args[i] ?? 0);
      }
      this.executeBlock(proc.body);
      // Restore only the params (simple scope)
      for (const p of proc.params) {
        if (savedVars.has(p)) {
          this.variables.set(p, savedVars.get(p)!);
        } else {
          this.variables.delete(p);
        }
      }
      return;
    }

    // Unknown command - just ignore for compatibility
  }

  private evalExpr(node: ExprNode): number | string {
    switch (node.type) {
      case "NumberLiteral":
        return node.value;
      case "StringLiteral":
        return node.value;
      case "VariableRef": {
        const name = node.name;
        // Special string constants
        if (name === "tab$") return "\t";
        if (name === "newline$") return "\n";
        const val = this.variables.get(name);
        if (val === undefined) {
          // String variables default to empty
          if (name.endsWith("$")) return "";
          throw new RuntimeError(`Undefined variable: ${name}`, 0);
        }
        return val;
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
    }
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
      case "mod": return r === 0 ? 0 : l % r;
      case "<": return l < r ? 1 : 0;
      case ">": return l > r ? 1 : 0;
      case "<=": return l <= r ? 1 : 0;
      case ">=": return l >= r ? 1 : 0;
      case "==": return left === right ? 1 : 0;
      case "!=": return left !== right ? 1 : 0;
      case "and": return (this.isTruthy(left) && this.isTruthy(right)) ? 1 : 0;
      case "or": return (this.isTruthy(left) || this.isTruthy(right)) ? 1 : 0;
      default: return 0;
    }
  }

  private evalFunctionCall(node: { name: string; args: ExprNode[] }): number | string {
    const args = node.args.map((a) => this.evalExpr(a));

    // String functions
    if (node.name === "length") return String(args[0]).length;
    if (node.name === "left$") return String(args[0]).slice(0, args[1] as number);
    if (node.name === "right$") return String(args[0]).slice(-(args[1] as number));
    if (node.name === "mid$") return String(args[0]).slice((args[1] as number) - 1, (args[1] as number) - 1 + (args[2] as number));
    if (node.name === "number") return Number(args[0]) || 0;
    if (node.name === "string$") return String(args[0]);
    if (node.name === "fixed$") return (args[0] as number).toFixed(args[1] as number);
    if (node.name === "index") return String(args[0]).indexOf(String(args[1])) + 1;
    if (node.name === "rindex") return String(args[0]).lastIndexOf(String(args[1])) + 1;
    if (node.name === "replace$") return String(args[0]).replace(new RegExp(String(args[1]), "g"), String(args[2]));

    // Math functions
    const mathFn = this.mathFunctions[node.name];
    if (mathFn) return mathFn(args.map(Number));

    // undefined function → 0
    return 0;
  }

  private evalNumeric(node: ExprNode, line: number): number {
    const val = this.evalExpr(node);
    if (typeof val === "string") throw new RuntimeError(`Expected number, got string`, line);
    return val;
  }

  private isTruthy(val: number | string): boolean {
    if (typeof val === "string") return val.length > 0;
    return val !== 0;
  }
}

// Convenience function
export function runPraatScript(source: string): InterpreterResult {
  const interpreter = new Interpreter();
  return interpreter.execute(source);
}
