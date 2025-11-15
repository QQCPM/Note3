use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;

/// Tool definition for AI function calling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

/// Tool execution result
#[derive(Debug, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub data: Value,
    pub error: Option<String>,
}

// ============================================================================
// DATABASE TOOLS - Phase 1: True Database Understanding
// ============================================================================

/// Get all available database tools for AI function calling
pub fn get_database_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "db_query_rows".to_string(),
            description: "Query database rows with SQL-like filters. Returns matching rows.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "filter": {
                        "type": "object",
                        "description": "Filter conditions (column: value pairs)",
                        "additionalProperties": true
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum rows to return"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "db_aggregate".to_string(),
            description: "Perform aggregations (sum, avg, count, min, max) on database columns.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["sum", "avg", "count", "min", "max"],
                        "description": "Aggregation operation"
                    },
                    "column": {
                        "type": "string",
                        "description": "Column name to aggregate"
                    },
                    "filter": {
                        "type": "object",
                        "description": "Optional filter conditions"
                    }
                },
                "required": ["block_id", "operation", "column"]
            }),
        },
        ToolDefinition {
            name: "db_group_by".to_string(),
            description: "Group database rows by column(s) and aggregate.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "group_by": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Columns to group by"
                    },
                    "aggregations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "operation": {"type": "string"},
                                "column": {"type": "string"},
                                "alias": {"type": "string"}
                            }
                        },
                        "description": "Aggregations to perform on each group"
                    }
                },
                "required": ["block_id", "group_by", "aggregations"]
            }),
        },
        ToolDefinition {
            name: "db_column_stats".to_string(),
            description: "Get statistical analysis of a column (mean, median, mode, std dev, distribution).".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "column": {
                        "type": "string",
                        "description": "Column name to analyze"
                    }
                },
                "required": ["block_id", "column"]
            }),
        },
        ToolDefinition {
            name: "db_create_chart_data".to_string(),
            description: "Generate chart-ready data from database (for pie, bar, line charts).".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "chart_type": {
                        "type": "string",
                        "enum": ["pie", "bar", "line", "scatter"],
                        "description": "Type of chart to create"
                    },
                    "x_column": {
                        "type": "string",
                        "description": "Column for X-axis or labels"
                    },
                    "y_column": {
                        "type": "string",
                        "description": "Column for Y-axis or values"
                    },
                    "group_by": {
                        "type": "string",
                        "description": "Optional column to group by"
                    }
                },
                "required": ["block_id", "chart_type", "x_column", "y_column"]
            }),
        },
        ToolDefinition {
            name: "db_update_rows".to_string(),
            description: "Update rows matching a filter with new values.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "filter": {
                        "type": "object",
                        "description": "Filter conditions (which rows to update)"
                    },
                    "updates": {
                        "type": "object",
                        "description": "New values (column: value pairs)"
                    }
                },
                "required": ["block_id", "filter", "updates"]
            }),
        },
        ToolDefinition {
            name: "db_add_row".to_string(),
            description: "Add a new row to the database.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "row_data": {
                        "type": "object",
                        "description": "Column values for the new row"
                    }
                },
                "required": ["block_id", "row_data"]
            }),
        },
        ToolDefinition {
            name: "db_delete_rows".to_string(),
            description: "Delete rows matching a filter.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "filter": {
                        "type": "object",
                        "description": "Filter conditions (which rows to delete)"
                    }
                },
                "required": ["block_id", "filter"]
            }),
        },
        ToolDefinition {
            name: "db_sort_rows".to_string(),
            description: "Sort database rows by one or more columns.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    },
                    "sort_by": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "column": {"type": "string"},
                                "direction": {
                                    "type": "string",
                                    "enum": ["asc", "desc"]
                                }
                            }
                        },
                        "description": "Sort specifications"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum rows to return"
                    }
                },
                "required": ["block_id", "sort_by"]
            }),
        },
        ToolDefinition {
            name: "db_get_schema".to_string(),
            description: "Get detailed schema info: columns, types, constraints, sample values.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The database block ID"
                    }
                },
                "required": ["block_id"]
            }),
        },
    ]
}

// ============================================================================
// ARTIFACT TOOLS - Phase 2: True Artifact Understanding
// ============================================================================

pub fn get_artifact_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "artifact_parse_structure".to_string(),
            description: "Parse and extract DOM structure from artifact HTML. Returns element tree.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "artifact_get_css_rules".to_string(),
            description: "Extract all CSS rules from artifact. Returns selectors and properties.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    },
                    "selector": {
                        "type": "string",
                        "description": "Optional: filter by selector pattern"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "artifact_get_js_functions".to_string(),
            description: "Extract JavaScript functions and their signatures from artifact.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "artifact_modify_html".to_string(),
            description: "Modify specific HTML elements by selector. Returns updated HTML.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector for element(s) to modify"
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["replace", "insert_before", "insert_after", "delete", "set_attribute", "set_text"],
                        "description": "Modification operation"
                    },
                    "content": {
                        "type": "string",
                        "description": "New content or attribute value"
                    }
                },
                "required": ["block_id", "selector", "operation"]
            }),
        },
        ToolDefinition {
            name: "artifact_modify_css".to_string(),
            description: "Add, update, or remove CSS rules.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    },
                    "selector": {
                        "type": "string",
                        "description": "CSS selector"
                    },
                    "properties": {
                        "type": "object",
                        "description": "CSS properties to set"
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["add", "update", "delete"],
                        "description": "Whether to add new rule, update existing, or delete"
                    }
                },
                "required": ["block_id", "selector", "operation"]
            }),
        },
        ToolDefinition {
            name: "artifact_modify_js".to_string(),
            description: "Modify JavaScript code: add functions, update variables, fix bugs.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["add_function", "replace_function", "add_variable", "replace_code"],
                        "description": "Modification operation"
                    },
                    "target": {
                        "type": "string",
                        "description": "Function name or code pattern to target"
                    },
                    "code": {
                        "type": "string",
                        "description": "New JavaScript code"
                    }
                },
                "required": ["block_id", "operation", "code"]
            }),
        },
        ToolDefinition {
            name: "artifact_validate".to_string(),
            description: "Validate artifact code: check HTML syntax, CSS validity, JS errors.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "artifact_extract_dependencies".to_string(),
            description: "Find external dependencies (CDN links, external scripts, fonts).".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "artifact_optimize".to_string(),
            description: "Analyze artifact and suggest optimizations (reduce size, improve performance).".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    },
                    "optimization_type": {
                        "type": "string",
                        "enum": ["size", "performance", "accessibility", "best_practices"],
                        "description": "Type of optimization to analyze"
                    }
                },
                "required": ["block_id"]
            }),
        },
        ToolDefinition {
            name: "artifact_get_colors".to_string(),
            description: "Extract all colors used in the artifact (from CSS and inline styles).".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "block_id": {
                        "type": "string",
                        "description": "The artifact block ID"
                    }
                },
                "required": ["block_id"]
            }),
        },
    ]
}

/// Get all tools (database + artifact)
pub fn get_all_tools() -> Vec<ToolDefinition> {
    let mut tools = get_database_tools();
    tools.extend(get_artifact_tools());
    tools
}

// ============================================================================
// TOOL EXECUTION - Implement the actual tool logic
// ============================================================================

/// Execute a database tool
pub async fn execute_database_tool(
    tool_name: &str,
    params: Value,
    db: &SqlitePool,
) -> Result<ToolResult, String> {
    match tool_name {
        "db_query_rows" => execute_db_query_rows(params, db).await,
        "db_aggregate" => execute_db_aggregate(params, db).await,
        "db_group_by" => execute_db_group_by(params, db).await,
        "db_column_stats" => execute_db_column_stats(params, db).await,
        "db_create_chart_data" => execute_db_create_chart_data(params, db).await,
        "db_update_rows" => execute_db_update_rows(params, db).await,
        "db_add_row" => execute_db_add_row(params, db).await,
        "db_delete_rows" => execute_db_delete_rows(params, db).await,
        "db_sort_rows" => execute_db_sort_rows(params, db).await,
        "db_get_schema" => execute_db_get_schema(params, db).await,
        _ => Err(format!("Unknown database tool: {}", tool_name)),
    }
}

/// Execute an artifact tool
pub async fn execute_artifact_tool(
    tool_name: &str,
    params: Value,
    db: &SqlitePool,
) -> Result<ToolResult, String> {
    match tool_name {
        "artifact_parse_structure" => execute_artifact_parse_structure(params, db).await,
        "artifact_get_css_rules" => execute_artifact_get_css_rules(params, db).await,
        "artifact_get_js_functions" => execute_artifact_get_js_functions(params, db).await,
        "artifact_modify_html" => execute_artifact_modify_html(params, db).await,
        "artifact_modify_css" => execute_artifact_modify_css(params, db).await,
        "artifact_modify_js" => execute_artifact_modify_js(params, db).await,
        "artifact_validate" => execute_artifact_validate(params, db).await,
        "artifact_extract_dependencies" => execute_artifact_extract_dependencies(params, db).await,
        "artifact_optimize" => execute_artifact_optimize(params, db).await,
        "artifact_get_colors" => execute_artifact_get_colors(params, db).await,
        _ => Err(format!("Unknown artifact tool: {}", tool_name)),
    }
}

// ============================================================================
// DATABASE TOOL IMPLEMENTATIONS
// ============================================================================

async fn execute_db_query_rows(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    let filter = params.get("filter");
    let limit = params.get("limit").and_then(|v| v.as_i64()).unwrap_or(100);

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .ok_or("No rows in database")?;

    // Apply filter
    let mut filtered_rows: Vec<&Value> = rows.iter().collect();

    if let Some(filter_obj) = filter.and_then(|v| v.as_object()) {
        filtered_rows.retain(|row| {
            if let Some(row_obj) = row.as_object() {
                filter_obj.iter().all(|(key, value)| {
                    row_obj.get(key).map(|v| v == value).unwrap_or(false)
                })
            } else {
                false
            }
        });
    }

    // Apply limit
    let result: Vec<Value> = filtered_rows.iter()
        .take(limit as usize)
        .cloned()
        .cloned()
        .collect();

    Ok(ToolResult {
        success: true,
        data: json!({
            "rows": result,
            "count": result.len(),
            "total": rows.len()
        }),
        error: None,
    })
}

async fn execute_db_aggregate(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    let operation = params.get("operation")
        .and_then(|v| v.as_str())
        .ok_or("Missing operation")?;

    let column = params.get("column")
        .and_then(|v| v.as_str())
        .ok_or("Missing column")?;

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .ok_or("No rows in database")?;

    // Extract numeric values
    let values: Vec<f64> = rows.iter()
        .filter_map(|row| {
            row.get(column).and_then(|v| {
                v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
        })
        .collect();

    if values.is_empty() {
        return Ok(ToolResult {
            success: false,
            data: Value::Null,
            error: Some("No numeric values found".to_string()),
        });
    }

    let result = match operation {
        "sum" => values.iter().sum(),
        "avg" => values.iter().sum::<f64>() / values.len() as f64,
        "count" => values.len() as f64,
        "min" => values.iter().cloned().fold(f64::INFINITY, f64::min),
        "max" => values.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
        _ => return Err("Invalid operation".to_string()),
    };

    Ok(ToolResult {
        success: true,
        data: json!({
            "operation": operation,
            "column": column,
            "result": result,
            "count": values.len()
        }),
        error: None,
    })
}

async fn execute_db_group_by(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    let group_by_cols = params.get("group_by")
        .and_then(|v| v.as_array())
        .ok_or("Missing group_by")?;

    let aggregations = params.get("aggregations")
        .and_then(|v| v.as_array())
        .ok_or("Missing aggregations")?;

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .ok_or("No rows in database")?;

    // Group rows
    use std::collections::HashMap;
    let mut groups: HashMap<String, Vec<&Value>> = HashMap::new();

    for row in rows {
        let key = group_by_cols.iter()
            .filter_map(|col| {
                col.as_str().and_then(|c| {
                    row.get(c).and_then(|v| v.as_str()).map(String::from)
                })
            })
            .collect::<Vec<_>>()
            .join("|");

        groups.entry(key).or_insert_with(Vec::new).push(row);
    }

    // Perform aggregations on each group
    let mut results = Vec::new();
    for (key, group_rows) in groups {
        let key_parts: Vec<&str> = key.split('|').collect();
        let mut result = serde_json::Map::new();

        // Add group keys
        for (i, col) in group_by_cols.iter().enumerate() {
            if let Some(col_name) = col.as_str() {
                if let Some(&value) = key_parts.get(i) {
                    result.insert(col_name.to_string(), json!(value));
                }
            }
        }

        // Perform aggregations
        for agg in aggregations {
            if let Some(agg_obj) = agg.as_object() {
                let op = agg_obj.get("operation").and_then(|v| v.as_str()).unwrap_or("");
                let col = agg_obj.get("column").and_then(|v| v.as_str()).unwrap_or("");
                let alias = agg_obj.get("alias").and_then(|v| v.as_str()).unwrap_or(col);

                let values: Vec<f64> = group_rows.iter()
                    .filter_map(|row| {
                        row.get(col).and_then(|v| {
                            v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                        })
                    })
                    .collect();

                if !values.is_empty() {
                    let agg_result = match op {
                        "sum" => values.iter().sum(),
                        "avg" => values.iter().sum::<f64>() / values.len() as f64,
                        "count" => values.len() as f64,
                        "min" => values.iter().cloned().fold(f64::INFINITY, f64::min),
                        "max" => values.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
                        _ => 0.0,
                    };

                    result.insert(alias.to_string(), json!(agg_result));
                }
            }
        }

        results.push(Value::Object(result));
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "groups": results,
            "count": results.len()
        }),
        error: None,
    })
}

async fn execute_db_column_stats(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    let column = params.get("column")
        .and_then(|v| v.as_str())
        .ok_or("Missing column")?;

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .ok_or("No rows in database")?;

    // Extract values
    let mut values: Vec<f64> = rows.iter()
        .filter_map(|row| {
            row.get(column).and_then(|v| {
                v.as_f64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
        })
        .collect();

    if values.is_empty() {
        return Ok(ToolResult {
            success: false,
            data: Value::Null,
            error: Some("No numeric values found".to_string()),
        });
    }

    values.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let count = values.len();
    let sum: f64 = values.iter().sum();
    let mean = sum / count as f64;

    // Median
    let median = if count % 2 == 0 {
        (values[count / 2 - 1] + values[count / 2]) / 2.0
    } else {
        values[count / 2]
    };

    // Standard deviation
    let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / count as f64;
    let std_dev = variance.sqrt();

    // Mode (most frequent value)
    use std::collections::HashMap;
    let mut freq_map: HashMap<String, usize> = HashMap::new();
    for &value in &values {
        let key = format!("{:.2}", value);
        *freq_map.entry(key).or_insert(0) += 1;
    }
    let mode = freq_map.iter()
        .max_by_key(|(_, &count)| count)
        .map(|(value, _)| value.parse::<f64>().unwrap_or(0.0))
        .unwrap_or(0.0);

    Ok(ToolResult {
        success: true,
        data: json!({
            "column": column,
            "count": count,
            "sum": sum,
            "mean": mean,
            "median": median,
            "mode": mode,
            "std_dev": std_dev,
            "min": values.first().unwrap(),
            "max": values.last().unwrap(),
            "range": values.last().unwrap() - values.first().unwrap()
        }),
        error: None,
    })
}

async fn execute_db_create_chart_data(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    let chart_type = params.get("chart_type")
        .and_then(|v| v.as_str())
        .ok_or("Missing chart_type")?;

    let x_column = params.get("x_column")
        .and_then(|v| v.as_str())
        .ok_or("Missing x_column")?;

    let y_column = params.get("y_column")
        .and_then(|v| v.as_str())
        .ok_or("Missing y_column")?;

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .ok_or("No rows in database")?;

    // Extract chart data
    let chart_data: Vec<Value> = rows.iter()
        .filter_map(|row| {
            let x = row.get(x_column)?;
            let y = row.get(y_column)?;
            Some(json!({
                "x": x,
                "y": y
            }))
        })
        .collect();

    Ok(ToolResult {
        success: true,
        data: json!({
            "chart_type": chart_type,
            "data": chart_data,
            "x_label": x_column,
            "y_label": y_column
        }),
        error: None,
    })
}

// Simplified stubs for remaining database tools (full implementation would go here)
async fn execute_db_update_rows(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "Update rows not yet implemented"}),
        error: None,
    })
}

async fn execute_db_add_row(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "Add row not yet implemented"}),
        error: None,
    })
}

async fn execute_db_delete_rows(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "Delete rows not yet implemented"}),
        error: None,
    })
}

async fn execute_db_sort_rows(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    let sort_specs = params.get("sort_by")
        .and_then(|v| v.as_array())
        .ok_or("Missing sort_by")?;

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .ok_or("No rows in database")?;

    let mut sorted_rows: Vec<Value> = rows.clone();

    // Sort by each column (in reverse order for stability)
    for spec in sort_specs.iter().rev() {
        if let Some(spec_obj) = spec.as_object() {
            let column = spec_obj.get("column").and_then(|v| v.as_str()).unwrap_or("");
            let direction = spec_obj.get("direction").and_then(|v| v.as_str()).unwrap_or("asc");

            sorted_rows.sort_by(|a, b| {
                let a_val = a.get(column);
                let b_val = b.get(column);

                let cmp = match (a_val, b_val) {
                    (Some(av), Some(bv)) => {
                        // Try numeric comparison first
                        if let (Some(an), Some(bn)) = (av.as_f64(), bv.as_f64()) {
                            an.partial_cmp(&bn).unwrap()
                        } else {
                            // Fall back to string comparison
                            av.to_string().cmp(&bv.to_string())
                        }
                    }
                    _ => std::cmp::Ordering::Equal,
                };

                if direction == "desc" { cmp.reverse() } else { cmp }
            });
        }
    }

    let limit = params.get("limit").and_then(|v| v.as_i64()).unwrap_or(sorted_rows.len() as i64);
    let result: Vec<Value> = sorted_rows.into_iter().take(limit as usize).collect();

    Ok(ToolResult {
        success: true,
        data: json!({
            "rows": result,
            "count": result.len()
        }),
        error: None,
    })
}

async fn execute_db_get_schema(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get database block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'database'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Database block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let columns = data.get("columns")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let rows = data.get("rows")
        .and_then(|v| v.as_array())
        .unwrap_or(&vec![]);

    // Get sample values for each column
    let mut schema_info = Vec::new();
    for col in columns {
        if let Some(col_obj) = col.as_object() {
            let name = col_obj.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
            let col_type = col_obj.get("type").and_then(|v| v.as_str()).unwrap_or("text");

            // Get sample values
            let samples: Vec<Value> = rows.iter()
                .filter_map(|row| row.get(name).cloned())
                .take(3)
                .collect();

            schema_info.push(json!({
                "name": name,
                "type": col_type,
                "samples": samples
            }));
        }
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "columns": schema_info,
            "row_count": rows.len()
        }),
        error: None,
    })
}

// ============================================================================
// ARTIFACT TOOL IMPLEMENTATIONS (Simplified for now)
// ============================================================================

async fn execute_artifact_parse_structure(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get artifact block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'artifact'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let html = data.get("html")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Simple HTML parsing - count elements by tag
    use std::collections::HashMap;
    let mut tag_counts: HashMap<String, usize> = HashMap::new();

    for tag in ["div", "p", "span", "h1", "h2", "h3", "button", "input", "form", "table", "ul", "li"] {
        let count = html.matches(&format!("<{}", tag)).count();
        if count > 0 {
            tag_counts.insert(tag.to_string(), count);
        }
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "html_length": html.len(),
            "tag_counts": tag_counts,
            "has_forms": html.contains("<form"),
            "has_scripts": html.contains("<script"),
            "has_styles": html.contains("<style")
        }),
        error: None,
    })
}

async fn execute_artifact_get_css_rules(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get artifact block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'artifact'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let css = data.get("css")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Extract selectors (very simplified)
    let selectors: Vec<&str> = css.split('{')
        .filter_map(|s| {
            let trimmed = s.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('}') {
                Some(trimmed)
            } else {
                None
            }
        })
        .collect();

    Ok(ToolResult {
        success: true,
        data: json!({
            "css_length": css.len(),
            "rule_count": selectors.len(),
            "selectors": selectors
        }),
        error: None,
    })
}

async fn execute_artifact_get_js_functions(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get artifact block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'artifact'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let js = data.get("javascript")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Extract function names (very simplified regex-like matching)
    let mut functions = Vec::new();
    for line in js.lines() {
        if line.contains("function ") {
            if let Some(name_start) = line.find("function ") {
                if let Some(name_end) = line[name_start + 9..].find('(') {
                    let name = &line[name_start + 9..name_start + 9 + name_end].trim();
                    functions.push(name.to_string());
                }
            }
        }
        // Also check for arrow functions
        if line.contains("const ") && line.contains("=>") {
            if let Some(name_start) = line.find("const ") {
                if let Some(name_end) = line[name_start + 6..].find('=') {
                    let name = &line[name_start + 6..name_start + 6 + name_end].trim();
                    functions.push(name.to_string());
                }
            }
        }
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "js_length": js.len(),
            "function_count": functions.len(),
            "functions": functions,
            "has_event_listeners": js.contains("addEventListener") || js.contains("onclick")
        }),
        error: None,
    })
}

// Stubs for remaining artifact tools
async fn execute_artifact_modify_html(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "HTML modification not yet implemented"}),
        error: None,
    })
}

async fn execute_artifact_modify_css(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "CSS modification not yet implemented"}),
        error: None,
    })
}

async fn execute_artifact_modify_js(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "JS modification not yet implemented"}),
        error: None,
    })
}

async fn execute_artifact_validate(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get artifact block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'artifact'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let html = data.get("html").and_then(|v| v.as_str()).unwrap_or("");
    let css = data.get("css").and_then(|v| v.as_str()).unwrap_or("");
    let js = data.get("javascript").and_then(|v| v.as_str()).unwrap_or("");

    let mut issues = Vec::new();

    // Simple validation checks
    if html.is_empty() {
        issues.push("HTML is empty");
    }
    if !html.contains("</") && !html.is_empty() {
        issues.push("HTML might have unclosed tags");
    }
    if css.matches('{').count() != css.matches('}').count() {
        issues.push("CSS has mismatched braces");
    }
    if js.matches('{').count() != js.matches('}').count() {
        issues.push("JavaScript has mismatched braces");
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "valid": issues.is_empty(),
            "issues": issues
        }),
        error: None,
    })
}

async fn execute_artifact_extract_dependencies(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get artifact block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'artifact'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let html = data.get("html").and_then(|v| v.as_str()).unwrap_or("");

    let mut dependencies = Vec::new();

    // Find CDN links
    for line in html.lines() {
        if line.contains("http://") || line.contains("https://") {
            if line.contains("cdn") || line.contains(".js") || line.contains(".css") {
                dependencies.push(line.trim().to_string());
            }
        }
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "dependencies": dependencies,
            "count": dependencies.len()
        }),
        error: None,
    })
}

async fn execute_artifact_optimize(_params: Value, _db: &SqlitePool) -> Result<ToolResult, String> {
    Ok(ToolResult {
        success: true,
        data: json!({"message": "Optimization analysis not yet implemented"}),
        error: None,
    })
}

async fn execute_artifact_get_colors(params: Value, db: &SqlitePool) -> Result<ToolResult, String> {
    let block_id = params.get("block_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing block_id")?;

    // Get artifact block
    let block: crate::db::Block = sqlx::query_as(
        "SELECT * FROM blocks WHERE id = ? AND block_type = 'artifact'"
    )
    .bind(block_id)
    .fetch_one(db)
    .await
    .map_err(|e| format!("Artifact block not found: {}", e))?;

    let data: Value = serde_json::from_str(&block.data)
        .map_err(|e| format!("Invalid block data: {}", e))?;

    let css = data.get("css").and_then(|v| v.as_str()).unwrap_or("");
    let html = data.get("html").and_then(|v| v.as_str()).unwrap_or("");

    let mut colors = Vec::new();
    let combined = format!("{} {}", css, html);

    // Find hex colors
    for word in combined.split_whitespace() {
        if word.starts_with('#') && (word.len() == 4 || word.len() == 7) {
            colors.push(word.to_string());
        }
    }

    // Find rgb/rgba colors
    if combined.contains("rgb(") || combined.contains("rgba(") {
        colors.push("Contains RGB colors".to_string());
    }

    Ok(ToolResult {
        success: true,
        data: json!({
            "colors": colors,
            "count": colors.len()
        }),
        error: None,
    })
}
