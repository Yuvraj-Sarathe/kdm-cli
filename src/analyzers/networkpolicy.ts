import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listNetworkPolicies } from '../kubernetes/resources';

/**
 * Checks NetworkPolicy for empty or overly broad selectors.
 * @param np The NetworkPolicy object.
 * @returns Array of failures found.
 */
const checkNetworkPolicySelector = (np: k8s.V1NetworkPolicy): Failure[] => {
  const selector = np.spec?.podSelector;
  const hasLabels = selector?.matchLabels && Object.keys(selector.matchLabels).length > 0;
  const hasExpressions = selector?.matchExpressions && selector.matchExpressions.length > 0;
  if (!hasLabels && !hasExpressions) {
    return [{ text: 'NetworkPolicy has an empty podSelector (applies to all pods in namespace)' }];
  }
  return [];
};

/**
 * Checks NetworkPolicy for missing ingress and egress rules.
 * @param np The NetworkPolicy object.
 * @returns Array of failures found.
 */
const checkNetworkPolicyRules = (np: k8s.V1NetworkPolicy): Failure[] => {
  const failures: Failure[] = [];
  const types = np.spec?.policyTypes ?? [];
  const hasIngress = types.includes('Ingress');
  const hasEgress = types.includes('Egress');

  if (hasIngress && !np.spec?.ingress?.length) {
    failures.push({ text: 'NetworkPolicy declares Ingress policy type but has no ingress rules (blocks all ingress)' });
  }
  if (hasEgress && !np.spec?.egress?.length) {
    failures.push({ text: 'NetworkPolicy declares Egress policy type but has no egress rules (blocks all egress)' });
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes NetworkPolicies.
 */
export const NetworkPolicyAnalyzer: Analyzer = {
  name: 'NetworkPolicy',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listNetworkPolicies(context);
    return resources.flatMap((np) => {
      const errors = [...checkNetworkPolicySelector(np), ...checkNetworkPolicyRules(np)];
      if (!errors.length) return [];
      return [{
        kind: 'NetworkPolicy',
        name: np.metadata?.name ?? 'unknown-networkpolicy',
        namespace: np.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
