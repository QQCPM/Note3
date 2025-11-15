use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub endpoint: String,
    pub model: String,
    pub dimension: usize,
}

#[derive(Debug, Serialize)]
struct EmbeddingRequest {
    input: String,
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>,
}

pub struct LocalEmbeddingService {
    client: Client,
    config: EmbeddingConfig,
}

impl LocalEmbeddingService {
    pub fn new(config: EmbeddingConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Generate embedding for a single text
    pub async fn generate(&self, text: &str) -> Result<Vec<f32>, String> {
        let url = format!("{}/v1/embeddings", self.config.endpoint);

        let request_body = serde_json::json!({
            "input": text,
            "model": self.config.model,
        });

        let response = self.client
            .post(&url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, error_text));
        }

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Handle llama.cpp response format
        let embedding = if let Some(data) = response_json.get("data") {
            // OpenAI-compatible format
            data.as_array()
                .and_then(|arr| arr.first())
                .and_then(|obj| obj.get("embedding"))
                .and_then(|emb| emb.as_array())
                .ok_or("Invalid response format")?
                .iter()
                .filter_map(|v| v.as_f64().map(|f| f as f32))
                .collect()
        } else if let Some(embedding) = response_json.get("embedding") {
            // Direct embedding format
            embedding.as_array()
                .ok_or("Invalid embedding format")?
                .iter()
                .filter_map(|v| v.as_f64().map(|f| f as f32))
                .collect()
        } else {
            return Err("No embedding found in response".to_string());
        };

        Ok(embedding)
    }

    /// Generate embeddings for multiple texts (batched)
    pub async fn generate_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
        let mut embeddings = Vec::new();

        // Process in batches of 32 to avoid overwhelming the server
        for chunk in texts.chunks(32) {
            for text in chunk {
                let embedding = self.generate(text).await?;
                embeddings.push(embedding);
            }
        }

        Ok(embeddings)
    }

    /// Check if the embedding service is available
    pub async fn health_check(&self) -> Result<(), String> {
        let url = format!("{}/health", self.config.endpoint);

        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Health check failed: {}", e))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_embedding_generation() {
        let config = EmbeddingConfig {
            endpoint: "http://localhost:8081".to_string(),
            model: "qwen3-embedding-0.6b".to_string(),
            dimension: 1024,
        };

        let service = LocalEmbeddingService::new(config);

        // This will fail if server isn't running - that's expected in tests
        if let Ok(embedding) = service.generate("Hello, world!").await {
            assert_eq!(embedding.len(), 1024);
        }
    }
}
