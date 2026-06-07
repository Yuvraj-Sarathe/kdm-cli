import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from '../analyzers/types';
import { registry } from '../analyzers';
import { getCustomObjectsApi } from '../kubernetes/client';

/** Configuration for an integration. */
export interface IntegrationConfig {
  name: string;
  enabled: boolean;
}

/**
 * Integration registry that manages third-party integrations
 * and registers their analyzers into the main analyzer registry.
 */
export class IntegrationRegistry {
  private integrations = new Map<string, Analyzer>();

  /**
   * Registers an integration analyzer and adds it to the main registry.
   * @param analyzer The integration analyzer to register.
   */
  register(analyzer: Analyzer): void {
    this.integrations.set(analyzer.name, analyzer);
    registry.register(analyzer);
  }

  /**
   * Lists all registered integration analyzers.
   * @returns Array of integration analyzer instances.
   */
  list(): Analyzer[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Checks if an integration is registered.
   * @param name Integration analyzer name.
   * @returns True if the integration exists.
   */
  has(name: string): boolean {
    return this.integrations.has(name);
  }
}

export const integrationRegistry = new IntegrationRegistry();

/**
 * Checks KEDA ScaledObject conditions for readiness.
 * @param resource KEDA ScaledObject custom resource.
 * @returns Array of failures found.
 */
const checkKEDAScaledObject = (resource: any): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of resource.status?.conditions ?? []) {
    if (cond.type === 'Ready' && cond.status !== 'True') {
      failures.push({ text: `KEDA ScaledObject not ready${cond.message ? `: ${cond.message}` : ''}` });
    }
  }
  return failures;
};

/**
 * KEDA integration analyzer checking ScaledObject health.
 */
export const KEDAAnalyzer: Analyzer = {
  name: 'KEDA',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    try {
      const api = getCustomObjectsApi(context);
      const response = context.namespace
        ? await api.listNamespacedCustomObject('keda.sh', 'v1alpha1', context.namespace, 'scaledobjects')
        : await api.listClusterCustomObject('keda.sh', 'v1alpha1', 'scaledobjects');
      const items = ((response as any)?.body?.items ?? (response as any)?.items) ?? [];
      return items.flatMap((resource: any) => {
        const errors = checkKEDAScaledObject(resource);
        if (!errors.length) return [];
        return [{
          kind: 'KEDA',
          name: resource.metadata?.name ?? 'unknown',
          namespace: resource.metadata?.namespace ?? 'default',
          errors,
        }];
      });
    } catch {
      return [];
    }
  },
};

/**
 * Checks Kyverno ClusterPolicy compliance status.
 * @param resource Kyverno ClusterPolicy custom resource.
 * @returns Array of failures found.
 */
const checkKyvernoPolicy = (resource: any): Failure[] => {
  const failures: Failure[] = [];
  if (resource.status?.ready === false) {
    failures.push({ text: `Kyverno policy not ready` });
  }
  for (const cond of resource.status?.conditions ?? []) {
    if (cond.status === 'False' && cond.message) {
      failures.push({ text: `Kyverno policy ${cond.type}: ${cond.message}` });
    }
  }
  return failures;
};

/**
 * Kyverno integration analyzer checking ClusterPolicy compliance.
 */
export const KyvernoAnalyzer: Analyzer = {
  name: 'Kyverno',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    try {
      const api = getCustomObjectsApi(context);
      const response = await api.listClusterCustomObject('kyverno.io', 'v1', 'clusterpolicies');
      const items = ((response as any)?.body?.items ?? (response as any)?.items) ?? [];
      return items.flatMap((resource: any) => {
        const errors = checkKyvernoPolicy(resource);
        if (!errors.length) return [];
        return [{
          kind: 'Kyverno',
          name: resource.metadata?.name ?? 'unknown',
          errors,
        }];
      });
    } catch {
      return [];
    }
  },
};

/**
 * Checks Prometheus ServiceMonitor configuration.
 * @param resource Prometheus ServiceMonitor custom resource.
 * @returns Array of failures found.
 */
const checkPrometheusServiceMonitor = (resource: any): Failure[] => {
  if (!resource.spec?.endpoints?.length) {
    return [{ text: 'ServiceMonitor has no endpoints configured' }];
  }
  return [];
};

/**
 * Prometheus integration analyzer checking ServiceMonitor configuration.
 */
export const PrometheusAnalyzer: Analyzer = {
  name: 'Prometheus',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    try {
      const api = getCustomObjectsApi(context);
      const response = context.namespace
        ? await api.listNamespacedCustomObject('monitoring.coreos.com', 'v1', context.namespace, 'servicemonitors')
        : await api.listClusterCustomObject('monitoring.coreos.com', 'v1', 'servicemonitors');
      const items = ((response as any)?.body?.items ?? (response as any)?.items) ?? [];
      return items.flatMap((resource: any) => {
        const errors = checkPrometheusServiceMonitor(resource);
        if (!errors.length) return [];
        return [{
          kind: 'Prometheus',
          name: resource.metadata?.name ?? 'unknown',
          namespace: resource.metadata?.namespace ?? 'default',
          errors,
        }];
      });
    } catch {
      return [];
    }
  },
};

/**
 * Registers all available integration analyzers.
 * Called during application initialization.
 */
export function registerIntegrations(): void {
  integrationRegistry.register(KEDAAnalyzer);
  integrationRegistry.register(KyvernoAnalyzer);
  integrationRegistry.register(PrometheusAnalyzer);
}
