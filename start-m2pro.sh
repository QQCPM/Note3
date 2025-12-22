#!/bin/bash
# =============================================================================
# Note3 AI - Mac M2 Pro Setup
# Uses: GPT-5.2 + text-embedding-3-large + Qwen3-Reranker-4B
# =============================================================================

echo "🍎 Note3 AI - Mac M2 Pro Setup"
echo "================================"
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

# Pull reranker model if not present
echo "📦 Checking reranker model..."

if ! ollama list | grep -q "dengcao/Qwen3-Reranker-4B"; then
    echo "   Pulling dengcao/Qwen3-Reranker-4B (~2GB)..."
    ollama pull dengcao/Qwen3-Reranker-4B
else
    echo "   ✅ dengcao/Qwen3-Reranker-4B already installed"
fi

echo ""
echo "================================"
echo "✅ AI System Ready (M2 Pro Mode)!"
echo "================================"
echo ""
echo "Model Configuration:"
echo "  • Agent:      GPT-5.2 (OpenAI API)"
echo "  • Code Gen:   GPT-5.2 (OpenAI API)"
echo "  • Embeddings: text-embedding-3-large (OpenAI API)"
echo "  • Reranker:   dengcao/Qwen3-Reranker-4B (~2GB RAM)"
echo ""
echo "Local Memory Usage: ~2GB (leaves 14GB for system + app)"
echo ""
echo "Now run: npm run tauri:dev"
echo ""
echo "To stop Ollama: pkill ollama"
