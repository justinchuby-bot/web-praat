/**
 * Plugin system types for Web-Praat.
 * Plugins are .praat scripts that integrate with the analysis engine.
 */

export interface PluginParameter {
  name: string;
  label: string;
  type: 'number' | 'choice' | 'boolean';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // for 'choice' type
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: 'formant' | 'pitch' | 'voice' | 'rhythm' | 'other';
  parameters: PluginParameter[];
  /** The Praat Script source */
  script: string;
}

export interface PluginResult {
  output: string;
  data?: Record<string, number[]>;
  errors?: string[];
}
