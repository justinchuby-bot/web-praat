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
  Include = "include",
  Repeat = "repeat",
  Until = "until",

  // Operators
  Equals = "=",
  Plus = "+",
  Minus = "-",
  Star = "*",
  Slash = "/",
  Mod = "mod",
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
  LeftBracket = "[",
  RightBracket = "]",
  Comma = ",",
  Colon = ":",
  Dot = ".",
  At = "@",

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
  include: TokenType.Include,
  repeat: TokenType.Repeat,
  until: TokenType.Until,
  and: TokenType.And,
  or: TokenType.Or,
  not: TokenType.Not,
  mod: TokenType.Mod,
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

    // Comments: ; or line starting with #  
    // In Praat, # is comment only at start of token when not part of identifier
    if (ch === ";") {
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    // # as comment: only if previous non-whitespace on this line is not an identifier char
    // Simple heuristic: # is comment if preceded by space/start-of-line and not followed by identifier-forming chars immediately after a word with #
    if (ch === "#") {
      // Check if this could be part of a vector variable (e.g. after identifier)
      // If previous token on this line is an identifier that doesn't end with #, this is a comment
      const lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      if (lastToken && lastToken.line === startLine && lastToken.type === TokenType.Identifier && !lastToken.value.endsWith("#")) {
        // This is a comment
        while (pos < source.length && peek() !== "\n") advance();
        continue;
      }
      if (!lastToken || lastToken.type === TokenType.Newline || lastToken.line !== startLine) {
        // Start of line — comment
        while (pos < source.length && peek() !== "\n") advance();
        continue;
      }
      // Otherwise treat as comment (safe default)
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    // Strings
    if (ch === '"') {
      const quote = advance();
      let str = "";
      while (pos < source.length && peek() !== quote && peek() !== "\n") {
        str += advance();
      }
      if (peek() === quote) advance();
      tokens.push({ type: TokenType.String, value: str, line: startLine, column: startCol });
      continue;
    }

    // Single-quote strings — but in Praat, single quotes are variable interpolation 'var$'
    // We'll handle them as string literals for now to avoid breaking things
    if (ch === "'") {
      advance();
      let str = "";
      while (pos < source.length && peek() !== "'" && peek() !== "\n") {
        str += advance();
      }
      if (peek() === "'") advance();
      // Treat as interpolation marker - emit as special identifier
      tokens.push({ type: TokenType.Identifier, value: `'${str}'`, line: startLine, column: startCol });
      continue;
    }

    // Numbers
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (pos < source.length && ((peek() >= "0" && peek() <= "9") || peek() === ".")) {
        num += advance();
      }
      // Check for e/E notation
      if (peek() === "e" || peek() === "E") {
        num += advance();
        if (peek() === "+" || peek() === "-") num += advance();
        while (pos < source.length && peek() >= "0" && peek() <= "9") num += advance();
      }
      tokens.push({ type: TokenType.Number, value: num, line: startLine, column: startCol });
      continue;
    }

    // @ sign for procedure calls
    if (ch === "@") {
      advance();
      tokens.push({ type: TokenType.At, value: "@", line: startLine, column: startCol });
      continue;
    }

    // Dot-prefix variables (.varName) 
    if (ch === "." && pos + 1 < source.length && ((source[pos + 1] >= "a" && source[pos + 1] <= "z") || (source[pos + 1] >= "A" && source[pos + 1] <= "Z") || source[pos + 1] === "_")) {
      advance(); // skip .
      let id = ".";
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
      tokens.push({ type: TokenType.Identifier, value: id, line: startLine, column: startCol });
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
          peek() === "#" ||
          peek() === ".")
      ) {
        // Allow dot only if followed by letter (for proc.var access)
        if (peek() === ".") {
          if (pos + 1 < source.length && ((source[pos + 1] >= "a" && source[pos + 1] <= "z") || (source[pos + 1] >= "A" && source[pos + 1] <= "Z") || source[pos + 1] === "_")) {
            id += advance();
          } else {
            break;
          }
        } else {
          id += advance();
        }
      }
      const lower = id.toLowerCase();
      const kwType = KEYWORDS[lower];
      if (kwType && !id.endsWith("$") && !id.endsWith("#") && !id.includes(".")) {
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
    if (ch === "<" && source[pos + 1] === ">") {
      advance(); advance();
      tokens.push({ type: TokenType.NotEqual, value: "<>", line: startLine, column: startCol });
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
    if (ch === "." && source[pos + 1] === "." && source[pos + 2] === ".") {
      advance(); advance(); advance();
      // Ellipsis — used in old-style commands like "Remove column... name"
      tokens.push({ type: TokenType.Identifier, value: "...", line: startLine, column: startCol });
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
      "[": TokenType.LeftBracket,
      "]": TokenType.RightBracket,
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
