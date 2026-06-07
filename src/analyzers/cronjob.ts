import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listCronJobs } from '../kubernetes/resources';

/**
 * Checks CronJob schedule validity and suspension status.
 * @param cj The CronJob object.
 * @returns Array of failures found.
 */
const checkCronJobSchedule = (cj: k8s.V1CronJob): Failure[] => {
  const failures: Failure[] = [];
  if (!cj.spec?.schedule) {
    failures.push({ text: 'CronJob has no schedule defined' });
  }
  if (cj.spec?.suspend) {
    failures.push({ text: 'CronJob is suspended' });
  }
  return failures;
};

/**
 * Checks CronJob for failed last scheduled jobs.
 * @param cj The CronJob object.
 * @returns Array of failures found.
 */
const checkCronJobLastSchedule = (cj: k8s.V1CronJob): Failure[] => {
  if (!cj.status?.lastScheduleTime && cj.status?.active?.length) {
    return [{ text: 'CronJob has active jobs but no last schedule time recorded' }];
  }
  return [];
};

/**
 * Analyzer implementation focused on Kubernetes CronJobs.
 */
export const CronJobAnalyzer: Analyzer = {
  name: 'CronJob',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listCronJobs(context);
    return resources.flatMap((cj) => {
      const errors = [...checkCronJobSchedule(cj), ...checkCronJobLastSchedule(cj)];
      if (!errors.length) return [];
      return [{
        kind: 'CronJob',
        name: cj.metadata?.name ?? 'unknown-cronjob',
        namespace: cj.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
