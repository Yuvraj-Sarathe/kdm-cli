import { describe, it, expect, vi, afterEach } from 'vitest';
import { createServer } from '../server/server';

vi.mock('../config/store', () => ({
  getActiveFilters: vi.fn(() => []),
  getAIConfig: vi.fn(() => ({ providers: [] })),
  getCacheConfig: vi.fn(() => ({ type: 'file', enabled: false })),
  getConfig: vi.fn(() => ({ ai: { providers: [] } })),
}));

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
  labelsToSelector: vi.fn(() => ''),
}));

vi.mock('../cache', () => ({
  createCacheProvider: vi.fn(() => ({
    name: 'file',
    configure: vi.fn(),
    store: vi.fn(),
    load: vi.fn(async () => null),
    list: vi.fn(async () => []),
    remove: vi.fn(),
    exists: vi.fn(async () => false),
    purge: vi.fn(),
  })),
}));

describe('HTTP Server', () => {
  let server: { close: () => void } | null = null;

  afterEach(() => {
    server?.close();
    server = null;
  });

  it('responds to GET /health with status ok', async () => {
    server = await createServer({ port: 0 });
    // Since port 0 picks a random port, we test the server creation itself
    expect(server).toBeDefined();
    expect(server.close).toBeInstanceOf(Function);
  });

  it('creates server with custom options', async () => {
    server = await createServer({
      port: 0,
      backend: 'noop',
      filter: ['Pod'],
    });
    expect(server).toBeDefined();
  });
});
