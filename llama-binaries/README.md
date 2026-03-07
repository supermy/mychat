# llama.cpp Binaries

This directory should contain llama.cpp server binaries for local LLM inference.

## Download

### Option 1: Automatic Download (Recommended)

Run the download script:

```bash
node scripts/download-llama.js
```

### Option 2: Manual Download

Download from GitHub Releases:
- **macOS ARM64 (Apple Silicon)**: https://github.com/ggerganov/llama.cpp/releases
- **macOS x64 (Intel)**: https://github.com/ggerganov/llama.cpp/releases
- **Windows x64**: https://github.com/ggerganov/llama.cpp/releases

Extract the `llama-server` binary to this directory.

### Option 3: Build from Source

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j
```

Copy `build/bin/llama-server` to this directory.

## Directory Structure

```
llama-binaries/
├── darwin/
│   ├── llama-server        # macOS ARM64
│   └── llama-server-x64    # macOS Intel
└── win32/
    └── llama-server.exe    # Windows
```

## Verification

After downloading, verify the binary works:

```bash
# macOS
./llama-binaries/darwin/llama-server --version

# Windows
.\llama-binaries\win32\llama-server.exe --version
```
