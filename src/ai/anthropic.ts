import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * Formats the Anthropic URL based on custom base url configurations.
 * @param baseUrl Configured base URL or undefined.
 * @returns Formatted messages URL.
 */
const formatAnthropicUrl = (baseUrl?: string): string => {
  const base = baseUrl || 'https://api.anthropic.com/v1/messages';
  const url = base.replace(/\/$/, '');
  if (url.endsWith('/v1')) {
    return `${url}/messages`;
  }
  if (!url.includes('/messages')) {
    return `${url}/messages`;
  }
  return url;
};

/**
 * Builds the Anthropic payload body.
 * @param params Option parameters for the Anthropic payload.
 * @returns Payload body object.
 */
const buildAnthropicBody = (params: {
  model: string;
  prompt: string;
  temp?: number;
  maxTokens?: number;
}) => ({
  model: params.model,
  messages: [{ role: 'user', content: params.prompt }],
  max_tokens: params.maxTokens ?? 2048,
  temperature: params.temp ?? 0.7,
});

/**
 * AI client implementation for querying Anthropic Claude models.
 */
export class AnthropicAIClient implements AIClient {
  readonly name = 'anthropic';
  private config!: AIProviderConfig;

  /**
   * Configures the client, ensuring the Anthropic API key is provided.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com/v1/messages',
      model: config.model || 'claude-3-5-sonnet-latest',
    };
    if (!this.config.password) {
      throw new Error('API key (password) is required for anthropic provider');
    }
  }

  /**
   * Sends a message request to the Anthropic messages API.
   * @param prompt The string prompt.
   * @returns The generated response string.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = formatAnthropicUrl(this.config.baseUrl);
    const body = buildAnthropicBody({
      model: this.config.model,
      prompt,
      temp: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.password!,
        'anthropic-version': '2023-06-01',
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API call failed with status ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    return data.content?.[0]?.text || '';
  }
}
