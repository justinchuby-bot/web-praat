/**
 * CodeMirror 6 language support for Praat Script.
 */
import { StreamLanguage, type StreamParser } from "@codemirror/language";

const keywords = new Set([
  "for", "endfor", "from", "to", "if", "then", "else", "elsif", "elif",
  "endif", "while", "endwhile", "repeat", "until", "procedure", "endproc",
  "call", "assert", "exit", "select", "plus", "minus", "Remove",
  "and", "or", "not", "do", "end",
]);

const builtins = new Set([
  "appendInfoLine", "appendInfo", "writeInfoLine", "writeInfo",
  "appendFileLine", "appendFile", "writeFileLine", "writeFile",
  "pauseScript", "runScript", "include", "form", "endform",
  "comment", "positive", "real", "integer", "natural", "word",
  "sentence", "text", "boolean", "choice", "option",
  "beginPause", "endPause", "clearinfo",
  "selected", "numberOfSelected", "selectObject", "removeObject",
  "Create", "Read", "Open", "Save", "View", "Play", "Draw",
  "Get", "Set", "To", "Down", "Copy",
]);

const praatParser: StreamParser<{ inString: boolean }> = {
  startState() {
    return { inString: false };
  },
  token(stream, state) {
    if (state.inString) {
      if (stream.match('""')) return "string";
      if (stream.next() === '"') {
        state.inString = false;
        return "string";
      }
      stream.match(/[^"]+/);
      return "string";
    }

    // Comments
    if (stream.match(/^#.*/)) return "comment";
    if (stream.match(/^;.*/)) return "comment";

    // Strings
    if (stream.match('"')) {
      state.inString = true;
      return "string";
    }

    // Numbers
    if (stream.match(/^\d+(\.\d+)?([eE][+-]?\d+)?/)) return "number";

    // Words (keywords, builtins, variables)
    if (stream.match(/^[a-zA-Z_]\w*\$?/)) {
      const word = stream.current();
      if (keywords.has(word)) return "keyword";
      if (builtins.has(word) || builtins.has(word.replace(/\$$/, ""))) return "builtin";
      if (word.endsWith("$")) return "variableName";
      return null;
    }

    // Operators
    if (stream.match(/^[+\-*/<>=!:,()[\]]/)) return "operator";

    stream.next();
    return null;
  },
};

export const praatLanguage = StreamLanguage.define(praatParser);
