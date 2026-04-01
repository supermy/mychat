const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tar = require('tar');
const AdmZip = require('adm-zip');

const LLAMA_VERSION = 'b8229';
const ZEROCLAW_VERSION = 'v0.1.7';
const CODEX_VERSION = 'rust-v0.111.0';
const LLAMA_GITHUB_API = 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest';
const ZEROCLAW_GITHUB_API = 'https://api.github.com/repos/zeroclaw-labs/zeroclaw/releases/latest';
const CODEX_GITHUB_API = 'https://api.github.com/repos/openai/codex/releases/latest';

async function getLatestVersion(engine) {
  let apiUrl;
  if (engine === 'zeroclaw') {
    apiUrl = ZEROCLAW_GITHUB_API;
  } else if (engine === 'codex') {
    apiUrl = CODEX_GITHUB_API;
  } else {
    apiUrl = LLAMA_GITHUB_API;
  }
  
  return new Promise((resolve, reject) => {
    https.get(apiUrl, {
      headers: { 'User-Agent': 'MyChat-App' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve({
            version: release.tag_name,
            name: release.name,
            publishedAt: release.published_at,
            assets: release.assets
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function getCurrentVersion(engineDir) {
  const versionFile = path.join(engineDir, 'VERSION');
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, 'utf-8').trim();
  }
  return null;
}

function saveVersion(engineDir, version) {
  const versionFile = path.join(engineDir, 'VERSION');
  fs.writeFileSync(versionFile, version);
}

function getDownloadUrl(engine, platform, arch, version) {
  if (engine === 'zeroclaw') {
    const baseUrl = 'https://github.com/zeroclaw-labs/zeroclaw/releases/download';
    const v = version || ZEROCLAW_VERSION;
    
    if (platform === 'darwin') {
      if (arch === 'arm64') {
        return `${baseUrl}/${v}/zeroclaw-aarch64-apple-darwin.tar.gz`;
      } else {
        return `${baseUrl}/${v}/zeroclaw-x86_64-apple-darwin.tar.gz`;
      }
    } else if (platform === 'win32') {
      return `${baseUrl}/${v}/zeroclaw-x86_64-pc-windows-msvc.zip`;
    } else if (platform === 'linux') {
      if (arch === 'arm64') {
        return `${baseUrl}/${v}/zeroclaw-aarch64-unknown-linux-gnu.tar.gz`;
      } else {
        return `${baseUrl}/${v}/zeroclaw-x86_64-unknown-linux-gnu.tar.gz`;
      }
    }
    return null;
  }
  
  if (engine === 'codex') {
    const baseUrl = 'https://github.com/openai/codex/releases/download';
    const v = version || CODEX_VERSION;
    
    if (platform === 'darwin') {
      if (arch === 'arm64') {
        return `${baseUrl}/${v}/codex-aarch64-apple-darwin.tar.gz`;
      } else {
        return `${baseUrl}/${v}/codex-npm-darwin-x64-${v.replace('rust-v', '')}.tgz`;
      }
    } else if (platform === 'win32') {
      if (arch === 'arm64') {
        return `${baseUrl}/${v}/codex-aarch64-pc-windows-msvc.exe.zip`;
      } else {
        return `${baseUrl}/${v}/codex-npm-win32-x64-${v.replace('rust-v', '')}.tgz`;
      }
    } else if (platform === 'linux') {
      if (arch === 'arm64') {
        return `${baseUrl}/${v}/codex-aarch64-unknown-linux-musl.tar.gz`;
      } else {
        return `${baseUrl}/${v}/codex-npm-linux-x64-${v.replace('rust-v', '')}.tgz`;
      }
    }
    return null;
  }
  
  const baseUrl = 'https://github.com/ggml-org/llama.cpp/releases/download';
  const v = version || LLAMA_VERSION;
  
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return `${baseUrl}/${v}/llama-${v}-bin-macos-arm64.tar.gz`;
    } else {
      return `${baseUrl}/${v}/llama-${v}-bin-macos-x64.tar.gz`;
    }
  } else if (platform === 'win32') {
    return `${baseUrl}/${v}/llama-${v}-bin-win-cpu-x64.zip`;
  } else if (platform === 'linux') {
    return `${baseUrl}/${v}/llama-${v}-bin-ubuntu-x64.tar.gz`;
  }
  
  return null;
}

function getBinaryName(engine, platform) {
  if (engine === 'zeroclaw') {
    if (platform === 'win32') {
      return 'zeroclaw.exe';
    }
    return 'zeroclaw';
  }
  
  if (engine === 'codex') {
    if (platform === 'win32') {
      return 'codex.exe';
    }
    return 'codex';
  }
  
  if (platform === 'win32') {
    return 'llama-server.exe';
  }
  return 'llama-server';
}

async function downloadFile(url, destPath, onProgress, existingSize = 0) {
  return new Promise((resolve, reject) => {
    let redirectCount = 0;
    
    const download = (downloadUrl) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }
      
      const protocol = downloadUrl.startsWith('https') ? https : http;
      const options = new URL(downloadUrl);
      
      options.headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': '*/*',
      };
      
      if (existingSize > 0) {
        options.headers['Range'] = `bytes=${existingSize}-`;
      }
      
      const request = protocol.request(options, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          redirectCount++;
          download(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10) + existingSize;
        let downloaded = existingSize;
        
        const file = fs.createWriteStream(destPath, { flags: existingSize > 0 ? 'a' : 'w' });
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (onProgress && totalSize) {
            onProgress(downloaded, totalSize);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve({ size: downloaded, totalSize });
        });
        
        file.on('error', (err) => {
          file.close();
          reject(err);
        });
      });
      
      request.on('error', reject);
      request.setTimeout(600000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
      
      request.end();
    };
    
    download(url);
  });
}

async function extractArchive(archivePath, destDir, platform, engine) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const backupDir = destDir + '.backup';
  if (fs.existsSync(destDir)) {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true });
    }
    fs.renameSync(destDir, backupDir);
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  try {
    if (platform === 'win32') {
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(destDir, true);
    } else {
      if (engine === 'zeroclaw') {
        await tar.x({
          file: archivePath,
          cwd: destDir
        });
      } else if (engine === 'codex' && archivePath.endsWith('.tgz')) {
        const tempExtractDir = destDir + '-temp';
        if (!fs.existsSync(tempExtractDir)) {
          fs.mkdirSync(tempExtractDir, { recursive: true });
        }
        await tar.x({
          file: archivePath,
          cwd: tempExtractDir
        });
        const packageDir = path.join(tempExtractDir, 'package');
        if (fs.existsSync(packageDir)) {
          const binDir = path.join(packageDir, 'bin');
          if (fs.existsSync(binDir)) {
            const files = fs.readdirSync(binDir);
            for (const file of files) {
              const srcPath = path.join(binDir, file);
              const destPath = path.join(destDir, file);
              fs.copyFileSync(srcPath, destPath);
            }
          }
          const codexPath = path.join(packageDir, 'codex');
          if (fs.existsSync(codexPath)) {
            fs.copyFileSync(codexPath, path.join(destDir, 'codex'));
          }
        }
        fs.rmSync(tempExtractDir, { recursive: true });
      } else if (engine === 'codex') {
        await tar.x({
          file: archivePath,
          cwd: destDir
        });
        const files = fs.readdirSync(destDir);
        for (const file of files) {
          if (file.startsWith('codex-') && !file.includes('.tar')) {
            const srcPath = path.join(destDir, file);
            const destPath = path.join(destDir, 'codex');
            if (fs.statSync(srcPath).isFile()) {
              fs.renameSync(srcPath, destPath);
            }
            break;
          }
        }
      } else {
        await tar.x({
          file: archivePath,
          cwd: destDir,
          strip: 1
        });
      }
    }
    
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true });
    }
  } catch (error) {
    if (fs.existsSync(backupDir)) {
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true });
      }
      fs.renameSync(backupDir, destDir);
    }
    throw error;
  }
}

async function downloadEngine(engine, platform, arch, version, onProgress) {
  if (engine !== 'llama' && engine !== 'zeroclaw' && engine !== 'codex') {
    throw new Error(`Unknown engine: ${engine}`);
  }
  
  const defaultVersion = engine === 'zeroclaw' ? ZEROCLAW_VERSION : (engine === 'codex' ? CODEX_VERSION : LLAMA_VERSION);
  const targetVersion = version || defaultVersion;
  const url = getDownloadUrl(engine, platform, arch, targetVersion);
  if (!url) {
    throw new Error(`Unsupported platform: ${platform} ${arch}`);
  }
  
  const engineDir = path.join(__dirname, '..', 'engine-binaries', engine, platform);
  const binaryName = getBinaryName(engine, platform);
  const binaryPath = path.join(engineDir, binaryName);
  
  const currentVersion = getCurrentVersion(engineDir);
  if (currentVersion === targetVersion && fs.existsSync(binaryPath)) {
    console.log(`${engine} ${targetVersion} already installed at ${binaryPath}`);
    return { path: binaryPath, version: targetVersion, alreadyInstalled: true };
  }
  
  console.log(`Downloading ${engine} ${targetVersion} for ${platform} ${arch}...`);
  console.log(`URL: ${url}`);
  
  let tempExt = 'tar.gz';
  if (url.endsWith('.tgz')) {
    tempExt = 'tgz';
  } else if (url.endsWith('.zip')) {
    tempExt = 'zip';
  }
  const tempFile = path.join(__dirname, '..', 'engine-binaries', `temp-${engine}-${Date.now()}.${tempExt}`);
  
  let existingSize = 0;
  if (fs.existsSync(tempFile)) {
    existingSize = fs.statSync(tempFile).size;
  }
  
  try {
    await downloadFile(url, tempFile, (downloaded, total) => {
      if (onProgress) {
        onProgress(downloaded, total);
      } else {
        const percent = ((downloaded / total) * 100).toFixed(1);
        process.stdout.write(`\rDownloading: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
      }
    }, existingSize);
    console.log('\n');
    
    console.log('Extracting...');
    await extractArchive(tempFile, engineDir, platform, engine);
    
    fs.unlinkSync(tempFile);
    
    if (platform !== 'win32') {
      fs.chmodSync(binaryPath, '755');
    }
    
    saveVersion(engineDir, targetVersion);
    
    console.log(`${engine} ${targetVersion} installed successfully at ${binaryPath}`);
    return { path: binaryPath, version: targetVersion, alreadyInstalled: false };
  } catch (error) {
    if (fs.existsSync(tempFile)) {
      // Keep temp file for resume
    }
    throw error;
  }
}

function checkEngine(engine, platform, arch) {
  const engineDir = path.join(__dirname, '..', 'engine-binaries', engine, platform);
  const binaryName = getBinaryName(engine, platform);
  const binaryPath = path.join(engineDir, binaryName);
  const version = getCurrentVersion(engineDir);
  
  if (fs.existsSync(binaryPath)) {
    console.log(`✓ ${engine} ${version || 'unknown version'} is installed at ${binaryPath}`);
    return { installed: true, version, path: binaryPath };
  } else {
    console.log(`✗ ${engine} is not installed`);
    console.log(`  Run: npm run engine:download`);
    return { installed: false, version: null, path: null };
  }
}

async function checkForUpdate(engine, platform, arch) {
  const engineDir = path.join(__dirname, '..', 'engine-binaries', engine, platform);
  const currentVersion = getCurrentVersion(engineDir);
  
  try {
    const latest = await getLatestVersion(engine);
    const hasUpdate = !currentVersion || currentVersion !== latest.version;
    
    return {
      currentVersion,
      latestVersion: latest.version,
      hasUpdate,
      releaseInfo: latest
    };
  } catch (error) {
    return {
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      error: error.message
    };
  }
}

module.exports = { 
  downloadEngine, 
  checkEngine, 
  checkForUpdate,
  getLatestVersion,
  getCurrentVersion
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'check') {
    const platform = process.platform;
    const arch = process.arch;
    console.log('Checking engines...');
    checkEngine('llama', platform, arch);
    checkEngine('zeroclaw', platform, arch);
    checkEngine('codex', platform, arch);
  } else if (command === 'update') {
    const engine = args[1] || 'llama';
    const platform = args[2] || process.platform;
    const arch = args[3] || process.arch;
    
    checkForUpdate(engine, platform, arch).then(info => {
      if (info.hasUpdate) {
        console.log(`Update available: ${info.currentVersion || 'none'} -> ${info.latestVersion}`);
        return downloadEngine(engine, platform, arch, info.latestVersion);
      } else {
        console.log(`Already up to date: ${info.currentVersion}`);
      }
    }).catch(err => {
      console.error('Failed:', err.message);
      process.exit(1);
    });
  } else if (command === 'all') {
    const platform = process.platform;
    const arch = process.arch;
    
    console.log('Downloading all engines...');
    Promise.all([
      downloadEngine('llama', platform, arch),
      downloadEngine('zeroclaw', platform, arch),
      downloadEngine('codex', platform, arch)
    ]).then(() => {
      console.log('All engines downloaded successfully');
    }).catch(err => {
      console.error('Failed to download engines:', err.message);
      process.exit(1);
    });
  } else {
    const engine = args[0] || 'llama';
    const platform = args[1] || process.platform;
    const arch = args[2] || process.arch;
    
    downloadEngine(engine, platform, arch).catch(err => {
      console.error('Failed to download engine:', err.message);
      process.exit(1);
    });
  }
}
