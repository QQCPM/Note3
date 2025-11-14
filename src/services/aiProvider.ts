import type { AIConfig, ModelConfig } from '@/types/ai';

/**
 * AI Provider Service
 *
 * Handles connections to various AI providers (OpenAI, Anthropic, local models)
 * Supports streaming responses and function calling
 */

export interface AIProviderResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
}

export interface AIProviderStreamChunk {
  content: string;
  done: boolean;
}

export interface AIProviderOptions {
  temperature?: number;
  max_tokens?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  stream?: boolean;
}

class AIProviderService {
  private config: AIConfig | null = null;

  /**
   * Initialize AI configuration from settings
   */
  async loadConfig(): Promise<AIConfig | null> {
    try {
      // Try to load from localStorage first
      const storedConfig = localStorage.getItem('ai_config');
      if (storedConfig) {
        this.config = JSON.parse(storedConfig);
        return this.config;
      }

      // Default configuration
      this.config = this.getDefaultConfig();
      return this.config;
    } catch (error) {
      console.error('Failed to load AI config:', error);
      return null;
    }
  }

  /**
   * Save AI configuration
   */
  async saveConfig(config: AIConfig): Promise<void> {
    this.config = config;
    localStorage.setItem('ai_config', JSON.stringify(config));
  }

  /**
   * Get default AI configuration
   */
  private getDefaultConfig(): AIConfig {
    return {
      code_generation: {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        temperature: 0.7,
        max_tokens: 4000,
      },
      note_understanding: {
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        max_tokens: 2000,
      },
      embeddings: {
        provider: 'openai',
        model: 'text-embedding-3-small',
      },
    };
  }

  /**
   * Check if AI is configured and ready
   */
  isConfigured(): boolean {
    if (!this.config) return false;

    const noteConfig = this.config.note_understanding;
    if (noteConfig.provider === 'openai' && !noteConfig.api_key) return false;
    if (noteConfig.provider === 'anthropic' && !noteConfig.api_key) return false;

    return true;
  }

  /**
   * Generate completion using configured provider
   */
  async generateCompletion(
    messages: Array<{ role: string; content: string }>,
    options: AIProviderOptions = {}
  ): Promise<AIProviderResponse> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('AI not configured. Please set up your AI provider in settings.');
    }

    const config = this.config.note_understanding;

    switch (config.provider) {
      case 'openai':
        return this.generateOpenAI(messages, config, options);
      case 'anthropic':
        return this.generateAnthropic(messages, config, options);
      case 'local':
        return this.generateLocal(messages, config, options);
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }

  /**
   * OpenAI completion
   */
  private async generateOpenAI(
    messages: Array<{ role: string; content: string }>,
    config: ModelConfig,
    options: AIProviderOptions
  ): Promise<AIProviderResponse> {
    if (!config.api_key) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4-turbo-preview',
        messages,
        temperature: options.temperature ?? config.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? config.max_tokens ?? 2000,
        tools: options.tools,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || '',
      model: data.model,
      usage: data.usage,
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }

  /**
   * Anthropic completion
   */
  private async generateAnthropic(
    messages: Array<{ role: string; content: string }>,
    config: ModelConfig,
    options: AIProviderOptions
  ): Promise<AIProviderResponse> {
    if (!config.api_key) {
      throw new Error('Anthropic API key not configured');
    }

    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        messages: conversationMessages,
        system: systemMessage?.content,
        max_tokens: options.max_tokens ?? config.max_tokens ?? 2000,
        temperature: options.temperature ?? config.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      model: data.model,
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  /**
   * Local model completion (e.g., Ollama)
   */
  private async generateLocal(
    messages: Array<{ role: string; content: string }>,
    config: ModelConfig,
    options: AIProviderOptions
  ): Promise<AIProviderResponse> {
    const endpoint = config.endpoint || 'http://localhost:11434/api/chat';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'llama2',
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? config.temperature ?? 0.7,
          num_predict: options.max_tokens ?? config.max_tokens ?? 2000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Local model error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.message.content,
      model: config.model || 'llama2',
    };
  }

  /**
   * Get API key for provider
   */
  getApiKey(provider: 'openai' | 'anthropic'): string | undefined {
    if (!this.config) return undefined;

    if (provider === 'openai') {
      return this.config.note_understanding.api_key ||
             this.config.code_generation.api_key;
    } else if (provider === 'anthropic') {
      return this.config.note_understanding.api_key ||
             this.config.code_generation.api_key;
    }

    return undefined;
  }

  /**
   * Update API key for provider
   */
  async updateApiKey(provider: 'openai' | 'anthropic', apiKey: string): Promise<void> {
    if (!this.config) {
      this.config = this.getDefaultConfig();
    }

    // Update all configs for this provider
    if (this.config.note_understanding.provider === provider) {
      this.config.note_understanding.api_key = apiKey;
    }
    if (this.config.code_generation.provider === provider) {
      this.config.code_generation.api_key = apiKey;
    }
    if (this.config.embeddings.provider === provider) {
      this.config.embeddings.api_key = apiKey;
    }

    await this.saveConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfig | null {
    return this.config;
  }
}

export const aiProvider = new AIProviderService();
