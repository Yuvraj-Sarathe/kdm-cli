import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for IBM watsonx.ai.
 */
export class IBMWatsonxAIClient implements AIClient {
  readonly name = 'ibm-watsonx';
  private baseUrl = '';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;
  private projectId = '';

  /**
   * Configures the IBM watsonx client with API credentials and project details.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.baseUrl = config.baseUrl ?? 'https://us-south.ml.cloud.ibm.com';
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'ibm/granite-13b-instruct-v2';
    this.temperature = config.temperature ?? 0.7;
    this.projectId = config.customHeaders?.['X-Project-Id'] ?? '';
  }

  /**
   * Sends a text generation request to IBM watsonx.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/ml/v1/text/generation?version=2024-03-14`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model_id: this.model,
        input: prompt,
        project_id: this.projectId,
        parameters: { temperature: this.temperature, max_new_tokens: 1024 },
      }),
    });
    if (!response.ok) {
      throw new Error(`IBM watsonx API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.results?.[0]?.generated_text ?? '';
  }
}
