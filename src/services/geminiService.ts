/**
 * Gemini Service - Educational Slide Generation with Gemini 3 Pro
 * 
 * Uses Gemini 3 Pro for text analysis and slide outline generation
 * Uses Gemini 3 Pro Image for generating detailed educational diagrams
 */

import { GoogleGenAI } from '@google/genai';

// ============================================================================
// TYPES
// ============================================================================

export interface SlideOutline {
  slideNumber: number;
  title: string;
  type: 'architecture' | 'concept' | 'process' | 'graph' | 'comparison' | 'overview';
  keyPoints: string[];
  visualElements: string[];
  imagePrompt: string;
  visualStyle: {
    theme: 'Technical/Engineering' | 'Organic/Biological' | 'History/Paper' | 'Modern/Abstract';
    primaryColor: string;
    accentColor: string;
    backgroundTexture: string;
  };
}

export interface GeneratedSlide {
  slideNumber: number;
  title: string;
  type: string;
  imageData: string; // Base64 encoded image
  caption: string;
}

export interface SlideGenerationProgress {
  currentSlide: number;
  totalSlides: number;
  status: 'planning' | 'generating' | 'complete' | 'error';
  message: string;
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================


const SLIDE_OUTLINE_PROMPT = `You are an expert PowerPoint presentation designer creating educational slides. Analyze the following note content and create a detailed outline for a professional presentation.

NOTE CONTENT:
{NOTE_CONTENT}

Create a comprehensive presentation plan. Determine the optimal number of slides (max {NUM_SLIDES}) to explain these concepts effectively.

For each slide, you must determine:
1. The slide title
2. The best slide layout/type (concept, diagram, comparison, etc.)
3. The specific content to include
4. A detailed image generation prompt for a high-fidelity slide

CRITICAL:
- You have FULL AUTONOMY over the structure. Do NOT follow a fixed template like "The What/The Why".
- Choose section headers that are descriptive and specific to the content (e.g., "Market Trends", "Neural Architecture", "Historical Context").
- Ensure a consistent "Visual Style Strategy" is defined for the whole deck.

For "Visual Style Strategy", determine:
- theme: "Technical/Engineering", "Organic/Biological", "History/Paper", or "Modern/Abstract"
- primaryColor: Dominant professional color
- accentColor: High-contrast accent color
- backgroundTexture: Texture description (e.g., "grid", "paper", "noise")

Return ONLY a JSON array:
[
  {
    "slideNumber": 1,
    "title": "Descriptive Title",
    "type": "concept|architecture|process|comparison|example|overview",
    "keyPoints": ["Point 1", "Point 2"],
    "visualElements": ["diagram description", "chart description"],
    "imagePrompt": "Detailed prompt for the image generator...",
    "visualStyle": {
      "theme": "Technical/Engineering",
      "primaryColor": "#001f3f",
      "accentColor": "#FFD700",
      "backgroundTexture": "clean light background with subtle engineering grid pattern"
    }
  }
]`;

const ARCHITECTURE_PROMPT_TEMPLATE = `Create a COMPLETE PowerPoint presentation slide explaining: {TOPIC}

SLIDE TITLE (at very top):
"{TITLE}" in distinct, bold, high-contrast text

CONTENT & GOAL:
{CONTEXT}

DESIGN INSTRUCTION:
- Design a layout that BEST communicates this specific system or structure.
- You have full autonomy to choose split-screen, full-width diagram, or other layouts.
- Use clear hierarchies and bold headers.
- DO NOT use generic headers like "The What" or "The Logic". Use specific, descriptive headers relevant to the topic.
- Include annotations and arrows where they add value.

VISUAL STYLE & THEME (MUST FOLLOW):
- Theme: {THEME}
- Background: {BACKGROUND_TEXTURE}
- Primary Color: {PRIMARY_COLOR}
- Accent Color: {ACCENT_COLOR}
- Style: Professional notebook/blueprint aesthetic. High fidelity lines.
- No flat vector art. Use textured, professional rendering.`;

const CONCEPT_PROMPT_TEMPLATE = `Create a COMPLETE PowerPoint presentation slide explaining the concept: {TOPIC}

SLIDE TITLE (at very top):
"{TITLE}" in distinct, bold, high-contrast text

CONTENT & GOAL:
{CONTEXT}

DESIGN INSTRUCTION:
- Design a layout that BEST explains this concept.
- If it's a mathematical concept, center the formula and annotate it.
- If it's a structural concept, use a diagram.
- Use specific, descriptive headers (e.g., "Key Principles", "Historical Impact") instead of generic ones.
- Ensure the slide is balanced and professional.

VISUAL STYLE & THEME (MUST FOLLOW):
- Theme: {THEME}
- Background: {BACKGROUND_TEXTURE}
- Primary Color: {PRIMARY_COLOR}
- Accent Color: {ACCENT_COLOR}
- Style: Professional high-fidelity presentation.
- Rendering: Clean, sharp lines, subtle depth.`;

const PROCESS_PROMPT_TEMPLATE = `Create a COMPLETE PowerPoint presentation slide showing the process: {TOPIC}

SLIDE TITLE (at top):
"{TITLE}" in distinct, bold, high-contrast text

CONTENT & GOAL:
{CONTEXT}

DESIGN INSTRUCTION:
- Design a visual flow that clearly communicates the steps or evolution.
- Choose the best layout: horizontal flow, vertical list, or cyclical diagram.
- Use clear indicators (numbers, arrows) to guide the eye.
- DO NOT Use generic headers.
- Focus on clarity and readability.

VISUAL STYLE & THEME (MUST FOLLOW):
- Theme: {THEME}
- Background: {BACKGROUND_TEXTURE}
- Primary Color: {PRIMARY_COLOR}
- Accent Color: {ACCENT_COLOR}
- Style: Clean visual process flow. High readability.`;

const GRAPH_PROMPT_TEMPLATE = `Create a COMPLETE PowerPoint presentation slide with data visualization: {TOPIC}

SLIDE TITLE (at top):
"{TITLE}" in distinct, bold, high-contrast text

CONTENT & GOAL:
{CONTEXT}

DESIGN INSTRUCTION:
- Choose the best data visualization type (bar, line, scatter, etc.) for this data.
- Layout the slide to highlight the key insights effectively.
- Ensure axis labels and data points are large and legible.
- Use callouts or annotations to explain the "So What?" of the data.

VISUAL STYLE & THEME (MUST FOLLOW):
- Theme: {THEME}
- Background: {BACKGROUND_TEXTURE}
- Primary Color: {PRIMARY_COLOR}
- Accent Color: {ACCENT_COLOR}
- Style: Professional notebook/scientific publication aesthetic.`;

const COMPARISON_PROMPT_TEMPLATE = `Create a COMPLETE PowerPoint presentation slide comparing: {TOPIC}

SLIDE TITLE (at top):
"{TITLE}" in distinct, bold, high-contrast text

CONTENT & GOAL:
{CONTEXT}

DESIGN INSTRUCTION:
- Design a layout that clearly juxtaposes the two (or more) concepts.
- Choose between a Split-Screen, Table/Matrix, or Overlaid Diagram layout.
- Ensure distinctive visual separation between the compared items.
- Use headers that name the concepts being compared.

VISUAL STYLE & THEME (MUST FOLLOW):
- Theme: {THEME}
- Background: {BACKGROUND_TEXTURE}
- Primary Color: {PRIMARY_COLOR}
- Accent Color: {ACCENT_COLOR}
- Style: Clean, symmetrical, professional comparison.`;

const OVERVIEW_PROMPT_TEMPLATE = `Create a COMPLETE PowerPoint presentation slide overview: {TOPIC}

SLIDE TITLE (at top):
"{TITLE}" in distinct, bold, high-contrast text

CONTENT & GOAL:
{CONTEXT}

DESIGN INSTRUCTION:
- Design a high-level overview layout.
- You might use a central hub diagram, a list of key pillars, or a dashboard style.
- Ensure the main takeaways are immediately visible.
- Use iconography and large text for impact.

VISUAL STYLE & THEME (MUST FOLLOW):
- Theme: {THEME}
- Background: {BACKGROUND_TEXTURE}
- Primary Color: {PRIMARY_COLOR}
- Accent Color: {ACCENT_COLOR}
- Style: Broad, clean overview. Engaging visual hierarchy.`;


// ============================================================================
// SERVICE CLASS
// ============================================================================

class GeminiService {
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  /**
   * Initialize the Gemini service with API key
   */
  initialize(apiKey: string): void {
    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ [GeminiService] Cannot initialize - API key is empty');
      throw new Error('Gemini API key is required');
    }

    this.apiKey = apiKey;
    this.client = new GoogleGenAI({ apiKey });
    console.log('✅ [GeminiService] Initialized with API key:', apiKey.substring(0, 10) + '...');
  }

  /**
   * Check if service is initialized
   */
  get isInitialized(): boolean {
    return this.client !== null && this.apiKey !== null;
  }

  /**
   * Ensure service is initialized
   */
  private requireInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('GeminiService not initialized. Call initialize(apiKey) first.');
    }
  }

  /**
   * Get the appropriate prompt template based on slide type
   */
  private getPromptTemplate(type: SlideOutline['type']): string {
    switch (type) {
      case 'architecture':
        return ARCHITECTURE_PROMPT_TEMPLATE;
      case 'concept':
        return CONCEPT_PROMPT_TEMPLATE;
      case 'process':
        return PROCESS_PROMPT_TEMPLATE;
      case 'graph':
        return GRAPH_PROMPT_TEMPLATE;
      case 'comparison':
        return COMPARISON_PROMPT_TEMPLATE;
      case 'overview':
      default:
        return OVERVIEW_PROMPT_TEMPLATE;
    }
  }

  /**
   * Generate slide outline from note content
   */
  async generateSlideOutline(
    noteContent: string,
    numSlides: number = 8
  ): Promise<SlideOutline[]> {
    this.requireInitialized();

    const prompt = SLIDE_OUTLINE_PROMPT
      .replace('{NOTE_CONTENT}', noteContent.substring(0, 8000)) // Limit content length
      .replace('{NUM_SLIDES}', String(Math.min(numSlides, 14))); // Max 14 slides

    try {
      const response = await this.client!.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });

      // Extract text from response
      const text = response.text || '';

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse slide outline from response');
      }

      const outline: SlideOutline[] = JSON.parse(jsonMatch[0]);
      return outline;
    } catch (error) {
      console.error('[GeminiService] Failed to generate slide outline:', error);
      throw error;
    }
  }

  /**
   * Generate a single educational slide image
   */
  async generateSlideImage(
    slideOutline: SlideOutline,
    noteContext: string
  ): Promise<GeneratedSlide> {
    this.requireInitialized();

    // Get the appropriate prompt template
    const template = this.getPromptTemplate(slideOutline.type);

    // Build the full prompt
    const context = `
Key points to include: ${slideOutline.keyPoints.join('; ')}
Visual elements needed: ${slideOutline.visualElements.join(', ')}
Specific requirements: ${slideOutline.imagePrompt}
Note context: ${noteContext.substring(0, 1000)}
    `.trim();

    const fullPrompt = template
      .replace('{TOPIC}', slideOutline.title)
      .replace('{TITLE}', slideOutline.title)
      .replace('{CONTEXT}', context)
      .replace('{THEME}', slideOutline.visualStyle?.theme || 'Technical/Professional')
      .replace('{BACKGROUND_TEXTURE}', slideOutline.visualStyle?.backgroundTexture || 'Clean light background with subtle grid pattern')
      .replace('{PRIMARY_COLOR}', slideOutline.visualStyle?.primaryColor || '#001f3f')
      .replace('{ACCENT_COLOR}', slideOutline.visualStyle?.accentColor || '#0074D9');

    try {
      const response = await this.client!.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: fullPrompt,
        config: {
          tools: [{ googleSearch: {} }], // Enable Google Search for real data
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '2K', // High quality for detailed diagrams
          },
        },
      });

      // Extract image from response
      let imageData = '';
      let caption = '';

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            caption = part.text;
          } else if (part.inlineData) {
            imageData = part.inlineData.data || '';
          }
        }
      }

      if (!imageData) {
        throw new Error('No image data in response');
      }

      return {
        slideNumber: slideOutline.slideNumber,
        title: slideOutline.title,
        type: slideOutline.type,
        imageData,
        caption: caption || `Figure ${slideOutline.slideNumber}: ${slideOutline.title}`,
      };
    } catch (error) {
      console.error(`[GeminiService] Failed to generate slide ${slideOutline.slideNumber}:`, error);
      throw error;
    }
  }

  /**
   * Generate all slides for a topic
   */
  async generateAllSlides(
    noteContent: string,
    numSlides: number = 8,
    onProgress?: (progress: SlideGenerationProgress) => void
  ): Promise<GeneratedSlide[]> {
    this.requireInitialized();

    const slides: GeneratedSlide[] = [];

    // Step 1: Generate outline
    onProgress?.({
      currentSlide: 0,
      totalSlides: numSlides,
      status: 'planning',
      message: 'Analyzing content and planning slides...',
    });

    const outline = await this.generateSlideOutline(noteContent, numSlides);
    const actualNumSlides = outline.length;

    // Step 2: Generate each slide image
    for (let i = 0; i < outline.length; i++) {
      const slideOutline = outline[i];

      onProgress?.({
        currentSlide: i + 1,
        totalSlides: actualNumSlides,
        status: 'generating',
        message: `Generating slide ${i + 1}: ${slideOutline.title}...`,
      });

      try {
        const slide = await this.generateSlideImage(slideOutline, noteContent);
        slides.push(slide);
      } catch (error) {
        console.error(`Failed to generate slide ${i + 1}:`, error);
        // Continue with remaining slides even if one fails
      }
    }

    onProgress?.({
      currentSlide: actualNumSlides,
      totalSlides: actualNumSlides,
      status: 'complete',
      message: `Generated ${slides.length} slides successfully!`,
    });

    return slides;
  }

  /**
   * Generate a single slide for a specific topic (quick generation)
   */
  async generateSingleSlide(
    topic: string,
    type: SlideOutline['type'] = 'concept'
  ): Promise<GeneratedSlide> {
    this.requireInitialized();

    const slideOutline: SlideOutline = {
      slideNumber: 1,
      title: topic,
      type,
      keyPoints: [],
      visualElements: [],
      imagePrompt: `Create a detailed educational diagram explaining ${topic}`,
      visualStyle: {
        theme: 'Technical/Engineering',
        primaryColor: '#001f3f',
        accentColor: '#FFD700',
        backgroundTexture: 'Clean light background with subtle engineering grid pattern'
      }
    };

    return this.generateSlideImage(slideOutline, topic);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const geminiService = new GeminiService();
