import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listPDBs } from '../kubernetes/resources';

/**
 * Checks PDB disruption budget status for blocked evictions.
 * @param pdb The PDB object.
 * @returns Array of failures found.
 */
const checkPDBDisruptions = (pdb: k8s.V1PodDisruptionBudget): Failure[] => {
  const failures: Failure[] = [];
  const allowed = pdb.status?.disruptionsAllowed ?? 0;
  const current = pdb.status?.currentHealthy ?? 0;
  const expected = pdb.status?.expectedPods ?? 0;

  if (allowed === 0 && expected > 0) {
    failures.push({ text: 'PDB allows zero disruptions — evictions are blocked' });
  }
  if (current < expected) {
    failures.push({ text: `PDB has ${current}/${expected} healthy pods` });
  }
  return failures;
};

/**
 * Checks PDB status conditions for issues.
 * @param pdb The PDB object.
 * @returns Array of failures found.
 */
const checkPDBConditions = (pdb: k8s.V1PodDisruptionBudget): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of pdb.status?.conditions ?? []) {
    if (cond.status === 'False' && cond.message) {
      failures.push({ text: `PDB condition ${cond.type} is False: ${cond.message}` });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes PodDisruptionBudgets.
 */
export const PDBAnalyzer: Analyzer = {
  name: 'PodDisruptionBudget',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listPDBs(context);
    return resources.flatMap((pdb) => {
      const errors = [...checkPDBDisruptions(pdb), ...checkPDBConditions(pdb)];
      if (!errors.length) return [];
      return [{
        kind: 'PodDisruptionBudget',
        name: pdb.metadata?.name ?? 'unknown-pdb',
        namespace: pdb.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
