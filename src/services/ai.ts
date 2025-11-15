import type { AIConfig } from '@/types';
import {
  POMODORO_TIMER,
  CALCULATOR,
  detectArtifactType,
  customizeTimer
} from '@/utils/artifactTemplates';

interface ArtifactResult {
  title?: string;
  html: string;
  css: string;
  javascript: string;
}

interface DatabaseResult {
  title: string;
  columns: Array<{
    name: string;
    column_type: string;
    options?: any;
  }>;
  rows: any[];
  view: any;
}

class AIService {
  private config: AIConfig | null = null;

  async initialize(config: AIConfig): Promise<void> {
    this.config = config;
  }

  async generateArtifact(prompt: string): Promise<ArtifactResult> {
    // Template-based generation (will be enhanced with real AI later)
    const artifactType = detectArtifactType(prompt);

    // Extract duration for timers
    const minutesMatch = prompt.match(/(\d+)\s*min/i);
    const customMinutes = minutesMatch ? parseInt(minutesMatch[1]) : null;

    let result: ArtifactResult;

    switch (artifactType) {
      case 'timer':
        result = customMinutes ? customizeTimer(customMinutes) : POMODORO_TIMER;
        break;
      case 'calculator':
        result = CALCULATOR;
        break;
      default:
        result = {
          title: 'Custom Artifact',
          html: `<div style="padding: 40px; text-align: center;">
            <h2>${prompt}</h2>
            <p>Template-based artifact. Full AI generation coming soon!</p>
          </div>`,
          css: `body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-family: Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0;
          }`,
          javascript: `console.log('Artifact loaded: ${prompt}');`
        };
    }

    return new Promise((resolve) => {
      setTimeout(() => resolve(result), 500);
    });
  }

  async generateDatabase(_prompt: string): Promise<DatabaseResult> {
    // Mock implementation - replace with actual AI API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title: 'AI Generated Database',
          columns: [
            { name: 'Name', column_type: 'text' },
            { name: 'Status', column_type: 'select', options: ['Active', 'Inactive'] },
            { name: 'Created', column_type: 'date' }
          ],
          rows: [
            { Name: 'Sample Item', Status: 'Active', Created: new Date().toISOString() }
          ],
          view: { type: 'table' }
        });
      }, 1000);
    });
  }

  async generateWebContent(prompt: string): Promise<any> {
    // Mock implementation for web content generation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          title: 'AI Generated Web Content',
          content: `Generated web content for: "${prompt}"`,
          url: 'https://example.com'
        });
      }, 1000);
    });
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  getConfig(): AIConfig | null {
    return this.config;
  }
}

export const aiService = new AIService();
