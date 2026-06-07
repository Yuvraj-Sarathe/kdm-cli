import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Google Vertex AI (Gemini models).
 */
export class GoogleVertexAIClient implements AIClient {
  readonly name = 'google-vertex';
  private baseUrl = '';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;

  /**
   * Configures the Vertex AI client with endpoint and credentials.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.baseUrl = config.baseUrl ?? '';
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'gemini-pro';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Sends a content generation request to Vertex AI.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/v1/projects/-/locations/-/publishers/google/models/${this.model}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: this.temperature },
      }),
    });
    if (!response.ok) {
      throw new Error(`Google Vertex API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
