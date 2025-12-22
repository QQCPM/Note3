#!/bin/bash
# Auto-setup API keys from .env file

echo "🔑 Setting up API keys..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Create it with:"
    echo "   OPENAI_API_KEY=your_key"
    echo "   OLLAMA_API_KEY=your_key"
    exit 1
fi

# Load .env
source .env

# Check if keys are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not set in .env"
    echo "   Add your OpenAI API key to .env file"
fi

if [ -z "$OLLAMA_API_KEY" ]; then
    echo "⚠️  OLLAMA_API_KEY not set in .env"
else
    echo "✅ Ollama API Key loaded: ${OLLAMA_API_KEY:0:20}..."
fi

echo ""
echo "Keys will be loaded when you open Settings in the app"
echo "Or they will be auto-loaded on first run"


