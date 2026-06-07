import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listGatewayClasses } from '../kubernetes/resources';

/**
 * Checks GatewayClass for accepted condition status.
 * @param gc The GatewayClass custom resource.
 * @returns Array of failures found.
 */
const checkGatewayClassConditions = (gc: any): Failure[] => {
  const failures: Failure[] = [];
  for (const cond of gc.status?.conditions ?? []) {
    if (cond.type === 'Accepted' && cond.status !== 'True') {
      failures.push({
        text: `GatewayClass not accepted${cond.reason ? `: ${cond.reason}` : ''}${cond.message ? ` - ${cond.message}` : ''}`,
      });
    }
  }
  return failures;
};

/**
 * Analyzer implementation focused on Kubernetes Gateway API GatewayClasses.
 */
export const GatewayClassAnalyzer: Analyzer = {
  name: 'GatewayClass',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listGatewayClasses(context);
    return resources.flatMap((gc: any) => {
      const errors = checkGatewayClassConditions(gc);
      if (!errors.length) return [];
      return [{
        kind: 'GatewayClass',
        name: gc.metadata?.name ?? 'unknown-gatewayclass',
        errors,
      }];
    });
  },
};
