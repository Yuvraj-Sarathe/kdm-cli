import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registry, PodAnalyzer, DeploymentAnalyzer } from '../analyzers';
import { runAnalysis } from '../analysis/analysis';
import { clearConfig, setAIConfig } from '../config/store';
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

describe('AI Explain Mode', () => {
  beforeEach(() => {
    clearConfig();
    registry.clear();
    registry.register(PodAnalyzer);
    registry.register(DeploymentAnalyzer);
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

    const errorAnalyzer = {
      name: 'TestPod',
      analyze: async () => [{
        kind: 'Pod',
        name: 'crash-pod',
        namespace: 'default',
        errors: [{ text: 'CrashLoopBackOff: back-off restarting failed container' }],
      }],
    };
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

    const errorAnalyzer = {
      name: 'TestBackend',
      analyze: async () => [{
        kind: 'Pod',
        name: 'test-pod',
        namespace: 'default',
        errors: [{ text: 'Error' }],
      }],
    };
    registry.register(errorAnalyzer);

    const output = await runAnalysis({
      filters: ['TestBackend'],
      explain: true,
      backend: 'noop',
    });

    expect(output.results[0].details).toBe('noop completion explanation');
  });

  it('returns clear error for missing provider', async () => {
    const errorAnalyzer = {
      name: 'TestMissing',
      analyze: async () => [{
        kind: 'Pod',
        name: 'test',
        namespace: 'default',
        errors: [{ text: 'Error' }],
      }],
    };
    registry.register(errorAnalyzer);

    await expect(
      runAnalysis({ filters: ['TestMissing'], explain: true, backend: 'nonexistent-provider' }),
    ).rejects.toThrow('Unsupported AI provider');
  });

  it('includes details in JSON output when --explain is used', async () => {
    setAIConfig({ providers: [{ name: 'noop', model: '' }] });

    const errorAnalyzer = {
      name: 'TestJson',
      analyze: async () => [{
        kind: 'Pod',
        name: 'json-pod',
        namespace: 'default',
        errors: [{ text: 'Error' }],
      }],
    };
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
    const errorAnalyzer = {
      name: 'NoExplain',
      analyze: async () => [{
        kind: 'Pod',
        name: 'pod-1',
        namespace: 'default',
        errors: [{ text: 'Error' }],
      }],
    };
    registry.register(errorAnalyzer);

    const output = await runAnalysis({ filters: ['NoExplain'] });
    expect(output.results[0].details).toBeUndefined();
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
