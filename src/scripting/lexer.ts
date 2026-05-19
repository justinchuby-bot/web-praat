// Praat Script Lexer

export enum TokenType {
  // Literals
  Number = "Number",
  String = "String",
  Identifier = "Identifier",

  // Keywords
  For = "for",
  EndFor = "endfor",
  If = "if",
  Else = "else",
  ElsIf = "elsif",
  EndIf = "endif",
  While = "while",
  EndWhile = "endwhile",
  Procedure = "procedure",
  EndProc = "endproc",
  Call = "call",
  To = "to",
  From = "from",
  Then = "then",

  // Operators
  Equals = "=",
  Plus = "+",
  Minus = "-",
  Star = "*",
  Slash = "/",
  Less = "<",
  Greater = ">",
  EqualEqual = "==",
  NotEqual = "!=",
  LessEqual = "<=",
  GreaterEqual = ">=",
  And = "and",
  Or = "or",
  Not = "not",

  // Punctuation
  LeftParen = "(",
  RightParen = ")",
  Comma = ",",
  Colon = ":",
  Dot = ".",

  // Special
  Newline = "Newline",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS: Record<string, TokenType> = {
  for: TokenType.For,
  endfor: TokenType.EndFor,
  if: TokenType.If,
  else: TokenType.Else,
  elsif: TokenType.ElsIf,
  elif: TokenType.ElsIf,
  endif: TokenType.EndIf,
  while: TokenType.While,
  endwhile: TokenType.EndWhile,
  procedure: TokenType.Procedure,
  endproc: TokenType.EndProc,
  call: TokenType.Call,
  to: TokenType.To,
  from: TokenType.From,
  then: TokenType.Then,
  and: TokenType.And,
  or: TokenType.Or,
  not: TokenType.Not,
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(): string {
    return source[pos] ?? "\0";
  }

  function advance(): string {
    const ch = source[pos++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  while (pos < source.length) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Skip spaces/tabs (not newlines)
    if (ch === " " || ch === "\t" || ch === "\r") {
      advance();
      continue;
    }

    // Newline
    if (ch === "\n") {
      advance();
      tokens.push({ type: TokenType.Newline, value: "\n", line: startLine, column: startCol });
      continue;
    }

    // Comments: # or ;
    if (ch === "#" || ch === ";") {
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = advance();
      let str = "";
      while (pos < source.length && peek() !== quote && peek() !== "\n") {
        str += advance();
      }
      if (peek() === quote) advance();
      tokens.push({ type: TokenType.String, value: str, line: startLine, column: startCol });
      continue;
    }

    // Numbers
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (pos < source.length && ((peek() >= "0" && peek() <= "9") || peek() === ".")) {
        num += advance();
      }
      tokens.push({ type: TokenType.Number, value: num, line: startLine, column: startCol });
      continue;
    }

    // Identifiers and keywords
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let id = "";
      while (
        pos < source.length &&
        ((peek() >= "a" && peek() <= "z") ||
          (peek() >= "A" && peek() <= "Z") ||
          (peek() >= "0" && peek() <= "9") ||
          peek() === "_" ||
          peek() === "$" ||
          peek() === "#")
      ) {
        id += advance();
      }
      const lower = id.toLowerCase();
      const kwType = KEYWORDS[lower];
      if (kwType && !id.endsWith("$") && !id.endsWith("#")) {
        tokens.push({ type: kwType, value: id, line: startLine, column: startCol });
      } else {
        tokens.push({ type: TokenType.Identifier, value: id, line: startLine, column: startCol });
      }
      continue;
    }

    // Two-char operators
    if (ch === "=" && source[pos + 1] === "=") {
      advance(); advance();
      tokens.push({ type: TokenType.EqualEqual, value: "==", line: startLine, column: startCol });
      continue;
    }
    if (ch === "!" && source[pos + 1] === "=") {
      advance(); advance();
      tokens.push({ type: TokenType.NotEqual, value: "!=", line: startLine, column: startCol });
      continue;
    }
    if (ch === "<" && source[pos + 1] === "=") {
      advance(); advance();
      tokens.push({ type: TokenType.LessEqual, value: "<=", line: startLine, column: startCol });
      continue;
    }
    if (ch === ">" && source[pos + 1] === "=") {
      advance(); advance();
      tokens.push({ type: TokenType.GreaterEqual, value: ">=", line: startLine, column: startCol });
      continue;
    }

    // Single-char operators/punctuation
    const singleMap: Record<string, TokenType> = {
      "=": TokenType.Equals,
      "+": TokenType.Plus,
      "-": TokenType.Minus,
      "*": TokenType.Star,
      "/": TokenType.Slash,
      "<": TokenType.Less,
      ">": TokenType.Greater,
      "(": TokenType.LeftParen,
      ")": TokenType.RightParen,
      ",": TokenType.Comma,
      ":": TokenType.Colon,
      ".": TokenType.Dot,
    };

    if (singleMap[ch]) {
      advance();
      tokens.push({ type: singleMap[ch], value: ch, line: startLine, column: startCol });
      continue;
    }

    // Skip unknown chars
    advance();
  }

  tokens.push({ type: TokenType.EOF, value: "", line, column: col });
  return tokens;
}
