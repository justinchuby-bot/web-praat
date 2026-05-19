/**
 * JavaScript script runner — executes user JS in a sandboxed Function scope.
 * The user code receives a `praat` API object but cannot access window/document/fetch.
 */

import { createPraatApi, JsApiContext, JsApiResult } from './jsApi';

export interface JsRunnerResult {
  output: string;
  errors: Array<{ message: string }>;
}

export function runJavaScript(
  code: string,
  context: JsApiContext
): JsRunnerResult {
  const result: JsApiResult = { logs: [], errors: [] };
  const api = createPraatApi(context, result);

  try {
    // Wrap user code in a with(proxy) to block global access,
    // but since `with` is banned in strict mode, we use a non-strict wrapper
    // that creates a strict inner scope for the user code.
    
    // Block dangerous globals by shadowing them as parameters set to undefined
    // We avoid 'eval' and 'arguments' as param names (strict mode restriction).
    const blockedParams = [
      'window', 'document', 'fetch', 'XMLHttpRequest', 'importScripts',
      'globalThis', 'self', 'top', 'parent', 'frames',
      'localStorage', 'sessionStorage', 'indexedDB', 'WebSocket',
      'Worker', 'SharedWorker', 'ServiceWorker',
    ];

    // The outer function is NOT strict (so we can use param shadowing freely).
    // User code runs inside a nested strict IIFE.
    const wrappedCode = `
var _eval = undefined;
var _Function = undefined;
return (function(${blockedParams.join(', ')}) {
"use strict";
${code}
})();`;

    const fn = new Function('praat', wrappedCode);
    fn(api);
  } catch (e: unknown) {
    if (e instanceof SyntaxError) {
      result.errors.push({ message: `SyntaxError: ${e.message}` });
    } else if (e instanceof Error) {
      result.errors.push({ message: `${e.name}: ${e.message}` });
    } else {
      result.errors.push({ message: String(e) });
    }
  }

  return {
    output: result.logs.join('\n'),
    errors: result.errors,
  };
}
