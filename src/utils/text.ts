/**
 * Text anonymization utilities for redacting sensitive Kubernetes resource names
 * and namespaces from prompts before sending them to AI providers.
 */

/** Mapping between original values and their masked placeholders. */
export interface AnonymizeMapping {
  original: string;
  placeholder: string;
}

/** Result of an anonymization pass containing the masked text and the mapping. */
export interface AnonymizeResult {
  text: string;
  mapping: AnonymizeMapping[];
}

/**
 * Pattern matching common Kubernetes resource name formats
 * (e.g. my-app-6d8f7b-abc12, kube-system, redis-master-0).
 */
const K8S_NAME_PATTERN = /\b([a-z][\da-z]*(?:-[\da-z]+){1,})\b/g;

/**
 * Replaces Kubernetes resource names and namespaces with stable masked placeholders.
 * Each unique name maps to MASKED_0, MASKED_1, etc.
 * @param text The raw text containing sensitive resource names.
 * @returns The anonymized text and the reversible mapping.
 */
export function anonymize(text: string): AnonymizeResult {
  const seen = new Map<string, string>();
  let counter = 0;

  const masked = text.replace(K8S_NAME_PATTERN, (match) => {
    const existing = seen.get(match);
    if (existing) return existing;
    const placeholder = `MASKED_${counter++}`;
    seen.set(match, placeholder);
    return placeholder;
  });

  const mapping = Array.from(seen.entries()).map(([original, placeholder]) => ({
    original,
    placeholder,
  }));

  return { text: masked, mapping };
}

/**
 * Restores original names in AI response text by replacing masked placeholders.
 * @param text The AI response text containing masked placeholders.
 * @param mapping The mapping from anonymize() to reverse.
 * @returns Text with original names restored.
 */
export function deanonymize(text: string, mapping: AnonymizeMapping[]): string {
  let result = text;
  for (const entry of mapping) {
    result = result.split(entry.placeholder).join(entry.original);
  }
  return result;
}
