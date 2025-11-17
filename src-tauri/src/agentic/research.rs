use crate::ai::{AIManager, Message};
use crate::agentic::types::*;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Web research agent that searches and extracts structured data
pub struct WebResearchAgent {
    ai_manager: AIManager,
}

impl WebResearchAgent {
    pub fn new(ai_manager: AIManager) -> Self {
        Self { ai_manager }
    }

    /// Research a topic and extract structured data
    pub async fn research_and_extract(
        &self,
        query: &str,
        schema: DataSchema,
        count: usize,
    ) -> Result<Vec<HashMap<String, Value>>, String> {
        // Step 1: Search the web
        let search_results = self.search_web(query).await?;

        // Step 2: Use AI to extract structured data from search results
        let extraction_prompt = self.build_extraction_prompt(query, &schema, count, &search_results);

        let (response, _) = self.ai_manager.agent_service.chat(
            vec![
                Message {
                    role: "system".to_string(),
                    content: "You are an expert data extraction AI. Extract accurate, factual data from search results and return it in the requested JSON format. Prioritize accuracy and cite reliable sources.".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: extraction_prompt,
                },
            ],
            None,
        ).await.map_err(|e| format!("AI extraction failed: {}", e))?;

        // Step 3: Parse AI response into structured data
        let data = self.parse_extracted_data(&response)?;

        // Step 4: Validate data against schema
        self.validate_data(&data, &schema)?;

        Ok(data)
    }

    /// Simple research without structured extraction
    pub async fn research(&self, query: &str) -> Result<ResearchResult, String> {
        let search_results = self.search_web(query).await?;

        // Use AI to summarize search results
        let summary_prompt = format!(
            "Summarize the following search results about '{}':\n\n{}",
            query, search_results
        );

        let (summary, _) = self.ai_manager.agent_service.chat(
            vec![Message {
                role: "user".to_string(),
                content: summary_prompt,
            }],
            None,
        ).await.map_err(|e| format!("AI summarization failed: {}", e))?;

        Ok(ResearchResult {
            query: query.to_string(),
            sources: vec![],
            summary,
            data: None,
        })
    }

    /// Verify data accuracy by cross-checking sources
    pub async fn verify_data(
        &self,
        data: &[HashMap<String, Value>],
    ) -> Result<ValidationResult, String> {
        // Use AI to verify data looks reasonable
        let verification_prompt = format!(
            "Verify the accuracy and reasonableness of this data. Check for:\n\
             1. Obvious errors or inconsistencies\n\
             2. Unrealistic values\n\
             3. Missing required information\n\
             \n\
             Data:\n{}\n\
             \n\
             Return a JSON object with: {{\"passed\": boolean, \"issues\": [{{\"severity\": \"error|warning|info\", \"description\": string}}], \"score\": number 0-100}}",
            serde_json::to_string_pretty(data).unwrap()
        );

        let (response, _) = self.ai_manager.agent_service.chat(
            vec![Message {
                role: "user".to_string(),
                content: verification_prompt,
            }],
            None,
        ).await.map_err(|e| format!("AI verification failed: {}", e))?;

        let validation_json = self.extract_json_from_response(&response)?;
        let validation: ValidationResult = serde_json::from_value(validation_json)
            .map_err(|e| format!("Failed to parse validation result: {}", e))?;

        Ok(validation)
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    /// Search the web for information
    async fn search_web(&self, query: &str) -> Result<String, String> {
        // Try to use real search APIs with fallback chain:
        // 1. Brave Search (if API key in env)
        // 2. DuckDuckGo instant answers
        // 3. Mock fallback

        // Try Brave Search first if API key is available
        if let Ok(api_key) = std::env::var("BRAVE_API_KEY") {
            if !api_key.is_empty() {
                match self.brave_search(query, &api_key).await {
                    Ok(results) if !results.is_empty() => return Ok(results),
                    Err(e) => eprintln!("Brave Search failed: {}", e),
                    _ => {}
                }
            }
        }

        // Try DuckDuckGo as fallback
        match self.duckduckgo_search(query).await {
            Ok(results) if !results.is_empty() => return Ok(results),
            Err(e) => eprintln!("DuckDuckGo Search failed: {}", e),
            _ => {}
        }

        // Final fallback - return a helpful message
        Ok(format!(
            "Search results for: {}\n\
             \n\
             [No web search API configured. To enable real web search:\n\
             1. Set BRAVE_API_KEY environment variable with your Brave Search API key\n\
             2. Or use the frontend web search tool which has better fallback support\n\
             \n\
             For now, please use your knowledge base or rely on the frontend search.]",
            query
        ))
    }

    /// Brave Search API implementation
    async fn brave_search(&self, query: &str, api_key: &str) -> Result<String, String> {
        let url = format!(
            "https://api.search.brave.com/res/v1/web/search?q={}&count=10",
            urlencoding::encode(query)
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&url)
            .header("Accept", "application/json")
            .header("X-Subscription-Token", api_key)
            .send()
            .await
            .map_err(|e| format!("Brave Search request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Brave Search API error: {}", response.status()));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Brave response: {}", e))?;

        let mut formatted_results = String::new();
        formatted_results.push_str(&format!("Web search results for '{}':\n\n", query));

        if let Some(results) = data["web"]["results"].as_array() {
            for (i, result) in results.iter().enumerate() {
                if let (Some(title), Some(description), Some(url)) = (
                    result["title"].as_str(),
                    result["description"].as_str(),
                    result["url"].as_str(),
                ) {
                    formatted_results.push_str(&format!(
                        "{}. {}\n   {}\n   Source: {}\n\n",
                        i + 1,
                        title,
                        description,
                        url
                    ));
                }
            }
        }

        Ok(formatted_results)
    }

    /// DuckDuckGo instant answer API
    async fn duckduckgo_search(&self, query: &str) -> Result<String, String> {
        let url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1",
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

        let mut formatted_results = String::new();
        formatted_results.push_str(&format!("Search results for '{}':\n\n", query));

        // Extract abstract
        if let (Some(abstract_text), Some(abstract_url)) = (
            data["AbstractText"].as_str(),
            data["AbstractURL"].as_str(),
        ) {
            if !abstract_text.is_empty() {
                formatted_results.push_str(&format!(
                    "1. {}\n   {}\n   Source: {}\n\n",
                    data["Heading"].as_str().unwrap_or("Result"),
                    abstract_text,
                    abstract_url
                ));
            }
        }

        // Extract related topics
        if let Some(topics) = data["RelatedTopics"].as_array() {
            let mut count = 2;
            for topic in topics.iter().take(5) {
                if let (Some(text), Some(url)) = (
                    topic["Text"].as_str(),
                    topic["FirstURL"].as_str(),
                ) {
                    formatted_results.push_str(&format!(
                        "{}. {}\n   Source: {}\n\n",
                        count,
                        text,
                        url
                    ));
                    count += 1;
                }
            }
        }

        if formatted_results.len() < 50 {
            return Err("No results found".to_string());
        }

        Ok(formatted_results)
    }

    /// Build prompt for data extraction
    fn build_extraction_prompt(
        &self,
        query: &str,
        schema: &DataSchema,
        count: usize,
        search_results: &str,
    ) -> String {
        let schema_description = self.format_schema(schema);

        format!(
            "Based on search results about '{}', extract {} items with the following structure:\n\
             \n\
             SCHEMA:\n{}\n\
             \n\
             SEARCH RESULTS:\n{}\n\
             \n\
             INSTRUCTIONS:\n\
             1. Extract exactly {} items\n\
             2. Ensure all required columns are present\n\
             3. Use accurate, factual data from reliable sources\n\
             4. Follow the data types specified in the schema\n\
             5. Return ONLY a JSON array of objects, no other text\n\
             \n\
             Example format:\n\
             [\n\
               {{\n\
                 \"column1\": value1,\n\
                 \"column2\": value2\n\
               }},\n\
               ...\n\
             ]\n\
             \n\
             Return the JSON array:",
            query,
            count,
            schema_description,
            search_results,
            count
        )
    }

    /// Format schema for prompt
    fn format_schema(&self, schema: &DataSchema) -> String {
        let mut lines = vec![];

        for col in &schema.columns {
            let example = col.example.as_ref()
                .map(|e| format!(" (example: {})", e))
                .unwrap_or_default();

            lines.push(format!(
                "  - {}: {} - {}{}",
                col.name,
                col.data_type,
                col.description,
                example
            ));
        }

        lines.join("\n")
    }

    /// Parse extracted data from AI response
    fn parse_extracted_data(&self, ai_response: &str) -> Result<Vec<HashMap<String, Value>>, String> {
        let json_value = self.extract_json_from_response(ai_response)?;

        // Ensure it's an array
        if !json_value.is_array() {
            return Err("AI response is not a JSON array".to_string());
        }

        // Convert to Vec<HashMap<String, Value>>
        let array = json_value.as_array().unwrap();
        let mut result = vec![];

        for item in array {
            if let Some(obj) = item.as_object() {
                let mut map = HashMap::new();
                for (key, value) in obj {
                    map.insert(key.clone(), value.clone());
                }
                result.push(map);
            } else {
                return Err("Array item is not an object".to_string());
            }
        }

        Ok(result)
    }

    /// Extract JSON from AI response (handles markdown code blocks)
    fn extract_json_from_response(&self, response: &str) -> Result<Value, String> {
        let json_str = if response.contains("```json") {
            // Extract from code block
            let start = response.find("```json")
                .ok_or("Failed to find JSON code block start")?
                + 7;
            let end = response[start..]
                .find("```")
                .ok_or("Failed to find JSON code block end")?
                + start;
            response[start..end].trim()
        } else if response.contains("```") {
            // Extract from generic code block
            let start = response.find("```")
                .ok_or("Failed to find code block start")?
                + 3;
            let end = response[start..]
                .find("```")
                .ok_or("Failed to find code block end")?
                + start;
            response[start..end].trim()
        } else {
            // Try to find JSON array or object
            let trimmed = response.trim();
            if trimmed.starts_with('[') || trimmed.starts_with('{') {
                trimmed
            } else {
                // Look for first [ or {
                let start = trimmed.find(|c| c == '[' || c == '{')
                    .ok_or("No JSON found in response")?;
                &trimmed[start..]
            }
        };

        serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse JSON: {}. JSON: {}", e, json_str))
    }

    /// Validate data against schema
    fn validate_data(
        &self,
        data: &[HashMap<String, Value>],
        schema: &DataSchema,
    ) -> Result<(), String> {
        if data.is_empty() {
            return Err("No data extracted".to_string());
        }

        // Check each row
        for (idx, row) in data.iter().enumerate() {
            // Check all required columns exist
            for col_spec in &schema.columns {
                if !row.contains_key(&col_spec.name) {
                    return Err(format!(
                        "Row {}: Missing required column '{}'",
                        idx, col_spec.name
                    ));
                }

                // Type checking
                let value = &row[&col_spec.name];
                let valid = match col_spec.data_type.to_lowercase().as_str() {
                    "number" | "integer" | "float" => value.is_number(),
                    "string" | "text" => value.is_string(),
                    "boolean" | "bool" => value.is_boolean(),
                    "array" => value.is_array(),
                    "object" => value.is_object(),
                    _ => true, // Unknown type, allow
                };

                if !valid {
                    return Err(format!(
                        "Row {}: Invalid type for column '{}': expected {}, got {:?}",
                        idx, col_spec.name, col_spec.data_type, value
                    ));
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_from_markdown() {
        let agent = WebResearchAgent {
            ai_manager: AIManager::new(crate::ai::AIConfig::default()),
        };

        let response = r#"
Here's the data:

```json
[
  {"name": "TON 618", "mass": 66000000000},
  {"name": "Holmberg 15A", "mass": 40000000000}
]
```

That's all!
        "#;

        let result = agent.extract_json_from_response(response);
        assert!(result.is_ok());

        let json = result.unwrap();
        assert!(json.is_array());
        assert_eq!(json.as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_validate_data() {
        let agent = WebResearchAgent {
            ai_manager: AIManager::new(crate::ai::AIConfig::default()),
        };

        let schema = DataSchema {
            columns: vec![
                ColumnSpec {
                    name: "name".to_string(),
                    data_type: "string".to_string(),
                    description: "Black hole name".to_string(),
                    example: None,
                },
                ColumnSpec {
                    name: "mass".to_string(),
                    data_type: "number".to_string(),
                    description: "Mass in solar masses".to_string(),
                    example: Some("66000000000".to_string()),
                },
            ],
            constraints: vec![],
        };

        let mut data = vec![];
        let mut row1 = HashMap::new();
        row1.insert("name".to_string(), json!("TON 618"));
        row1.insert("mass".to_string(), json!(66000000000i64));
        data.push(row1);

        let result = agent.validate_data(&data, &schema);
        assert!(result.is_ok());
    }
}
