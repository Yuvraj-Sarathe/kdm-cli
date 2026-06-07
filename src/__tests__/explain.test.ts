import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registry, PodAnalyzer, DeploymentAnalyzer } from '../analyzers';
import { runAnalysis } from '../analysis/analysis';
import { clearConfig, setAIConfig, setCacheConfig } from '../config/store';
import { buildPrompt, buildDefaultPrompt } from '../ai/prompts';
import { anonymize, deanonymize } from '../utils/text';

vi.mock('conf', () => {
  const mockConfigStore = new Map<string, any>();
  const mockConfInstance = {
    get store() {
      return Object.fromEntries(mockConfigStore.entries());
    },
    set: vi.fn((key, val) => {
      mockConfigStore.set(key, val);
    }),
    get: vi.fn((key) => mockConfigStore.get(key)),
    delete: vi.fn((key) => {
      mockConfigStore.delete(key);
    }),
    clear: vi.fn(() => {
      mockConfigStore.clear();
    }),
  };
  return {
    default: class MockConf {
      constructor() {
        return mockConfInstance;
      }
    },
  };
});

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

const mockCache = {
  name: 'file',
  configure: vi.fn(),
  store: vi.fn(),
  load: vi.fn(async () => null),
  list: vi.fn(async () => []),
  remove: vi.fn(),
  exists: vi.fn(async () => false),
  purge: vi.fn(),
};

vi.mock('../cache', () => ({
  createCacheProvider: vi.fn(() => mockCache),
}));

describe('AI Explain Mode', () => {
  beforeEach(() => {
    clearConfig();
    registry.clear();
    registry.register(PodAnalyzer);
    registry.register(DeploymentAnalyzer);
  });

  const createMockAnalyzer = (name: string, podName: string, errors: string[]) => ({
    name,
    analyze: async () => [{
      kind: 'Pod',
      name: podName,
      namespace: 'default',
      errors: errors.map((text) => ({ text })),
    }],
  });

  it('skips AI when no analyzer results exist', async () => {
    const output = await runAnalysis({
      filters: ['Pod'],
      explain: true,
      backend: 'noop',
    });
    expect(output.status).toBe('OK');
    expect(output.results).toEqual([]);
  });

  it('enriches results with details when --explain is used with noop provider', async () => {
    setAIConfig({ providers: [{ name: 'noop', model: '' }] });

    const errorAnalyzer = createMockAnalyzer('TestPod', 'crash-pod', ['CrashLoopBackOff: back-off restarting failed container']);
    registry.register(errorAnalyzer);

    const output = await runAnalysis({
      filters: ['TestPod'],
      explain: true,
      backend: 'noop',
    });

    expect(output.status).toBe('ProblemDetected');
    expect(output.results[0].details).toBe('noop completion explanation');
  });

  it('uses --backend override instead of default provider', async () => {
    setAIConfig({
      providers: [{ name: 'noop', model: '' }],
      defaultProvider: 'openai',
    });

    const errorAnalyzer = createMockAnalyzer('TestBackend', 'test-pod', ['Error']);
    registry.register(errorAnalyzer);

    const output = await runAnalysis({
      filters: ['TestBackend'],
      explain: true,
      backend: 'noop',
    });

    expect(output.results[0].details).toBe('noop completion explanation');
  });

  it('returns clear error for missing provider', async () => {
    const errorAnalyzer = createMockAnalyzer('TestMissing', 'test', ['Error']);
    registry.register(errorAnalyzer);

    await expect(
      runAnalysis({ filters: ['TestMissing'], explain: true, backend: 'nonexistent-provider' }),
    ).rejects.toThrow('Unsupported AI provider');
  });

  it('includes details in JSON output when --explain is used', async () => {
    setAIConfig({ providers: [{ name: 'noop', model: '' }] });

    const errorAnalyzer = createMockAnalyzer('TestJson', 'json-pod', ['Error']);
    registry.register(errorAnalyzer);

    const output = await runAnalysis({
      filters: ['TestJson'],
      explain: true,
      backend: 'noop',
      output: 'json',
    });

    expect(output.results[0].details).toBeDefined();
    expect(typeof output.results[0].details).toBe('string');
  });

  it('does not add details when --explain is not set', async () => {
    const errorAnalyzer = createMockAnalyzer('NoExplain', 'pod-1', ['Error']);
    registry.register(errorAnalyzer);

    const output = await runAnalysis({ filters: ['NoExplain'] });
    expect(output.results[0].details).toBeUndefined();
  });

  it('anonymizes and deanonymizes error text when anonymize: true is used', async () => {
    setAIConfig({ providers: [{ name: 'noop', model: '' }] });
    const errorAnalyzer = createMockAnalyzer('TestAnonymize', 'sensitive-pod', ['Error in sensitive-pod']);
    registry.register(errorAnalyzer);

    const output = await runAnalysis({
      filters: ['TestAnonymize'],
      explain: true,
      backend: 'noop',
      anonymize: true,
    });

    expect(output.results[0].details).toBeDefined();
  });

  it('loads explanation from cache when cache hit occurs', async () => {
    setCacheConfig({ type: 'file', enabled: true });
    vi.mocked(mockCache.load).mockResolvedValueOnce('cached explanation');

    setAIConfig({ providers: [{ name: 'noop', model: '' }] });
    const errorAnalyzer = createMockAnalyzer('TestCache', 'cache-pod', ['Error']);
    registry.register(errorAnalyzer);

    const output = await runAnalysis({
      filters: ['TestCache'],
      explain: true,
      backend: 'noop',
    });

    expect(output.results[0].details).toBe('cached explanation');
  });
});

describe('Prompt Building', () => {
  it('builds a default prompt with language and failure text', () => {
    const prompt = buildDefaultPrompt({ failureText: 'OOMKilled', language: 'english' });
    expect(prompt).toContain('OOMKilled');
    expect(prompt).toContain('english');
    expect(prompt).toContain('root cause');
  });

  it.each([
    { lang: 'spanish', failureText: 'CrashLoopBackOff' },
    { lang: 'french', failureText: 'ImagePullBackOff' },
  ])('builds prompt for language $lang', ({ lang, failureText }) => {
    const prompt = buildPrompt({ failureText, language: lang });
    expect(prompt).toContain(failureText);
    expect(prompt).toContain(lang);
  });
});

describe('Text Anonymization', () => {
  it('replaces K8s resource names with masked placeholders', () => {
    const result = anonymize('Pod my-app-6d8f7b crashed in kube-system');
    expect(result.text).toContain('MASKED_');
    expect(result.text).not.toContain('my-app-6d8f7b');
    expect(result.mapping.length).toBeGreaterThan(0);
  });

  it('restores original names from masked text', () => {
    const result = anonymize('Pod my-app-6d8f7b crashed');
    const restored = deanonymize('MASKED_0 is the problem', result.mapping);
    expect(restored).toContain('my-app-6d8f7b');
  });

  it('handles text with no K8s resource names', () => {
    const result = anonymize('simple text');
    expect(result.text).toBe('simple text');
    expect(result.mapping).toEqual([]);
  });
});
