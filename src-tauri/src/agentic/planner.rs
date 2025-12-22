use crate::ai::{AIManager, Message};
use crate::agentic::types::*;
use serde_json::Value;

#[allow(unused_imports)]
use serde_json::json;
#[allow(unused_imports)]
use uuid::Uuid;

/// Multi-step task planner using AI
pub struct MultiStepPlanner {
    ai_manager: AIManager,
}

impl MultiStepPlanner {
    pub fn new(ai_manager: AIManager) -> Self {
        Self { ai_manager }
    }

    /// Plan a complex task by breaking it into executable steps
    pub async fn plan(&self, task: &str) -> Result<Vec<AgentStep>, String> {
        let planning_prompt = self.build_planning_prompt(task);

        let (response, _) = self.ai_manager.agent_service.chat(
            vec![
                Message {
                    role: "system".to_string(),
                    content: self.get_system_prompt(),
                },
                Message {
                    role: "user".to_string(),
                    content: planning_prompt,
                },
            ],
            None,
        ).await.map_err(|e| format!("AI planning failed: {}", e))?;

        // Parse plan from AI response
        self.parse_plan(&response)
    }

    /// Re-plan when a step fails
    pub async fn replan(
        &self,
        original_task: &str,
        context: &ExecutionContext,
        failed_step: &AgentStep,
        error: &str,
    ) -> Result<Vec<AgentStep>, String> {
        let replan_prompt = format!(
            "Original task: {}\n\
             \n\
             Failed step: {:?}\n\
             Error: {}\n\
             \n\
             Execution history:\n{}\n\
             \n\
             Create an alternative plan to complete this task, avoiding the error that occurred.",
            original_task,
            failed_step.step_type,
            error,
            self.format_execution_history(context)
        );

        self.plan(&replan_prompt).await
    }

    /// Suggest improvements to a plan
    pub async fn suggest_improvements(
        &self,
        steps: &[AgentStep],
        context: &ExecutionContext,
    ) -> Result<Vec<Improvement>, String> {
        let improvement_prompt = format!(
            "Analyze this execution plan and suggest improvements:\n\
             \n\
             Current plan:\n{}\n\
             \n\
             Execution context:\n{}\n\
             \n\
             Return a JSON array of improvements with structure:\n\
             [{{\n\
               \"target\": \"step_id or 'overall'\",\n\
               \"description\": \"what could be improved\",\n\
               \"action\": \"specific action to take\"\n\
             }}]",
            self.format_steps(steps),
            serde_json::to_string_pretty(context).unwrap()
        );

        let (response, _) = self.ai_manager.agent_service.chat(
            vec![Message {
                role: "user".to_string(),
                content: improvement_prompt,
            }],
            None,
        ).await.map_err(|e| format!("AI improvement suggestion failed: {}", e))?;

        let json = self.extract_json(&response)?;
        serde_json::from_value(json)
            .map_err(|e| format!("Failed to parse improvements: {}", e))
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    fn get_system_prompt(&self) -> String {
        r#"You are an expert autonomous AI agent planner. You break down complex tasks into specific, executable steps.

Available capabilities:
1. Research - Search the web for information
2. ExtractData - Extract structured data from research results
3. CreateNote - Create note blocks
4. CreateDatabase - Create database blocks with columns
5. CreateArtifact - Create artifact blocks (visualizations, simulations, etc.)
6. GenerateContent - Generate content for blocks
7. PopulateDatabase - Populate databases with data from various sources
8. Validate - Validate work quality
9. Reflect - Reflect on work and suggest improvements

Step types and their structure:
- Research: {"type": "Research", "query": "search query", "purpose": "why researching"}
- ExtractData: {"type": "ExtractData", "query": "topic", "schema": {"columns": [...]}, "count": 5}
- CreateNote: {"type": "CreateNote", "title": "Note Title", "parent_id": null}
- CreateDatabase: {"type": "CreateDatabase", "title": "DB Title", "columns": [{"name": "...", "type": "..."}]}
- CreateArtifact: {"type": "CreateArtifact", "title": "...", "artifact_type": "...", "content_prompt": "..."}
- PopulateDatabase: {"type": "PopulateDatabase", "database_id": "step_id", "data_source": {"type": "Research", "data": [...]}}
- Validate: {"type": "Validate", "target": "what to validate", "criteria": ["..."]}
- Reflect: {"type": "Reflect", "on": "what to reflect on", "improve": true}

Return a JSON array of steps with this structure:
[
  {
    "id": "step_1",
    "step_type": <one of the types above>,
    "depends_on": ["step_id1", "step_id2"],
    "status": "Pending"
  },
  ...
]

Important:
- Use descriptive step IDs (e.g., "research_black_holes", "create_database_largest")
- Set depends_on to ensure steps execute in the right order
- For database population, depends_on should include both the CreateDatabase step and the ExtractData step
- Be specific and actionable in each step"#.to_string()
    }

    fn build_planning_prompt(&self, task: &str) -> String {
        format!(
            "Create a detailed step-by-step plan for this task:\n\
             \n\
             TASK: {}\n\
             \n\
             Break this down into specific, executable steps. Each step should be atomic and clear.\n\
             Consider:\n\
             1. What information needs to be researched?\n\
             2. What data needs to be extracted and in what format?\n\
             3. What blocks (notes, databases, artifacts) need to be created?\n\
             4. In what order should things be created?\n\
             5. How should data flow between steps?\n\
             \n\
             Return ONLY the JSON array of steps, no other text.",
            task
        )
    }

    fn parse_plan(&self, ai_response: &str) -> Result<Vec<AgentStep>, String> {
        let json = self.extract_json(ai_response)?;

        if !json.is_array() {
            return Err("AI response is not a JSON array".to_string());
        }

        let array = json.as_array().unwrap();
        let mut steps = vec![];

        for (idx, item) in array.iter().enumerate() {
            let step = self.parse_step(item, idx)?;
            steps.push(step);
        }

        Ok(steps)
    }

    fn parse_step(&self, json: &Value, idx: usize) -> Result<AgentStep, String> {
        let obj = json.as_object()
            .ok_or_else(|| format!("Step {} is not an object", idx))?;

        let id = obj.get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(&format!("step_{}", idx))
            .to_string();

        let step_type: AgentStepType = serde_json::from_value(
            obj.get("step_type")
                .ok_or_else(|| format!("Step {} missing step_type", id))?
                .clone()
        ).map_err(|e| format!("Step {}: Invalid step_type: {}", id, e))?;

        let depends_on = obj.get("depends_on")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok(AgentStep {
            id,
            step_type,
            depends_on,
            status: StepStatus::Pending,
            result: None,
            error: None,
            retry_count: 0,
        })
    }

    fn extract_json(&self, response: &str) -> Result<Value, String> {
        let json_str = if response.contains("```json") {
            let start = response.find("```json")
                .ok_or("Failed to find JSON code block start")?
                + 7;
            let end = response[start..]
                .find("```")
                .ok_or("Failed to find JSON code block end")?
                + start;
            response[start..end].trim()
        } else if response.contains("```") {
            let start = response.find("```")
                .ok_or("Failed to find code block start")?
                + 3;
            let end = response[start..]
                .find("```")
                .ok_or("Failed to find code block end")?
                + start;
            response[start..end].trim()
        } else {
            let trimmed = response.trim();
            if trimmed.starts_with('[') {
                trimmed
            } else {
                let start = trimmed.find('[')
                    .ok_or("No JSON array found in response")?;
                &trimmed[start..]
            }
        };

        serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse JSON: {}. JSON: {}", e, json_str))
    }

    fn format_steps(&self, steps: &[AgentStep]) -> String {
        steps.iter()
            .map(|s| format!("  - {}: {:?} (depends on: {:?})", s.id, s.step_type, s.depends_on))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn format_execution_history(&self, context: &ExecutionContext) -> String {
        context.execution_history.iter()
            .map(|e| format!("  - Step {}: {:?} - {}", e.step_id, e.event_type, e.details))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_step() {
        let planner = MultiStepPlanner {
            ai_manager: AIManager::new(crate::ai::AIConfig::default()),
        };

        let json = json!({
            "id": "research_1",
            "step_type": {
                "type": "Research",
                "query": "largest black holes",
                "purpose": "Find top 5 largest black holes"
            },
            "depends_on": [],
            "status": "Pending"
        });

        let result = planner.parse_step(&json, 0);
        assert!(result.is_ok());

        let step = result.unwrap();
        assert_eq!(step.id, "research_1");
        assert!(matches!(step.step_type, AgentStepType::Research { .. }));
    }
}
