import { useState, useEffect } from "react";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { praatScriptGrammar } from "../scripting/praatGrammar";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-dark.mjs")],
      langs: [praatScriptGrammar, import("shiki/langs/javascript.mjs")],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  }
  return highlighterPromise;
}

interface HighlightedCodeProps {
  code: string;
  language: "praat" | "javascript";
}

export function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  if (!highlighter) {
    return (
      <pre className="font-mono text-sm leading-5 text-gray-100 whitespace-pre-wrap break-words">
        {code}
      </pre>
    );
  }

  const html = highlighter.codeToHtml(code, {
    lang: language,
    theme: "github-dark",
  });

  return (
    <div
      className="shiki-highlight font-mono text-sm leading-5 whitespace-pre-wrap break-words [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
