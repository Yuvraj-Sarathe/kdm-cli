import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listReplicaSets,
  listStatefulSets,
  listDaemonSets,
  listJobs,
  listCronJobs,
  listIngresses,
  listConfigMaps,
  listHPAs,
  listPDBs,
  listNetworkPolicies,
  listEvents,
  listPods,
  listStorageClasses,
  listPersistentVolumeClaims,
  listGatewayClasses,
  listGateways,
  listHTTPRoutes,
} from '../kubernetes/resources';
import {
  ReplicaSetAnalyzer,
  StatefulSetAnalyzer,
  DaemonSetAnalyzer,
  JobAnalyzer,
  CronJobAnalyzer,
  IngressAnalyzer,
  ConfigMapAnalyzer,
  HPAAnalyzer,
  PDBAnalyzer,
  NetworkPolicyAnalyzer,
  EventsAnalyzer,
  StorageAnalyzer,
  GatewayClassAnalyzer,
  GatewayAnalyzer,
  HTTPRouteAnalyzer,
} from '../analyzers';

vi.mock('../kubernetes/resources', () => ({
  listPods: vi.fn(async () => []),
  listDeployments: vi.fn(async () => []),
  listServices: vi.fn(async () => []),
  listPersistentVolumeClaims: vi.fn(async () => []),
  listNodes: vi.fn(async () => []),
  listReplicaSets: vi.fn(async () => []),
  listStatefulSets: vi.fn(async () => []),
  listDaemonSets: vi.fn(async () => []),
  listJobs: vi.fn(async () => []),
  listCronJobs: vi.fn(async () => []),
  listIngresses: vi.fn(async () => []),
  listConfigMaps: vi.fn(async () => []),
  listHPAs: vi.fn(async () => []),
  listPDBs: vi.fn(async () => []),
  listNetworkPolicies: vi.fn(async () => []),
  listEvents: vi.fn(async () => []),
  listStorageClasses: vi.fn(async () => []),
  listGatewayClasses: vi.fn(async () => []),
  listGateways: vi.fn(async () => []),
  listHTTPRoutes: vi.fn(async () => []),
  readEndpoints: vi.fn(async () => undefined),
  readPodLog: vi.fn(async () => ''),
  labelsToSelector: (labels: Record<string, string> = {}) =>
    Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(','),
}));

describe('Phase 8 Analyzers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects ReplicaSet with insufficient ready replicas', async () => {
    vi.mocked(listReplicaSets).mockResolvedValueOnce([{
      metadata: { name: 'rs-1', namespace: 'default' },
      spec: { replicas: 3 },
      status: { readyReplicas: 1 },
    } as any]);

    const results = await ReplicaSetAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('1/3 ready replicas');
  });

  it('detects StatefulSet with insufficient ready replicas', async () => {
    vi.mocked(listStatefulSets).mockResolvedValueOnce([{
      metadata: { name: 'ss-1', namespace: 'default' },
      spec: { replicas: 3 },
      status: { readyReplicas: 0 },
    } as any]);

    const results = await StatefulSetAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('0/3 ready replicas');
  });

  it('detects DaemonSet with misscheduled pods', async () => {
    vi.mocked(listDaemonSets).mockResolvedValueOnce([{
      metadata: { name: 'ds-1', namespace: 'default' },
      status: { desiredNumberScheduled: 3, numberReady: 2, numberMisscheduled: 1 },
    } as any]);

    const results = await DaemonSetAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    const errorTexts = results[0].errors.map((e) => e.text).join('\n');
    expect(errorTexts).toContain('2/3 ready pods');
    expect(errorTexts).toContain('1 misscheduled');
  });

  it('detects Job with failed pods', async () => {
    vi.mocked(listJobs).mockResolvedValueOnce([{
      metadata: { name: 'job-1', namespace: 'default' },
      spec: { backoffLimit: 3 },
      status: { failed: 3, conditions: [{ type: 'Failed', status: 'True', reason: 'BackoffLimitExceeded' }] },
    } as any]);

    const results = await JobAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    const errorTexts = results[0].errors.map((e) => e.text).join('\n');
    expect(errorTexts).toContain('3 failed pods');
    expect(errorTexts).toContain('BackoffLimitExceeded');
  });

  it('detects suspended CronJob', async () => {
    vi.mocked(listCronJobs).mockResolvedValueOnce([{
      metadata: { name: 'cj-1', namespace: 'default' },
      spec: { schedule: '*/5 * * * *', suspend: true },
    } as any]);

    const results = await CronJobAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('suspended');
  });

  it('detects Ingress with no rules', async () => {
    vi.mocked(listIngresses).mockResolvedValueOnce([{
      metadata: { name: 'ing-1', namespace: 'default' },
      spec: {},
    } as any]);

    const results = await IngressAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('no rules defined');
  });

  it('detects empty ConfigMap', async () => {
    vi.mocked(listConfigMaps).mockResolvedValueOnce([{
      metadata: { name: 'cm-1', namespace: 'default' },
    } as any]);

    const results = await ConfigMapAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('no data keys');
  });

  it('detects HPA at max replicas', async () => {
    vi.mocked(listHPAs).mockResolvedValueOnce([{
      metadata: { name: 'hpa-1', namespace: 'default' },
      spec: { maxReplicas: 10 },
      status: { currentReplicas: 10 },
    } as any]);

    const results = await HPAAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('maximum replicas');
  });

  it('detects PDB with zero disruptions allowed', async () => {
    vi.mocked(listPDBs).mockResolvedValueOnce([{
      metadata: { name: 'pdb-1', namespace: 'default' },
      status: { disruptionsAllowed: 0, expectedPods: 3, currentHealthy: 2 },
    } as any]);

    const results = await PDBAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    const errorTexts = results[0].errors.map((e) => e.text).join('\n');
    expect(errorTexts).toContain('zero disruptions');
    expect(errorTexts).toContain('2/3 healthy pods');
  });

  it('detects NetworkPolicy with empty podSelector', async () => {
    vi.mocked(listNetworkPolicies).mockResolvedValueOnce([{
      metadata: { name: 'np-1', namespace: 'default' },
      spec: { podSelector: {}, policyTypes: ['Ingress'], ingress: [] },
    } as any]);

    const results = await NetworkPolicyAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    const errorTexts = results[0].errors.map((e) => e.text).join('\n');
    expect(errorTexts).toContain('empty podSelector');
  });

  it('detects Warning events', async () => {
    vi.mocked(listEvents).mockResolvedValueOnce([{
      metadata: { name: 'evt-1', namespace: 'default' },
      type: 'Warning',
      reason: 'FailedScheduling',
      message: 'Insufficient cpu',
      involvedObject: { name: 'my-pod', kind: 'Pod' },
    } as any]);

    const results = await EventsAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('FailedScheduling');
  });

  it('detects StorageClass with no provisioner', async () => {
    vi.mocked(listStorageClasses).mockResolvedValueOnce([{
      metadata: { name: 'sc-1' },
    } as any]);
    vi.mocked(listPersistentVolumeClaims).mockResolvedValueOnce([]);

    const results = await StorageAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('no provisioner');
  });

  it('detects GatewayClass not accepted', async () => {
    vi.mocked(listGatewayClasses).mockResolvedValueOnce([{
      metadata: { name: 'gc-1' },
      status: { conditions: [{ type: 'Accepted', status: 'False', reason: 'InvalidConfig' }] },
    }]);

    const results = await GatewayClassAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('not accepted');
  });

  it('detects Gateway with no listeners', async () => {
    vi.mocked(listGateways).mockResolvedValueOnce([{
      metadata: { name: 'gw-1', namespace: 'default' },
      spec: {},
    }]);

    const results = await GatewayAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('no listeners');
  });

  it('detects HTTPRoute not accepted', async () => {
    vi.mocked(listHTTPRoutes).mockResolvedValueOnce([{
      metadata: { name: 'hr-1', namespace: 'default' },
      spec: { rules: [{ backendRefs: [] }] },
      status: { parents: [{ conditions: [{ type: 'Accepted', status: 'False', reason: 'NoMatchingParent' }] }] },
    }]);

    const results = await HTTPRouteAnalyzer.analyze({});
    expect(results).toHaveLength(1);
    const errorTexts = results[0].errors.map((e) => e.text).join('\n');
    expect(errorTexts).toContain('not accepted');
  });

  it.each([
    { analyzer: ReplicaSetAnalyzer, mockFn: 'listReplicaSets' },
    { analyzer: StatefulSetAnalyzer, mockFn: 'listStatefulSets' },
    { analyzer: DaemonSetAnalyzer, mockFn: 'listDaemonSets' },
    { analyzer: JobAnalyzer, mockFn: 'listJobs' },
    { analyzer: CronJobAnalyzer, mockFn: 'listCronJobs' },
    { analyzer: IngressAnalyzer, mockFn: 'listIngresses' },
    { analyzer: ConfigMapAnalyzer, mockFn: 'listConfigMaps' },
    { analyzer: HPAAnalyzer, mockFn: 'listHPAs' },
    { analyzer: PDBAnalyzer, mockFn: 'listPDBs' },
    { analyzer: NetworkPolicyAnalyzer, mockFn: 'listNetworkPolicies' },
    { analyzer: EventsAnalyzer, mockFn: 'listEvents' },
  ])('returns empty results when $mockFn returns no items', async ({ analyzer }) => {
    const results = await analyzer.analyze({});
    expect(results).toEqual([]);
  });
});
