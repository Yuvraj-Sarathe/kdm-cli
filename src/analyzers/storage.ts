import type * as k8s from '@kubernetes/client-node';
import type { Analyzer, AnalyzerContext, AnalyzerResult, Failure } from './types';
import { listStorageClasses, listPersistentVolumeClaims } from '../kubernetes/resources';

/**
 * Checks for PVCs referencing non-existent StorageClasses.
 * @param pvcs List of PVCs.
 * @param storageClassNames Set of valid StorageClass names.
 * @returns Array of failures found.
 */
const checkOrphanedPVCs = (
  pvcs: k8s.V1PersistentVolumeClaim[],
  storageClassNames: Set<string>,
): AnalyzerResult[] => {
  return pvcs.flatMap((pvc) => {
    const scName = pvc.spec?.storageClassName;
    if (!scName || storageClassNames.has(scName)) return [];
    return [{
      kind: 'Storage',
      name: pvc.metadata?.name ?? 'unknown-pvc',
      namespace: pvc.metadata?.namespace ?? 'default',
      errors: [{ text: `PVC references StorageClass '${scName}' which does not exist` }],
    }];
  });
};

/**
 * Checks StorageClasses for deprecated or unusual provisioners.
 * @param sc The StorageClass object.
 * @returns Array of failures found.
 */
const checkStorageClassProvisioner = (sc: k8s.V1StorageClass): Failure[] => {
  if (!sc.provisioner) {
    return [{ text: 'StorageClass has no provisioner set' }];
  }
  return [];
};

/**
 * Analyzer implementation focused on Kubernetes storage resources.
 * Checks StorageClasses and PVC-to-StorageClass references.
 */
export const StorageAnalyzer: Analyzer = {
  name: 'Storage',
  async analyze(context: AnalyzerContext): Promise<AnalyzerResult[]> {
    const [storageClasses, pvcs] = await Promise.all([
      listStorageClasses(context),
      listPersistentVolumeClaims(context),
    ]);

    const scNames = new Set(storageClasses.map((sc) => sc.metadata?.name ?? ''));
    const results: AnalyzerResult[] = [];

    for (const sc of storageClasses) {
      const errors = checkStorageClassProvisioner(sc);
      if (errors.length > 0) {
        results.push({
          kind: 'Storage',
          name: sc.metadata?.name ?? 'unknown-storageclass',
          errors,
        });
      }
    }

    results.push(...checkOrphanedPVCs(pvcs, scNames));
    return results;
  },
};
