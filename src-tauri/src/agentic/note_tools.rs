use crate::ai::FunctionDefinition;
use serde_json::json;

// ============================================================================
// NOTE-TAKING CUSTOM TOOLS
// These tools allow the GPT-5 Agent to create and manage notes, blocks,
// databases, and artifacts in the note-taking application.
// ============================================================================

/// Get all note-taking custom tools for the agent
pub fn get_note_tools() -> Vec<FunctionDefinition> {
    vec![
        create_note_tool(),
        create_text_block_tool(),
        create_heading_block_tool(),
        create_database_tool(),
        create_artifact_tool(),
        create_image_block_tool(),
        create_code_block_tool(),
        add_database_row_tool(),
        link_notes_tool(),
        create_section_tool(),
        create_quiz_tool(),
        create_flashcard_tool(),
    ]
}

/// Tool to create a new note
fn create_note_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_note".to_string(),
        description: "Create a new note/page in the workspace. Use this to organize content into separate pages.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "The title of the note"
                },
                "parent_id": {
                    "type": "string",
                    "description": "Optional parent note ID to create as a sub-note"
                },
                "icon": {
                    "type": "string",
                    "description": "Optional emoji icon for the note (e.g., '📚', '🔬')"
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional tags for categorization"
                }
            },
            "required": ["title"]
        }),
    }
}

/// Tool to create a text block
fn create_text_block_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_text_block".to_string(),
        description: "Create a text/paragraph block in the current note. Use for explanatory content, descriptions, and general text.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID to add the block to"
                },
                "content": {
                    "type": "string",
                    "description": "The text content (supports markdown)"
                },
                "position": {
                    "type": "integer",
                    "description": "Optional position in the note (0 = top)"
                }
            },
            "required": ["note_id", "content"]
        }),
    }
}

/// Tool to create a heading block
fn create_heading_block_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_heading_block".to_string(),
        description: "Create a heading block to structure content. Use for section titles and organization.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID to add the block to"
                },
                "text": {
                    "type": "string",
                    "description": "The heading text"
                },
                "level": {
                    "type": "integer",
                    "description": "Heading level (1-6, default 2)",
                    "enum": [1, 2, 3, 4, 5, 6]
                }
            },
            "required": ["note_id", "text"]
        }),
    }
}

/// Tool to create a database block
fn create_database_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_database".to_string(),
        description: "Create a database/table block for structured data. Use for lists, comparisons, tracking information.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID to add the database to"
                },
                "title": {
                    "type": "string",
                    "description": "Database title"
                },
                "columns": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "type": {
                                "type": "string",
                                "enum": ["text", "number", "date", "select", "checkbox", "url"]
                            },
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Options for select type columns"
                            }
                        },
                        "required": ["name", "type"]
                    },
                    "description": "Column definitions"
                }
            },
            "required": ["note_id", "title", "columns"]
        }),
    }
}

/// Tool to create an artifact block (interactive HTML/CSS/JS)
fn create_artifact_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_artifact".to_string(),
        description: "Create an interactive artifact block with HTML/CSS/JavaScript. Use for visualizations, simulations, interactive demos, charts, and dynamic content.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID to add the artifact to"
                },
                "title": {
                    "type": "string",
                    "description": "Artifact title"
                },
                "description": {
                    "type": "string",
                    "description": "What the artifact should do/show. Be detailed."
                },
                "artifact_type": {
                    "type": "string",
                    "description": "Type of artifact",
                    "enum": ["visualization", "simulation", "calculator", "chart", "diagram", "interactive", "game", "animation"]
                }
            },
            "required": ["note_id", "title", "description"]
        }),
    }
}

/// Tool to create an image block
fn create_image_block_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_image_block".to_string(),
        description: "Create an image block. Can use generated images, URLs, or request AI image generation.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID to add the image to"
                },
                "source": {
                    "type": "string",
                    "description": "Image source: 'url', 'generate', or 'upload'"
                },
                "url": {
                    "type": "string",
                    "description": "Image URL (if source is 'url')"
                },
                "prompt": {
                    "type": "string",
                    "description": "Generation prompt (if source is 'generate')"
                },
                "caption": {
                    "type": "string",
                    "description": "Optional image caption"
                },
                "alt_text": {
                    "type": "string",
                    "description": "Alt text for accessibility"
                }
            },
            "required": ["note_id", "source"]
        }),
    }
}

/// Tool to create a code block
fn create_code_block_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_code_block".to_string(),
        description: "Create a code block with syntax highlighting. Use for code examples, snippets, and technical content.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID to add the code block to"
                },
                "code": {
                    "type": "string",
                    "description": "The code content"
                },
                "language": {
                    "type": "string",
                    "description": "Programming language for syntax highlighting"
                },
                "title": {
                    "type": "string",
                    "description": "Optional title/filename"
                },
                "runnable": {
                    "type": "boolean",
                    "description": "Whether the code should be executable"
                }
            },
            "required": ["note_id", "code", "language"]
        }),
    }
}

/// Tool to add a row to a database
fn add_database_row_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "add_database_row".to_string(),
        description: "Add a row to an existing database. Use to populate databases with data.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "database_id": {
                    "type": "string",
                    "description": "The database block ID"
                },
                "data": {
                    "type": "object",
                    "description": "Row data as column_name: value pairs",
                    "additionalProperties": true
                }
            },
            "required": ["database_id", "data"]
        }),
    }
}

/// Tool to link notes together
fn link_notes_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "link_notes".to_string(),
        description: "Create a link between two notes. Use to build a knowledge graph.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "source_note_id": {
                    "type": "string",
                    "description": "The source note ID"
                },
                "target_note_id": {
                    "type": "string",
                    "description": "The target note ID to link to"
                },
                "link_text": {
                    "type": "string",
                    "description": "Text to display for the link"
                },
                "relationship": {
                    "type": "string",
                    "description": "Type of relationship",
                    "enum": ["related", "prerequisite", "next", "see_also", "parent", "child"]
                }
            },
            "required": ["source_note_id", "target_note_id"]
        }),
    }
}

/// Tool to create a section with multiple blocks
fn create_section_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_section".to_string(),
        description: "Create a complete section with heading and content blocks. Use for structured content creation.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID"
                },
                "heading": {
                    "type": "string",
                    "description": "Section heading"
                },
                "heading_level": {
                    "type": "integer",
                    "description": "Heading level (1-6)"
                },
                "content": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["text", "bullet_list", "numbered_list", "code", "quote"]
                            },
                            "content": {"type": "string"}
                        }
                    },
                    "description": "Content blocks for this section"
                }
            },
            "required": ["note_id", "heading", "content"]
        }),
    }
}

/// Tool to create a quiz/exercise
fn create_quiz_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_quiz".to_string(),
        description: "Create an interactive quiz or exercise. Use for testing understanding and practice.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID"
                },
                "title": {
                    "type": "string",
                    "description": "Quiz title"
                },
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {"type": "string"},
                            "type": {
                                "type": "string",
                                "enum": ["multiple_choice", "true_false", "short_answer", "fill_blank"]
                            },
                            "options": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                            "correct_answer": {"type": "string"},
                            "explanation": {"type": "string"}
                        },
                        "required": ["question", "type", "correct_answer"]
                    }
                }
            },
            "required": ["note_id", "title", "questions"]
        }),
    }
}

/// Tool to create flashcards
fn create_flashcard_tool() -> FunctionDefinition {
    FunctionDefinition {
        name: "create_flashcards".to_string(),
        description: "Create a set of flashcards for spaced repetition learning.".to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "note_id": {
                    "type": "string",
                    "description": "The note ID"
                },
                "deck_name": {
                    "type": "string",
                    "description": "Name for the flashcard deck"
                },
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "front": {"type": "string"},
                            "back": {"type": "string"},
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        },
                        "required": ["front", "back"]
                    }
                }
            },
            "required": ["note_id", "deck_name", "cards"]
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_note_tools() {
        let tools = get_note_tools();
        assert!(tools.len() >= 10);

        // Check that all tools have valid names and descriptions
        for tool in &tools {
            assert!(!tool.name.is_empty());
            assert!(!tool.description.is_empty());
        }
    }

    #[test]
    fn test_create_note_tool_schema() {
        let tool = create_note_tool();
        assert_eq!(tool.name, "create_note");

        let params = tool.parameters.as_object().unwrap();
        let properties = params.get("properties").unwrap().as_object().unwrap();

        assert!(properties.contains_key("title"));
        assert!(properties.contains_key("parent_id"));
    }
}
