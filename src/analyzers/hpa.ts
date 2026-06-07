import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listHPAs } from '../kubernetes/resources';

/**
 * Checks HPA scaling status for issues like hitting max replicas.
 * @param hpa The HPA object.
 * @returns Array of failures found.
 */
const checkHPAScaling = (hpa: k8s.V2HorizontalPodAutoscaler): Failure[] => {
  const failures: Failure[] = [];
  const current = hpa.status?.currentReplicas ?? 0;
  const max = hpa.spec?.maxReplicas ?? 0;
  if (current >= max && max > 0) {
    failures.push({ text: `HPA is at maximum replicas (${current}/${max})` });
  }
  return failures;
};

/**
 * Checks HPA status conditions for scaling failures.
 * @param hpa The HPA object.
 * @returns Array of failures found.
 */
const checkHPAConditions = (hpa: k8s.V2HorizontalPodAutoscaler): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of hpa.status?.conditions ?? []) {
    if (cond.type === 'ScalingLimited' && cond.status === 'True') {
      failures.push({ text: `HPA scaling limited${cond.message ? `: ${cond.message}` : ''}` });
    }
    if (cond.type === 'AbleToScale' && cond.status === 'False') {
      failures.push({ text: `HPA unable to scale${cond.message ? `: ${cond.message}` : ''}` });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes HorizontalPodAutoscalers.
 */
export const HPAAnalyzer: Analyzer = {
  name: 'HorizontalPodAutoscaler',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listHPAs(context);
    return resources.flatMap((hpa) => {
      const errors = [...checkHPAScaling(hpa), ...checkHPAConditions(hpa)];
      if (!errors.length) return [];
      return [{
        kind: 'HorizontalPodAutoscaler',
        name: hpa.metadata?.name ?? 'unknown-hpa',
        namespace: hpa.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
