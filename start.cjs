const { spawn } = require('child_process');
const path = require('path');

// Start Express API on port 3001
const api = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: path.join(__dirname, 'apps', 'api'),
  stdio: 'inherit',
  shell: true,
});

// Start Next.js on PORT (Railway assigns this) or 3000
const webPort = process.env.PORT || '3000';
const web = spawn('npx', ['next', 'start', '-p', webPort], {
  cwd: path.join(__dirname, 'apps', 'web'),
  stdio: 'inherit',
  shell: true,
});

// If either process exits, kill the other
api.on('exit', (code) => {
  console.error(`API exited with code ${code}`);
  web.kill();
  process.exit(code || 1);
});

web.on('exit', (code) => {
  console.error(`Web exited with code ${code}`);
  api.kill();
  process.exit(code || 1);
});

process.on('SIGTERM', () => {
  api.kill();
  web.kill();
});
