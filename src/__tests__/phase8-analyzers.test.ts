/**
 * Comprehensive unit tests for Phase 8 Kubernetes analyzers.
 * Covers failure detection, healthy-resource green paths, API failure propagation,
 * result metadata (kind/name/namespace), and edge cases for every analyzer.
 *
 * Follows coding_style.md rules:
 *   - it.each parameterized testing to avoid structural duplication
 *   - JSDoc coverage on test utilities and describe blocks
 */

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
  readPodLog,
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
import { SecurityAnalyzer } from '../analyzers/security';
import { LogAnalyzer } from '../analyzers/log-analyzer';

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

/**
 * Joins all error text from an AnalyzerResult array into a single string for assertion.
 * @param results Array of analyzer results.
 * @returns Concatenated error text.
 */
const joinErrors = (results: any[]) =>
  results.flatMap((r: any) => r.errors.map((e: any) => e.text)).join('\n');

// ─── ReplicaSet Analyzer ───────────────────────────────────────────

describe('ReplicaSetAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects insufficient ready replicas and reports correct metadata', async () => {
    vi.mocked(listReplicaSets).mockResolvedValueOnce([{
      metadata: { name: 'api-rs', namespace: 'production' },
      spec: { replicas: 5 },
      status: { readyReplicas: 2 },
    } as any]);

    const results = await ReplicaSetAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('ReplicaSet');
    expect(results[0].name).toBe('api-rs');
    expect(results[0].namespace).toBe('production');
    expect(results[0].errors[0].text).toContain('2/5 ready replicas');
  });

  it('detects condition failures with message text', async () => {
    vi.mocked(listReplicaSets).mockResolvedValueOnce([{
      metadata: { name: 'rs-cond', namespace: 'default' },
      spec: { replicas: 1 },
      status: {
        readyReplicas: 1,
        conditions: [
          { type: 'ReplicaFailure', status: 'False', message: 'quota exceeded' },
        ],
      },
    } as any]);

    const results = await ReplicaSetAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(joinErrors(results)).toContain('ReplicaFailure');
    expect(joinErrors(results)).toContain('quota exceeded');
  });

  it('returns empty for healthy ReplicaSet with all replicas ready', async () => {
    vi.mocked(listReplicaSets).mockResolvedValueOnce([{
      metadata: { name: 'healthy-rs', namespace: 'default' },
      spec: { replicas: 3 },
      status: { readyReplicas: 3 },
    } as any]);

    await expect(ReplicaSetAnalyzer.analyze({})).resolves.toEqual([]);
  });

  it('skips ReplicaSets with zero desired replicas', async () => {
    vi.mocked(listReplicaSets).mockResolvedValueOnce([{
      metadata: { name: 'scaled-down', namespace: 'default' },
      spec: { replicas: 0 },
      status: { readyReplicas: 0 },
    } as any]);

    await expect(ReplicaSetAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── StatefulSet Analyzer ──────────────────────────────────────────

describe('StatefulSetAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects insufficient ready replicas and reports correct metadata', async () => {
    vi.mocked(listStatefulSets).mockResolvedValueOnce([{
      metadata: { name: 'redis', namespace: 'cache' },
      spec: { replicas: 3 },
      status: { readyReplicas: 0 },
    } as any]);

    const results = await StatefulSetAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('StatefulSet');
    expect(results[0].name).toBe('redis');
    expect(results[0].namespace).toBe('cache');
    expect(results[0].errors[0].text).toContain('0/3 ready replicas');
  });

  it('returns empty for healthy StatefulSet', async () => {
    vi.mocked(listStatefulSets).mockResolvedValueOnce([{
      metadata: { name: 'healthy-ss', namespace: 'default' },
      spec: { replicas: 2 },
      status: { readyReplicas: 2 },
    } as any]);

    await expect(StatefulSetAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── DaemonSet Analyzer ────────────────────────────────────────────

describe('DaemonSetAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects both unavailable and misscheduled pods', async () => {
    vi.mocked(listDaemonSets).mockResolvedValueOnce([{
      metadata: { name: 'fluentd', namespace: 'logging' },
      status: { desiredNumberScheduled: 5, numberReady: 3, numberMisscheduled: 2 },
    } as any]);

    const results = await DaemonSetAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('DaemonSet');
    expect(results[0].name).toBe('fluentd');
    expect(results[0].namespace).toBe('logging');
    const errors = joinErrors(results);
    expect(errors).toContain('3/5 ready pods');
    expect(errors).toContain('2 misscheduled pods');
  });

  it('returns empty when all pods are ready and none misscheduled', async () => {
    vi.mocked(listDaemonSets).mockResolvedValueOnce([{
      metadata: { name: 'healthy-ds', namespace: 'default' },
      status: { desiredNumberScheduled: 3, numberReady: 3, numberMisscheduled: 0 },
    } as any]);

    await expect(DaemonSetAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Job Analyzer ──────────────────────────────────────────────────

describe('JobAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects failed pods, failure condition, and backoff limit exceeded', async () => {
    vi.mocked(listJobs).mockResolvedValueOnce([{
      metadata: { name: 'etl-job', namespace: 'batch' },
      spec: { backoffLimit: 3 },
      status: {
        failed: 3,
        conditions: [{ type: 'Failed', status: 'True', reason: 'BackoffLimitExceeded', message: 'Job reached backoff limit' }],
      },
    } as any]);

    const results = await JobAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Job');
    expect(results[0].name).toBe('etl-job');
    const errors = joinErrors(results);
    expect(errors).toContain('3 failed pods');
    expect(errors).toContain('BackoffLimitExceeded');
    expect(errors).toContain('exceeded backoff limit');
  });

  it('uses singular "pod" for single failure', async () => {
    vi.mocked(listJobs).mockResolvedValueOnce([{
      metadata: { name: 'one-fail', namespace: 'default' },
      spec: { backoffLimit: 6 },
      status: { failed: 1 },
    } as any]);

    const results = await JobAnalyzer.analyze({});
    expect(results[0].errors[0].text).toBe('Job has 1 failed pod');
  });

  it('returns empty for completed Job', async () => {
    vi.mocked(listJobs).mockResolvedValueOnce([{
      metadata: { name: 'done-job', namespace: 'default' },
      spec: { backoffLimit: 6 },
      status: { succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] },
    } as any]);

    await expect(JobAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── CronJob Analyzer ──────────────────────────────────────────────

describe('CronJobAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects suspended CronJob', async () => {
    vi.mocked(listCronJobs).mockResolvedValueOnce([{
      metadata: { name: 'backup', namespace: 'ops' },
      spec: { schedule: '0 2 * * *', suspend: true },
    } as any]);

    const results = await CronJobAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('CronJob');
    expect(results[0].name).toBe('backup');
    expect(results[0].errors[0].text).toContain('suspended');
  });

  it('detects CronJob with no schedule', async () => {
    vi.mocked(listCronJobs).mockResolvedValueOnce([{
      metadata: { name: 'no-sched', namespace: 'default' },
      spec: {},
    } as any]);

    const results = await CronJobAnalyzer.analyze({});
    expect(joinErrors(results)).toContain('no schedule defined');
  });

  it('returns empty for healthy CronJob', async () => {
    vi.mocked(listCronJobs).mockResolvedValueOnce([{
      metadata: { name: 'healthy-cj', namespace: 'default' },
      spec: { schedule: '*/5 * * * *', suspend: false },
    } as any]);

    await expect(CronJobAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Ingress Analyzer ──────────────────────────────────────────────

describe('IngressAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects Ingress with no rules', async () => {
    vi.mocked(listIngresses).mockResolvedValueOnce([{
      metadata: { name: 'empty-ing', namespace: 'web' },
      spec: {},
    } as any]);

    const results = await IngressAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Ingress');
    expect(results[0].errors[0].text).toContain('no rules defined');
  });

  it('detects hosts without TLS configuration', async () => {
    vi.mocked(listIngresses).mockResolvedValueOnce([{
      metadata: { name: 'no-tls', namespace: 'default' },
      spec: {
        rules: [{ host: 'api.example.com', http: { paths: [{ path: '/', backend: { service: { name: 'api' } } }] } }],
      },
    } as any]);

    const results = await IngressAnalyzer.analyze({});
    expect(joinErrors(results)).toContain('hosts but no TLS');
  });

  it('detects missing backend service on a rule path', async () => {
    vi.mocked(listIngresses).mockResolvedValueOnce([{
      metadata: { name: 'bad-backend', namespace: 'default' },
      spec: {
        rules: [{ host: 'app.test', http: { paths: [{ path: '/api', backend: {} }] } }],
      },
    } as any]);

    const results = await IngressAnalyzer.analyze({});
    expect(joinErrors(results)).toContain('no backend service');
  });

  it('returns empty for well-configured Ingress with TLS', async () => {
    vi.mocked(listIngresses).mockResolvedValueOnce([{
      metadata: { name: 'good-ing', namespace: 'default' },
      spec: {
        tls: [{ hosts: ['app.example.com'], secretName: 'tls-secret' }],
        rules: [{ host: 'app.example.com', http: { paths: [{ path: '/', backend: { service: { name: 'app' } } }] } }],
      },
    } as any]);

    await expect(IngressAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── ConfigMap Analyzer ────────────────────────────────────────────

describe('ConfigMapAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects empty ConfigMap with no data keys', async () => {
    vi.mocked(listConfigMaps).mockResolvedValueOnce([{
      metadata: { name: 'empty-cm', namespace: 'default' },
    } as any]);

    const results = await ConfigMapAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('ConfigMap');
    expect(results[0].errors[0].text).toContain('no data keys');
  });

  it('returns empty for ConfigMap with data', async () => {
    vi.mocked(listConfigMaps).mockResolvedValueOnce([{
      metadata: { name: 'app-config', namespace: 'default' },
      data: { 'config.yaml': 'key: value' },
    } as any]);

    await expect(ConfigMapAnalyzer.analyze({})).resolves.toEqual([]);
  });

  it('returns empty for ConfigMap with binary data only', async () => {
    vi.mocked(listConfigMaps).mockResolvedValueOnce([{
      metadata: { name: 'certs', namespace: 'default' },
      binaryData: { 'ca.crt': 'base64data' },
    } as any]);

    await expect(ConfigMapAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── HPA Analyzer ──────────────────────────────────────────────────

describe('HPAAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects HPA at maximum replicas', async () => {
    vi.mocked(listHPAs).mockResolvedValueOnce([{
      metadata: { name: 'web-hpa', namespace: 'production' },
      spec: { maxReplicas: 10 },
      status: { currentReplicas: 10 },
    } as any]);

    const results = await HPAAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('HorizontalPodAutoscaler');
    expect(results[0].errors[0].text).toContain('maximum replicas (10/10)');
  });

  it('detects ScalingLimited and AbleToScale=False conditions', async () => {
    vi.mocked(listHPAs).mockResolvedValueOnce([{
      metadata: { name: 'limited-hpa', namespace: 'default' },
      spec: { maxReplicas: 20 },
      status: {
        currentReplicas: 5,
        conditions: [
          { type: 'ScalingLimited', status: 'True', message: 'at max' },
          { type: 'AbleToScale', status: 'False', message: 'no metrics' },
        ],
      },
    } as any]);

    const results = await HPAAnalyzer.analyze({});
    const errors = joinErrors(results);
    expect(errors).toContain('scaling limited');
    expect(errors).toContain('unable to scale');
  });

  it('returns empty for HPA below max replicas with healthy conditions', async () => {
    vi.mocked(listHPAs).mockResolvedValueOnce([{
      metadata: { name: 'ok-hpa', namespace: 'default' },
      spec: { maxReplicas: 10 },
      status: { currentReplicas: 5 },
    } as any]);

    await expect(HPAAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── PDB Analyzer ──────────────────────────────────────────────────

describe('PDBAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects zero disruptions allowed and unhealthy pods', async () => {
    vi.mocked(listPDBs).mockResolvedValueOnce([{
      metadata: { name: 'api-pdb', namespace: 'default' },
      status: { disruptionsAllowed: 0, expectedPods: 3, currentHealthy: 2 },
    } as any]);

    const results = await PDBAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('PodDisruptionBudget');
    expect(results[0].name).toBe('api-pdb');
    const errors = joinErrors(results);
    expect(errors).toContain('zero disruptions');
    expect(errors).toContain('2/3 healthy pods');
  });

  it('returns empty when PDB allows disruptions and pods are healthy', async () => {
    vi.mocked(listPDBs).mockResolvedValueOnce([{
      metadata: { name: 'ok-pdb', namespace: 'default' },
      status: { disruptionsAllowed: 1, expectedPods: 3, currentHealthy: 3 },
    } as any]);

    await expect(PDBAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── NetworkPolicy Analyzer ────────────────────────────────────────

describe('NetworkPolicyAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects empty podSelector and missing ingress rules', async () => {
    vi.mocked(listNetworkPolicies).mockResolvedValueOnce([{
      metadata: { name: 'deny-all', namespace: 'secure' },
      spec: { podSelector: {}, policyTypes: ['Ingress'], ingress: [] },
    } as any]);

    const results = await NetworkPolicyAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('NetworkPolicy');
    const errors = joinErrors(results);
    expect(errors).toContain('empty podSelector');
    expect(errors).toContain('blocks all ingress');
  });

  it('detects missing egress rules when Egress policy declared', async () => {
    vi.mocked(listNetworkPolicies).mockResolvedValueOnce([{
      metadata: { name: 'no-egress', namespace: 'default' },
      spec: {
        podSelector: { matchLabels: { app: 'web' } },
        policyTypes: ['Egress'],
        egress: [],
      },
    } as any]);

    const results = await NetworkPolicyAnalyzer.analyze({});
    expect(joinErrors(results)).toContain('blocks all egress');
  });

  it('returns empty for NetworkPolicy with specific selector and matching rules', async () => {
    vi.mocked(listNetworkPolicies).mockResolvedValueOnce([{
      metadata: { name: 'allow-web', namespace: 'default' },
      spec: {
        podSelector: { matchLabels: { app: 'web' } },
        policyTypes: ['Ingress'],
        ingress: [{ from: [{ podSelector: { matchLabels: { role: 'api' } } }] }],
      },
    } as any]);

    await expect(NetworkPolicyAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Events Analyzer ───────────────────────────────────────────────

describe('EventsAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects Warning events and captures involvedObject metadata', async () => {
    vi.mocked(listEvents).mockResolvedValueOnce([{
      metadata: { name: 'evt-1', namespace: 'kube-system' },
      type: 'Warning',
      reason: 'FailedScheduling',
      message: 'Insufficient cpu',
      involvedObject: { name: 'my-pod', kind: 'Pod' },
    } as any]);

    const results = await EventsAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Event');
    expect(results[0].name).toBe('my-pod');
    expect(results[0].parentObject).toBe('Pod');
    expect(results[0].errors[0].text).toContain('FailedScheduling');
    expect(results[0].errors[0].text).toContain('Insufficient cpu');
  });

  it('ignores Normal events', async () => {
    vi.mocked(listEvents).mockResolvedValueOnce([{
      metadata: { name: 'evt-normal', namespace: 'default' },
      type: 'Normal',
      reason: 'Scheduled',
      message: 'Successfully assigned',
      involvedObject: { name: 'pod-1', kind: 'Pod' },
    } as any]);

    await expect(EventsAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Storage Analyzer ──────────────────────────────────────────────

describe('StorageAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects StorageClass with no provisioner', async () => {
    vi.mocked(listStorageClasses).mockResolvedValueOnce([{
      metadata: { name: 'bad-sc' },
    } as any]);
    vi.mocked(listPersistentVolumeClaims).mockResolvedValueOnce([]);

    const results = await StorageAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Storage');
    expect(results[0].errors[0].text).toContain('no provisioner');
  });

  it('detects PVC referencing non-existent StorageClass', async () => {
    vi.mocked(listStorageClasses).mockResolvedValueOnce([{
      metadata: { name: 'gp2' },
      provisioner: 'ebs.csi.aws.com',
    } as any]);
    vi.mocked(listPersistentVolumeClaims).mockResolvedValueOnce([{
      metadata: { name: 'orphan-pvc', namespace: 'default' },
      spec: { storageClassName: 'deleted-class' },
    } as any]);

    const results = await StorageAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('orphan-pvc');
    expect(results[0].errors[0].text).toContain("'deleted-class' which does not exist");
  });

  it('returns empty for valid StorageClass and matching PVCs', async () => {
    vi.mocked(listStorageClasses).mockResolvedValueOnce([{
      metadata: { name: 'gp2' },
      provisioner: 'ebs.csi.aws.com',
    } as any]);
    vi.mocked(listPersistentVolumeClaims).mockResolvedValueOnce([{
      metadata: { name: 'data-pvc', namespace: 'default' },
      spec: { storageClassName: 'gp2' },
    } as any]);

    await expect(StorageAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Security Analyzer ─────────────────────────────────────────────

describe('SecurityAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects root user, privileged mode, and missing readOnlyRootFilesystem', async () => {
    vi.mocked(listPods).mockResolvedValueOnce([{
      metadata: { name: 'insecure-pod', namespace: 'default' },
      spec: {
        containers: [{
          name: 'app',
          securityContext: { privileged: true },
        }],
      },
    } as any]);

    const results = await SecurityAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Security');
    expect(results[0].name).toBe('insecure-pod');
    const errors = joinErrors(results);
    expect(errors).toContain('may run as root');
    expect(errors).toContain('privileged mode');
    expect(errors).toContain('read-only root filesystem');
  });

  it('returns empty for fully hardened pod', async () => {
    vi.mocked(listPods).mockResolvedValueOnce([{
      metadata: { name: 'secure-pod', namespace: 'default' },
      spec: {
        securityContext: { runAsNonRoot: true },
        containers: [{
          name: 'app',
          securityContext: { readOnlyRootFilesystem: true },
        }],
      },
    } as any]);

    await expect(SecurityAnalyzer.analyze({})).resolves.toEqual([]);
  });

  it('respects pod-level runAsNonRoot when container-level is absent', async () => {
    vi.mocked(listPods).mockResolvedValueOnce([{
      metadata: { name: 'pod-level-sec', namespace: 'default' },
      spec: {
        securityContext: { runAsNonRoot: true },
        containers: [{
          name: 'app',
          securityContext: { readOnlyRootFilesystem: true },
        }],
      },
    } as any]);

    await expect(SecurityAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Log Analyzer ──────────────────────────────────────────────────

describe('LogAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects ERROR patterns in unhealthy pod logs', async () => {
    vi.mocked(listPods).mockResolvedValueOnce([{
      metadata: { name: 'crash-pod', namespace: 'default' },
      status: {
        phase: 'Running',
        containerStatuses: [{ name: 'app', ready: false }],
      },
      spec: { containers: [{ name: 'app' }] },
    } as any]);
    vi.mocked(readPodLog).mockResolvedValueOnce(
      'INFO: starting\nERROR: connection refused\nFATAL: shutting down',
    );

    const results = await LogAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Log');
    expect(results[0].name).toBe('crash-pod');
    const errors = joinErrors(results);
    expect(errors).toContain('ERROR: connection refused');
    expect(errors).toContain('FATAL: shutting down');
  });

  it('skips healthy pods entirely', async () => {
    vi.mocked(listPods).mockResolvedValueOnce([{
      metadata: { name: 'ok-pod', namespace: 'default' },
      status: { phase: 'Running', containerStatuses: [{ name: 'app', ready: true }] },
      spec: { containers: [{ name: 'app' }] },
    } as any]);

    await expect(LogAnalyzer.analyze({})).resolves.toEqual([]);
    expect(readPodLog).not.toHaveBeenCalled();
  });

  it('returns empty when unhealthy pod logs contain no error patterns', async () => {
    vi.mocked(listPods).mockResolvedValueOnce([{
      metadata: { name: 'slow-pod', namespace: 'default' },
      status: { phase: 'Failed' },
      spec: { containers: [{ name: 'worker' }] },
    } as any]);
    vi.mocked(readPodLog).mockResolvedValueOnce('INFO: processing\nDEBUG: complete');

    await expect(LogAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Gateway API Analyzers ─────────────────────────────────────────

describe('GatewayClassAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects GatewayClass not accepted with reason', async () => {
    vi.mocked(listGatewayClasses).mockResolvedValueOnce([{
      metadata: { name: 'istio' },
      status: { conditions: [{ type: 'Accepted', status: 'False', reason: 'InvalidConfig', message: 'bad params' }] },
    }]);

    const results = await GatewayClassAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('GatewayClass');
    expect(results[0].name).toBe('istio');
    expect(joinErrors(results)).toContain('not accepted');
    expect(joinErrors(results)).toContain('InvalidConfig');
  });

  it('returns empty for accepted GatewayClass', async () => {
    vi.mocked(listGatewayClasses).mockResolvedValueOnce([{
      metadata: { name: 'envoy' },
      status: { conditions: [{ type: 'Accepted', status: 'True' }] },
    }]);

    await expect(GatewayClassAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

describe('GatewayAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects Gateway with no listeners and not-programmed condition', async () => {
    vi.mocked(listGateways).mockResolvedValueOnce([{
      metadata: { name: 'main-gw', namespace: 'istio-system' },
      spec: {},
      status: { conditions: [{ type: 'Programmed', status: 'False', reason: 'AddressNotAssigned' }] },
    }]);

    const results = await GatewayAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('Gateway');
    const errors = joinErrors(results);
    expect(errors).toContain('no listeners');
    expect(errors).toContain('not programmed');
  });

  it('returns empty for fully configured Gateway', async () => {
    vi.mocked(listGateways).mockResolvedValueOnce([{
      metadata: { name: 'ok-gw', namespace: 'default' },
      spec: { listeners: [{ port: 80, protocol: 'HTTP' }] },
      status: { conditions: [{ type: 'Accepted', status: 'True' }, { type: 'Programmed', status: 'True' }] },
    }]);

    await expect(GatewayAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

describe('HTTPRouteAnalyzer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects HTTPRoute not accepted by parent and missing backend refs', async () => {
    vi.mocked(listHTTPRoutes).mockResolvedValueOnce([{
      metadata: { name: 'api-route', namespace: 'default' },
      spec: { rules: [{ backendRefs: [] }] },
      status: { parents: [{ conditions: [{ type: 'Accepted', status: 'False', reason: 'NoMatchingParent' }] }] },
    }]);

    const results = await HTTPRouteAnalyzer.analyze({});

    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('HTTPRoute');
    const errors = joinErrors(results);
    expect(errors).toContain('not accepted');
    expect(errors).toContain('no backend references');
  });

  it('returns empty for accepted HTTPRoute with valid backends', async () => {
    vi.mocked(listHTTPRoutes).mockResolvedValueOnce([{
      metadata: { name: 'ok-route', namespace: 'default' },
      spec: { rules: [{ backendRefs: [{ name: 'api-svc' }] }] },
      status: { parents: [{ conditions: [{ type: 'Accepted', status: 'True' }] }] },
    }]);

    await expect(HTTPRouteAnalyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Parameterized: Empty Input Returns Empty Results ──────────────

describe('Phase 8 analyzers — empty resource lists', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { name: 'ReplicaSet', analyzer: ReplicaSetAnalyzer },
    { name: 'StatefulSet', analyzer: StatefulSetAnalyzer },
    { name: 'DaemonSet', analyzer: DaemonSetAnalyzer },
    { name: 'Job', analyzer: JobAnalyzer },
    { name: 'CronJob', analyzer: CronJobAnalyzer },
    { name: 'Ingress', analyzer: IngressAnalyzer },
    { name: 'ConfigMap', analyzer: ConfigMapAnalyzer },
    { name: 'HPA', analyzer: HPAAnalyzer },
    { name: 'PDB', analyzer: PDBAnalyzer },
    { name: 'NetworkPolicy', analyzer: NetworkPolicyAnalyzer },
    { name: 'Events', analyzer: EventsAnalyzer },
    { name: 'Security', analyzer: SecurityAnalyzer },
    { name: 'Log', analyzer: LogAnalyzer },
    { name: 'GatewayClass', analyzer: GatewayClassAnalyzer },
    { name: 'Gateway', analyzer: GatewayAnalyzer },
    { name: 'HTTPRoute', analyzer: HTTPRouteAnalyzer },
  ])('$name analyzer returns empty when no resources exist', async ({ analyzer }) => {
    await expect(analyzer.analyze({})).resolves.toEqual([]);
  });
});

// ─── Parameterized: API Failure Propagation ────────────────────────

describe('Phase 8 analyzers — API failure propagation', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { name: 'ReplicaSet', listFn: listReplicaSets, analyzer: ReplicaSetAnalyzer },
    { name: 'StatefulSet', listFn: listStatefulSets, analyzer: StatefulSetAnalyzer },
    { name: 'DaemonSet', listFn: listDaemonSets, analyzer: DaemonSetAnalyzer },
    { name: 'Job', listFn: listJobs, analyzer: JobAnalyzer },
    { name: 'CronJob', listFn: listCronJobs, analyzer: CronJobAnalyzer },
    { name: 'Ingress', listFn: listIngresses, analyzer: IngressAnalyzer },
    { name: 'ConfigMap', listFn: listConfigMaps, analyzer: ConfigMapAnalyzer },
    { name: 'HPA', listFn: listHPAs, analyzer: HPAAnalyzer },
    { name: 'PDB', listFn: listPDBs, analyzer: PDBAnalyzer },
    { name: 'NetworkPolicy', listFn: listNetworkPolicies, analyzer: NetworkPolicyAnalyzer },
    { name: 'Events', listFn: listEvents, analyzer: EventsAnalyzer },
    { name: 'GatewayClass', listFn: listGatewayClasses, analyzer: GatewayClassAnalyzer },
    { name: 'Gateway', listFn: listGateways, analyzer: GatewayAnalyzer },
    { name: 'HTTPRoute', listFn: listHTTPRoutes, analyzer: HTTPRouteAnalyzer },
  ])('$name analyzer propagates API failure', async ({ listFn, analyzer }) => {
    vi.mocked(listFn as any).mockRejectedValueOnce(new Error('API timeout'));
    await expect(analyzer.analyze({})).rejects.toThrow('API timeout');
  });
});
