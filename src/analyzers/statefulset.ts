import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listStatefulSets } from '../kubernetes/resources';

/**
 * Checks StatefulSet replica readiness against desired count.
 * @param ss The StatefulSet object.
 * @returns Array of failures found.
 */
const checkStatefulSetReplicas = (ss: k8s.V1StatefulSet): Failure[] => {
  const desired = ss.spec?.replicas ?? 1;
  const ready = ss.status?.readyReplicas ?? 0;
  if (desired > ready) {
    return [{ text: `StatefulSet has ${ready}/${desired} ready replicas` }];
  }
  return [];
};

/**
 * Checks StatefulSet status conditions for failures.
 * @param ss The StatefulSet object.
 * @returns Array of failures found.
 */
const checkStatefulSetConditions = (ss: k8s.V1StatefulSet): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of ss.status?.conditions ?? []) {
    if (cond.status === 'False' && cond.message) {
      failures.push({ text: `StatefulSet condition ${cond.type} is False: ${cond.message}` });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes StatefulSets.
 */
export const StatefulSetAnalyzer: Analyzer = {
  name: 'StatefulSet',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listStatefulSets(context);
    return resources.flatMap((ss) => {
      const errors = [...checkStatefulSetReplicas(ss), ...checkStatefulSetConditions(ss)];
      if (!errors.length) return [];
      return [{
        kind: 'StatefulSet',
        name: ss.metadata?.name ?? 'unknown-statefulset',
        namespace: ss.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
