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

    // Install therapist-app dependencies
    console.log('📥 Installing therapist app dependencies...');
    await execAsync('npm install', { cwd: path.join(__dirname, 'therapist-app') });

    // Clean and rebuild admin panel
    console.log('🧹 Cleaning admin build...');
    await fs.remove(path.join(__dirname, 'admin', 'dist'));

    console.log('📦 Building admin panel...');
    await execAsync('npm run build', {
      cwd: path.join(__dirname, 'admin'),
      env: { ...process.env }
    });

    // Clean and rebuild therapist app
    console.log('🧹 Cleaning therapist app build...');
    await fs.remove(path.join(__dirname, 'therapist-app', 'dist'));

    console.log('📦 Building therapist app...');
    await execAsync('npm run build', {
      cwd: path.join(__dirname, 'therapist-app'),
      env: { ...process.env }
    });

    // Setup dist directory
    console.log('📁 Setting up dist...');
    await fs.remove(path.join(__dirname, 'dist'));
    await fs.ensureDir(path.join(__dirname, 'dist'));

    // Copy booking platform to root (exclude netlify.toml to prevent overwriting)
    console.log('📋 Copying booking platform...');
    await fs.copy(path.join(__dirname, 'booking'), path.join(__dirname, 'dist'), {
      filter: (src) => !src.endsWith('netlify.toml')
    });

    // Copy admin build to /admin
    console.log('👥 Copying admin panel...');
    await fs.copy(path.join(__dirname, 'admin', 'dist'), path.join(__dirname, 'dist', 'admin'));

    // Copy therapist app build to /therapist
    console.log('💆 Copying therapist app...');
    await fs.copy(path.join(__dirname, 'therapist-app', 'dist'), path.join(__dirname, 'dist', 'therapist'));

    // Copy mockups folder
    console.log('🎨 Copying mockups...');
    await fs.copy(path.join(__dirname, 'mockups'), path.join(__dirname, 'dist', 'mockups'));

    // Copy the root netlify.toml AFTER everything else to ensure correct config
    console.log('⚙️  Copying netlify.toml...');
    await fs.copy(path.join(__dirname, 'netlify.toml'), path.join(__dirname, 'dist', 'netlify.toml'));

    console.log('✅ Build complete!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();
