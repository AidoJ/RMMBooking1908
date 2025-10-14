import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Building platforms...');

async function main() {
  try {
    // Install admin dependencies first
    console.log('📥 Installing admin dependencies...');
    await execAsync('npm install', { cwd: path.join(__dirname, 'admin') });
    
    // Clean and rebuild admin panel
    console.log('🧹 Cleaning admin build...');
    await fs.remove(path.join(__dirname, 'admin', 'dist'));
    
    console.log('📦 Building admin panel...');
    await execAsync('npm run build', { cwd: path.join(__dirname, 'admin') });
    
    // Setup dist directory
    console.log('📁 Setting up dist...');
    await fs.remove(path.join(__dirname, 'dist'));
    await fs.ensureDir(path.join(__dirname, 'dist'));
    
    // Copy booking platform to root (excluding unnecessary files)
    console.log('📋 Copying booking platform...');
    await fs.copy(path.join(__dirname, 'booking'), path.join(__dirname, 'dist'), {
      filter: (src, dest) => {
        // Exclude node_modules, .md files, test files, and other unnecessary files
        const relativePath = path.relative(path.join(__dirname, 'booking'), src);
        
        if (relativePath.includes('node_modules')) return false;
        if (relativePath.endsWith('.md')) return false;
        if (relativePath.includes('test')) return false;
        if (relativePath.includes('.test.')) return false;
        if (relativePath.includes('.spec.')) return false;
        if (relativePath.includes('jest.config')) return false;
        if (relativePath.includes('.gitignore')) return false;
        if (relativePath.includes('.env.example')) return false;
        if (relativePath.includes('package-lock.json')) return false;
        
        return true;
      }
    });
    
    // Copy admin build to /admin
    console.log('👥 Copying admin panel...');
    await fs.copy(path.join(__dirname, 'admin', 'dist'), path.join(__dirname, 'dist', 'admin'));
    
    console.log('✅ Build complete!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();
