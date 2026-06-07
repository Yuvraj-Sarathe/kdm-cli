import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Hugging Face Inference API.
 */
export class HuggingFaceAIClient implements AIClient {
  readonly name = 'huggingface';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;

  /**
   * Configures the Hugging Face client with API token and model.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'mistralai/Mixtral-8x7B-Instruct-v0.1';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Sends a text generation request to Hugging Face Inference API.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = `https://api-inference.huggingface.co/models/${this.model}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { temperature: this.temperature, max_new_tokens: 1024 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Hugging Face API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return Array.isArray(data) ? (data[0]?.generated_text ?? '') : (data.generated_text ?? '');
  }
}
