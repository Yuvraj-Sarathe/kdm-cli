import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listPods, readPodLog } from '../kubernetes/resources';

/** Error patterns to search for in container logs. */
const ERROR_PATTERNS = [
  /\bERROR\b/i,
  /\bFATAL\b/i,
  /\bPANIC\b/i,
  /\bOOMKilled\b/i,
  /\bException\b/,
  /\bSegmentation fault\b/i,
];

/**
 * Checks if a single log line matches any known error patterns.
 * @param line The log line to check.
 * @returns True if the line contains an error pattern.
 */
const isErrorLine = (line: string): boolean =>
  ERROR_PATTERNS.some((pattern) => pattern.test(line));

/**
 * Scans log text for error pattern matches, returning the first few matches as failures.
 * @param logText Raw log output.
 * @param containerName Container name for context.
 * @returns Array of failures found.
 */
const scanLogForErrors = (logText: string, containerName: string): Failure[] => {
  const lines = logText.split('\n').filter(isErrorLine);
  if (lines.length === 0) return [];
  const sample = lines.slice(0, 3);
  return sample.map((line) => ({
    text: `Container ${containerName} log error: ${line.trim().slice(0, 200)}`,
  }));
};

/**
 * Analyzer implementation that scans Pod container logs for error patterns.
 * Only analyzes pods that are in a non-healthy state.
 */
export const LogAnalyzer: Analyzer = {
  name: 'Logs',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const pods = await listPods(context);
    const results: AnalyzerResult[] = [];

    for (const pod of pods) {
      const isUnhealthy = pod.status?.phase === 'Failed' ||
        pod.status?.containerStatuses?.some((cs) => !cs.ready);
      if (!isUnhealthy) continue;

      const allErrors: Failure[] = [];
      for (const container of pod.spec?.containers ?? []) {
        const log = await readPodLog(
          pod.metadata?.name ?? '',
          pod.metadata?.namespace ?? 'default',
          container.name,
          context,
        );
        allErrors.push(...scanLogForErrors(log, container.name));
      }

      if (allErrors.length > 0) {
        results.push({
          kind: 'Log',
          name: pod.metadata?.name ?? 'unknown-pod',
          namespace: pod.metadata?.namespace ?? 'default',
          errors: allErrors,
        });
      }
    }
    return results;
  },
};
