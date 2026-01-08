/**
 * LangGraph Secretary Tools
 * 
 * Simplified architecture: 6 core tools leveraging AI's intelligence for file editing.
 * 
 * CORE TOOLS:
 * - create_roadmap: AI generates learning plans
 * - save_roadmap: Complex save logic (Plan.md + archive)
 * - read_memory_file: Read any .md file
 * - write_memory_file: Write any .md file
 * - list_memory_files: List files in directory
 * - delete_memory_file: Delete files
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================================================
// ROADMAP TOOLS (Need AI generation + complex logic)
// ============================================================================

const createRoadmapSchema = z.object({
    topic: z.string().describe("The main topic to learn (e.g., 'Deep Learning', 'Web Development')"),
    duration_days: z.number().describe("Total number of days for the roadmap"),
    study_days: z.array(z.string()).optional().describe("Days of the week to study (e.g., ['Mon', 'Tue', 'Wed'])"),
    daily_hours: z.number().optional().describe("Hours per study day"),
    specific_topics: z.string().optional().describe("Optional specific subtopics or resources to include"),
});

const saveRoadmapSchema = z.object({
    roadmap_name: z.string().describe("Name of the roadmap to save"),
    start_date: z.string().optional().describe("When to start (YYYY-MM-DD format)"),
    end_date: z.string().optional().describe("When the plan ends (YYYY-MM-DD). Calculate this based on sessions and study days per week."),
});

export const createRoadmapTool = tool(
    async (input) => {
        const { executeCreateRoadmap } = await import("../secretaryService");
        const result = await executeCreateRoadmap(input);
        return JSON.stringify(result);
    },
    {
        name: "create_roadmap",
        description: "Create a new learning roadmap with AI-generated content. Returns the full roadmap for user review before saving.",
        schema: createRoadmapSchema,
    }
);

export const saveRoadmapTool = tool(
    async (input) => {
        const { executeSaveRoadmap } = await import("../secretaryService");
        const result = await executeSaveRoadmap(input);
        return JSON.stringify(result);
    },
    {
        name: "save_roadmap",
        description: "Save the pending roadmap to Plan.md and archive the full content. Call after user approves a created roadmap.",
        schema: saveRoadmapSchema,
    }
);

// ============================================================================
// GENERIC MEMORY FILE TOOLS (AI uses these like a text editor)
// ============================================================================

const readMemoryFileSchema = z.object({
    path: z.string().describe("File path relative to Memory folder (e.g., 'Plan.md', 'AI.md', 'Plans/optics-roadmap.md')"),
});

const writeMemoryFileSchema = z.object({
    path: z.string().describe("File path relative to Memory folder"),
    content: z.string().describe("Full file content to write"),
});

const listMemoryFilesSchema = z.object({
    directory: z.string().optional().describe("Directory to list (e.g., 'Plans'). If omitted, lists root Memory folder."),
});

const deleteMemoryFileSchema = z.object({
    path: z.string().describe("File path relative to Memory folder to delete"),
});

export const readMemoryFileTool = tool(
    async (input) => {
        const { executeReadMemoryFile } = await import("../secretaryService");
        const result = await executeReadMemoryFile(input);
        return JSON.stringify(result);
    },
    {
        name: "read_memory_file",
        description: "Read the contents of any memory file. Use to inspect Plan.md, AI.md, Daily.md, or files in Plans/ folder before editing.",
        schema: readMemoryFileSchema,
    }
);

export const writeMemoryFileTool = tool(
    async (input) => {
        const { executeWriteMemoryFile } = await import("../secretaryService");
        const result = await executeWriteMemoryFile(input);
        return JSON.stringify(result);
    },
    {
        name: "write_memory_file",
        description: "Write content to a memory file. Use after reading and modifying content. Can create new files or overwrite existing.",
        schema: writeMemoryFileSchema,
    }
);

export const listMemoryFilesTool = tool(
    async (input) => {
        const { executeListMemoryFiles } = await import("../secretaryService");
        const result = await executeListMemoryFiles(input);
        return JSON.stringify(result);
    },
    {
        name: "list_memory_files",
        description: "List files in the Memory folder or a subdirectory. Use to discover available files before reading.",
        schema: listMemoryFilesSchema,
    }
);

export const deleteMemoryFileTool = tool(
    async (input) => {
        const { executeDeleteMemoryFile } = await import("../secretaryService");
        const result = await executeDeleteMemoryFile(input);
        return JSON.stringify(result);
    },
    {
        name: "delete_memory_file",
        description: "Delete a file from the Memory folder. Use list_memory_files first to verify the file exists.",
        schema: deleteMemoryFileSchema,
    }
);

const renameMemoryFileSchema = z.object({
    old_path: z.string().describe("Current file path relative to Memory folder (e.g., 'Plans/old-name.md')"),
    new_path: z.string().describe("New file path relative to Memory folder (e.g., 'Plans/new-name.md')"),
});

export const renameMemoryFileTool = tool(
    async (input) => {
        const { executeRenameMemoryFile } = await import("../secretaryService");
        const result = await executeRenameMemoryFile(input);
        return JSON.stringify(result);
    },
    {
        name: "rename_memory_file",
        description: "Rename or move a file within the Memory folder. Use to rename plan files in Plans/ folder.",
        schema: renameMemoryFileSchema,
    }
);

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All secretary tools for binding to the LLM model
 * 
 * Simplified to 7 core tools:
 * - 2 for roadmap creation (AI generation)
 * - 5 for generic file operations (AI-driven editing)
 */
export const secretaryTools = [
    // Roadmap creation
    createRoadmapTool,
    saveRoadmapTool,
    // Generic file operations
    readMemoryFileTool,
    writeMemoryFileTool,
    listMemoryFilesTool,
    deleteMemoryFileTool,
    renameMemoryFileTool,
];

/**
 * Tool name to tool instance mapping for easy lookup
 */
export const secretaryToolsByName = {
    create_roadmap: createRoadmapTool,
    save_roadmap: saveRoadmapTool,
    read_memory_file: readMemoryFileTool,
    write_memory_file: writeMemoryFileTool,
    list_memory_files: listMemoryFilesTool,
    delete_memory_file: deleteMemoryFileTool,
    rename_memory_file: renameMemoryFileTool,
} as const;

export type SecretaryToolName = keyof typeof secretaryToolsByName;
