import { AIClient } from './types';
import { AIProviderConfig } from '../config/schema';

/**
 * AI client implementation for Google Gemini API.
 */
export class GoogleGeminiAIClient implements AIClient {
  readonly name = 'google-gemini';
  private apiKey = '';
  private model = '';
  private temperature = 0.7;

  /**
   * Configures the Google Gemini client with API credentials.
   * @param config The provider configuration.
   */
  async configure(config: AIProviderConfig): Promise<void> {
    this.apiKey = config.password ?? '';
    this.model = config.model ?? 'gemini-pro';
    this.temperature = config.temperature ?? 0.7;
  }

  /**
   * Sends a content generation request to Google Gemini.
   * @param prompt The string prompt.
   * @returns AI-generated response text.
   */
  async getCompletion(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: this.temperature },
      }),
    });
    if (!response.ok) {
      throw new Error(`Google Gemini API call failed with status ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
