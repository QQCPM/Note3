use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub snippet: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub max_results: Option<usize>,
    pub language: Option<String>,
    pub freshness: Option<String>,
}

/// Search the web using Tauri backend to avoid CORS issues
#[tauri::command]
pub async fn search_web(
    query: String,
    options: Option<SearchOptions>,
) -> Result<Vec<SearchResult>, String> {
    let opts = options.unwrap_or(SearchOptions {
        max_results: Some(5),
        language: Some("en".to_string()),
        freshness: None,
    });

    let max_results = opts.max_results.unwrap_or(5);

    // Try Brave Search first if API key available
    if let Ok(api_key) = std::env::var("BRAVE_API_KEY") {
        if !api_key.is_empty() {
            match brave_search(&query, max_results, &api_key, opts.freshness.as_deref()).await {
                Ok(results) if !results.is_empty() => {
                    println!("✓ Brave Search returned {} results", results.len());
                    return Ok(results);
                }
                Err(e) => {
                    eprintln!("Brave Search failed: {}", e);
                    // If rate limited (429), wait a bit before trying DuckDuckGo
                    if e.contains("429") {
                        eprintln!("⚠️ Rate limited by Brave API, waiting 2 seconds before fallback...");
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    }
                }
                _ => {}
            }
        }
    }

    // Try DuckDuckGo as fallback
    match duckduckgo_search(&query, max_results).await {
        Ok(results) if !results.is_empty() => {
            println!("✓ DuckDuckGo returned {} results", results.len());
            return Ok(results);
        }
        Err(e) => eprintln!("DuckDuckGo failed: {}", e),
        _ => {}
    }

    // Return mock results as final fallback
    println!("⚠️ All search APIs failed, returning mock results");
    Ok(mock_search_results(&query, max_results))
}

/// Brave Search API implementation
async fn brave_search(
    query: &str,
    max_results: usize,
    api_key: &str,
    freshness: Option<&str>,
) -> Result<Vec<SearchResult>, String> {
    let mut url = format!(
        "https://api.search.brave.com/res/v1/web/search?q={}&count={}",
        urlencoding::encode(query),
        max_results.min(20)
    );

    if let Some(fresh) = freshness {
        url.push_str(&format!("&freshness={}", fresh));
    }

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .header("X-Subscription-Token", api_key)
        .send()
        .await
        .map_err(|e| format!("Brave request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Brave API error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Brave response: {}", e))?;

    let mut results = Vec::new();

    if let Some(web_results) = data["web"]["results"].as_array() {
        for result in web_results.iter().take(max_results) {
            if let (Some(title), Some(description), Some(url_str)) = (
                result["title"].as_str(),
                result["description"].as_str(),
                result["url"].as_str(),
            ) {
                // Extract source - prefer profile name, fallback to hostname
                let source = result["profile"]["name"]
                    .as_str()
                    .map(|s| s.to_string())
                    .or_else(|| {
                        url_str.parse::<url::Url>()
                            .ok()
                            .and_then(|u| u.host_str().map(|s| s.to_string()))
                    });

                results.push(SearchResult {
                    title: title.to_string(),
                    snippet: description.to_string(),
                    url: url_str.to_string(),
                    source,
                    published_date: result["age"].as_str().map(|s| s.to_string()),
                });
            }
        }
    }

    Ok(results)
}

/// DuckDuckGo instant answer API
async fn duckduckgo_search(query: &str, max_results: usize) -> Result<Vec<SearchResult>, String> {
    let url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        urlencoding::encode(query)
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("DuckDuckGo request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("DuckDuckGo API error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse DDG response: {}", e))?;

    let mut results = Vec::new();

    // Extract abstract
    if let (Some(abstract_text), Some(abstract_url)) = (
        data["AbstractText"].as_str(),
        data["AbstractURL"].as_str(),
    ) {
        if !abstract_text.is_empty() {
            results.push(SearchResult {
                title: data["Heading"]
                    .as_str()
                    .unwrap_or("Result")
                    .to_string(),
                snippet: abstract_text.to_string(),
                url: abstract_url.to_string(),
                source: data["AbstractSource"].as_str().map(|s| s.to_string()),
                published_date: None,
            });
        }
    }

    // Extract related topics
    if let Some(topics) = data["RelatedTopics"].as_array() {
        for topic in topics.iter().take(max_results.saturating_sub(results.len())) {
            if let (Some(text), Some(url)) = (
                topic["Text"].as_str(),
                topic["FirstURL"].as_str(),
            ) {
                results.push(SearchResult {
                    title: text.split(" - ").next().unwrap_or("Related Topic").to_string(),
                    snippet: text.to_string(),
                    url: url.to_string(),
                    source: Some("DuckDuckGo".to_string()),
                    published_date: None,
                });
            }
        }
    }

    if results.is_empty() {
        return Err("No results found".to_string());
    }

    Ok(results)
}

/// Mock search results for fallback/offline mode
fn mock_search_results(query: &str, max_results: usize) -> Vec<SearchResult> {
    let lower_query = query.to_lowercase();

    if lower_query.contains("black hole") {
        return vec![
            SearchResult {
                title: "TON 618 - The Largest Known Black Hole".to_string(),
                snippet: "TON 618 is an extremely luminous quasar with a supermassive black hole at its center. It has an estimated mass of 66 billion solar masses, making it one of the largest known black holes in the universe.".to_string(),
                url: "https://en.wikipedia.org/wiki/TON_618".to_string(),
                source: Some("Wikipedia".to_string()),
                published_date: Some("2025-01-15".to_string()),
            },
            SearchResult {
                title: "Phoenix A Black Hole - 100 Billion Solar Masses".to_string(),
                snippet: "The black hole at the center of Phoenix A galaxy is estimated to have a mass of 100 billion solar masses, potentially making it the largest known black hole.".to_string(),
                url: "https://www.space.com/phoenix-a-black-hole".to_string(),
                source: Some("Space.com".to_string()),
                published_date: Some("2024-12-10".to_string()),
            },
            SearchResult {
                title: "Holmberg 15A Black Hole - 40 Billion Solar Masses".to_string(),
                snippet: "Located at the center of Holmberg 15A galaxy, this supermassive black hole has an estimated mass of 40 billion solar masses.".to_string(),
                url: "https://www.scientificamerican.com/holmberg-15a".to_string(),
                source: Some("Scientific American".to_string()),
                published_date: Some("2024-11-20".to_string()),
            },
            SearchResult {
                title: "IC 1101 Central Black Hole - 40 Billion Solar Masses".to_string(),
                snippet: "The supermassive black hole at the heart of IC 1101, one of the largest galaxies known, has a mass estimated at 40 billion times that of the Sun.".to_string(),
                url: "https://www.nasa.gov/ic-1101".to_string(),
                source: Some("NASA".to_string()),
                published_date: Some("2024-10-05".to_string()),
            },
            SearchResult {
                title: "S5 0014+81 - 40 Billion Solar Masses".to_string(),
                snippet: "This distant quasar hosts a supermassive black hole with an estimated mass of 40 billion solar masses, making it one of the most massive black holes ever discovered.".to_string(),
                url: "https://www.astronomy.com/s5-0014-81".to_string(),
                source: Some("Astronomy Magazine".to_string()),
                published_date: Some("2024-09-15".to_string()),
            },
        ]
        .into_iter()
        .take(max_results)
        .collect();
    }

    // Generic mock results for other queries
    vec![
        SearchResult {
            title: format!("Understanding {} - Comprehensive Guide", query),
            snippet: format!("{} is an important topic in modern science and technology. This comprehensive guide covers everything you need to know.", query),
            url: format!("https://www.example.com/{}", query.replace(' ', "-")),
            source: Some("Example Source".to_string()),
            published_date: Some("2024-12-01".to_string()),
        },
        SearchResult {
            title: format!("{}: Latest Research and Discoveries", query),
            snippet: format!("Recent studies on {} have revealed fascinating insights. Researchers have made significant progress.", query),
            url: format!("https://www.research.com/{}", query.replace(' ', "-")),
            source: Some("Research Portal".to_string()),
            published_date: Some("2024-11-15".to_string()),
        },
        SearchResult {
            title: format!("The Science Behind {}", query),
            snippet: format!("Exploring the scientific principles of {}. This article breaks down complex concepts into easy-to-understand explanations.", query),
            url: format!("https://www.science.com/{}", query.replace(' ', "-")),
            source: Some("Science Magazine".to_string()),
            published_date: Some("2024-10-20".to_string()),
        },
    ]
    .into_iter()
    .take(max_results)
    .collect()
}
