import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Oracle Cloud Infrastructure Generative AI.
 */
export class OCIGenAIClient implements AIClient {
  readonly name = 'oci-genai';
  private baseUrl = '';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;
  private compartmentId = '';

  /**
   * Configures the OCI Generative AI client with endpoint and credentials.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.baseUrl = config.baseUrl ?? 'https://inference.generativeai.us-chicago-1.oci.oraclecloud.com';
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'cohere.command-r-plus';
    this.temperature = config.temperature ?? 0.7;
    this.compartmentId = config.customHeaders?.['X-Compartment-Id'] ?? '';
  }

  /**
   * Sends a text generation request to OCI Generative AI.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/20231130/actions/generateText`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        compartmentId: this.compartmentId,
        servingMode: { servingType: 'ON_DEMAND', modelId: this.model },
        inferenceRequest: {
          runtimeType: 'COHERE',
          prompt,
          temperature: this.temperature,
          maxTokens: 1024,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`OCI GenAI API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.inferenceResponse?.generatedTexts?.[0]?.text ?? '';
  }
}
