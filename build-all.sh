#!/bin/bash

# Cross-platform build script for Weave
# Builds for Windows, macOS, and Linux

set -e

echo "🔨 Building Weave for all platforms..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean 2>/dev/null || true
rm -rf src-tauri/target/release/bundle

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build for current platform first
echo "🏗️ Building for current platform..."
npm run tauri:build

# Check if we have the required tools for cross-compilation
if command -v cargo &> /dev/null; then
    echo "🔧 Setting up cross-compilation targets..."
    
    # Add targets if not already present
    rustup target add x86_64-pc-windows-gnu 2>/dev/null || true
    rustup target add x86_64-unknown-linux-gnu 2>/dev/null || true
    rustup target add aarch64-apple-darwin 2>/dev/null || true
    rustup target add x86_64-apple-darwin 2>/dev/null || true
    
    # Build for different platforms
    echo "🪟 Building for Windows..."
    TAURI_PRIVATE_KEY="" TAURI_KEY_PASSWORD="" npm run tauri:build -- --target x86_64-pc-windows-gnu || echo "Windows build failed (may need Windows cross-compilation tools)"
    
    echo "🐧 Building for Linux..."
    TAURI_PRIVATE_KEY="" TAURI_KEY_PASSWORD="" npm run tauri:build -- --target x86_64-unknown-linux-gnu || echo "Linux build failed (may need Linux cross-compilation tools)"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🍎 Building for macOS (Apple Silicon)..."
        TAURI_PRIVATE_KEY="" TAURI_KEY_PASSWORD="" npm run tauri:build -- --target aarch64-apple-darwin || echo "Apple Silicon build failed"
        
        echo "🍎 Building for macOS (Intel)..."
        TAURI_PRIVATE_KEY="" TAURI_KEY_PASSWORD="" npm run tauri:build -- --target x86_64-apple-darwin || echo "Intel Mac build failed"
    fi
fi

echo "📦 Build artifacts:"
find src-tauri/target/release/bundle -name "*.dmg" -o -name "*.msi" -o -name "*.deb" -o -name "*.appimage" 2>/dev/null || echo "No bundles found"

echo "✅ Build process completed!"
