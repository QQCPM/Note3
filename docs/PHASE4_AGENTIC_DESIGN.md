# Phase 4: Agentic AI with Research Capabilities - Design

## User Requirements

### Goal
Enable AI to autonomously research topics, gather data from the internet, and populate databases/create content without manual intervention.

### Example Use Cases

**1. Simple Research Task:**
```
User: "Create a table of top 5 largest black holes"

AI autonomous workflow:
1. Search internet for "largest black holes"
2. Extract data (name, mass, distance, discovery date)
3. Create database with appropriate columns
4. Populate rows with researched data
5. Present completed table
```

**2. Complex Multi-Step Task:**
```
User: "Make a complete note about black holes with simulation and analysis"

AI autonomous workflow:
1. Research black holes (what they are, how they form)
2. Create note "Black Holes: A Comprehensive Guide"
3. Write informative content in text blocks
4. Research top 5 largest black holes
5. Create database: "Top 5 Largest Black Holes"
6. Populate with researched data
7. Create artifact: Black hole simulation (visual)
8. Research top 5 farthest black holes
9. Create database: "Top 5 Farthest Black Holes"
10. Populate with researched data
11. Present complete note with all components
```

---

## Architecture Design

### Core Components

```rust
// Agentic AI system
struct AgenticAI {
    planner: MultiStepPlanner,
    researcher: WebResearchAgent,
    executor: AutonomousExecutor,
    reflector: SelfReflector,
}

// Multi-step task planning
struct MultiStepPlanner {
    ai: AIManager,
}

impl MultiStepPlanner {
    // Break complex task into steps
    async fn plan(&self, task: &str) -> Result<Vec<AgentStep>>;

    // Re-plan if step fails
    async fn replan(&self, task: &str, context: &ExecutionContext) -> Result<Vec<AgentStep>>;
}

// Web research capabilities
struct WebResearchAgent {
    search_service: WebSearchService,
    ai: AIManager,
}

impl WebResearchAgent {
    // Research a topic
    async fn research(&self, query: &str) -> Result<ResearchResult>;

    // Extract structured data from search results
    async fn extract_data(&self, query: &str, schema: DataSchema) -> Result<Vec<HashMap<String, Value>>>;

    // Verify data accuracy
    async fn verify_data(&self, data: &[HashMap<String, Value>]) -> Result<bool>;
}

// Autonomous execution
struct AutonomousExecutor {
    db: SqlitePool,
    ai_state: AIState,
}

impl AutonomousExecutor {
    // Execute a full plan autonomously
    async fn execute_plan(&mut self, plan: Vec<AgentStep>) -> Result<ExecutionResult>;

    // Execute single step
    async fn execute_step(&mut self, step: &AgentStep) -> Result<StepResult>;

    // Handle step failure
    async fn handle_failure(&mut self, step: &AgentStep, error: &str) -> Result<RetryStrategy>;
}

// Self-reflection and validation
struct SelfReflector {
    ai: AIManager,
}

impl SelfReflector {
    // Validate work quality
    async fn validate(&self, result: &ExecutionResult) -> Result<ValidationResult>;

    // Suggest improvements
    async fn suggest_improvements(&self, result: &ExecutionResult) -> Result<Vec<Improvement>>;

    // Learn from mistakes
    async fn learn(&mut self, error: &str, context: &ExecutionContext);
}
```

---

## Step Types

```rust
enum AgentStepType {
    // Research steps
    Research {
        query: String,
        purpose: String,  // Why we're researching
    },

    // Data extraction
    ExtractData {
        source: String,  // Search results, web page, etc.
        schema: DataSchema,  // What structure we need
        count: usize,  // How many items
    },

    // Block creation
    CreateNote {
        title: String,
        parent_id: Option<String>,
    },

    CreateDatabase {
        title: String,
        columns: Vec<DatabaseColumn>,
    },

    CreateArtifact {
        title: String,
        artifact_type: String,
        content_prompt: String,
    },

    // Content generation
    GenerateContent {
        block_id: String,
        content_type: String,  // "text", "code", "markdown"
        prompt: String,
    },

    // Database population
    PopulateDatabase {
        database_id: String,
        data_source: DataSource,  // From research, from AI, from file
    },

    // Validation
    Validate {
        target: String,  // What to validate
        criteria: Vec<String>,  // What to check
    },

    // Reflection
    Reflect {
        on: String,  // What to reflect on
        improve: bool,  // Whether to improve
    },
}

enum DataSource {
    Research(Vec<HashMap<String, Value>>),  // From web research
    AIGenerated(String),  // AI generated data
    Transformed(String),  // From another database
}

struct DataSchema {
    columns: Vec<ColumnSpec>,
    constraints: Vec<Constraint>,
}

struct ColumnSpec {
    name: String,
    data_type: String,
    description: String,
    example: Option<String>,
}
```

---

## Implementation: Research Agent

```rust
// src-tauri/src/agentic/research.rs

use crate::ai::AIManager;
use serde::{Serialize, Deserialize};
use serde_json::{json, Value};

pub struct WebResearchAgent {
    ai: AIManager,
}

impl WebResearchAgent {
    pub async fn research_and_extract(
        &self,
        query: &str,
        schema: DataSchema,
        count: usize,
    ) -> Result<Vec<HashMap<String, Value>>, String> {
        // Step 1: Search the web
        let search_results = self.search_web(query).await?;

        // Step 2: Use AI to extract structured data from search results
        let extraction_prompt = format!(
            "Based on these search results about '{}', extract {} items with the following structure:\n\n\
             Schema:\n{}\n\n\
             Search Results:\n{}\n\n\
             Extract the data and return as JSON array. Be accurate and cite sources.",
            query,
            count,
            serde_json::to_string_pretty(&schema).unwrap(),
            search_results
        );

        let (response, _) = self.ai.agent_service.chat(
            vec![Message {
                role: "user".to_string(),
                content: extraction_prompt,
            }],
            None,
        ).await?;

        // Step 3: Parse AI response into structured data
        let data = self.parse_extracted_data(&response)?;

        // Step 4: Validate data
        self.validate_data(&data, &schema)?;

        Ok(data)
    }

    async fn search_web(&self, query: &str) -> Result<String, String> {
        // Use WebSearch tool (already available in Claude Code)
        // This would call the web search API

        // For now, return placeholder
        Ok(format!("Search results for: {}", query))
    }

    fn parse_extracted_data(&self, ai_response: &str) -> Result<Vec<HashMap<String, Value>>, String> {
        // Extract JSON from AI response
        // AI might wrap it in markdown code blocks

        let json_str = if ai_response.contains("```json") {
            // Extract from code block
            let start = ai_response.find("```json").unwrap() + 7;
            let end = ai_response[start..].find("```").unwrap() + start;
            &ai_response[start..end].trim()
        } else {
            ai_response.trim()
        };

        serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse JSON: {}", e))
    }

    fn validate_data(
        &self,
        data: &[HashMap<String, Value>],
        schema: &DataSchema,
    ) -> Result<(), String> {
        // Check that data matches schema
        for row in data {
            for col_spec in &schema.columns {
                if !row.contains_key(&col_spec.name) {
                    return Err(format!("Missing column: {}", col_spec.name));
                }

                // Type checking
                let value = &row[&col_spec.name];
                let valid = match col_spec.data_type.as_str() {
                    "number" => value.is_number(),
                    "string" | "text" => value.is_string(),
                    "boolean" => value.is_boolean(),
                    _ => true,
                };

                if !valid {
                    return Err(format!(
                        "Invalid type for column {}: expected {}, got {:?}",
                        col_spec.name, col_spec.data_type, value
                    ));
                }
            }
        }

        Ok(())
    }
}
```

---

## Implementation: Multi-Step Planner

```rust
// src-tauri/src/agentic/planner.rs

pub struct MultiStepPlanner {
    ai: AIManager,
}

impl MultiStepPlanner {
    pub async fn plan(&self, task: &str) -> Result<Vec<AgentStep>, String> {
        let planning_prompt = format!(
            "You are an autonomous AI agent. Break down this task into specific, executable steps:\n\n\
             Task: {}\n\n\
             Available capabilities:\n\
             - Research topics on the web\n\
             - Create notes, databases, artifacts\n\
             - Extract structured data from research\n\
             - Populate databases with data\n\
             - Generate content (text, code, visualizations)\n\
             - Validate and reflect on work\n\n\
             Create a detailed step-by-step plan. For each step, specify:\n\
             1. Step type (research, create_database, populate_data, etc.)\n\
             2. Description of what to do\n\
             3. Required inputs\n\
             4. Expected outputs\n\n\
             Return as JSON array of steps.",
            task
        );

        let (response, _) = self.ai.agent_service.chat(
            vec![Message {
                role: "system".to_string(),
                content: "You are an expert at planning multi-step autonomous tasks.".to_string(),
            }, Message {
                role: "user".to_string(),
                content: planning_prompt,
            }],
            None,
        ).await?;

        // Parse plan from AI response
        self.parse_plan(&response)
    }

    pub async fn replan(
        &self,
        original_task: &str,
        failed_step: &AgentStep,
        error: &str,
    ) -> Result<Vec<AgentStep>, String> {
        let replan_prompt = format!(
            "Task: {}\n\
             Failed Step: {:?}\n\
             Error: {}\n\n\
             Create an alternative approach to complete this task.",
            original_task, failed_step, error
        );

        // Similar to plan() but with failure context
        self.plan(&replan_prompt).await
    }

    fn parse_plan(&self, ai_response: &str) -> Result<Vec<AgentStep>, String> {
        // Parse AI's plan into structured steps
        // AI should return JSON array

        // For now, simplified parsing
        Ok(vec![])
    }
}
```

---

## Example Workflows

### Workflow 1: "Create table of top 5 largest black holes"

```
AI Planning Phase:
  ↓
Plan:
  1. Research: "largest black holes by mass"
  2. ExtractData: {
       schema: [
         {name: "Name", type: "text"},
         {name: "Mass (solar masses)", type: "number"},
         {name: "Distance (light years)", type: "number"},
         {name: "Location", type: "text"},
         {name: "Discovery Year", type: "number"}
       ],
       count: 5
     }
  3. CreateDatabase: "Top 5 Largest Black Holes"
  4. PopulateDatabase: with researched data
  5. Validate: Check data accuracy
  ↓
Execution Phase:
  Step 1: Search web for "largest black holes" ✓
  Step 2: AI extracts structured data from results ✓
  Step 3: Create database block ✓
  Step 4: Insert 5 rows with data ✓
  Step 5: Validate data looks reasonable ✓
  ↓
Result: Complete database with real data!
```

### Workflow 2: "Complete note about black holes"

```
AI Planning Phase:
  ↓
Plan:
  1. CreateNote: "Black Holes: A Comprehensive Guide"
  2. Research: "what are black holes, how do they form"
  3. GenerateContent: Informative text block about black holes
  4. Research: "largest black holes by mass"
  5. CreateDatabase: "Top 5 Largest Black Holes"
  6. PopulateDatabase: with data
  7. CreateArtifact: Black hole simulation (visualization)
  8. Research: "farthest black holes from earth"
  9. CreateDatabase: "Top 5 Farthest Black Holes"
  10. PopulateDatabase: with data
  11. Validate: All components created correctly
  12. Reflect: Is the note comprehensive and accurate?
  ↓
Execution: Each step executed autonomously
  ↓
Result: Complete note with multiple blocks, all populated with real data!
```

---

## Key Features

### 1. Autonomous Research ✓
- AI searches web for information
- Extracts relevant data
- Structures data according to needs

### 2. Smart Data Extraction ✓
- AI understands what data structure is needed
- Extracts from unstructured search results
- Validates data accuracy

### 3. Multi-Step Planning ✓
- AI breaks down complex tasks
- Creates executable plan
- Handles dependencies

### 4. Autonomous Execution ✓
- Executes plan step-by-step
- Handles errors gracefully
- Re-plans if needed

### 5. Self-Reflection ✓
- AI validates its own work
- Checks accuracy
- Improves if needed

---

## Integration with Existing Tools

**Uses Phase 1 (Database Tools):**
- `db_add_row` to populate researched data
- `db_aggregate` to analyze data
- `db_validate` to check data quality

**Uses Phase 2 (Artifact Tools):**
- `artifact_generate` to create visualizations
- `artifact_validate` to check quality

**Uses Phase 3 (Orchestration):**
- Multi-block creation
- Workflow templates

**New: Phase 4 (Agentic):**
- Web research
- Multi-step planning
- Autonomous execution
- Self-reflection

---

## Technical Challenges & Solutions

**Challenge 1: Web Search Integration**
- **Solution**: Use Claude Code's WebSearch tool
- Extract structured data with AI

**Challenge 2: Data Accuracy**
- **Solution**: AI validates data, cites sources
- Can re-research if data seems wrong

**Challenge 3: Complex Planning**
- **Solution**: Use GPT-4o for planning
- Break into small, verifiable steps

**Challenge 4: Error Recovery**
- **Solution**: Retry with different approach
- Re-plan if strategy fails

---

## Next Steps

1. ✅ Design architecture
2. ⏳ Implement research agent
3. ⏳ Implement planner
4. ⏳ Implement autonomous executor
5. ⏳ Add self-reflection
6. ⏳ Test with real examples
7. ⏳ Document capabilities

**Estimated**: ~2,000 lines of code
