#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL = {
  name: 'Qwen3.5-0.8B-UD-Q4_K_XL.gguf',
  url: 'https://www.modelscope.cn/models/unsloth/Qwen3.5-0.8B-GGUF/resolve/master/Qwen3.5-0.8B-UD-Q4_K_XL.gguf',
  size: '~500MB'
};

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    console.log('Downloading:', url);
    
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
        timeout: 1800000, // 30 minutes
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const location = response.headers.location;
          console.log('Redirect ->', location.substring(0, 80) + '...');
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
            if (percent !== lastPercent) {
              lastPercent = percent;
              const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
              const totalMB = (totalSize / 1024 / 1024).toFixed(1);
              if (onProgress) {
                onProgress(percent, downloadedMB, totalMB);
              } else {
                process.stdout.write(`\rProgress: ${percent}% (${downloadedMB}/${totalMB} MB)`);
              }
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

async function downloadDefaultModel() {
  const targetDir = path.join(__dirname, '..', 'default-model');
  const modelPath = path.join(targetDir, DEFAULT_MODEL.name);
  
  if (fs.existsSync(modelPath)) {
    const stats = fs.statSync(modelPath);
    console.log(`\n✓ Default model already exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    console.log('  Path:', modelPath);
    return modelPath;
  }
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  console.log('\n📦 Downloading Default Model');
  console.log('='.repeat(50));
  console.log('Name:', DEFAULT_MODEL.name);
  console.log('Size:', DEFAULT_MODEL.size);
  console.log('='.repeat(50));
  
  try {
    await downloadFile(DEFAULT_MODEL.url, modelPath, (percent, downloaded, total) => {
      process.stdout.write(`\rProgress: ${percent}% (${downloaded}/${total} MB)`);
    });
    
    console.log('\n\n✓ Download complete!');
    console.log('  Path:', modelPath);
    return modelPath;
  } catch (error) {
    console.error('\n\n✗ Download failed:', error.message);
    console.log('\nPlease download manually:');
    console.log(DEFAULT_MODEL.url);
    console.log('\nAnd save to:', modelPath);
    throw error;
  }
}

function checkDefaultModel() {
  const targetDir = path.join(__dirname, '..', 'default-model');
  const modelPath = path.join(targetDir, DEFAULT_MODEL.name);
  
  console.log('\n📦 Default Model Status\n');
  
  if (fs.existsSync(modelPath)) {
    const stats = fs.statSync(modelPath);
    console.log('✓ Installed');
    console.log('  Name:', DEFAULT_MODEL.name);
    console.log('  Size:', (stats.size / 1024 / 1024).toFixed(1), 'MB');
    console.log('  Path:', modelPath);
    return true;
  } else {
    console.log('✗ Not installed');
    console.log('  Run: npm run model:download');
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'check') {
    checkDefaultModel();
  } else {
    await downloadDefaultModel();
    checkDefaultModel();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
