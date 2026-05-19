/**
 * TextMate grammar for Praat Script syntax highlighting via Shiki.
 */
import type { LanguageRegistration } from "shiki";

export const praatScriptGrammar: LanguageRegistration = {
  name: "praat",
  scopeName: "source.praat",
  patterns: [
    { include: "#comment" },
    { include: "#string" },
    { include: "#number" },
    { include: "#keyword" },
    { include: "#builtin" },
    { include: "#operator" },
    { include: "#variable" },
  ],
  repository: {
    comment: {
      patterns: [
        {
          name: "comment.line.number-sign.praat",
          match: "#.*$",
        },
        {
          name: "comment.line.semicolon.praat",
          match: ";.*$",
        },
      ],
    },
    string: {
      patterns: [
        {
          name: "string.quoted.double.praat",
          begin: '"',
          end: '"',
          patterns: [
            {
              name: "constant.character.escape.praat",
              match: '""',
            },
          ],
        },
      ],
    },
    number: {
      patterns: [
        {
          name: "constant.numeric.praat",
          match: "\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b",
        },
      ],
    },
    keyword: {
      patterns: [
        {
          name: "keyword.control.praat",
          match:
            "\\b(for|endfor|from|to|if|then|else|elsif|elif|endif|while|endwhile|repeat|until|procedure|endproc|call|assert|exit|select|plus|minus|Remove)\\b",
        },
        {
          name: "keyword.other.praat",
          match: "\\b(and|or|not|mod|div)\\b",
        },
      ],
    },
    builtin: {
      patterns: [
        {
          name: "support.function.praat",
          match:
            "\\b(appendInfoLine|appendInfo|writeInfoLine|writeInfo|clearinfo|pauseScript|beginPause|endPause|comment|natural|positive|real|word|sentence|text|boolean|choice|optionMenu|option)\\b",
        },
        {
          name: "support.function.action.praat",
          match:
            "\\b(To Pitch|To Formant \\(burg\\)|To Intensity|To Spectrogram|To Harmonicity \\(cc\\)|To PointProcess \\(periodic, cc\\)|Get mean|Get minimum|Get maximum|Get value at time|Get number of|Create|Open|Read|Save|Write|Play|Draw|Paint|Edit|View & Edit|Copy|Rename)\\b",
        },
        {
          name: "support.function.math.praat",
          match:
            "\\b(abs|round|floor|ceiling|sqrt|sin|cos|tan|arcsin|arccos|arctan|arctan2|exp|ln|log2|log10|min|max|randomUniform|randomInteger|randomGauss|fixed\\$|left\\$|right\\$|mid\\$|replace\\$|length|index|rindex|number|string\\$)\\b",
        },
      ],
    },
    operator: {
      patterns: [
        {
          name: "keyword.operator.praat",
          match: "(=|<>|<|>|<=|>=|\\+|-|\\*|/|\\^|:)",
        },
      ],
    },
    variable: {
      patterns: [
        {
          name: "variable.other.praat",
          match: "\\b[a-zA-Z_][a-zA-Z0-9_]*(\\$|#)?\\b",
        },
      ],
    },
  },
};
