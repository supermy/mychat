/**
 * @jest
 */

describe('Engine Download', () => {
  describe('Version Parsing', () => {
    it('should parse version from llama-server output', () => {
      const versionOutput = 'version: 8229 (649f06481)';
      const versionMatch = versionOutput.match(/version:\s*(\d+)/i);
      
      expect(versionMatch).not.toBeNull();
      expect(versionMatch?.[1]).toBe('8229');
    });

    it('should parse version with b prefix', () => {
      const version = 'b8229';
      const numMatch = version.match(/b?(\d+)/);
      
      expect(numMatch).not.toBeNull();
      expect(numMatch?.[1]).toBe('8229');
    });

    it('should detect GPU support from version output', () => {
      const vulkanOutput = 'llama-server version: 8229 (vulkan support)';
      const hasVulkan = vulkanOutput.toLowerCase().includes('vulkan');
      
      expect(hasVulkan).toBe(true);
    });

    it('should detect CUDA support', () => {
      const cudaOutput = 'llama-server version: 8229 (cuda support)';
      const hasCuda = cudaOutput.toLowerCase().includes('cuda');
      
      expect(hasCuda).toBe(true);
    });

    it('should detect HIPBLAS support', () => {
      const hipOutput = 'llama-server version: 8229 (hipblas support)';
      const hasHip = hipOutput.toLowerCase().includes('hipblas');
      
      expect(hasHip).toBe(true);
    });
  });

  describe('Download URL Generation', () => {
    it('should generate correct CPU URL for Ubuntu x64', () => {
      const version = 'b8606';
      const os = 'ubuntu';
      const arch = 'x64';
      const hasGpu = false;
      
      let url: string;
      if (hasGpu && os === 'ubuntu' && arch === 'x64') {
        url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-ubuntu-vulkan-x64.tar.gz`;
      } else {
        url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-${os}-${arch}.tar.gz`;
      }
      
      expect(url).toBe('https://github.com/ggml-org/llama.cpp/releases/download/b8606/llama-b8606-bin-ubuntu-x64.tar.gz');
    });

    it('should generate correct Vulkan URL for GPU', () => {
      const version = 'b8606';
      const os = 'ubuntu';
      const arch = 'x64';
      const hasGpu = true;
      
      let url: string;
      if (hasGpu && os === 'ubuntu' && arch === 'x64') {
        url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-ubuntu-vulkan-x64.tar.gz`;
      } else {
        url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-${os}-${arch}.tar.gz`;
      }
      
      expect(url).toBe('https://github.com/ggml-org/llama.cpp/releases/download/b8606/llama-b8606-bin-ubuntu-vulkan-x64.tar.gz');
    });

    it('should generate correct URL for macOS arm64', () => {
      const version = 'b8606';
      const os = 'macos';
      const arch = 'arm64';
      const hasGpu = false;
      
      const url = `https://github.com/ggml-org/llama.cpp/releases/download/${version}/llama-${version}-bin-${os}-${arch}.tar.gz`;
      
      expect(url).toBe('https://github.com/ggml-org/llama.cpp/releases/download/b8606/llama-b8606-bin-macos-arm64.tar.gz');
    });
  });

  describe('Version Comparison', () => {
    it('should compare versions correctly', () => {
      const currentVersion = 'b8229';
      const latestVersion = 'b8606';
      
      const currentNum = parseInt(currentVersion.replace('b', ''));
      const latestNum = parseInt(latestVersion.replace('b', ''));
      
      expect(latestNum).toBeGreaterThan(currentNum);
    });

    it('should detect same version', () => {
      const currentVersion = 'b8606';
      const latestVersion = 'b8606';
      
      expect(currentVersion).toBe(latestVersion);
    });
  });

  describe('Platform Detection', () => {
    it('should detect Ubuntu from uname output', () => {
      const unameOutput = 'Linux ubuntu-server 6.8.0-106-generic #112-Ubuntu SMP x86_64 GNU/Linux';
      const isUbuntu = unameOutput.toLowerCase().includes('ubuntu');
      
      expect(isUbuntu).toBe(true);
    });

    it('should detect x64 architecture', () => {
      const archOutput = 'x86_64';
      const isX64 = archOutput.includes('x86_64') || archOutput.includes('amd64');
      
      expect(isX64).toBe(true);
    });

    it('should detect arm64 architecture', () => {
      const archOutput = 'aarch64';
      const isArm = archOutput.includes('arm') || archOutput.includes('aarch');
      
      expect(isArm).toBe(true);
    });
  });
});
