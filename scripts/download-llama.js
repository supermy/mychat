const https = require('https');
const http = require('http');
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
      
      const protocol = downloadUrl.startsWith('https') ? https : http;
      
      protocol.get(downloadUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const location = response.headers.location;
          console.log('Redirect to:', location);
          doDownload(location);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
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
      }).setTimeout(300000, () => {
        fs.unlink(dest, () => {});
        reject(new Error('Download timeout'));
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
  
  try {
    await downloadFile(url, zipPath, (downloaded, total) => {
      const percent = ((downloaded / total) * 100).toFixed(1);
      const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
      const totalMB = (total / 1024 / 1024).toFixed(1);
      process.stdout.write(`\rProgress: ${percent}% (${downloadedMB}/${totalMB} MB)`);
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
  } catch (error) {
    console.error('\nDownload failed:', error.message);
    console.log('\nPlease download manually from:');
    console.log(url);
    console.log('\nAnd extract to:', targetDir);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetPlatform = args[0] || process.platform;
  const targetArch = args[1] || process.arch;
  
  console.log('MyChat Desktop - llama.cpp Setup');
  console.log('================================');
  
  if (args[0] === 'all') {
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
