#!/bin/bash

# Setup script for MyChat Desktop with llama.cpp

echo "Setting up MyChat Desktop..."

# Create directories
mkdir -p scripts
mkdir -p llama-binaries/darwin
mkdir -p llama-binaries/win32

# Create download script
cat > scripts/download-llama.js << 'SCRIPT'
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LLAMA_VERSION = 'b4693';
const GITHUB_RELEASES = {
  darwin_arm64: `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-arm64.zip`,
  darwin_x64: `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-x64.zip`,
  win32_x64: `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-win-x64.zip`
};

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let redirectCount = 0;
    
    const doDownload = (downloadUrl) => {
      redirectCount++;
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      https.get(downloadUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          doDownload(response.headers.location);
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && totalSize) {
            onProgress(downloaded, totalSize);
          }
        });
        
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(dest);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    
    doDownload(url);
  });
}

function extractZip(zipPath, targetDir) {
  const platform = process.platform;
  console.log('Extracting', zipPath, 'to', targetDir);
  
  if (platform === 'win32') {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${targetDir}"`, { stdio: 'inherit' });
  }
}

async function downloadForPlatform(platform, arch) {
  let url, targetDir;
  
  if (platform === 'darwin') {
    url = arch === 'arm64' ? GITHUB_RELEASES.darwin_arm64 : GITHUB_RELEASES.darwin_x64;
    targetDir = path.join(__dirname, '..', 'llama-binaries', 'darwin');
  } else if (platform === 'win32') {
    url = GITHUB_RELEASES.win32_x64;
    targetDir = path.join(__dirname, '..', 'llama-binaries', 'win32');
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const zipPath = path.join(targetDir, 'llama.zip');
  console.log(`\nDownloading llama.cpp for ${platform}-${arch}...`);
  console.log('URL:', url);
  
  await downloadFile(url, zipPath, (downloaded, total) => {
    const percent = ((downloaded / total) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
  });
  
  console.log('\nExtracting...');
  extractZip(zipPath, targetDir);
  
  // Cleanup zip
  fs.unlinkSync(zipPath);
  
  // Make executable
  if (platform === 'darwin') {
    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      if (file.startsWith('llama-') && !file.endsWith('.zip')) {
        execSync(`chmod +x "${path.join(targetDir, file)}"`);
      }
    }
  }
  
  console.log('Done!\n');
  return targetDir;
}

async function main() {
  const args = process.argv.slice(2);
  const targetPlatform = args[0] || process.platform;
  const targetArch = args[1] || process.arch;
  
  console.log('MyChat Desktop - llama.cpp Setup');
  console.log('================================');
  
  if (args[0] === 'all') {
    // Download for all platforms
    await downloadForPlatform('darwin', 'arm64');
    await downloadForPlatform('darwin', 'x64');
    await downloadForPlatform('win32', 'x64');
  } else {
    await downloadForPlatform(targetPlatform, targetArch);
  }
  
  console.log('llama.cpp binaries ready!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
SCRIPT

chmod +x scripts/download-llama.js

# Create llama-binaries README
cat > llama-binaries/README.md << 'EOF'
# llama.cpp Binaries

This directory contains llama.cpp server binaries for local LLM inference.

## Directory Structure

```
llama-binaries/
├── darwin/
│   ├── llama-server      # macOS ARM64 (Apple Silicon)
│   └── llama-server-x64  # macOS x64 (Intel)
└── win32/
    └── llama-server.exe  # Windows x64
```

## Download

```bash
# Download for current platform
node scripts/download-llama.js

# Download for all platforms
node scripts/download-llama.js all

# Download for specific platform
node scripts/download-llama.js darwin arm64
node scripts/download-llama.js darwin x64
node scripts/download-llama.js win32 x64
```

## Manual Download

Download from GitHub Releases:
https://github.com/ggerganov/llama.cpp/releases

## Build from Source

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j
```

The `llama-server` binary will be in `build/bin/`.
EOF

echo "Setup complete!"
echo ""
echo "================================"
echo "Next Steps:"
echo "================================"
echo ""
echo "1. Download llama.cpp binaries:"
echo "   node scripts/download-llama.js"
echo ""
echo "2. Install dependencies:"
echo "   npm install"
echo ""
echo "3. Run in development:"
echo "   npm run electron:dev"
echo ""
echo "4. Build desktop apps:"
echo "   npm run electron:build:mac    # macOS"
echo "   npm run electron:build:win    # Windows"
echo ""
echo "================================"
echo "Available Models:"
echo "================================"
echo "- GLM-4.7-Flash (10B, ~4GB Q4_K_XL)"
echo "- Qwen3.5-2B (2B, ~1.4GB Q4_K_XL)"
echo "- Qwen3.5-35B-A3B (35B MoE, ~18GB)"
echo "- AgentCPM-Explore (8B, ~8GB)"
echo ""
