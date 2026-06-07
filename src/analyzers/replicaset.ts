import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listReplicaSets } from '../kubernetes/resources';

/**
 * Checks ReplicaSet replica availability against desired count.
 * @param rs The ReplicaSet object.
 * @returns Array of failures found.
 */
const checkReplicaSetReplicas = (rs: k8s.V1ReplicaSet): Failure[] => {
  const desired = rs.spec?.replicas ?? 0;
  if (desired === 0) return [];
  const ready = rs.status?.readyReplicas ?? 0;
  if (desired > ready) {
    return [{ text: `ReplicaSet has ${ready}/${desired} ready replicas` }];
  }
  return [];
};

/**
 * Checks ReplicaSet status conditions for failures.
 * @param rs The ReplicaSet object.
 * @returns Array of failures found.
 */
const checkReplicaSetConditions = (rs: k8s.V1ReplicaSet): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of rs.status?.conditions ?? []) {
    if (cond.status === 'False' && cond.message) {
      failures.push({ text: `ReplicaSet condition ${cond.type} is False: ${cond.message}` });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes ReplicaSets.
 */
export const ReplicaSetAnalyzer: Analyzer = {
  name: 'ReplicaSet',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listReplicaSets(context);
    return resources.flatMap((rs) => {
      const errors = [...checkReplicaSetReplicas(rs), ...checkReplicaSetConditions(rs)];
      if (!errors.length) return [];
      return [{
        kind: 'ReplicaSet',
        name: rs.metadata?.name ?? 'unknown-replicaset',
        namespace: rs.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
