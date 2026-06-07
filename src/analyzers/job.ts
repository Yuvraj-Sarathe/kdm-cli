import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listJobs } from '../kubernetes/resources';

/**
 * Checks Job completion and failure status.
 * @param job The Job object.
 * @returns Array of failures found.
 */
const checkJobStatus = (job: k8s.V1Job): Failure[] => {
  const failures: Failure[] = [];
  const failed = job.status?.failed ?? 0;
  if (failed > 0) {
    failures.push({ text: `Job has ${failed} failed pod${failed === 1 ? '' : 's'}` });
  }
  return failures;
};

/**
 * Checks Job status conditions for failure reasons.
 * @param job The Job object.
 * @returns Array of failures found.
 */
const checkJobConditions = (job: k8s.V1Job): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of job.status?.conditions ?? []) {
    if (cond.type === 'Failed' && cond.status === 'True') {
      failures.push({
        text: `Job failed${cond.reason ? `: ${cond.reason}` : ''}${cond.message ? ` - ${cond.message}` : ''}`,
      });
    }
  }
  return failures;
};

/**
 * Checks if Job has exceeded its backoff limit.
 * @param job The Job object.
 * @returns Array of failures found.
 */
const checkJobBackoffLimit = (job: k8s.V1Job): Failure[] => {
  const backoffLimit = job.spec?.backoffLimit ?? 6;
  const failed = job.status?.failed ?? 0;
  if (failed >= backoffLimit) {
    return [{ text: `Job exceeded backoff limit (${failed}/${backoffLimit})` }];
  }
  return [];
};

/**
 * Analyzer implementation focused on Kubernetes Jobs.
 */
export const JobAnalyzer: Analyzer = {
  name: 'Job',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listJobs(context);
    return resources.flatMap((job) => {
      const errors = [...checkJobStatus(job), ...checkJobConditions(job), ...checkJobBackoffLimit(job)];
      if (!errors.length) return [];
      return [{
        kind: 'Job',
        name: job.metadata?.name ?? 'unknown-job',
        namespace: job.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
