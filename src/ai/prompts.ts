/**
 * AI prompt template system for building Kubernetes failure explanation prompts.
 * Supports language selection and analyzer-specific prompt overrides.
 */

/** Options for building an AI prompt. */
export interface PromptOptions {
  /** The Kubernetes failure or error text to explain. */
  failureText: string;
  /** Target language for the AI response. */
  language: string;
  /** Optional analyzer name to select a specific prompt template. */
  analyzerName?: string;
}

/**
 * Builds the default prompt asking for a concise root cause and fix.
 * @param options Prompt construction parameters.
 * @returns Formatted prompt string.
 */
export function buildDefaultPrompt(options: PromptOptions): string {
  return [
    `Simplify the following Kubernetes error message and provide a solution.`,
    `Respond in ${options.language}.`,
    `Provide the most likely root cause and a recommended fix.`,
    `Do not invent or assume any cluster facts not present in the error.`,
    `Be concise.`,
    ``,
    `Error: ${options.failureText}`,
  ].join('\n');
}

/**
 * Extensible map of analyzer-specific prompt builders.
 * Falls back to default if no analyzer-specific template is registered.
 */
const ANALYZER_PROMPT_MAP: Record<string, (options: PromptOptions) => string> = {};

/**
 * Builds an AI prompt for the given failure text, selecting an analyzer-specific
 * template if one is registered, otherwise falling back to the default template.
 * @param options Prompt construction parameters.
 * @returns Formatted prompt string ready for AI consumption.
 */
export function buildPrompt(options: PromptOptions): string {
  const builder = options.analyzerName
    ? ANALYZER_PROMPT_MAP[options.analyzerName]
    : undefined;
  return builder ? builder(options) : buildDefaultPrompt(options);
}
