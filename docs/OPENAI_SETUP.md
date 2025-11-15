# OpenAI API Key Setup & GPT-5 Support

## 📍 Where to Put Your OpenAI API Key

### Option 1: Environment File (Recommended)

I've already created a `.env` file for you at the project root:

**Location**: `/Users/lending/Documents/AI PRJ/Note3/.env`

**Steps**:
1. Open the `.env` file
2. Replace `your-api-key-here` with your actual OpenAI API key:
   ```bash
   VITE_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. Save the file
4. Restart the app (`npm run dev`)

**Get your API key**: https://platform.openai.com/api-keys

---

## 🤖 GPT-5 / Latest Model Support

### Current Model Configuration

By default, your app uses **GPT-4o** (the latest GPT-4 Optimized model). Here's how to change it:

### Method 1: Quick Change in Code

Edit `src/services/tauriAI.ts` around line 309:

**For GPT-4o (current default)**:
```typescript
agent: {
  api_key: openaiKey,
  model: 'gpt-4o',          // ← Current
  temperature: 0.7,
  max_tokens: 4096,
}
```

**For GPT-4o Mini (faster, cheaper)**:
```typescript
agent: {
  api_key: openaiKey,
  model: 'gpt-4o-mini',     // ← Faster & cheaper
  temperature: 0.7,
  max_tokens: 4096,
}
```

**For O1 Preview (reasoning model)**:
```typescript
agent: {
  api_key: openaiKey,
  model: 'o1-preview',      // ← Better reasoning
  temperature: 1.0,          // O1 uses temperature 1.0
  max_tokens: 32768,         // O1 supports longer outputs
}
```

**For O1 Mini (reasoning, faster)**:
```typescript
agent: {
  api_key: openaiKey,
  model: 'o1-mini',         // ← Fast reasoning
  temperature: 1.0,
  max_tokens: 16384,
}
```

**When GPT-5 / O3 is available**:
```typescript
agent: {
  api_key: openaiKey,
  model: 'gpt-5',           // ← Or whatever OpenAI calls it
  temperature: 0.7,
  max_tokens: 4096,
}
```

---

### Method 2: Dynamic Model Selection (Advanced)

Add model selection to your `.env` file:

**1. Update `.env`**:
```bash
VITE_OPENAI_API_KEY=sk-proj-xxxxx
VITE_OPENAI_MODEL=gpt-4o              # Change this to switch models
VITE_OPENAI_TEMPERATURE=0.7
VITE_OPENAI_MAX_TOKENS=4096
```

**2. Update `src/vite-env.d.ts`**:
```typescript
interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_OPENAI_MODEL: string
  readonly VITE_OPENAI_TEMPERATURE: string
  readonly VITE_OPENAI_MAX_TOKENS: string
}
```

**3. Update `src/services/tauriAI.ts`** (line 307-312):
```typescript
agent: {
  api_key: openaiKey,
  model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o',
  temperature: parseFloat(import.meta.env.VITE_OPENAI_TEMPERATURE || '0.7'),
  max_tokens: parseInt(import.meta.env.VITE_OPENAI_MAX_TOKENS || '4096'),
}
```

Now you can switch models just by editing `.env` without touching code!

---

## 📊 Model Comparison

| Model | Speed | Cost | Quality | Use Case |
|-------|-------|------|---------|----------|
| **gpt-4o** | Fast | Medium | Excellent | General chat, agents |
| **gpt-4o-mini** | Very Fast | Low | Good | Simple tasks, testing |
| **o1-preview** | Slow | High | Best | Complex reasoning |
| **o1-mini** | Medium | Medium | Very Good | Fast reasoning |
| **gpt-5** (future) | TBD | TBD | TBD | Next generation |
| **o3-mini** (future) | TBD | TBD | TBD | Advanced reasoning |

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep your `.env` file local (already in `.gitignore`)
- Use environment variables for API keys
- Rotate keys periodically
- Set usage limits in OpenAI dashboard

### ❌ DON'T:
- Commit `.env` to Git (already protected)
- Share your API key publicly
- Hard-code keys in source files
- Use production keys for testing

---

## 💰 Cost Management

### Monitor Usage:
- OpenAI Dashboard: https://platform.openai.com/usage
- Set monthly spending limits
- Enable email alerts for high usage

### Reduce Costs:
1. Use local models for embeddings (already doing this ✅)
2. Use `gpt-4o-mini` for simple tasks
3. Set lower `max_tokens` values
4. Use local Qwen3-Coder for artifacts (already doing this ✅)

### Estimated Monthly Costs:

**With your hybrid setup**:
- Embeddings: **$0** (local Qwen3-8B)
- Code generation: **$0** (local Qwen3-30B with API fallback)
- Reranking: **$0** (local Qwen3-8B)
- Chat/Agent: **~$5-20/month** (GPT-4o only)

**Total**: **~$5-20/month** (vs ~$50-100/month for all-API setup)

---

## 🧪 Testing Your Setup

### Test 1: Verify API Key
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $VITE_OPENAI_API_KEY"
```

### Test 2: Check Available Models
Open DevTools Console (F12) and run:
```javascript
const response = await fetch('https://api.openai.com/v1/models', {
  headers: {
    'Authorization': 'Bearer ' + import.meta.env.VITE_OPENAI_API_KEY
  }
});
const data = await response.json();
console.log('Available models:', data.data.map(m => m.id));
```

### Test 3: Chat Test
In your app, try chatting with AI. Check DevTools Console for:
- ✅ `AI system initialized successfully`
- ✅ `AI Ready` status indicator
- ❌ Any error messages

---

## 🔧 Troubleshooting

### Error: "Incorrect API key"
- Double-check your API key in `.env`
- Make sure there are no extra spaces
- Verify key is active at https://platform.openai.com/api-keys

### Error: "Model not found"
- Check if model name is correct (case-sensitive)
- Some models require special access (o1-preview, etc.)
- Try `gpt-4o` or `gpt-4o-mini` first

### Error: "Rate limit exceeded"
- You've hit your usage limit
- Wait a few minutes or upgrade your OpenAI plan
- Check usage at https://platform.openai.com/usage

### Error: "Insufficient quota"
- Add payment method to your OpenAI account
- Or wait until next billing cycle
- Free tier is very limited ($5/3 months)

---

## 📝 Quick Start Checklist

- [ ] Get OpenAI API key from https://platform.openai.com/api-keys
- [ ] Copy key to `.env` file
- [ ] Choose your model (gpt-4o, o1-preview, etc.)
- [ ] Restart app: `npm run dev`
- [ ] Check for green "AI Ready" indicator
- [ ] Test chat functionality
- [ ] Monitor costs at https://platform.openai.com/usage

---

## 🚀 When GPT-5 Launches

OpenAI typically follows this pattern:

1. **Announcement** → Wait 1-2 weeks for API access
2. **Early access** → Model appears in API as `gpt-5` or similar
3. **General availability** → Update your config

**To prepare**:
1. Set up environment variable method (Method 2 above)
2. When GPT-5 launches, just update `.env`:
   ```bash
   VITE_OPENAI_MODEL=gpt-5
   ```
3. Restart app → Done! ✅

No code changes needed if you use environment variables!

---

## 📚 Additional Resources

- OpenAI API Docs: https://platform.openai.com/docs
- Model Pricing: https://openai.com/api/pricing/
- Rate Limits: https://platform.openai.com/docs/guides/rate-limits
- Model Comparison: https://openai.com/api/models/
