/**
 * Web Search Service
 *
 * Provides web search capabilities for AI to gather current information.
 * Uses Tauri backend to proxy requests and avoid CORS issues.
 *
 * Backend fallback chain:
 * 1. Brave Search API (if BRAVE_API_KEY env var set)
 * 2. DuckDuckGo instant answers (no API key needed)
 * 3. Mock results (offline fallback)
 */

import { invoke } from '@tauri-apps/api/core';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
  published_date?: string; // Note: snake_case from Rust backend
}

export interface SearchOptions {
  max_results?: number; // Note: snake_case for Rust
  language?: string;
  freshness?: 'day' | 'week' | 'month' | 'year';
}

/**
 * Search the web for information using Tauri backend
 * This avoids CORS issues by proxying through the Rust backend
 *
 * @param query - The search query
 * @param options - Search options
 * @returns Array of search results
 */
export async function searchWeb(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { max_results = 5, language = 'en', freshness } = options;

  console.log(`[WebSearch] Searching via Tauri backend for: "${query}" (max: ${max_results})`);

  try {
    // Call Tauri command which handles all the API logic and CORS
    const results = await invoke<SearchResult[]>('search_web', {
      query,
      options: {
        max_results,
        language,
        freshness,
      },
    });

    console.log(`[WebSearch] ✓ Tauri backend returned ${results.length} results`);
    return results;
  } catch (error) {
    console.error('[WebSearch] Tauri backend failed:', error);

    // If Tauri fails, return empty array
    // (The backend already has its own fallback chain, so this shouldn't happen)
    return [];
  }
}

/**
 * Format search results into readable text for AI context
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No search results found.';
  }

  let formatted = `Found ${results.length} search results:\n\n`;

  results.forEach((result, index) => {
    formatted += `${index + 1}. ${result.title}\n`;
    formatted += `   ${result.snippet}\n`;
    formatted += `   Source: ${result.source || new URL(result.url).hostname}\n`;
    if (result.published_date) {
      formatted += `   Published: ${result.published_date}\n`;
    }
    formatted += `\n`;
  });

  return formatted;
}
