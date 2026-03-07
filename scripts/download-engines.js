#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LLAMA_VERSION = 'b4693';
const ZEROCLAW_VERSION = '0.1.0';

const DOWNLOAD_URLS = {
  llama: {
    darwin_arm64: [
      `https://mirror.ghproxy.com/https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-arm64.zip`,
      `https://ghproxy.com/https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-arm64.zip`,
      `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-arm64.zip`
    ],
    darwin_x64: [
      `https://mirror.ghproxy.com/https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-x64.zip`,
      `https://ghproxy.com/https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-x64.zip`,
      `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-macos-x64.zip`
    ],
    win32_x64: [
      `https://mirror.ghproxy.com/https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-win-x64.zip`,
      `https://ghproxy.com/https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-win-x64.zip`,
      `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-binaries-win-x64.zip`
    ]
  },
  zeroclaw: {
    darwin_arm64: [
      `https://mirror.ghproxy.com/https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-${ZEROCLAW_VERSION}-macos-arm64.tar.gz`,
      `https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-${ZEROCLAW_VERSION}-macos-arm64.tar.gz`
    ],
    darwin_x64: [
      `https://mirror.ghproxy.com/https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-${ZEROCLAW_VERSION}-macos-x64.tar.gz`,
      `https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-${ZEROCLAW_VERSION}-macos-x64.tar.gz`
    ],
    win32_x64: [
      `https://mirror.ghproxy.com/https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-${ZEROCLAW_VERSION}-windows-x64.zip`,
      `https://github.com/zeroclaw-labs/zeroclaw/releases/download/v${ZEROCLAW_VERSION}/zeroclaw-${ZEROCLAW_VERSION}-windows-x64.zip`
    ]
  }
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('  Downloading:', url.substring(0, 80) + '...');
    
    const file = fs.createWriteStream(dest);
    let redirectCount = 0;
    
    const doDownload = (downloadUrl) => {
      redirectCount++;
      if (redirectCount > 15) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      const protocol = downloadUrl.startsWith('https') ? https : http;
      
      const request = protocol.get(downloadUrl, {
        timeout: 600000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const location = response.headers.location;
          console.log('  Redirect ->', location.substring(0, 60) + '...');
          doDownload(location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;
        let lastPercent = 0;
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize) {
            const percent = Math.floor(downloaded / totalSize * 100);
            if (percent !== lastPercent && percent % 10 === 0) {
              lastPercent = percent;
              const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
              const totalMB = (totalSize / 1024 / 1024).toFixed(1);
              console.log(`  Progress: ${percent}% (${downloadedMB}/${totalMB} MB)`);
            }
          }
        });
        
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(dest);
        });
      });
      
      request.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
      
      request.on('timeout', () => {
        request.destroy();
        fs.unlink(dest, () => {});
        reject(new Error('Timeout'));
      });
    };
    
    doDownload(url);
  });
}

function extractFile(filePath, targetDir, engine) {
  console.log('  Extracting to:', targetDir);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  if (filePath.endsWith('.zip')) {
    if (process.platform === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${filePath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'inherit' });
    } else {
      execSync(`unzip -o "${filePath}" -d "${targetDir}"`, { stdio: 'inherit' });
    }
  } else if (filePath.endsWith('.tar.gz')) {
    execSync(`tar -xzf "${filePath}" -C "${targetDir}"`, { stdio: 'inherit' });
  }
  
  fs.unlinkSync(filePath);
  
  if (process.platform === 'darwin') {
    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      const fullPath = path.join(targetDir, file);
      try {
        if (fs.statSync(fullPath).isFile()) {
          execSync(`chmod +x "${fullPath}"`);
          console.log('  Made executable:', file);
        }
      } catch (e) {}
    }
  }
}

async function downloadEngine(engine, platform, arch) {
  const key = `${platform}_${arch}`;
  const urls = DOWNLOAD_URLS[engine]?.[key];
  
  if (!urls) {
    console.log(`  No ${engine} download available for ${platform}-${arch}`);
    return null;
  }
  
  const targetDir = path.join(__dirname, '..', 'engine-binaries', engine, platform);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const ext = engine === 'llama' ? '.zip' : (platform === 'win32' ? '.zip' : '.tar.gz');
  const filePath = path.join(targetDir, `download${ext}`);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Downloading ${engine} for ${platform}-${arch}`);
  console.log('='.repeat(50));
  
  for (const url of urls) {
    try {
      await downloadFile(url, filePath);
      console.log('  Download complete!');
      
      extractFile(filePath, targetDir, engine);
      
      console.log('  ✓ Done!\n');
      return targetDir;
    } catch (error) {
      console.log('  ✗ Failed:', error.message);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }
  }
  
  console.log('\n  All mirrors failed. Please download manually:');
  console.log('  ' + urls[urls.length - 1]);
  console.log('  And extract to:', targetDir);
  return null;
}

function checkEngines() {
  const engines = ['llama', 'zeroclaw'];
  const platforms = ['darwin', 'win32'];
  
  console.log('\n📦 Engine Binaries Status\n');
  
  for (const engine of engines) {
    console.log(`${engine.toUpperCase()}:`);
    for (const platform of platforms) {
      const dir = path.join(__dirname, '..', 'engine-binaries', engine, platform);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => {
          const ext = platform === 'win32' ? '.exe' : '';
          return f.includes(engine) || f.includes('llama') || f.includes('zeroclaw');
        });
        console.log(`  ${platform}: ${files.length > 0 ? '✓ ' + files.join(', ') : '✗ Not found'}`);
      } else {
        console.log(`  ${platform}: ✗ Not found`);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('\n🔧 MyChat Desktop - Engine Setup\n');
  
  if (args[0] === 'check') {
    checkEngines();
    return;
  }
  
  if (args[0] === 'all') {
    await downloadEngine('llama', 'darwin', 'arm64');
    await downloadEngine('llama', 'darwin', 'x64');
    await downloadEngine('llama', 'win32', 'x64');
    await downloadEngine('zeroclaw', 'darwin', 'arm64');
    await downloadEngine('zeroclaw', 'darwin', 'x64');
    await downloadEngine('zeroclaw', 'win32', 'x64');
  } else if (args[0] === 'llama' || args[0] === 'zeroclaw') {
    const engine = args[0];
    const platform = args[1] || process.platform;
    const arch = args[2] || process.arch;
    await downloadEngine(engine, platform, arch);
  } else {
    const platform = args[0] || process.platform;
    const arch = args[1] || process.arch;
    await downloadEngine('llama', platform, arch);
    await downloadEngine('zeroclaw', platform, arch);
  }
  
  checkEngines();
  console.log('🔧 Setup complete!\n');
}

main().catch(err => {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
});
