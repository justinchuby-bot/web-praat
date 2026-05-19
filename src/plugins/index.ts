/**
 * Plugin Manager — registry, parameter injection, and execution.
 */

import { PluginManifest, PluginResult, PluginParameter } from './types';
import { runPraatScript } from '../scripting';
import { fastTrackPlugin } from './fasttrack';
import { vowelSpacePlugin } from './vowelSpace';
import { jitterShimmerPlugin } from './jitterShimmer';

// Built-in plugins
const builtinPlugins: PluginManifest[] = [
  fastTrackPlugin,
  vowelSpacePlugin,
  jitterShimmerPlugin,
];

// User-loaded plugins (from .praat files)
let userPlugins: PluginManifest[] = [];

export function getPlugins(): PluginManifest[] {
  return [...builtinPlugins, ...userPlugins];
}

export function getPlugin(id: string): PluginManifest | undefined {
  return getPlugins().find(p => p.id === id);
}

/**
 * Run a plugin with given parameter values.
 * Injects parameters as variable assignments at the top of the script.
 */
export function runPlugin(
  plugin: PluginManifest,
  params: Record<string, number>
): PluginResult {
  // Inject parameters as Praat variable assignments
  const paramLines = plugin.parameters.map(p => {
    const value = params[p.name] ?? p.default;
    return `${p.name} = ${value}`;
  }).join('\n');

  const fullScript = paramLines + '\n\n' + plugin.script;

  const result = runPraatScript(fullScript);

  return {
    output: result.output,
    errors: result.errors.map(e => e.message),
  };
}

/**
 * Parse a .praat file into a PluginManifest.
 * Expects a header comment block with metadata:
 *   # Plugin: Name
 *   # Version: 1.0.0
 *   # Author: Name
 *   # Description: What it does
 *   # Category: formant|pitch|voice|rhythm|other
 *   # Param: name type default [min max step] "label"
 */
export function parsePluginFile(filename: string, source: string): PluginManifest | null {
  const lines = source.split('\n');
  const meta: Record<string, string> = {};
  const params: PluginParameter[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) break;

    const match = trimmed.match(/^#\s*(Plugin|Version|Author|Description|Category):\s*(.+)/i);
    if (match) {
      meta[match[1].toLowerCase()] = match[2].trim();
      continue;
    }

    const paramMatch = trimmed.match(
      /^#\s*Param:\s*(\w+)\s+(number|choice|boolean)\s+([\d.]+)(?:\s+([\d.]+)\s+([\d.]+)(?:\s+([\d.]+))?)?\s*"([^"]+)"/i
    );
    if (paramMatch) {
      params.push({
        name: paramMatch[1],
        type: paramMatch[2] as 'number' | 'choice' | 'boolean',
        default: parseFloat(paramMatch[3]),
        min: paramMatch[4] ? parseFloat(paramMatch[4]) : undefined,
        max: paramMatch[5] ? parseFloat(paramMatch[5]) : undefined,
        step: paramMatch[6] ? parseFloat(paramMatch[6]) : undefined,
        label: paramMatch[7],
      });
    }
  }

  if (!meta.plugin) return null;

  const id = filename.replace(/\.praat$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  return {
    id,
    name: meta.plugin,
    version: meta.version || '0.1.0',
    author: meta.author || 'Unknown',
    description: meta.description || '',
    category: (meta.category as PluginManifest['category']) || 'other',
    parameters: params,
    script: source,
  };
}

/**
 * Load a user plugin from file content.
 */
export function loadUserPlugin(filename: string, source: string): PluginManifest | null {
  const plugin = parsePluginFile(filename, source);
  if (plugin) {
    // Remove existing plugin with same id
    userPlugins = userPlugins.filter(p => p.id !== plugin.id);
    userPlugins.push(plugin);
  }
  return plugin;
}

/**
 * Remove a user plugin.
 */
export function removeUserPlugin(id: string): boolean {
  const len = userPlugins.length;
  userPlugins = userPlugins.filter(p => p.id !== id);
  return userPlugins.length < len;
}

export type { PluginManifest, PluginParameter, PluginResult } from './types';
