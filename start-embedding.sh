#!/bin/bash
# =============================================================================
# Note3 Search Models (Embedding + Reranker)
# Starts both Qwen3 models for semantic search. GLM-4.6 handles code gen.
# =============================================================================

echo "🔍 Note3 Search Models"
echo "======================"
echo ""

EMBEDDING_MODEL="$HOME/AI/models/qwen3-embedding-8b/Qwen3-Embedding-8B-Q8_0.gguf"
RERANKER_MODEL="$(dirname "$0")/models/Qwen3-Reranker-8B.Q8_0.gguf"
EMBEDDING_PORT=8081
RERANKER_PORT=8082

# Check for llama-cpp-python
if ! python3 -c "import llama_cpp" 2>/dev/null; then
    echo "❌ llama-cpp-python not installed."
    echo "   Install with: pip3 install llama-cpp-python"
    exit 1
fi

# Function to start a server
start_server() {
    local name=$1
    local model=$2
    local port=$3
    
    if lsof -i :$port >/dev/null 2>&1; then
        echo "✅ $name already running on port $port"
        return
    fi
    
    if [ ! -f "$model" ]; then
        echo "⚠️  $name model not found at: $model"
        return
    fi
    
    echo "🚀 Starting $name on port $port..."
    python3 -m llama_cpp.server \
        --model "$model" \
        --port $port \
        --n_gpu_layers -1 \
        --host 0.0.0.0 \
        --embedding true \
        --n_ctx 8192 \
        > /tmp/note3-$name.log 2>&1 &
    echo "   PID: $! | Log: /tmp/note3-$name.log"
}

# Kill function
kill_servers() {
    echo ""
    echo "🛑 Shutting down..."
    pkill -f "llama_cpp.server.*$EMBEDDING_PORT" 2>/dev/null
    pkill -f "llama_cpp.server.*$RERANKER_PORT" 2>/dev/null
    echo "✅ Stopped"
    exit 0
}

trap kill_servers INT TERM

echo "Starting 2 Qwen3 models (~16GB RAM)..."
echo ""

start_server "Embedding" "$EMBEDDING_MODEL" $EMBEDDING_PORT
start_server "Reranker" "$RERANKER_MODEL" $RERANKER_PORT

sleep 2

echo ""
echo "======================"
echo "✅ Search Models Ready!"
echo "======================"
echo ""
echo "Local Services:"
echo "  • Embedding:  http://localhost:$EMBEDDING_PORT"
echo "  • Reranker:   http://localhost:$RERANKER_PORT"
echo ""
echo "Cloud Services:"
echo "  • Code Gen:   GLM-4.6 (Ollama Cloud)"
echo "  • Agent:      GPT-5.2 (OpenAI)"
echo ""
echo "Now run: npm run tauri:dev"
echo ""
echo "Press Ctrl+C to stop"

wait
