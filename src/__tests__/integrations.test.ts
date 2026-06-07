import { describe, it, expect, vi } from 'vitest';
import { createCustomAnalyzer, type CustomAnalyzerConfig } from '../analyzers/custom';

describe('Custom Analyzers', () => {
  it('returns error when neither command nor URL is set', async () => {
    const config: CustomAnalyzerConfig = { name: 'test-empty' };
    const analyzer = createCustomAnalyzer(config);
    const results = await analyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('neither command nor URL');
  });

  it('returns error when command fails', async () => {
    const config: CustomAnalyzerConfig = { name: 'test-fail', command: 'false' };
    const analyzer = createCustomAnalyzer(config);
    const results = await analyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('failed');
  });

  it('returns error when HTTP URL is unreachable', async () => {
    const config: CustomAnalyzerConfig = {
      name: 'test-http-fail',
      url: 'http://localhost:99999/nonexistent',
    };
    const analyzer = createCustomAnalyzer(config);
    const results = await analyzer.analyze({});
    expect(results).toHaveLength(1);
    expect(results[0].errors[0].text).toContain('HTTP call failed');
  });

  it('creates analyzer with correct name', () => {
    const config: CustomAnalyzerConfig = { name: 'my-custom', command: 'echo {}' };
    const analyzer = createCustomAnalyzer(config);
    expect(analyzer.name).toBe('my-custom');
  });
});
