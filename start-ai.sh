#!/bin/bash

# =============================================================================
# Note3 AI Models Launcher
# Starts all 3 local AI models in parallel for Note3 app
# =============================================================================

echo "🤖 Note3 AI System Launcher"
echo "==========================================="
echo ""

# Model paths (adjust if your models are elsewhere)
EMBEDDING_MODEL="$HOME/AI/models/qwen3-embedding-8b/Qwen3-Embedding-8B-Q8_0.gguf"
RERANKER_MODEL="$HOME/AI/models/qwen3-reranker-8b/Qwen3-Reranker-8B.Q8_0.gguf"
CODER_MODEL="$(pwd)/Qwen3-Coder-30B-A3B-Instruct-UD-Q8_K_XL.gguf"

# Ports
CODER_PORT=8080
EMBEDDING_PORT=8081
RERANKER_PORT=8082

# Check for llama-cpp-python
if ! python3 -c "import llama_cpp" 2>/dev/null; then
    echo "❌ llama-cpp-python not installed."
    echo "   Install with: pip3 install llama-cpp-python"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to start a model server
start_server() {
    local name=$1
    local model=$2
    local port=$3
    local extra_args=$4
    
    if check_port $port; then
        echo "⚠️  Port $port already in use - $name may already be running"
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
        $extra_args \
        > /tmp/note3-$name.log 2>&1 &
    
    echo "   PID: $! | Log: /tmp/note3-$name.log"
}

# Kill function
kill_servers() {
    echo ""
    echo "🛑 Shutting down AI servers..."
    pkill -f "llama_cpp.server.*$CODER_PORT" 2>/dev/null
    pkill -f "llama_cpp.server.*$EMBEDDING_PORT" 2>/dev/null
    pkill -f "llama_cpp.server.*$RERANKER_PORT" 2>/dev/null
    echo "✅ All servers stopped"
    exit 0
}

# Trap Ctrl+C
trap kill_servers INT TERM

echo "Starting 3 AI models (this uses ~46GB RAM)..."
echo ""

# Start all three servers
start_server "Coder" "$CODER_MODEL" $CODER_PORT "--n_ctx 32768"
start_server "Embedding" "$EMBEDDING_MODEL" $EMBEDDING_PORT "--embedding true --n_ctx 8192"
start_server "Reranker" "$RERANKER_MODEL" $RERANKER_PORT "--embedding true --n_ctx 8192"

echo ""
echo "==========================================="
echo "✅ AI System Ready!"
echo "==========================================="
echo ""
echo "Services:"
echo "  • Coder:     http://localhost:$CODER_PORT"
echo "  • Embedding: http://localhost:$EMBEDDING_PORT"
echo "  • Reranker:  http://localhost:$RERANKER_PORT"
echo ""
echo "Now run: npm run tauri:dev"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for all background jobs
wait
