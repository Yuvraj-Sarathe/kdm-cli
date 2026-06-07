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

interface CustomObjectParams {
  group: string;
  version: string;
  plural: string;
  kind: string;
  context: AnalyzerContext;
  checkFn: (resource: any) => Failure[];
  hasNamespace?: boolean;
}

/**
 * Helper to fetch and analyze custom objects.
 * @param params Configuration parameters.
 * @returns Array of analyzer results.
 */
async function analyzeCustomObjects(params: CustomObjectParams): Promise<AnalyzerResult[]> {
  try {
    const api = getCustomObjectsApi(params.context);
    const response = params.context.namespace && params.hasNamespace !== false
      ? await api.listNamespacedCustomObject({
          group: params.group,
          version: params.version,
          namespace: params.context.namespace,
          plural: params.plural,
        })
      : await api.listClusterCustomObject({
          group: params.group,
          version: params.version,
          plural: params.plural,
        });

    const items = (response as any)?.items ?? [];
    return items.flatMap((resource: any) => {
      const errors = params.checkFn(resource);
      if (!errors.length) return [];
      const result: AnalyzerResult = {
        kind: params.kind,
        name: resource.metadata?.name ?? 'unknown',
        errors,
      };
      if (resource.metadata?.namespace) {
        result.namespace = resource.metadata.namespace;
      } else if (params.context.namespace && params.hasNamespace !== false) {
        result.namespace = params.context.namespace;
      }
      return [result];
    });
  } catch {
    return [];
  }
}

/**
 * KEDA integration analyzer checking ScaledObject health.
 */
export const KEDAAnalyzer: Analyzer = {
  name: 'KEDA',
  /**
   * Performs analysis on KEDA ScaledObject resources.
   * @param context Analyzer context options.
   * @returns Array of analyzer results.
   */
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    return analyzeCustomObjects({
      group: 'keda.sh',
      version: 'v1alpha1',
      plural: 'scaledobjects',
      kind: 'KEDA',
      context,
      checkFn: checkKEDAScaledObject,
    });
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
  /**
   * Performs analysis on Kyverno ClusterPolicy resources.
   * @param context Analyzer context options.
   * @returns Array of analyzer results.
   */
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    return analyzeCustomObjects({
      group: 'kyverno.io',
      version: 'v1',
      plural: 'clusterpolicies',
      kind: 'Kyverno',
      context,
      checkFn: checkKyvernoPolicy,
      hasNamespace: false,
    });
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
  /**
   * Performs analysis on Prometheus ServiceMonitor resources.
   * @param context Analyzer context options.
   * @returns Array of analyzer results.
   */
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    return analyzeCustomObjects({
      group: 'monitoring.coreos.com',
      version: 'v1',
      plural: 'servicemonitors',
      kind: 'Prometheus',
      context,
      checkFn: checkPrometheusServiceMonitor,
    });
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
