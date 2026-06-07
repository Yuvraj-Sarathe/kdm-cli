import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listHTTPRoutes } from '../kubernetes/resources';

/**
 * Checks HTTPRoute parent reference status for acceptance.
 * @param route The HTTPRoute custom resource.
 * @returns Array of failures found.
 */
const checkHTTPRouteParentStatus = (route: any): Failure[] => {
  const failures: Failure[] = [];
  for (const parent of route.status?.parents ?? []) {
    for (const cond of parent.conditions ?? []) {
      if (cond.type === 'Accepted' && cond.status !== 'True') {
        failures.push({
          text: `HTTPRoute not accepted by parent${cond.reason ? `: ${cond.reason}` : ''}`,
        });
      }
    }
  }
  return failures;
};

/**
 * Checks HTTPRoute for missing rules or backend references.
 * @param route The HTTPRoute custom resource.
 * @returns Array of failures found.
 */
const checkHTTPRouteRules = (route: any): Failure[] => {
  if (!route.spec?.rules?.length) {
    return [{ text: 'HTTPRoute has no rules defined' }];
  }
  const failures: Failure[] = [];
  for (const rule of route.spec.rules) {
    if (!rule.backendRefs?.length) {
      failures.push({ text: 'HTTPRoute rule has no backend references' });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes Gateway API HTTPRoutes.
 */
export const HTTPRouteAnalyzer: Analyzer = {
  name: 'HTTPRoute',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listHTTPRoutes(context);
    return resources.flatMap((route: any) => {
      const errors = [...checkHTTPRouteParentStatus(route), ...checkHTTPRouteRules(route)];
      if (!errors.length) return [];
      return [{
        kind: 'HTTPRoute',
        name: route.metadata?.name ?? 'unknown-httproute',
        namespace: route.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
