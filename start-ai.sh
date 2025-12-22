#!/bin/bash
# =============================================================================
# Note3 AI System Launcher
# - Agent: GPT-5.2 (OpenAI)
# - Code Gen: MiniMax-M2 (Ollama cloud) - requires Ollama API key
# - Embeddings: text-embedding-3-large (OpenAI)
# - Reranker: Qwen3-Reranker-4B (Ollama local)
# =============================================================================

echo "🤖 Note3 AI System Launcher"
echo "==========================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama not installed."
    echo "   Install with: brew install ollama"
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "🚀 Starting Ollama service..."
    ollama serve > /tmp/ollama.log 2>&1 &
    sleep 3
fi

echo "✅ Ollama is running"
echo ""

# Check reranker model (only pull if missing)
if ! ollama list | grep -q "dengcao/Qwen3-Reranker-4B"; then
    echo "📦 Pulling reranker model..."
    ollama pull dengcao/Qwen3-Reranker-4B
else
    echo "✅ Reranker model ready"
fi

echo ""
echo "==========================================="
echo "✅ AI System Ready!"
echo "==========================================="
echo ""
echo "Model Configuration:"
echo "  • Agent:      GPT-5.2 (OpenAI API)"
echo "  • Code Gen:   MiniMax-M2 (Ollama cloud)"
echo "  • Embeddings: text-embedding-3-large (OpenAI API)"
echo "  • Reranker:   Qwen3-Reranker-4B (Ollama local)"
echo ""
echo "Required API Keys:"
echo "  1. OpenAI API Key - for agent + embeddings"
echo "  2. Ollama API Key - for minimax-m2:cloud code gen"
echo "     (Get from: ollama.com → Account → API Keys)"
echo ""
echo "Now run: npm run tauri:dev"
