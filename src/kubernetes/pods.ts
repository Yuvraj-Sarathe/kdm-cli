import { getK8sApi, getCustomObjectsApi } from './client';
import type * as k8s from '@kubernetes/client-node';
import { triggerAlert } from '../monitor/alerts';
import { logger } from '../utils/logger';

export interface PodData {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  node: string;
}

export const getRunningPods = async (options?: { forceAlert?: boolean }): Promise<PodData[]> => {
  const api = getK8sApi();
  try {
    const res = await api.listPodForAllNamespaces();
    return (res.items ?? []).map((pod: k8s.V1Pod) => {
      const name = pod.metadata?.name || 'Unknown';
      const phase = pod.status?.phase || 'Unknown';
      const containerStatuses = pod.status?.containerStatuses || [];
      const restarts = containerStatuses.reduce((acc: number, status: k8s.V1ContainerStatus) => acc + status.restartCount, 0);

      // Check for failures
      let failureReason = '';
      if (phase === 'Failed') {
        failureReason = 'Pod phase is FAILED';
      } else {
        for (const status of containerStatuses) {
          if (status.state?.waiting) {
            const reason = status.state.waiting.reason;
            if (reason === 'CrashLoopBackOff' || reason === 'ImagePullBackOff' || reason === 'CreateContainerConfigError') {
              failureReason = `Container ${status.name} is in ${reason}`;
              break;
            }
          }
        }
      }

      if (failureReason) {
        triggerAlert({
          id: `pod:${name}:failure`,
          type: 'pod',
          severity: 'critical',
          message: `Pod ${name} in namespace ${pod.metadata?.namespace} failed: ${failureReason}`,
        }, { force: options?.forceAlert });
      }

      return {
        name,
        namespace: pod.metadata?.namespace || 'default',
        status: phase,
        restarts,
        node: pod.spec?.nodeName || 'Unknown',
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch Kubernetes pods: ${errorMessage}`);
    throw error;
  }
};

export interface K8sClusterStats {
  cpu: string;
  memory: string;
  source: 'metrics-server' | 'requests' | 'N/A';
}

export function parseK8sCpuQuantity(q: string | number): number {
  if (typeof q === 'number') return q * 1000;
  if (!q) return 0;
  const match = q.trim().match(/^([0-9.]+)([a-zA-Z]*)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const suffix = match[2];
  switch (suffix) {
    case 'n':
      return val / 1000000; // nanocores to millicores
    case 'u':
      return val / 1000; // microcores to millicores
    case 'm':
      return val;
    case '':
      return val * 1000; // cores to millicores
    default:
      return val * 1000;
  }
}

export function parseK8sMemoryQuantity(q: string | number): number {
  if (typeof q === 'number') return q;
  if (!q) return 0;
  const match = q.trim().match(/^([0-9.]+)([a-zA-Z]*)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const suffix = match[2];
  
  const binaryPower: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 * 1024,
    Gi: 1024 * 1024 * 1024,
    Ti: 1024 * 1024 * 1024 * 1024,
    Pi: 1024 * 1024 * 1024 * 1024 * 1024,
  };
  
  const decimalPower: Record<string, number> = {
    k: 1000,
    M: 1000 * 1000,
    G: 1000 * 1000 * 1000,
    T: 1000 * 1000 * 1000 * 1000,
    P: 1000 * 1000 * 1000 * 1000 * 1000,
  };

  if (binaryPower[suffix]) {
    return val * binaryPower[suffix];
  }
  if (decimalPower[suffix]) {
    return val * decimalPower[suffix];
  }
  return val;
}

export const formatK8sBytes = (bytes: number): string => {
  if (bytes <= 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const num = bytes / Math.pow(k, i);
  return `${parseFloat(num.toFixed(1))}${sizes[i]}`;
};

export const getK8sClusterStats = async (): Promise<K8sClusterStats> => {
  // 1. Try to fetch metrics-server node stats
  try {
    const customApi = getCustomObjectsApi();
    const res = await customApi.listClusterCustomObject({
      group: 'metrics.k8s.io',
      version: 'v1beta1',
      plural: 'nodes',
    });
    
    const items = (res as any)?.items || [];
    if (items.length > 0) {
      let totalCpuMillicores = 0;
      let totalMemoryBytes = 0;
      
      for (const item of items) {
        const cpuQty = item.usage?.cpu || '0';
        const memQty = item.usage?.memory || '0';
        totalCpuMillicores += parseK8sCpuQuantity(cpuQty);
        totalMemoryBytes += parseK8sMemoryQuantity(memQty);
      }
      
      return {
        cpu: `${Math.round(totalCpuMillicores)}m`,
        memory: formatK8sBytes(totalMemoryBytes),
        source: 'metrics-server',
      };
    }
  } catch (error) {
    // metrics-server might not be available or permissions missing
  }

  // 2. Try to fallback to Pod Metrics
  try {
    const customApi = getCustomObjectsApi();
    const res = await customApi.listClusterCustomObject({
      group: 'metrics.k8s.io',
      version: 'v1beta1',
      plural: 'pods',
    });
    
    const items = (res as any)?.items || [];
    if (items.length > 0) {
      let totalCpuMillicores = 0;
      let totalMemoryBytes = 0;
      
      for (const item of items) {
        const containers = item.containers || [];
        for (const container of containers) {
          const cpuQty = container.usage?.cpu || '0';
          const memQty = container.usage?.memory || '0';
          totalCpuMillicores += parseK8sCpuQuantity(cpuQty);
          totalMemoryBytes += parseK8sMemoryQuantity(memQty);
        }
      }
      
      return {
        cpu: `${Math.round(totalCpuMillicores)}m`,
        memory: formatK8sBytes(totalMemoryBytes),
        source: 'metrics-server',
      };
    }
  } catch (error) {
    // Pod metrics also not available
  }

  // 3. Fallback to native cluster stats (sum of requests of all pods)
  try {
    const api = getK8sApi();
    const res = await api.listPodForAllNamespaces();
    const pods = res.items || [];
    
    let totalCpuMillicores = 0;
    let totalMemoryBytes = 0;
    
    for (const pod of pods) {
      const phase = pod.status?.phase;
      if (phase !== 'Running' && phase !== 'Pending') {
        continue;
      }
      
      const containers = pod.spec?.containers || [];
      const initContainers = pod.spec?.initContainers || [];
      
      for (const container of [...containers, ...initContainers]) {
        const requests = container.resources?.requests;
        if (requests) {
          if (requests.cpu) {
            totalCpuMillicores += parseK8sCpuQuantity(requests.cpu);
          }
          if (requests.memory) {
            totalMemoryBytes += parseK8sMemoryQuantity(requests.memory);
          }
        }
      }
    }
    
    if (totalCpuMillicores > 0 || totalMemoryBytes > 0) {
      return {
        cpu: `${Math.round(totalCpuMillicores)}m`,
        memory: formatK8sBytes(totalMemoryBytes),
        source: 'requests',
      };
    }
  } catch (error) {
    // Native API query failed
  }

  return {
    cpu: 'N/A',
    memory: 'N/A',
    source: 'N/A',
  };
};

