import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Groq's fast inference API.
 * Uses the OpenAI-compatible chat completions endpoint.
 */
export class GroqAIClient implements AIClient {
  readonly name = 'groq';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;

  /**
   * Configures the Groq client with API credentials.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'llama3-70b-8192';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Sends a chat completion request to Groq.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.temperature,
      }),
    });
    if (!response.ok) {
      throw new Error(`Groq API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content ?? '';
  }
}
