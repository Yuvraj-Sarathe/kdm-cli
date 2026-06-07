import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listConfigMaps } from '../kubernetes/resources';

/**
 * Checks ConfigMap for empty data (no keys).
 * @param cm The ConfigMap object.
 * @returns Array of failures found.
 */
const checkConfigMapData = (cm: k8s.V1ConfigMap): Failure[] => {
  const dataKeys = Object.keys(cm.data ?? {});
  const binaryKeys = Object.keys(cm.binaryData ?? {});
  if (dataKeys.length === 0 && binaryKeys.length === 0) {
    return [{ text: 'ConfigMap has no data keys' }];
  }
  return [];
};

/**
 * Analyzer implementation focused on Kubernetes ConfigMaps.
 * Reports empty ConfigMaps as potential misconfiguration.
 */
export const ConfigMapAnalyzer: Analyzer = {
  name: 'ConfigMap',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const resources = await listConfigMaps(context);
    return resources.flatMap((cm) => {
      const errors = checkConfigMapData(cm);
      if (!errors.length) return [];
      return [{
        kind: 'ConfigMap',
        name: cm.metadata?.name ?? 'unknown-configmap',
        namespace: cm.metadata?.namespace ?? 'default',
        errors,
      }];
    });
  },
};
