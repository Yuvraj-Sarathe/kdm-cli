import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listIngresses } from '../kubernetes/resources';

/**
 * Checks Ingress for missing or empty rules.
 * @param ingress The Ingress object.
 * @returns Array of failures found.
 */
const checkIngressRules = (ingress: k8s.V1Ingress): Failure[] => {
  if (!ingress.spec?.rules?.length) {
    return [{ text: 'Ingress has no rules defined' }];
  }
  return [];
};

/**
 * Checks Ingress for missing TLS configuration when hosts are defined.
 * @param ingress The Ingress object.
 * @returns Array of failures found.
 */
const checkIngressTLS = (ingress: k8s.V1Ingress): Failure[] => {
  const hosts = ingress.spec?.rules?.map((r) => r.host).filter(Boolean) ?? [];
  if (hosts.length > 0 && !ingress.spec?.tls?.length) {
    return [{ text: 'Ingress has hosts but no TLS configuration' }];
  }
  return [];
};

/**
 * Checks Ingress for missing backend services in rules.
 * @param ingress The Ingress object.
 * @returns Array of failures found.
 */
const checkIngressBackends = (ingress: k8s.V1Ingress): Failure[] => {
  const failures: Failure[] = [];
  for (const rule of ingress.spec?.rules ?? []) {
    for (const path of rule.http?.paths ?? []) {
      if (!path.backend?.service?.name) {
        failures.push({ text: `Ingress rule for host '${rule.host ?? '*'}' path '${path.path ?? '/'}' has no backend service` });
      }
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes Ingresses.
 */
export const IngressAnalyzer: Analyzer = {
  name: 'Ingress',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listIngresses(context);
    return resources.flatMap((ingress) => {
      const errors = [...checkIngressRules(ingress), ...checkIngressTLS(ingress), ...checkIngressBackends(ingress)];
      if (!errors.length) return [];
      return [{
        kind: 'Ingress',
        name: ingress.metadata?.name ?? 'unknown-ingress',
        namespace: ingress.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
