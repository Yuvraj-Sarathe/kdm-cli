import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Amazon Bedrock.
 */
export class AmazonBedrockAIClient implements AIClient {
  readonly name = 'amazon-bedrock';
  private baseUrl = '';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;

  /**
   * Configures the Amazon Bedrock client with endpoint and credentials.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.baseUrl = config.baseUrl ?? '';
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'anthropic.claude-v2';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Sends an invoke model request to Amazon Bedrock.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/model/${this.model}/invoke`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        inputText: prompt,
        textGenerationConfig: { temperature: this.temperature },
      }),
    });
    if (!response.ok) {
      throw new Error(`Amazon Bedrock API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.results?.[0]?.outputText ?? data.completion ?? '';
  }
}
