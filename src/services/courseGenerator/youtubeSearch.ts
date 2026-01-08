/**
 * YouTube Search Service
 * 
 * Searches YouTube for educational videos matching lesson topics.
 * Uses YouTube Data API v3 for search and Gemini for relevance scoring.
 * 
 * NOTE: Requires YouTube API key to be configured.
 * YouTube API Quota: 10,000 units/day (each search costs 100 units)
 */

import type { YouTubeVideo } from './workerMessages';

// ============================================================================
// CONFIGURATION
// ============================================================================

// YouTube API endpoint
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// API key storage
let youtubeApiKey: string | null = null;

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

// Known educational channels get a boost
const TRUSTED_EDU_CHANNELS = new Set([
    'fireship', '3blue1brown', 'computerphile', 'numberphile', 'crashcourse',
    'mit opencourseware', 'khan academy', 'freecodecamp', 'the coding train',
    'traversy media', 'web dev simplified', 'academind', 'programming with mosh',
    'sentdex', 'corey schafer', 'tech with tim', 'cs dojo', 'brocode',
]);

// Positive educational keywords
const EDU_POSITIVE_KEYWORDS = [
    'tutorial', 'explained', 'course', 'deep dive', 'crash course', 'how to',
    'learn', 'introduction', 'basics', 'guide', 'masterclass', 'complete',
    'fundamentals', 'beginner', 'advanced', 'walkthrough', 'lecture',
];

// Negative entertainment keywords
const EDU_NEGATIVE_KEYWORDS = [
    'reaction', 'meme', 'shorts', 'vlog', 'unboxing', 'day in the life',
    'funny', 'prank', 'challenge', 'drama', 'podcast snippet',
];

/**
 * Initialize the YouTube search service with an API key
 */
export function initializeYouTubeSearch(apiKey: string): void {
    youtubeApiKey = apiKey;
    console.log('[YouTubeSearch] Initialized with API key');
}

/**
 * Check if YouTube search is available
 */
export function isYouTubeSearchAvailable(): boolean {
    return youtubeApiKey !== null && youtubeApiKey.length > 0;
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

interface YouTubeSearchOptions {
    maxResults?: number;
    videoDuration?: 'any' | 'short' | 'medium' | 'long';  // short: <4min, medium: 4-20min, long: >20min
    relevanceLanguage?: string;
    order?: 'relevance' | 'viewCount' | 'date';
}

interface YouTubeApiSearchResult {
    items: {
        id: { videoId: string };
        snippet: {
            title: string;
            description: string;
            channelTitle: string;
            thumbnails: {
                high?: { url: string };
                medium?: { url: string };
                default?: { url: string };
            };
        };
    }[];
}

interface YouTubeApiVideoResult {
    items: {
        id: string;
        contentDetails: {
            duration: string;  // ISO 8601 format: PT4M3S
        };
        statistics: {
            viewCount: string;
        };
    }[];
}

/**
 * Search YouTube for videos matching a query
 */
async function searchYouTube(
    query: string,
    options: YouTubeSearchOptions = {}
): Promise<YouTubeVideo[]> {
    if (!youtubeApiKey) {
        console.warn('[YouTubeSearch] API key not configured');
        return [];
    }

    const {
        maxResults = 5,
        videoDuration = 'medium',
        relevanceLanguage = 'en',
        order = 'relevance',
    } = options;

    try {
        // Step 1: Search for videos
        const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
        searchUrl.searchParams.set('part', 'snippet');
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('type', 'video');
        searchUrl.searchParams.set('videoDuration', videoDuration);
        searchUrl.searchParams.set('relevanceLanguage', relevanceLanguage);
        searchUrl.searchParams.set('order', order);
        searchUrl.searchParams.set('maxResults', String(maxResults));
        searchUrl.searchParams.set('key', youtubeApiKey);

        const searchResponse = await fetch(searchUrl.toString());
        if (!searchResponse.ok) {
            throw new Error(`YouTube search failed: ${searchResponse.status}`);
        }

        const searchData: YouTubeApiSearchResult = await searchResponse.json();

        if (!searchData.items || searchData.items.length === 0) {
            return [];
        }

        // Step 2: Get video details (duration, view count)
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
        detailsUrl.searchParams.set('part', 'contentDetails,statistics');
        detailsUrl.searchParams.set('id', videoIds);
        detailsUrl.searchParams.set('key', youtubeApiKey);

        const detailsResponse = await fetch(detailsUrl.toString());
        if (!detailsResponse.ok) {
            throw new Error(`YouTube details failed: ${detailsResponse.status}`);
        }

        const detailsData: YouTubeApiVideoResult = await detailsResponse.json();
        const detailsMap = new Map(
            detailsData.items.map(item => [item.id, item])
        );

        // Step 3: Combine results
        return searchData.items.map(item => {
            const details = detailsMap.get(item.id.videoId);
            return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.high?.url ||
                    item.snippet.thumbnails.medium?.url ||
                    item.snippet.thumbnails.default?.url || '',
                channelTitle: item.snippet.channelTitle,
                duration: details ? parseDuration(details.contentDetails.duration) : 'Unknown',
                viewCount: details ? parseInt(details.statistics.viewCount, 10) : 0,
                relevanceScore: 0,  // Will be set by AI scoring
            };
        });
    } catch (error) {
        console.error('[YouTubeSearch] Search error:', error);
        return [];
    }
}

/**
 * Parse ISO 8601 duration to human-readable format
 */
function parseDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'Unknown';

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================================
// MULTI-SIGNAL SCORING ALGORITHM
// ============================================================================

/**
 * Parse duration string to total seconds
 */
function parseDurationToSeconds(duration: string): number {
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/**
 * Compute quality signals score (20% of total)
 * - View count (normalized, log scale)
 * - Channel reputation (trusted edu channels get boost)
 * - Duration preference (10-25 min optimal for lessons)
 */
function computeQualityScore(video: YouTubeVideo): number {
    let score = 0;

    // View count score (log scale, max 40 points)
    if (video.viewCount > 0) {
        const logViews = Math.log10(video.viewCount);
        score += Math.min(40, logViews * 7);  // 1M views ≈ 42 points, capped at 40
    }

    // Channel reputation (30 points for trusted channels)
    const channelLower = video.channelTitle.toLowerCase();
    if (TRUSTED_EDU_CHANNELS.has(channelLower)) {
        score += 30;
    }

    // Duration preference (30 points max)
    const durationSec = parseDurationToSeconds(video.duration);
    if (durationSec >= 600 && durationSec <= 1500) {  // 10-25 min optimal
        score += 30;
    } else if (durationSec >= 300 && durationSec <= 2400) {  // 5-40 min acceptable
        score += 15;
    } else if (durationSec < 180) {  // Too short
        score -= 10;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Compute educational value score (15% of total)
 * - Positive keywords boost
 * - Negative keywords penalty
 */
function computeEducationalScore(video: YouTubeVideo): number {
    const text = `${video.title} ${video.description}`.toLowerCase();
    let score = 50;  // Start neutral

    // Positive educational keywords
    for (const keyword of EDU_POSITIVE_KEYWORDS) {
        if (text.includes(keyword)) {
            score += 8;
        }
    }

    // Negative entertainment keywords
    for (const keyword of EDU_NEGATIVE_KEYWORDS) {
        if (text.includes(keyword)) {
            score -= 15;
        }
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Compute title match score (25% of total)
 * - Keyword overlap between lesson title and video title
 * - Boost for exact phrase matches
 */
function computeTitleMatchScore(lessonTitle: string, lessonTopics: string[], video: YouTubeVideo): number {
    const videoText = `${video.title} ${video.description}`.toLowerCase();
    const lessonLower = lessonTitle.toLowerCase();
    let score = 0;

    // Extract keywords from lesson title
    const lessonWords = lessonLower.split(/\s+/).filter(w => w.length > 3);
    let matchedWords = 0;

    for (const word of lessonWords) {
        if (videoText.includes(word)) {
            matchedWords++;
        }
    }

    // Keyword overlap score
    if (lessonWords.length > 0) {
        score += (matchedWords / lessonWords.length) * 50;
    }

    // Topic matches
    for (const topic of lessonTopics) {
        if (videoText.includes(topic.toLowerCase())) {
            score += 15;
        }
    }

    // Exact phrase match bonus
    if (videoText.includes(lessonLower)) {
        score += 20;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Score video relevance using multi-signal algorithm
 * 
 * Score = (SemanticMatch × 0.40) + (TitleMatch × 0.25) + (QualitySignals × 0.20) + (EducationalValue × 0.15)
 * 
 * @param videos - Videos to score
 * @param lessonTitle - The lesson title to match
 * @param lessonTopics - Key topics the lesson covers
 * @param context - Additional context about the course/module
 */
export async function scoreVideoRelevance(
    videos: YouTubeVideo[],
    lessonTitle: string,
    lessonTopics: string[],
    context: string
): Promise<YouTubeVideo[]> {
    if (videos.length === 0) return [];

    // Compute local scores first
    const localScores = videos.map(video => ({
        video,
        titleMatch: computeTitleMatchScore(lessonTitle, lessonTopics, video),
        quality: computeQualityScore(video),
        educational: computeEducationalScore(video),
    }));

    // Try to get AI semantic scores
    let semanticScores: number[] = [];
    try {
        const { geminiService } = await import('../geminiService');
        if (geminiService.isInitialized) {
            const prompt = `Score these YouTube videos for SEMANTIC RELEVANCE to a lesson (0-100).
Focus ONLY on how well the video content matches the lesson topic conceptually.

LESSON: ${lessonTitle}
KEY TOPICS: ${lessonTopics.join(', ')}
CONTEXT: ${context}

VIDEOS:
${videos.map((v, i) => `${i + 1}. "${v.title}" by ${v.channelTitle}
   ${v.description.substring(0, 150)}...`).join('\n\n')}

Return ONLY a JSON array of semantic relevance scores (0-100):
[85, 72, 60, ...]`;

            const response = await geminiService.chat(prompt);
            const scoresMatch = response.match(/\[[\d,\s]+\]/);
            if (scoresMatch) {
                semanticScores = JSON.parse(scoresMatch[0]);
            }
        }
    } catch (error) {
        console.warn('[YouTubeSearch] AI scoring failed, using local scores:', error);
    }

    // Compute final weighted scores
    const scoredVideos = localScores.map((item, i) => {
        // Use AI semantic score if available, otherwise derive from title match
        const semanticScore = semanticScores[i] ?? item.titleMatch;

        // Multi-signal weighted formula
        const finalScore = (
            semanticScore * 0.40 +      // 40% semantic match
            item.titleMatch * 0.25 +    // 25% title/keyword match
            item.quality * 0.20 +       // 20% quality signals
            item.educational * 0.15     // 15% educational value
        );

        return {
            ...item.video,
            relevanceScore: Math.round(finalScore),
        };
    });

    // Sort by relevance score (highest first)
    return scoredVideos.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Search YouTube for videos matching a lesson
 * 
 * This is the main function to use from the course generator.
 * It generates optimal search queries, searches YouTube, and scores relevance.
 */
export async function searchVideosForLesson(
    lessonTitle: string,
    lessonTopics: string[],
    moduleContext: string,
    maxResults: number = 5
): Promise<YouTubeVideo[]> {
    if (!isYouTubeSearchAvailable()) {
        console.warn('[YouTubeSearch] Service not available');
        return [];
    }

    try {
        // Generate search queries using Gemini
        let searchQueries = [lessonTitle];

        try {
            const { geminiService } = await import('../geminiService');
            if (geminiService.isInitialized) {
                const queryPrompt = `Generate 2 YouTube search queries for finding educational videos about:
Lesson: ${lessonTitle}
Topics: ${lessonTopics.join(', ')}
Context: ${moduleContext}

Return ONLY a JSON array of search strings:
["query1", "query2"]`;

                const response = await geminiService.chat(queryPrompt);
                const queryMatch = response.match(/\[[\s\S]*?\]/);
                if (queryMatch) {
                    searchQueries = JSON.parse(queryMatch[0]);
                }
            }
        } catch {
            // Use default query
        }

        // Search with each query
        const allResults: YouTubeVideo[] = [];
        const seenIds = new Set<string>();

        for (const query of searchQueries) {
            const results = await searchYouTube(`${query} tutorial`, {
                maxResults: Math.ceil(maxResults / searchQueries.length) + 1,
                videoDuration: 'medium',
            });

            for (const video of results) {
                if (!seenIds.has(video.videoId)) {
                    seenIds.add(video.videoId);
                    allResults.push(video);
                }
            }
        }

        // Score relevance
        const scoredResults = await scoreVideoRelevance(
            allResults.slice(0, maxResults * 2),
            lessonTitle,
            lessonTopics,
            moduleContext
        );

        return scoredResults.slice(0, maxResults);
    } catch (error) {
        console.error('[YouTubeSearch] searchVideosForLesson error:', error);
        return [];
    }
}

/**
 * Get embeddable YouTube URL
 */
export function getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get thumbnail URL for a video
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' = 'high'): string {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}
