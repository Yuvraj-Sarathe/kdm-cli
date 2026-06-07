import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listDaemonSets } from '../kubernetes/resources';

/**
 * Checks DaemonSet scheduling status for misscheduled or unavailable pods.
 * @param ds The DaemonSet object.
 * @returns Array of failures found.
 */
const checkDaemonSetScheduling = (ds: k8s.V1DaemonSet): Failure[] => {
  const failures: Failure[] = [];
  const desired = ds.status?.desiredNumberScheduled ?? 0;
  const ready = ds.status?.numberReady ?? 0;
  const misscheduled = ds.status?.numberMisscheduled ?? 0;

  if (desired > ready) {
    failures.push({ text: `DaemonSet has ${ready}/${desired} ready pods` });
  }
  if (misscheduled > 0) {
    failures.push({ text: `DaemonSet has ${misscheduled} misscheduled pods` });
  }
  return failures;
};

/**
 * Checks DaemonSet status conditions for failures.
 * @param ds The DaemonSet object.
 * @returns Array of failures found.
 */
const checkDaemonSetConditions = (ds: k8s.V1DaemonSet): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of ds.status?.conditions ?? []) {
    if (cond.status === 'False' && cond.message) {
      failures.push({ text: `DaemonSet condition ${cond.type} is False: ${cond.message}` });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes DaemonSets.
 */
export const DaemonSetAnalyzer: Analyzer = {
  name: 'DaemonSet',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listDaemonSets(context);
    return resources.flatMap((ds) => {
      const errors = [...checkDaemonSetScheduling(ds), ...checkDaemonSetConditions(ds)];
      if (!errors.length) return [];
      return [{
        kind: 'DaemonSet',
        name: ds.metadata?.name ?? 'unknown-daemonset',
        namespace: ds.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
