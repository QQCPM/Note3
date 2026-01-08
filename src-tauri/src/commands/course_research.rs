use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use futures_util::StreamExt;

/// Result of course deep research
#[derive(Debug, Serialize, Deserialize)]
pub struct CourseResearchResult {
    pub topic: String,
    pub summary: String,
    pub sources: Vec<ResearchSource>,
    pub grounding_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchSource {
    pub url: String,
    pub title: String,
}

/// Progress update for streaming research
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchProgressPayload {
    pub thread_id: String,
    pub status: String,  // 'starting' | 'researching' | 'writing' | 'complete' | 'failed'
    pub progress: u8,    // 0-100
    pub thinking: String,
    pub sources: Vec<ResearchSourceWithStatus>,
    pub partial_report: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchSourceWithStatus {
    pub url: String,
    pub title: String,
    pub status: String,  // 'queued' | 'reading' | 'done' | 'failed'
}

/// Deep research for course generation using Gemini with Google Search grounding
/// 
/// This runs in Tauri backend to avoid CORS issues with the Gemini API
#[tauri::command]
pub async fn course_deep_research(
    topic: String,
    focus_areas: Vec<String>,
    gemini_api_key: String,
) -> Result<CourseResearchResult, String> {
    // Build research prompt
    let focus_section = if !focus_areas.is_empty() {
        format!("\nFOCUS AREAS: {}", focus_areas.join(", "))
    } else {
        String::new()
    };

    let research_prompt = format!(
        r#"Research comprehensive educational content for creating a course on: "{}"
{}

Please research and gather CURRENT, ACCURATE information on:

1. WHAT IS THIS TOPIC?
   - Official/accepted definition
   - Key terminology and acronyms explained correctly
   - Historical context and evolution

2. CORE CONCEPTS
   - What are the essential concepts that must be covered?
   - How do these concepts relate to each other?
   - What is the logical learning sequence?

3. CURRENT STATE (2024-2025)
   - Latest developments and research
   - Key papers and publications
   - Industry applications

4. PRACTICAL APPLICATIONS
   - Real-world use cases and examples
   - Code examples if applicable
   - Hands-on project ideas

5. RECOMMENDED RESOURCES
   - Key papers and their arxiv/publication links
   - Video tutorials and courses
   - Official documentation

Please provide detailed, WELL-SOURCED information with actual URLs.
Include specific examples and clear explanations."#,
        topic, focus_section
    );

    // Call Gemini API with Google Search grounding
    let client = reqwest::Client::new();
    
    let request_body = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": research_prompt
            }]
        }],
        "tools": [{
            "google_search": {}
        }],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192
        }
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        gemini_api_key
    );

    println!("========================================");
    println!("🚀 [TAURI BACKEND] Deep Research Request");
    println!("========================================");
    println!("[CourseResearch] Topic: {}", topic);
    println!("[CourseResearch] Focus Areas: {:?}", focus_areas);
    println!("[CourseResearch] Calling Gemini API via Tauri (NO CORS!)");
    println!("========================================");

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Gemini API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error {}: {}", status, error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

    // Extract text from response
    let text = data["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Extract grounding metadata if available
    let grounding_metadata = data["candidates"][0]["groundingMetadata"].clone();
    
    // Parse sources from grounding metadata
    let mut sources = Vec::new();
    if let Some(chunks) = grounding_metadata.get("groundingChunks").and_then(|c| c.as_array()) {
        for chunk in chunks {
            if let Some(web) = chunk.get("web") {
                if let (Some(uri), Some(title)) = (
                    web.get("uri").and_then(|u| u.as_str()),
                    web.get("title").and_then(|t| t.as_str()),
                ) {
                    sources.push(ResearchSource {
                        url: uri.to_string(),
                        title: title.to_string(),
                    });
                }
            }
        }
    }

    println!("========================================");
    println!("✅ [TAURI BACKEND] Research Complete!");
    println!("========================================");
    println!("[CourseResearch] Summary: {} chars", text.len());
    println!("[CourseResearch] Sources found: {}", sources.len());
    println!("[CourseResearch] Grounding metadata: {}", if grounding_metadata.is_null() { "None" } else { "Present" });
    println!("========================================");

    Ok(CourseResearchResult {
        topic,
        summary: text,
        sources,
        grounding_metadata: if grounding_metadata.is_null() {
            None
        } else {
            Some(grounding_metadata)
        },
    })
}

/// Streaming deep research using Gemini Interactions API
/// Emits real-time progress via Tauri events
#[tauri::command]
pub async fn course_deep_research_stream(
    app: tauri::AppHandle,
    thread_id: String,
    topic: String,
    focus_areas: Vec<String>,
    gemini_api_key: String,
) -> Result<(), String> {
    // Emit starting progress
    let _ = app.emit("research-progress", ResearchProgressPayload {
        thread_id: thread_id.clone(),
        status: "starting".to_string(),
        progress: 0,
        thinking: "Initializing deep research...".to_string(),
        sources: vec![],
        partial_report: None,
    });

    println!("========================================");
    println!("🚀 [TAURI STREAMING] Deep Research Request");
    println!("========================================");
    println!("[StreamingResearch] Thread: {}", thread_id);
    println!("[StreamingResearch] Topic: {}", topic);
    println!("[StreamingResearch] Focus Areas: {:?}", focus_areas);
    println!("========================================");

    // Build research prompt
    let focus_section = if !focus_areas.is_empty() {
        format!("\nFOCUS AREAS: {}", focus_areas.join(", "))
    } else {
        String::new()
    };

    let research_prompt = format!(
        r#"Research comprehensive educational content for creating a course on: "{}"
{}

Please research and gather CURRENT, ACCURATE information on:

1. WHAT IS THIS TOPIC?
   - Official/accepted definition
   - Key terminology and acronyms explained correctly
   - Historical context and evolution

2. CORE CONCEPTS
   - What are the essential concepts that must be covered?
   - How do these concepts relate to each other?
   - What is the logical learning sequence?

3. CURRENT STATE (2024-2025)
   - Latest developments and research
   - Key papers and publications
   - Industry applications

4. PRACTICAL APPLICATIONS
   - Real-world use cases and examples
   - Code examples if applicable
   - Hands-on project ideas

5. RECOMMENDED RESOURCES
   - Key papers and their arxiv/publication links
   - Video tutorials and courses
   - Official documentation

Please provide detailed, WELL-SOURCED information with actual URLs.
Include specific examples and clear explanations."#,
        topic, focus_section
    );

    // Create streaming request to Gemini Interactions API
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/interactions?key={}",
        gemini_api_key
    );

    let request_body = serde_json::json!({
        "input": research_prompt,
        "agent": "deep-research-pro-preview-12-2025",
        "background": true,
        "stream": true,
        "agent_config": {
            "type": "deep-research",
            "thinking_summaries": "auto"
        }
    });

    // Emit researching progress
    let _ = app.emit("research-progress", ResearchProgressPayload {
        thread_id: thread_id.clone(),
        status: "researching".to_string(),
        progress: 10,
        thinking: "Sending request to Gemini Deep Research API...".to_string(),
        sources: vec![],
        partial_report: None,
    });

    // Make streaming request
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Gemini API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        
        // Emit failure
        let _ = app.emit("research-progress", ResearchProgressPayload {
            thread_id: thread_id.clone(),
            status: "failed".to_string(),
            progress: 0,
            thinking: format!("API error {}: {}", status, error_text),
            sources: vec![],
            partial_report: None,
        });
        
        return Err(format!("Gemini API error {}: {}", status, error_text));
    }

    println!("[StreamingResearch] Stream connected, processing events...");

    // Process SSE stream
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut sources: Vec<ResearchSourceWithStatus> = vec![];
    let mut partial_report = String::new();
    let mut interaction_id: Option<String> = None;
    let mut progress_count = 10u8;

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let chunk_str = String::from_utf8_lossy(&chunk);
                buffer.push_str(&chunk_str);

                // Process complete SSE events (separated by \n\n)
                while let Some(event_end) = buffer.find("\n\n") {
                    let event_data = buffer[..event_end].to_string();
                    buffer = buffer[event_end + 2..].to_string();

                    // Parse SSE event
                    if event_data.starts_with("data: ") {
                        let json_str = &event_data[6..]; // Skip "data: "
                        
                        if let Ok(event) = serde_json::from_str::<serde_json::Value>(json_str) {
                            let event_type = event["event_type"].as_str().unwrap_or("");
                            
                            println!("[StreamingResearch] Event: {}", event_type);

                            match event_type {
                                "interaction.start" => {
                                    if let Some(id) = event["interaction"]["id"].as_str() {
                                        interaction_id = Some(id.to_string());
                                        println!("[StreamingResearch] Interaction ID: {}", id);
                                    }
                                    
                                    let _ = app.emit("research-progress", ResearchProgressPayload {
                                        thread_id: thread_id.clone(),
                                        status: "researching".to_string(),
                                        progress: 15,
                                        thinking: "Deep research started...".to_string(),
                                        sources: sources.clone(),
                                        partial_report: None,
                                    });
                                }

                                "content.delta" => {
                                    if let Some(delta) = event.get("delta") {
                                        let delta_type = delta["type"].as_str().unwrap_or("");
                                        
                                        if delta_type == "thought_summary" {
                                            // Extract thinking text
                                            if let Some(thinking_text) = delta["content"]["text"].as_str() {
                                                progress_count = (progress_count + 5).min(80);
                                                
                                                // Try to extract sources from thinking text
                                                // (This is a simple heuristic - actual source tracking would be better)
                                                if thinking_text.contains("http") {
                                                    // Simplified source extraction
                                                    let source_count = thinking_text.matches("http").count();
                                                    for i in 0..source_count.min(3) {
                                                        if sources.len() < 30 {
                                                            sources.push(ResearchSourceWithStatus {
                                                                url: format!("Source {}", sources.len() + 1),
                                                                title: format!("Researching source {}...", sources.len() + 1),
                                                                status: "reading".to_string(),
                                                            });
                                                        }
                                                    }
                                                }
                                                
                                                println!("[StreamingResearch] Thinking: {}", 
                                                    if thinking_text.len() > 100 { 
                                                        format!("{}...", &thinking_text[..100])
                                                    } else { 
                                                        thinking_text.to_string() 
                                                    }
                                                );

                                                let _ = app.emit("research-progress", ResearchProgressPayload {
                                                    thread_id: thread_id.clone(),
                                                    status: "researching".to_string(),
                                                    progress: progress_count,
                                                    thinking: thinking_text.to_string(),
                                                    sources: sources.clone(),
                                                    partial_report: None,
                                                });
                                            }
                                        } else if delta_type == "text" {
                                            // Final report text being written
                                            if let Some(text) = delta["text"].as_str() {
                                                partial_report.push_str(text);
                                                
                                                let _ = app.emit("research-progress", ResearchProgressPayload {
                                                    thread_id: thread_id.clone(),
                                                    status: "writing".to_string(),
                                                    progress: 85,
                                                    thinking: "Writing research report...".to_string(),
                                                    sources: sources.clone(),
                                                    partial_report: Some(partial_report.clone()),
                                                });
                                            }
                                        }
                                    }
                                }

                                "interaction.complete" => {
                                    println!("[StreamingResearch] Research complete!");
                                    
                                    // Mark all sources as done
                                    for source in &mut sources {
                                        source.status = "done".to_string();
                                    }
                                    
                                    // Extract final report if not already captured
                                    if partial_report.is_empty() {
                                        if let Some(outputs) = event["interaction"]["outputs"].as_array() {
                                            if let Some(last_output) = outputs.last() {
                                                if let Some(text) = last_output["text"].as_str() {
                                                    partial_report = text.to_string();
                                                }
                                            }
                                        }
                                    }
                                    
                                    let _ = app.emit("research-progress", ResearchProgressPayload {
                                        thread_id: thread_id.clone(),
                                        status: "complete".to_string(),
                                        progress: 100,
                                        thinking: format!("Research complete! Found {} sources.", sources.len()),
                                        sources: sources.clone(),
                                        partial_report: Some(partial_report.clone()),
                                    });
                                    
                                    println!("========================================");
                                    println!("✅ [TAURI STREAMING] Research Complete!");
                                    println!("========================================");
                                    println!("[StreamingResearch] Report: {} chars", partial_report.len());
                                    println!("[StreamingResearch] Sources discovered: {}", sources.len());
                                    println!("========================================");
                                    
                                    return Ok(());
                                }

                                "interaction.failed" => {
                                    let error_msg = event["error"]["message"].as_str()
                                        .unwrap_or("Research failed");
                                    
                                    let _ = app.emit("research-progress", ResearchProgressPayload {
                                        thread_id: thread_id.clone(),
                                        status: "failed".to_string(),
                                        progress: 0,
                                        thinking: error_msg.to_string(),
                                        sources: sources.clone(),
                                        partial_report: None,
                                    });
                                    
                                    return Err(error_msg.to_string());
                                }

                                _ => {
                                    // Ignore other event types
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("[StreamingResearch] Stream error: {}", e);
                
                let _ = app.emit("research-progress", ResearchProgressPayload {
                    thread_id: thread_id.clone(),
                    status: "failed".to_string(),
                    progress: 0,
                    thinking: format!("Stream error: {}", e),
                    sources: sources.clone(),
                    partial_report: None,
                });
                
                return Err(format!("Stream error: {}", e));
            }
        }
    }

    println!("[StreamingResearch] Stream ended");
    Ok(())
}
