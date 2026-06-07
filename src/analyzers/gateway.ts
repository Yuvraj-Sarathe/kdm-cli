import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listGateways } from '../kubernetes/resources';

/**
 * Checks Gateway status conditions for readiness issues.
 * @param gw The Gateway custom resource.
 * @returns Array of failures found.
 */
const checkGatewayConditions = (gw: any): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of gw.status?.conditions ?? []) {
    if (cond.type === 'Accepted' && cond.status !== 'True') {
      failures.push({
        text: `Gateway not accepted${cond.reason ? `: ${cond.reason}` : ''}${cond.message ? ` - ${cond.message}` : ''}`,
      });
    }
    if (cond.type === 'Programmed' && cond.status !== 'True') {
      failures.push({
        text: `Gateway not programmed${cond.reason ? `: ${cond.reason}` : ''}${cond.message ? ` - ${cond.message}` : ''}`,
      });
    }
  }
  return failures;
};

/**
 * Checks Gateway for missing or empty listeners.
 * @param gw The Gateway custom resource.
 * @returns Array of failures found.
 */
const checkGatewayListeners = (gw: any): Failure[] => {
  if (!gw.spec?.listeners?.length) {
    return [{ text: 'Gateway has no listeners defined' }];
  }
  return [];
};

/**
 * Analyzer implementation focused on Kubernetes Gateway API Gateways.
 */
export const GatewayAnalyzer: Analyzer = {
  name: 'Gateway',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listGateways(context);
    return resources.flatMap((gw: any) => {
      const errors = [...checkGatewayConditions(gw), ...checkGatewayListeners(gw)];
      if (!errors.length) return [];
      return [{
        kind: 'Gateway',
        name: gw.metadata?.name ?? 'unknown-gateway',
        namespace: gw.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
