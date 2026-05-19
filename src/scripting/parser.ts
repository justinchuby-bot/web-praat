// Praat Script Parser - Recursive Descent

import { Token, TokenType } from "./lexer";

export type ASTNode =
  | AssignmentNode
  | ForNode
  | WhileNode
  | IfNode
  | CallNode
  | ProcedureNode
  | ExpressionStatement;

export interface AssignmentNode {
  type: "Assignment";
  name: string;
  value: ExprNode;
  line: number;
}

export interface ForNode {
  type: "For";
  variable: string;
  from: ExprNode;
  to: ExprNode;
  body: ASTNode[];
  line: number;
}

export interface WhileNode {
  type: "While";
  condition: ExprNode;
  body: ASTNode[];
  line: number;
}

export interface IfNode {
  type: "If";
  condition: ExprNode;
  thenBody: ASTNode[];
  elsifClauses: { condition: ExprNode; body: ASTNode[] }[];
  elseBody: ASTNode[];
  line: number;
}

export interface CallNode {
  type: "Call";
  name: string;
  args: ExprNode[];
  line: number;
}

export interface ProcedureNode {
  type: "Procedure";
  name: string;
  params: string[];
  body: ASTNode[];
  line: number;
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: ExprNode;
  line: number;
}

export type ExprNode =
  | NumberLiteral
  | StringLiteral
  | VariableRef
  | BinaryExpr
  | UnaryExpr
  | FunctionCall;

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
}

export interface VariableRef {
  type: "VariableRef";
  name: string;
}

export interface BinaryExpr {
  type: "BinaryExpr";
  op: string;
  left: ExprNode;
  right: ExprNode;
}

export interface UnaryExpr {
  type: "UnaryExpr";
  op: string;
  operand: ExprNode;
}

export interface FunctionCall {
  type: "FunctionCall";
  name: string;
  args: ExprNode[];
}

export class ParseError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
    this.line = line;
  }
}

export function parse(tokens: Token[]): ASTNode[] {
  let pos = 0;

  function current(): Token {
    return tokens[pos] ?? { type: TokenType.EOF, value: "", line: 0, column: 0 };
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function skipNewlines() {
    while (current().type === TokenType.Newline) advance();
  }

  function expectNewlineOrEOF() {
    const t = current();
    if (t.type === TokenType.Newline || t.type === TokenType.EOF) {
      if (t.type === TokenType.Newline) advance();
    }
  }

  function parseProgram(): ASTNode[] {
    const stmts: ASTNode[] = [];
    skipNewlines();
    while (current().type !== TokenType.EOF) {
      const stmt = parseStatement();
      if (stmt) stmts.push(stmt);
      skipNewlines();
    }
    return stmts;
  }

  function parseStatement(): ASTNode | null {
    const t = current();

    if (t.type === TokenType.For) return parseFor();
    if (t.type === TokenType.While) return parseWhile();
    if (t.type === TokenType.If) return parseIf();
    if (t.type === TokenType.Procedure) return parseProcedure();
    if (t.type === TokenType.Call) return parseCall();

    // Check for assignment: identifier = expr
    if (t.type === TokenType.Identifier && pos + 1 < tokens.length && tokens[pos + 1].type === TokenType.Equals) {
      return parseAssignment();
    }

    // Command-style call: word followed by colon or args
    // e.g. "appendInfoLine: ..." or "select Sound hello"
    // Also handle keywords that start commands (To, From, etc.)
    if (t.type === TokenType.Identifier || t.type === TokenType.To || t.type === TokenType.From) {
      return parseCommandCall();
    }

    // Skip unknown
    advance();
    expectNewlineOrEOF();
    return null;
  }

  function parseAssignment(): AssignmentNode {
    const nameToken = advance(); // identifier
    advance(); // =
    const value = parseExpression();
    expectNewlineOrEOF();
    return { type: "Assignment", name: nameToken.value, value, line: nameToken.line };
  }

  function parseFor(): ForNode {
    const startToken = advance(); // for
    const varToken = advance(); // variable
    if (current().type === TokenType.From) advance(); // optional 'from'
    const from = parseExpression();
    if (current().type === TokenType.To) advance(); // 'to'
    const to = parseExpression();
    expectNewlineOrEOF();

    const body: ASTNode[] = [];
    skipNewlines();
    while (current().type !== TokenType.EndFor && current().type !== TokenType.EOF) {
      const stmt = parseStatement();
      if (stmt) body.push(stmt);
      skipNewlines();
    }
    if (current().type === TokenType.EndFor) advance();
    expectNewlineOrEOF();
    return { type: "For", variable: varToken.value, from, to, body, line: startToken.line };
  }

  function parseWhile(): WhileNode {
    const startToken = advance(); // while
    const condition = parseExpression();
    expectNewlineOrEOF();

    const body: ASTNode[] = [];
    skipNewlines();
    while (current().type !== TokenType.EndWhile && current().type !== TokenType.EOF) {
      const stmt = parseStatement();
      if (stmt) body.push(stmt);
      skipNewlines();
    }
    if (current().type === TokenType.EndWhile) advance();
    expectNewlineOrEOF();
    return { type: "While", condition, body, line: startToken.line };
  }

  function parseIf(): IfNode {
    const startToken = advance(); // if
    const condition = parseExpression();
    if (current().type === TokenType.Then) advance();
    expectNewlineOrEOF();

    const thenBody: ASTNode[] = [];
    const elsifClauses: { condition: ExprNode; body: ASTNode[] }[] = [];
    let elseBody: ASTNode[] = [];

    skipNewlines();
    while (
      current().type !== TokenType.Else &&
      current().type !== TokenType.ElsIf &&
      current().type !== TokenType.EndIf &&
      current().type !== TokenType.EOF
    ) {
      const stmt = parseStatement();
      if (stmt) thenBody.push(stmt);
      skipNewlines();
    }

    while (current().type === TokenType.ElsIf) {
      advance();
      const elsifCond = parseExpression();
      if (current().type === TokenType.Then) advance();
      expectNewlineOrEOF();
      const elsifBody: ASTNode[] = [];
      skipNewlines();
      while (
        current().type !== TokenType.Else &&
        current().type !== TokenType.ElsIf &&
        current().type !== TokenType.EndIf &&
        current().type !== TokenType.EOF
      ) {
        const stmt = parseStatement();
        if (stmt) elsifBody.push(stmt);
        skipNewlines();
      }
      elsifClauses.push({ condition: elsifCond, body: elsifBody });
    }

    if (current().type === TokenType.Else) {
      advance();
      expectNewlineOrEOF();
      skipNewlines();
      while (current().type !== TokenType.EndIf && current().type !== TokenType.EOF) {
        const stmt = parseStatement();
        if (stmt) elseBody.push(stmt);
        skipNewlines();
      }
    }

    if (current().type === TokenType.EndIf) advance();
    expectNewlineOrEOF();
    return { type: "If", condition, thenBody, elsifClauses, elseBody, line: startToken.line };
  }

  function parseProcedure(): ProcedureNode {
    const startToken = advance(); // procedure
    const nameToken = advance();
    const params: string[] = [];
    // optional params in parens or colon-separated
    if (current().type === TokenType.LeftParen) {
      advance();
      while (current().type !== TokenType.RightParen && current().type !== TokenType.EOF) {
        if (current().type === TokenType.Identifier) params.push(advance().value);
        if (current().type === TokenType.Comma) advance();
      }
      if (current().type === TokenType.RightParen) advance();
    } else if (current().type === TokenType.Colon) {
      advance();
      while (current().type === TokenType.Identifier) {
        params.push(advance().value);
        if (current().type === TokenType.Comma) advance();
      }
    }
    expectNewlineOrEOF();

    const body: ASTNode[] = [];
    skipNewlines();
    while (current().type !== TokenType.EndProc && current().type !== TokenType.EOF) {
      const stmt = parseStatement();
      if (stmt) body.push(stmt);
      skipNewlines();
    }
    if (current().type === TokenType.EndProc) advance();
    expectNewlineOrEOF();
    return { type: "Procedure", name: nameToken.value, params, body, line: startToken.line };
  }

  function parseCall(): CallNode {
    const startToken = advance(); // call
    const nameToken = advance();
    const args: ExprNode[] = [];
    if (current().type === TokenType.Colon) {
      advance();
      args.push(...parseArgList());
    } else {
      // space-separated args until newline
      while (current().type !== TokenType.Newline && current().type !== TokenType.EOF) {
        args.push(parseExpression());
        if (current().type === TokenType.Comma) advance();
      }
    }
    expectNewlineOrEOF();
    return { type: "Call", name: nameToken.value, args, line: startToken.line };
  }

  function parseCommandCall(): CallNode {
    const startToken = current();
    // Collect the command name (may be multi-word before colon)
    let name = advance().value;

    // Read until colon or newline to build multi-word command name
    while (
      current().type !== TokenType.Colon &&
      current().type !== TokenType.Newline &&
      current().type !== TokenType.EOF &&
      current().type !== TokenType.Equals
    ) {
      name += " " + advance().value;
    }

    const args: ExprNode[] = [];
    if (current().type === TokenType.Colon) {
      advance();
      args.push(...parseArgList());
    }
    expectNewlineOrEOF();
    return { type: "Call", name: name.trim(), args, line: startToken.line };
  }

  function parseArgList(): ExprNode[] {
    const args: ExprNode[] = [];
    if (current().type === TokenType.Newline || current().type === TokenType.EOF) return args;
    args.push(parseExpression());
    while (current().type === TokenType.Comma) {
      advance();
      args.push(parseExpression());
    }
    return args;
  }

  function parseExpression(): ExprNode {
    return parseOr();
  }

  function parseOr(): ExprNode {
    let left = parseAnd();
    while (current().type === TokenType.Or) {
      advance();
      left = { type: "BinaryExpr", op: "or", left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd(): ExprNode {
    let left = parseEquality();
    while (current().type === TokenType.And) {
      advance();
      left = { type: "BinaryExpr", op: "and", left, right: parseEquality() };
    }
    return left;
  }

  function parseEquality(): ExprNode {
    let left = parseComparison();
    while (current().type === TokenType.EqualEqual || current().type === TokenType.NotEqual) {
      const op = advance().value;
      left = { type: "BinaryExpr", op, left, right: parseComparison() };
    }
    return left;
  }

  function parseComparison(): ExprNode {
    let left = parseAddSub();
    while (
      current().type === TokenType.Less ||
      current().type === TokenType.Greater ||
      current().type === TokenType.LessEqual ||
      current().type === TokenType.GreaterEqual
    ) {
      const op = advance().value;
      left = { type: "BinaryExpr", op, left, right: parseAddSub() };
    }
    return left;
  }

  function parseAddSub(): ExprNode {
    let left = parseMulDiv();
    while (current().type === TokenType.Plus || current().type === TokenType.Minus) {
      const op = advance().value;
      left = { type: "BinaryExpr", op, left, right: parseMulDiv() };
    }
    return left;
  }

  function parseMulDiv(): ExprNode {
    let left = parseUnary();
    while (current().type === TokenType.Star || current().type === TokenType.Slash) {
      const op = advance().value;
      left = { type: "BinaryExpr", op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary(): ExprNode {
    if (current().type === TokenType.Minus) {
      advance();
      return { type: "UnaryExpr", op: "-", operand: parseUnary() };
    }
    if (current().type === TokenType.Not) {
      advance();
      return { type: "UnaryExpr", op: "not", operand: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary(): ExprNode {
    const t = current();

    if (t.type === TokenType.Number) {
      advance();
      return { type: "NumberLiteral", value: parseFloat(t.value) };
    }

    if (t.type === TokenType.String) {
      advance();
      return { type: "StringLiteral", value: t.value };
    }

    if (t.type === TokenType.LeftParen) {
      advance();
      const expr = parseExpression();
      if (current().type === TokenType.RightParen) advance();
      return expr;
    }

    if (t.type === TokenType.Identifier) {
      advance();
      // function call with parens
      if (current().type === TokenType.LeftParen) {
        advance();
        const args: ExprNode[] = [];
        if (current().type !== TokenType.RightParen) {
          args.push(parseExpression());
          while (current().type === TokenType.Comma) {
            advance();
            args.push(parseExpression());
          }
        }
        if (current().type === TokenType.RightParen) advance();
        return { type: "FunctionCall", name: t.value, args };
      }
      return { type: "VariableRef", name: t.value };
    }

    // Fallback
    advance();
    throw new ParseError(`Unexpected token: ${t.value}`, t.line);
  }

  return parseProgram();
}
