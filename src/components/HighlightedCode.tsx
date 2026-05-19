/**
 * Shiki-powered syntax highlighting component for ScriptEditor.
 * Provides a transparent overlay that highlights code while the user types in a textarea beneath.
 */
import { useEffect, useState, useMemo } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { praatScriptGrammar } from "../scripting/praatGrammar";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [praatScriptGrammar, "javascript"],
    });
  }
  return highlighterPromise;
}

interface HighlightedCodeProps {
  code: string;
  language: "praat" | "javascript";
}

export function HighlightedCode({ code, language }: HighlightedCodeProps) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    getHighlighter().then(setHighlighter);
  }, []);

  const html = useMemo(() => {
    if (!highlighter) return null;
    return highlighter.codeToHtml(code, {
      lang: language === "praat" ? "praat" : "javascript",
      theme: "github-dark",
    });
  }, [highlighter, code, language]);

  if (!html) {
    // Fallback: plain text while loading
    return (
      <pre className="font-mono text-sm leading-5 text-gray-100 whitespace-pre-wrap break-words">
        {code || " "}
      </pre>
    );
  }

  return (
    <div
      className="shiki-highlight font-mono text-sm leading-5 whitespace-pre-wrap break-words [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
