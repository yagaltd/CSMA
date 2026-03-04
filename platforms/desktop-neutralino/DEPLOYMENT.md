# CSMA Desktop Deployment Instructions

## Development
```bash
cd platforms/desktop-neutralino

# Run in development mode
neu run

# Build for current platform
neu build
```

## Distribution
```bash
# Build for all platforms (Linux, Mac, Windows)
neu build --release

# The built binaries will be in dist/ directory
```

## Platform-Specific Builds
```bash
# Linux
neu build --release --target linux

# macOS
neu build --release --target mac

# Windows
neu build --release --target win
```

## Customizing the App
- Edit `neutralino.config.json` for window settings
- Modify `resources/` for web app files
- Add native functionality using Neutralino APIs

## File Structure
```
platforms/desktop-neutralino/
├── neutralino.config.json    # App configuration
├── resources/               # Web app files (from dist/)
├── dist/                    # Built binaries (after build)
└── DEPLOYMENT.md           # This file
```
