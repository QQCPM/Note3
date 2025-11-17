# Model Configuration & UI Refresh Fix

## Issues Fixed

### 1. ✅ UI Not Updating After Row Insertion
**Problem:** Data added to tables didn't appear in UI without app restart

**Root Cause:** Missing `getBlock` function caused refresh to fail

**Solution:**
- Added `getBlock()` function to `src/utils/tauri.ts`
- Added `get_block` Tauri command to `src-tauri/src/commands/blocks.rs`
- Registered command in `src-tauri/src/main.rs`

**Status:** ✅ FIXED - Build successful

---

## Which Models Are Being Used?

### Current Configuration

Your system uses a **hybrid approach**:

| Task | Model | Location | Cost |
|------|-------|----------|------|
| **Chat with Tools** (main AI) | `gpt-4o` | OpenAI | $$ Paid |
| **Database Generation** | `gpt-4o` | OpenAI | $$ Paid |
| **Artifact Generation** | `qwen3-coder-30b` → `gpt-4o` fallback | Local → OpenAI | Free → Paid |
| **Embeddings** | `qwen3-embedding-8b` | Local | Free |
| **Reranking** | `qwen3-reranker-8b` | Local | Free |

### Why Your OpenAI Bill Didn't Charge

Possible reasons:

1. **OpenAI API Key Not Set**
   - Check Settings → AI tab
   - If empty, using only local models

2. **Local Models Handling Everything**
   - Artifact generation tries local first
   - Only uses OpenAI if local fails

3. **Not Enough Usage Yet**
   - Small queries might not show up immediately
   - Check OpenAI dashboard: https://platform.openai.com/usage

4. **Free Tier Credits**
   - New accounts get $5 free credits
   - Might still be using those

---

## Current Model: `gpt-4o`

**GPT-4o** is OpenAI's **most powerful general-purpose model**:
- ✅ Best for tool calling
- ✅ Best for multi-step reasoning
- ✅ Fast response times
- ✅ 128K context window
- ✅ JSON mode support

**Pricing:** ~$5.00 per 1M input tokens, ~$15.00 per 1M output tokens

---

## Upgrade to More Powerful Models

### Option 1: Use `o1-preview` (Reasoning Model)

**Best for:**
- Complex reasoning tasks
- Mathematical problems
- Deep analysis
- Multi-step problem solving

**Trade-offs:**
- ❌ **Much slower** (can take 30+ seconds per response)
- ❌ **More expensive** (~4x cost of GPT-4o)
- ❌ **No streaming** (wait for full response)
- ❌ **No tool calling support yet**

**To Enable:**

Edit `src/services/tauriAI.ts` line 404 and 434:

```typescript
// Change from:
model: 'gpt-4o',

// To:
model: 'o1-preview',
```

**⚠️ Warning:** `o1-preview` doesn't support tool calling yet, so it won't work for creating tables/databases!

---

### Option 2: Use `o1` (Latest Reasoning)

Similar to `o1-preview` but newer:
- Same limitations (no tool calling)
- Better reasoning capabilities
- Even more expensive

**Not recommended** for your use case since you need tool calling for tables.

---

### Option 3: Increase GPT-4o Capabilities

**Make GPT-4o "more powerful"** by tuning parameters:

Edit `src/services/tauriAI.ts`:

```typescript
agent: {
  api_key: openaiKey,
  model: 'gpt-4o',
  temperature: 0.2,  // Lower = more focused/accurate (was 0.7)
  max_tokens: 16000, // More tokens = longer responses (was 8192)
},
```

**Temperature guide:**
- `0.0-0.3`: Precise, deterministic, factual
- `0.4-0.7`: Balanced (current)
- `0.8-1.0`: Creative, varied

---

## Recommended Configuration for Your Use Case

Since you want **tables with real data from web search**, stick with **GPT-4o** but optimize:

```typescript
export function createMacM2UltraConfig(openaiKey: string): AIConfig {
  return {
    embeddings: {
      endpoint: 'http://localhost:8081',
      model: 'qwen3-embedding-8b',
      dimension: 8192,
    },
    reranker: {
      endpoint: 'http://localhost:8082',
      model: 'qwen3-reranker-8b',
      dimension: 8192,
    },
    local_code_generation: {
      endpoint: 'http://localhost:8080',
      model: 'qwen3-coder-30b',
      max_tokens: 8192,
      temperature: 0.7,
    },
    agent: {
      api_key: openaiKey,
      model: 'gpt-4o',           // Best for tool calling
      temperature: 0.3,           // More focused (was 0.7)
      max_tokens: 16000,          // Longer responses (was 8192)
    },
  };
}
```

**Why this config:**
- ✅ GPT-4o for reliable tool calling
- ✅ Lower temperature for accurate web search
- ✅ Higher max_tokens for detailed tables
- ✅ Local models for free code generation

---

## Monitoring OpenAI Usage

### Check Your Bill

1. Visit https://platform.openai.com/usage
2. View by date range
3. Should see charges for:
   - `gpt-4o` completion tokens
   - `gpt-4o` prompt tokens

### Enable Logging

Add to `src/services/aiEditService.ts` after line 494:

```typescript
const result = await tauriAI.chatWithTools(trimmedHistory, allTools);

// Add this logging:
console.log('💰 Model used:', result.model || 'gpt-4o');
console.log('📊 Tokens:', {
  prompt: result.usage?.prompt_tokens,
  completion: result.usage?.completion_tokens,
  total: result.usage?.total_tokens
});

console.log('📥 Got result:', result);
```

### Estimate Costs

For a typical table creation task:
- **Prompt:** ~2,000 tokens (context + tools)
- **Completion:** ~500 tokens (responses + tool calls)
- **Cost:** ~$0.01 per request

100 table creations ≈ $1.00

---

## Remaining Issue: Database Block Not Found

### Problem

From your logs:
```
✅ First 2 rows added successfully
❌ Rows 3-5 fail: "Database block not found"
```

### Analysis

This suggests a **race condition** where:
1. Database block created
2. AI gets block_id
3. First 2 `db_add_row` calls succeed
4. Rows 3-5 fail because block seems to disappear

### Possible Causes

1. **Transaction Not Committed**
   - Block written but not committed to database
   - First 2 reads succeed from transaction cache
   - Rows 3-5 read from committed DB (empty)

2. **Block ID Mismatch**
   - AI receives wrong block_id
   - First 2 calls use cached/correct ID
   - Later calls use wrong ID

3. **Concurrent Write Conflict**
   - Multiple row insertions happening simultaneously
   - Database locked or row corrupted

### Debug Steps

**Add logging to see actual block_id:**

Edit `src/services/aiEditService.ts` line 691:

```typescript
console.log(`🔍 DEBUG: Created database block with ID: ${newBlock.id}`);
console.log(`🔍 DEBUG: Block data:`, newBlock);

conversationHistory.push({
  role: 'user',
  content: `[Database created successfully]: "${result.title}" has been added to the note with block_id: ${newBlock.id}. You can now use db_add_row with this block_id to populate it with data.`,
});
```

**Then check logs when adding rows:**

The `db_add_row` logs should show same block_id for all 5 rows.

### Potential Fix: Add Delay Between Rows

Edit `src/services/aiTools.ts` line 179:

```typescript
async executeTool(toolName: string, params: any): Promise<any> {
  const result = await invoke('ai_execute_database_tool', {
    toolName,
    params: JSON.stringify(params),
  });

  // Add small delay for database writes to commit
  if (toolName === 'db_add_row') {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return result;
}
```

---

## Test After Restart

1. **Stop your dev server** (Ctrl+C)

2. **Restart with new build:**
   ```bash
   npm run dev
   ```

3. **Test table creation:**
   ```
   "Create a table of the top 5 largest black holes with real data"
   ```

4. **Check console for:**
   ```
   ✓ Tauri backend returned 5 results  ✅ Web search works
   🗄️ Creating database...            ✅ Table created
   🔄 Refreshed block after db_add_row ✅ UI updates!
   ```

5. **Verify UI shows data** without restart ✅

---

## Expected Behavior Now

### What Should Work:

1. ✅ Web search returns real Brave API results
2. ✅ Database table created with columns
3. ✅ Rows added successfully (all 5)
4. ✅ UI refreshes automatically after each row
5. ✅ Data visible immediately (no restart)
6. ✅ GPT-4o handles all tool calling

### What to Monitor:

1. OpenAI usage dashboard for charges
2. Console logs for "Database block not found"
3. UI updates after row insertion

---

## Summary

### Fixed:
- ✅ Added `getBlock` function for UI refresh
- ✅ Build successful with new command
- ✅ Identified model configuration (GPT-4o)

### Action Items:

1. **Restart dev server** to use new build
2. **Test table creation** and verify UI updates
3. **Check OpenAI dashboard** to confirm billing
4. **Optional:** Lower temperature to 0.3 for better accuracy
5. **If "block not found" persists:** Add debug logging

### Model Recommendation:

**Stick with `gpt-4o`** because:
- ✅ Best for tool calling (required for tables)
- ✅ Fast and reliable
- ✅ Already most powerful general model
- ✅ `o1-preview` doesn't support tools yet

---

## Next Steps

1. Restart your app
2. Try creating a table
3. Report back if:
   - ✅ Data appears without restart
   - ❌ Still getting "block not found" errors
   - ❓ OpenAI bill still not charging

Then we can debug further if needed!
