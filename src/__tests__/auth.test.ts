import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerAuthCommand } from '../commands/auth';
import { getAIConfig, setAIConfig } from '../config/store';
import { createAIClient } from '../ai/factory';
import { OllamaAIClient } from '../ai/ollama';
import { OpenAIAIClient } from '../ai/openai';
import { AnthropicAIClient } from '../ai/anthropic';
import { CustomRestAIClient } from '../ai/custom-rest';

const { mockStore } = vi.hoisted(() => ({
  mockStore: { providers: [] as any[], defaultProvider: undefined as string | undefined },
}));

vi.mock('../config/store', () => ({
  getAIConfig: vi.fn(() => mockStore),
  setAIConfig: vi.fn((config) => {
    mockStore.providers = config.providers;
    mockStore.defaultProvider = config.defaultProvider;
  }),
}));

describe('auth command & AI clients', () => {
  let program: Command;
  let logSpy: any;
  let errorSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    setAIConfig({ providers: [], defaultProvider: undefined });

    program = new Command();
    registerAuthCommand(program);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  const runAIClientTest = async (params: {
    backend: string;
    addArgs: string[];
    mockJson: any;
    expectedUrl: string;
    bodyExpectations: (body: any) => void;
    headersExpectations: (headers: any) => void;
  }) => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => params.mockJson,
    } as Response);

    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', params.backend, ...params.addArgs]);
    const client = await createAIClient(params.backend);
    await client.getCompletion('test-prompt');

    expect(fetchSpy).toHaveBeenCalled();
    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(params.expectedUrl);
    expect(calledOptions.method).toBe('POST');
    params.bodyExpectations(JSON.parse(calledOptions.body));
    params.headersExpectations(calledOptions.headers);
  };

  it('adds a provider with defaults', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'mykey']);
    const config = getAIConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0]).toEqual(
      expect.objectContaining({
        name: 'openai',
        model: 'gpt-4o',
        password: 'mykey',
        temperature: 0.7,
      }),
    );
    expect(config.defaultProvider).toBe('openai');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added AI provider "openai"'),
    );
  });

  it('rejects duplicate providers on add', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key2']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('already configured'));
    expect(process.exitCode).toBe(1);
  });

  it('updates an existing provider', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync([
      'node',
      'test',
      'auth',
      'update',
      'openai',
      '-m',
      'gpt-4-turbo',
      '-p',
      'newkey',
      '--temperature',
      '0.9',
      '--topp',
      '0.85',
      '--topk',
      '20',
      '--maxtokens',
      '500',
      '--custom-header',
      'X-Test=HeaderVal',
    ]);
    const config = getAIConfig();
    expect(config.providers[0].model).toBe('gpt-4-turbo');
    expect(config.providers[0].password).toBe('newkey');
    expect(config.providers[0].temperature).toBe(0.9);
    expect(config.providers[0].topP).toBe(0.85);
    expect(config.providers[0].topK).toBe(20);
    expect(config.providers[0].maxTokens).toBe(500);
    expect(config.providers[0].customHeaders).toEqual({ 'X-Test': 'HeaderVal' });
  });

  it('lists providers and masks secrets', async () => {
    await program.parseAsync([
      'node',
      'test',
      'auth',
      'add',
      '--backend',
      'openai',
      '--password',
      'supersecretapikey',
    ]);
    await program.parseAsync(['node', 'test', 'auth', 'list']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('openai'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('supe...ikey'));
  });

  it('shows empty list message', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'list']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No AI providers configured.'));
  });

  it('sets a default provider', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'anthropic', '-p', 'key2']);
    await program.parseAsync(['node', 'test', 'auth', 'default', 'anthropic']);
    const config = getAIConfig();
    expect(config.defaultProvider).toBe('anthropic');
  });

  it('removes a provider', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'openai', '-p', 'key1']);
    await program.parseAsync(['node', 'test', 'auth', 'remove', 'openai']);
    const config = getAIConfig();
    expect(config.providers).toHaveLength(0);
    expect(config.defaultProvider).toBeUndefined();
  });

  it('creates Noop client and returns deterministic text', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'noop']);
    const client = await createAIClient('noop');
    expect(client.name).toBe('noop');
    const result = await client.getCompletion('test prompt');
    expect(result).toBe('noop completion explanation');
  });

  // Parameterized tests for various client endpoints and options to avoid CodeScene duplication
  it.each([
    {
      backend: 'customrest',
      addArgs: ['-u', 'http://custom-endpoint.com/api', '--custom-header', 'X-Key=Value', '-p', 'customkey'],
      mockJson: { response: 'custom response text' },
      expectedUrl: 'http://custom-endpoint.com/api',
      bodyExpectations: (body: any) => {
        expect(body.prompt).toBe('test-prompt');
        expect(body.temperature).toBe(0.7);
      },
      headersExpectations: (headers: any) => {
        expect(headers['X-Key']).toBe('Value');
        expect(headers['Authorization']).toBe('Bearer customkey');
      },
    },
    {
      backend: 'ollama',
      addArgs: ['-u', 'http://localhost:11434/'],
      mockJson: { response: 'ollama response' },
      expectedUrl: 'http://localhost:11434/api/generate',
      bodyExpectations: (body: any) => expect(body.prompt).toBe('test-prompt'),
      headersExpectations: () => {},
    },
    {
      backend: 'openai',
      addArgs: ['-p', 'opensecretkey', '-u', 'https://api.openai.com/v1/'],
      mockJson: { choices: [{ message: { content: 'openai reply' } }] },
      expectedUrl: 'https://api.openai.com/v1/chat/completions',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => expect(headers['Authorization']).toBe('Bearer opensecretkey'),
    },
    {
      backend: 'openai',
      addArgs: ['-p', 'opensecretkey', '-u', 'https://api.openai.com/v1'],
      mockJson: { choices: [{ message: { content: 'openai reply v1' } }] },
      expectedUrl: 'https://api.openai.com/v1/chat/completions',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => expect(headers['Authorization']).toBe('Bearer opensecretkey'),
    },
    {
      backend: 'openai',
      addArgs: ['-p', 'opensecretkey', '-u', 'https://api.openai.com/chat/completions'],
      mockJson: { choices: [{ message: { content: 'openai reply exact' } }] },
      expectedUrl: 'https://api.openai.com/chat/completions',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => expect(headers['Authorization']).toBe('Bearer opensecretkey'),
    },
    {
      backend: 'openai',
      addArgs: ['-p', 'opensecretkey', '-u', 'https://my-custom-endpoint.com'],
      mockJson: { choices: [{ message: { content: 'openai reply generic' } }] },
      expectedUrl: 'https://my-custom-endpoint.com/chat/completions',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => expect(headers['Authorization']).toBe('Bearer opensecretkey'),
    },
    {
      backend: 'anthropic',
      addArgs: ['-p', 'anthropicsecretkey', '-u', 'https://api.anthropic.com/v1/'],
      mockJson: { content: [{ text: 'claude response' }] },
      expectedUrl: 'https://api.anthropic.com/v1/messages',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => {
        expect(headers['x-api-key']).toBe('anthropicsecretkey');
        expect(headers['anthropic-version']).toBe('2023-06-01');
      },
    },
    {
      backend: 'anthropic',
      addArgs: ['-p', 'anthropicsecretkey', '-u', 'https://api.anthropic.com/v1'],
      mockJson: { content: [{ text: 'claude response v1' }] },
      expectedUrl: 'https://api.anthropic.com/v1/messages',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => {
        expect(headers['x-api-key']).toBe('anthropicsecretkey');
        expect(headers['anthropic-version']).toBe('2023-06-01');
      },
    },
    {
      backend: 'anthropic',
      addArgs: ['-p', 'anthropicsecretkey', '-u', 'https://api.anthropic.com/messages'],
      mockJson: { content: [{ text: 'claude response exact' }] },
      expectedUrl: 'https://api.anthropic.com/messages',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => {
        expect(headers['x-api-key']).toBe('anthropicsecretkey');
      },
    },
    {
      backend: 'anthropic',
      addArgs: ['-p', 'anthropicsecretkey', '-u', 'https://my-custom-endpoint.com'],
      mockJson: { content: [{ text: 'claude response generic' }] },
      expectedUrl: 'https://my-custom-endpoint.com/messages',
      bodyExpectations: (body: any) => expect(body.messages[0].content).toBe('test-prompt'),
      headersExpectations: (headers: any) => {
        expect(headers['x-api-key']).toBe('anthropicsecretkey');
      },
    },
  ])(
    'queries $backend provider client completion with url options: $addArgs',
    async ({ backend, addArgs, mockJson, expectedUrl, bodyExpectations, headersExpectations }) => {
      await runAIClientTest({
        backend,
        addArgs,
        mockJson,
        expectedUrl,
        bodyExpectations,
        headersExpectations,
      });
    },
  );

  // Testing client configure default/fallback branches
  it('covers fallback default configurations', async () => {
    const ollama = new OllamaAIClient();
    await ollama.configure({ name: 'ollama' });
    // Verify default options
    expect((ollama as any).config.baseUrl).toBe('http://localhost:11434');
    expect((ollama as any).config.model).toBe('llama3.1');

    const openai = new OpenAIAIClient();
    await openai.configure({ name: 'openai', password: 'key' });
    expect((openai as any).config.baseUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect((openai as any).config.model).toBe('gpt-4o');

    const anthropic = new AnthropicAIClient();
    await anthropic.configure({ name: 'anthropic', password: 'key' });
    expect((anthropic as any).config.baseUrl).toBe('https://api.anthropic.com/v1/messages');
    expect((anthropic as any).config.model).toBe('claude-3-5-sonnet-latest');
  });

  // Testing failed completion scenarios
  it.each([
    { ClientClass: OpenAIAIClient, name: 'openai', config: { name: 'openai', password: 'key' } },
    { ClientClass: AnthropicAIClient, name: 'anthropic', config: { name: 'anthropic', password: 'key' } },
    { ClientClass: OllamaAIClient, name: 'ollama', config: { name: 'ollama' } },
    { ClientClass: CustomRestAIClient, name: 'customrest', config: { name: 'customrest', baseUrl: 'http://test' } },
  ])('fails getCompletion on non-ok HTTP responses for $name', async ({ ClientClass, config }) => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const client = new ClientClass();
    await client.configure(config);
    await expect(client.getCompletion('fail')).rejects.toThrow('failed with status 500');
  });

  // Client validation checks
  it('validates required configuration inputs', async () => {
    const openai = new OpenAIAIClient();
    await expect(openai.configure({ name: 'openai' })).rejects.toThrow(
      'API key (password) is required for openai',
    );

    const anthropic = new AnthropicAIClient();
    await expect(anthropic.configure({ name: 'anthropic' })).rejects.toThrow(
      'API key (password) is required for anthropic',
    );

    const customrest = new CustomRestAIClient();
    await expect(customrest.configure({ name: 'customrest' })).rejects.toThrow(
      'baseUrl is required for customrest',
    );
  });

  it('handles client validation errors', async () => {
    await expect(createAIClient('unsupported')).rejects.toThrow('Unsupported AI provider');
  });

  it('handles auth operations on missing providers', async () => {
    await program.parseAsync(['node', 'test', 'auth', 'update', 'openai', '-m', 'some-model']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('is not configured'));
    expect(process.exitCode).toBe(1);

    errorSpy.mockClear();
    process.exitCode = undefined;
    await program.parseAsync(['node', 'test', 'auth', 'default', 'openai']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('is not configured'));
    expect(process.exitCode).toBe(1);

    errorSpy.mockClear();
    process.exitCode = undefined;
    await program.parseAsync(['node', 'test', 'auth', 'remove', 'openai']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('is not configured'));
    expect(process.exitCode).toBe(1);
  });

  it('validates invalid backend parameter on add, update, default, remove', async () => {
    // resolveNewBackend validation
    await program.parseAsync(['node', 'test', 'auth', 'add', '-b', 'invalid-backend']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported backend'));
    expect(process.exitCode).toBe(1);

    // resolveProviderContext validation
    errorSpy.mockClear();
    process.exitCode = undefined;
    await program.parseAsync(['node', 'test', 'auth', 'update', 'invalid-backend']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported backend'));
    expect(process.exitCode).toBe(1);

    errorSpy.mockClear();
    process.exitCode = undefined;
    await program.parseAsync(['node', 'test', 'auth', 'default', 'invalid-backend']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported backend'));
    expect(process.exitCode).toBe(1);

    errorSpy.mockClear();
    process.exitCode = undefined;
    await program.parseAsync(['node', 'test', 'auth', 'remove', 'invalid-backend']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported backend'));
    expect(process.exitCode).toBe(1);
  });

  it('creates AI client without configuration (using default/fallback config)', async () => {
    const client = await createAIClient('noop');
    expect(client.name).toBe('noop');
  });
});
