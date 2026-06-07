import { describe, it, expect, vi } from 'vitest';
import { createMCPTools } from '../server/mcp';

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

describe('MCP Tools', () => {
  it('registers all expected tools', () => {
    const tools = createMCPTools();
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain('analyze_cluster');
    expect(names).toContain('list_filters');
    expect(names).toContain('get_cluster_health');
    expect(names).toContain('get_resource_issues');
  });

  it('list_filters returns available filters', async () => {
    const tools = createMCPTools();
    const listTool = tools.find((t) => t.name === 'list_filters')!;
    const result = await listTool.handler({}) as any;
    expect(result.filters).toBeDefined();
    expect(Array.isArray(result.filters)).toBe(true);
    expect(result.filters.length).toBeGreaterThan(0);
  });

  it('get_cluster_health returns status', async () => {
    const tools = createMCPTools();
    const healthTool = tools.find((t) => t.name === 'get_cluster_health')!;
    const result = await healthTool.handler({}) as any;
    expect(result.status).toBe('OK');
    expect(result.problems).toBe(0);
  });

  it('analyze_cluster runs analysis', async () => {
    const tools = createMCPTools();
    const analyzeTool = tools.find((t) => t.name === 'analyze_cluster')!;
    const result = await analyzeTool.handler({ filters: ['Pod'] }) as any;
    expect(result.status).toBeDefined();
  });

  it('get_resource_issues filters by kind', async () => {
    const tools = createMCPTools();
    const issuesTool = tools.find((t) => t.name === 'get_resource_issues')!;
    const result = await issuesTool.handler({ kind: 'Pod' }) as any;
    expect(result.status).toBe('OK');
  });
});
