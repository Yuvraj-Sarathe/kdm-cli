import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Cohere's Generate API.
 */
export class CohereAIClient implements AIClient {
  readonly name = 'cohere';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;

  /**
   * Configures the Cohere client with API credentials.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'command-r-plus';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Sends a chat request to Cohere's chat endpoint.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = 'https://api.cohere.ai/v1/chat';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ message: prompt, model: this.model, temperature: this.temperature }),
    });
    if (!response.ok) {
      throw new Error(`Cohere API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.text ?? '';
  }
}
