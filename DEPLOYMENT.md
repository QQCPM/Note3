# Deployment Guide

This guide shows you how to build and deploy Weave on different machines and platforms.

## Quick Deployment Options

### Option 1: Build Locally (Recommended)

Build the app on your current machine for distribution:

```bash
# Clone the repository
git clone https://github.com/QQCPM/Note3.git
cd Note3

# Install dependencies
npm install

# Build for all platforms
npm run tauri:build:all

# Or build for specific platform:
npm run tauri:build:macos      # macOS Intel
npm run tauri:build:macos-arm  # macOS Apple Silicon
npm run tauri:build:win        # Windows
npm run tauri:build:linux      # Linux
```

**Build Output Location:**
- macOS: `src-tauri/target/release/bundle/dmg/*.dmg`
- Windows: `src-tauri/target/release/bundle/msi/*.msi`
- Linux: `src-tauri/target/release/bundle/deb/*.deb`

### Option 2: GitHub Releases (Easiest)

Download pre-built releases from GitHub:

1. Go to [GitHub Releases](https://github.com/QQCPM/Note3/releases)
2. Download the appropriate installer for your platform
3. Install and run

### Option 3: Development Setup

Run from source code for development:

```bash
git clone https://github.com/QQCPM/Note3.git
cd Note3
npm install
npm run tauri:dev
```

## Platform-Specific Instructions

### macOS

1. **Download .dmg file** from releases or build locally
2. **Install**: Open the .dmg and drag Weave to Applications
3. **First Run**: Right-click → Open to bypass Gatekeeper
4. **Permissions**: Grant necessary permissions in System Preferences

### Windows

1. **Download .msi file** from releases or build locally
2. **Install**: Double-click the .msi installer
3. **Permissions**: Windows Defender may flag it - click "More info" → "Run anyway"

### Linux

1. **Download .deb file** (Ubuntu/Debian) or .AppImage (universal)
2. **Install .deb**: `sudo dpkg -i weave_*.deb`
3. **Install .AppImage**: `chmod +x weave_*.AppImage && ./weave_*.AppImage`

## Database Setup

The app automatically creates a SQLite database on first run. No manual setup required.

**Database Location:**
- macOS: `~/Library/Application Support/weave/database.db`
- Windows: `%APPDATA%\weave\database.db`
- Linux: `~/.local/share/weave/database.db`

## AI Model Setup (Optional)

Weave works without AI models, but you can add them for enhanced features:

### Local Models (Free, Private)

```bash
# Install Python tools
pip install huggingface-hub llama-cpp-python

# Download models (optional - app will download on demand)
huggingface-cli download Qwen/Qwen3-Coder-30B-Instruct-GGUF \
  qwen3-coder-30b-q4_k_m.gguf --local-dir ./models

# Start model server
python -m llama_cpp.server --model ./models/qwen3-coder-30b-q4_k_m.gguf --port 8080
```

### API Models (Easier, Paid)

Get API keys and configure in app settings:
- OpenAI: https://platform.openai.com/api-keys
- Brave Search: https://brave.com/search/api/

## Portable Version

For USB drives or portable use:

1. Download the appropriate installer
2. Extract to USB drive
3. Run the executable directly
4. Database will be stored in the app directory

## Docker Deployment (Advanced)

```bash
# Build Docker image
docker build -t weave .

# Run with database persistence
docker run -d \
  --name weave \
  -v weave-data:/app/data \
  -p 3000:3000 \
  weave
```

## Troubleshooting

### Common Issues

1. **"App won't open" (macOS)**
   - Right-click → Open to bypass Gatekeeper
   - Check System Preferences → Security & Privacy

2. **"Missing dependencies" (Linux)**
   - Install: `sudo apt install libwebkit2gtk-4.0-dev`
   - For other distros, check Tauri prerequisites

3. **"Build fails"**
   - Ensure Rust 1.75+ and Node.js 20+ are installed
   - Run `rustup target add` for cross-compilation targets

4. **"AI features not working"**
   - Check network connection for API models
   - Verify model server is running for local models

### Logs and Debugging

**Development Logs:**
```bash
npm run tauri:dev
```

**Production Logs:**
- macOS: `~/Library/Logs/weave.log`
- Windows: `%APPDATA%\weave\logs\weave.log`
- Linux: `~/.local/share/weave/logs/weave.log`

## Performance Optimization

1. **SSD Storage**: Use SSD for better database performance
2. **Memory**: 8GB+ RAM recommended for AI features
3. **GPU**: Not required, but helps with rendering

## Security Considerations

- All data is stored locally by default
- API keys are encrypted in storage
- No telemetry or data collection
- Open source - audit the code yourself

## Updates

### Auto-Update (Coming Soon)

The app will automatically check for updates and prompt to install.

### Manual Updates

1. Download new version from GitHub Releases
2. Install over existing version
3. Database will be automatically migrated

## Support

- **Documentation**: [./docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/QQCPM/Note3/issues)
- **Discussions**: [GitHub Discussions](https://github.com/QQCPM/Note3/discussions)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.
