#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LLAMA_VERSION = 'b4693';

const DOWNLOAD_URLS = {
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
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('Downloading from:', url);
    
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
          console.log('  Redirect ->', location.substring(0, 80) + '...');
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

function extractZip(zipPath, targetDir) {
  console.log('Extracting to:', targetDir);
  
  if (process.platform === 'win32') {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${targetDir}"`, { stdio: 'inherit' });
  }
}

async function downloadForPlatform(platform, arch) {
  const key = `${platform}_${arch}`;
  const urls = DOWNLOAD_URLS[key];
  
  if (!urls) {
    console.log(`No download available for ${platform}-${arch}`);
    return null;
  }
  
  const targetDir = path.join(__dirname, '..', 'llama-binaries', platform);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const zipPath = path.join(targetDir, 'llama.zip');
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Downloading llama.cpp for ${platform}-${arch}`);
  console.log('='.repeat(50));
  
  for (const url of urls) {
    try {
      await downloadFile(url, zipPath);
      console.log('  Download complete!');
      
      extractZip(zipPath, targetDir);
      
      fs.unlinkSync(zipPath);
      
      if (platform === 'darwin') {
        const files = fs.readdirSync(targetDir);
        for (const file of files) {
          if (file.startsWith('llama-') && !file.endsWith('.zip')) {
            execSync(`chmod +x "${path.join(targetDir, file)}"`);
            console.log('  Made executable:', file);
          }
        }
      }
      
      console.log('  ✓ Done!\n');
      return targetDir;
    } catch (error) {
      console.log('  ✗ Failed:', error.message);
      if (fs.existsSync(zipPath)) {
        try { fs.unlinkSync(zipPath); } catch (e) {}
      }
    }
  }
  
  console.log('\n  All mirrors failed. Please download manually:');
  console.log('  ' + urls[urls.length - 1]);
  console.log('  And extract to:', targetDir);
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('\n🦙 MyChat Desktop - llama.cpp Setup\n');
  
  if (args[0] === 'all') {
    await downloadForPlatform('darwin', 'arm64');
    await downloadForPlatform('darwin', 'x64');
    await downloadForPlatform('win32', 'x64');
  } else if (args[0] === 'check') {
    const darwinDir = path.join(__dirname, '..', 'llama-binaries', 'darwin');
    const winDir = path.join(__dirname, '..', 'llama-binaries', 'win32');
    
    console.log('Checking binaries...\n');
    
    if (fs.existsSync(darwinDir)) {
      const files = fs.readdirSync(darwinDir).filter(f => f.startsWith('llama-'));
      console.log('macOS:', files.length > 0 ? '✓ ' + files.join(', ') : '✗ Not found');
    } else {
      console.log('macOS: ✗ Not found');
    }
    
    if (fs.existsSync(winDir)) {
      const files = fs.readdirSync(winDir).filter(f => f.startsWith('llama-'));
      console.log('Windows:', files.length > 0 ? '✓ ' + files.join(', ') : '✗ Not found');
    } else {
      console.log('Windows: ✗ Not found');
    }
  } else {
    const platform = args[0] || process.platform;
    const arch = args[1] || process.arch;
    await downloadForPlatform(platform, arch);
  }
  
  console.log('🦙 Setup complete!\n');
}

main().catch(err => {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
});
