import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as k8s from '@kubernetes/client-node';
import * as fs from 'node:fs';
import {
  getK8sApi,
  getAppsApi,
  getBatchApi,
  getNetworkingApi,
  getAutoscalingApi,
  getPolicyApi,
  getStorageApi,
  getCustomObjectsApi,
  getKubeConfig,
  checkK8sConnection,
} from '../kubernetes/client';
import * as res from '../kubernetes/resources';

const mockApiClient = {
  listNamespacedPod: vi.fn(async () => ({ items: [] })),
  listPodForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedService: vi.fn(async () => ({ items: [] })),
  listServiceForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedPersistentVolumeClaim: vi.fn(async () => ({ items: [] })),
  listPersistentVolumeClaimForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNode: vi.fn(async () => ({ items: [] })),
  listNamespacedConfigMap: vi.fn(async () => ({ items: [] })),
  listConfigMapForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedEvent: vi.fn(async () => ({ items: [] })),
  listEventForAllNamespaces: vi.fn(async () => ({ items: [] })),
  readNamespacedEndpoints: vi.fn(async () => ({})),
  readNamespacedPodLog: vi.fn(async () => 'mock log'),
  listNamespacedDeployment: vi.fn(async () => ({ items: [] })),
  listDeploymentForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedReplicaSet: vi.fn(async () => ({ items: [] })),
  listReplicaSetForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedStatefulSet: vi.fn(async () => ({ items: [] })),
  listStatefulSetForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedDaemonSet: vi.fn(async () => ({ items: [] })),
  listDaemonSetForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedJob: vi.fn(async () => ({ items: [] })),
  listJobForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedCronJob: vi.fn(async () => ({ items: [] })),
  listCronJobForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedIngress: vi.fn(async () => ({ items: [] })),
  listIngressForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedNetworkPolicy: vi.fn(async () => ({ items: [] })),
  listNetworkPolicyForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedHorizontalPodAutoscaler: vi.fn(async () => ({ items: [] })),
  listHorizontalPodAutoscalerForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listNamespacedPodDisruptionBudget: vi.fn(async () => ({ items: [] })),
  listPodDisruptionBudgetForAllNamespaces: vi.fn(async () => ({ items: [] })),
  listStorageClass: vi.fn(async () => ({ items: [] })),
  listNamespacedCustomObject: vi.fn(async () => ({ items: [] })),
  listClusterCustomObject: vi.fn(async () => ({ items: [] })),
};

vi.mock('node:fs', () => ({
  statSync: vi.fn(),
}));

vi.mock('@kubernetes/client-node', () => {
  return {
    KubeConfig: class MockKubeConfig {
      loadFromFile = vi.fn();
      loadFromDefault = vi.fn();
      setCurrentContext = vi.fn();
      makeApiClient = vi.fn(() => mockApiClient);
    },
    CoreV1Api: class {},
    AppsV1Api: class {},
    BatchV1Api: class {},
    NetworkingV1Api: class {},
    AutoscalingV2Api: class {},
    PolicyV1Api: class {},
    StorageV1Api: class {},
    CustomObjectsApi: class {},
  };
});

describe('Kubernetes client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves all client APIs correctly', () => {
    expect(getK8sApi()).toBeDefined();
    expect(getAppsApi()).toBeDefined();
    expect(getBatchApi()).toBeDefined();
    expect(getNetworkingApi()).toBeDefined();
    expect(getAutoscalingApi()).toBeDefined();
    expect(getPolicyApi()).toBeDefined();
    expect(getStorageApi()).toBeDefined();
    expect(getCustomObjectsApi()).toBeDefined();
  });

  it('runs checkK8sConnection successfully', async () => {
    mockApiClient.listPodForAllNamespaces.mockResolvedValueOnce({
      items: [
        { status: { phase: 'Running' } },
        { status: { phase: 'Pending' } },
      ],
    } as any);

    const connection = await checkK8sConnection();
    expect(connection.connected).toBe(true);
    expect(connection.podCount).toBe(1);
  });

  it('runs checkK8sConnection with failure fallback', async () => {
    mockApiClient.listPodForAllNamespaces.mockRejectedValueOnce(new Error('K8s unreachable'));
    const connection = await checkK8sConnection();
    expect(connection.connected).toBe(false);
    expect(connection.podCount).toBe(0);
  });

  it('configures kubeconfig path and context overrides', () => {
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    const config = getKubeConfig({ kubeconfig: '/path/to/kubeconfig', kubecontext: 'my-ctx' });
    expect(config.loadFromFile).toHaveBeenCalledWith('/path/to/kubeconfig');
    expect(config.setCurrentContext).toHaveBeenCalledWith('my-ctx');
  });

  it('fails with invalid kubeconfig path (directory)', () => {
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as any);
    expect(() => getKubeConfig({ kubeconfig: '/path/to/dir' })).toThrow('Kubeconfig path is not a file');
  });

  it('fails when failing to load kubeconfig', () => {
    vi.mocked(fs.statSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(() => getKubeConfig({ kubeconfig: '/path/to/nonexistent' })).toThrow('Failed to load kubeconfig');
  });
});

describe('Kubernetes resource utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'listPods',
      fn: res.listPods,
      mockKey: 'listNamespacedPod',
      mockAllKey: 'listPodForAllNamespaces',
    },
    {
      name: 'listServices',
      fn: res.listServices,
      mockKey: 'listNamespacedService',
      mockAllKey: 'listServiceForAllNamespaces',
    },
    {
      name: 'listPersistentVolumeClaims',
      fn: res.listPersistentVolumeClaims,
      mockKey: 'listNamespacedPersistentVolumeClaim',
      mockAllKey: 'listPersistentVolumeClaimForAllNamespaces',
    },
    {
      name: 'listConfigMaps',
      fn: res.listConfigMaps,
      mockKey: 'listNamespacedConfigMap',
      mockAllKey: 'listConfigMapForAllNamespaces',
    },
    {
      name: 'listEvents',
      fn: res.listEvents,
      mockKey: 'listNamespacedEvent',
      mockAllKey: 'listEventForAllNamespaces',
    },
    {
      name: 'listDeployments',
      fn: res.listDeployments,
      mockKey: 'listNamespacedDeployment',
      mockAllKey: 'listDeploymentForAllNamespaces',
    },
    {
      name: 'listReplicaSets',
      fn: res.listReplicaSets,
      mockKey: 'listNamespacedReplicaSet',
      mockAllKey: 'listReplicaSetForAllNamespaces',
    },
    {
      name: 'listStatefulSets',
      fn: res.listStatefulSets,
      mockKey: 'listNamespacedStatefulSet',
      mockAllKey: 'listStatefulSetForAllNamespaces',
    },
    {
      name: 'listDaemonSets',
      fn: res.listDaemonSets,
      mockKey: 'listNamespacedDaemonSet',
      mockAllKey: 'listDaemonSetForAllNamespaces',
    },
    {
      name: 'listJobs',
      fn: res.listJobs,
      mockKey: 'listNamespacedJob',
      mockAllKey: 'listJobForAllNamespaces',
    },
    {
      name: 'listCronJobs',
      fn: res.listCronJobs,
      mockKey: 'listNamespacedCronJob',
      mockAllKey: 'listCronJobForAllNamespaces',
    },
    {
      name: 'listIngresses',
      fn: res.listIngresses,
      mockKey: 'listNamespacedIngress',
      mockAllKey: 'listIngressForAllNamespaces',
    },
    {
      name: 'listNetworkPolicies',
      fn: res.listNetworkPolicies,
      mockKey: 'listNamespacedNetworkPolicy',
      mockAllKey: 'listNetworkPolicyForAllNamespaces',
    },
    {
      name: 'listHPAs',
      fn: res.listHPAs,
      mockKey: 'listNamespacedHorizontalPodAutoscaler',
      mockAllKey: 'listHorizontalPodAutoscalerForAllNamespaces',
    },
    {
      name: 'listPDBs',
      fn: res.listPDBs,
      mockKey: 'listNamespacedPodDisruptionBudget',
      mockAllKey: 'listPodDisruptionBudgetForAllNamespaces',
    },
  ])('queries namespaced and global scope for $name', async ({ fn, mockKey, mockAllKey }) => {
    // Namespace scope
    await fn({ namespace: 'my-ns', labelSelector: 'app=test' });
    expect(mockApiClient[mockKey]).toHaveBeenCalledWith({
      namespace: 'my-ns',
      labelSelector: 'app=test',
    });

    // Global scope
    await fn({ labelSelector: 'app=test' });
    expect(mockApiClient[mockAllKey]).toHaveBeenCalledWith({
      labelSelector: 'app=test',
    });
  });

  it('queries listNodes', async () => {
    await res.listNodes({ labelSelector: 'role=worker' });
    expect(mockApiClient.listNode).toHaveBeenCalledWith({ labelSelector: 'role=worker' });
  });

  it('queries listStorageClasses', async () => {
    await res.listStorageClasses({ labelSelector: 'gp2' });
    expect(mockApiClient.listStorageClass).toHaveBeenCalledWith({ labelSelector: 'gp2' });
  });

  it('queries readEndpoints and resolves successfully', async () => {
    await res.readEndpoints('my-svc', 'my-ns');
    expect(mockApiClient.readNamespacedEndpoints).toHaveBeenCalledWith({
      name: 'my-svc',
      namespace: 'my-ns',
    });
  });

  it('queries readEndpoints and resolves 404 cleanly', async () => {
    mockApiClient.readNamespacedEndpoints.mockRejectedValueOnce({ statusCode: 404 });
    const result = await res.readEndpoints('my-svc', 'my-ns');
    expect(result).toBeUndefined();
  });

  it('queries readPodLog', async () => {
    const result = await res.readPodLog('my-pod', 'my-ns', 'my-container');
    expect(mockApiClient.readNamespacedPodLog).toHaveBeenCalledWith({
      name: 'my-pod',
      namespace: 'my-ns',
      container: 'my-container',
      tailLines: 100,
    });
    expect(result).toBe('mock log');
  });

  it('queries readPodLog with error fallback', async () => {
    mockApiClient.readNamespacedPodLog.mockRejectedValueOnce(new Error('K8s error'));
    const result = await res.readPodLog('my-pod', 'my-ns', 'my-container');
    expect(result).toBe('');
  });

  it('queries Gateway API resources (GatewayClass, Gateway, HTTPRoute)', async () => {
    await res.listGatewayClasses();
    expect(mockApiClient.listClusterCustomObject).toHaveBeenCalledWith({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      plural: 'gatewayclasses',
    });

    await res.listGateways({ namespace: 'my-ns' });
    expect(mockApiClient.listNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      namespace: 'my-ns',
      plural: 'gateways',
    });

    await res.listHTTPRoutes();
    expect(mockApiClient.listClusterCustomObject).toHaveBeenCalledWith({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      plural: 'httproutes',
    });
  });

  it('propagates non-404 custom resource errors', async () => {
    mockApiClient.listClusterCustomObject.mockRejectedValueOnce(new Error('Internal server error'));
    await expect(res.listGatewayClasses()).rejects.toThrow('Internal server error');
  });

  it('resolves empty array on 404 custom resource errors', async () => {
    mockApiClient.listClusterCustomObject.mockRejectedValueOnce({ statusCode: 404 });
    const result = await res.listGatewayClasses();
    expect(result).toEqual([]);
  });

  it('converts labels to selector string correctly', () => {
    expect(res.labelsToSelector({ app: 'web', env: 'prod' })).toBe('app=web,env=prod');
    expect(res.labelsToSelector()).toBe('');
  });
});
