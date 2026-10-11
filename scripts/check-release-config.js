const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};

  return fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((values, line) => {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) return values;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    return values;
  }, {});
}

const fileEnv = readDotEnv();
const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SENTRY_DSN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
];
const missing = required.filter(name => !(process.env[name] || fileEnv[name]));
const hasSupabasePublicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || fileEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!hasSupabasePublicKey) missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy EXPO_PUBLIC_SUPABASE_ANON_KEY)');
const publicFiles = [
  path.join(root, 'public', 'privacy', 'index.html'),
  path.join(root, 'public', 'support', 'index.html'),
  path.join(root, 'public', 'challenge', 'index.html'),
  path.join(root, 'src', 'db', 'migrations', '20260804_friend_challenges.sql'),
  path.join(root, 'src', 'db', 'migrations', '20260804_auth_profile_fix.sql'),
];
const missingFiles = publicFiles.filter(file => !fs.existsSync(file));
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const requiredBranding = [
  { label: 'app icon', relativePath: appConfig.icon, width: 1024, height: 1024 },
  { label: 'adaptive icon', relativePath: appConfig.android?.adaptiveIcon?.foregroundImage, width: 1024, height: 1024 },
  { label: 'splash icon', relativePath: appConfig.splash?.image, width: 1024, height: 1024 },
  { label: 'web favicon', relativePath: appConfig.web?.favicon, width: 512, height: 512 },
];
const brandingIssues = [];

for (const asset of requiredBranding) {
  if (!asset.relativePath) {
    brandingIssues.push(`${asset.label} is not configured in app.json`);
    continue;
  }
  const assetPath = path.resolve(root, asset.relativePath);
  if (!fs.existsSync(assetPath)) {
    brandingIssues.push(`${asset.label} is missing: ${asset.relativePath}`);
    continue;
  }
  const png = fs.readFileSync(assetPath);
  const isPng = png.length >= 24 && png.subarray(1, 4).toString('ascii') === 'PNG';
  if (!isPng) {
    brandingIssues.push(`${asset.label} must be a PNG: ${asset.relativePath}`);
    continue;
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== asset.width || height !== asset.height) {
    brandingIssues.push(`${asset.label} must be ${asset.width}x${asset.height}; found ${width}x${height}`);
  }
}
const testingToolsEnabled = (process.env.EXPO_PUBLIC_ENABLE_TEST_TOOLS || fileEnv.EXPO_PUBLIC_ENABLE_TEST_TOOLS) === 'true';

if (missing.length || missingFiles.length || brandingIssues.length || testingToolsEnabled) {
  console.error('Release preflight failed.');
  for (const name of missing) console.error(`- Missing environment variable: ${name}`);
  for (const file of missingFiles) console.error(`- Missing public page: ${path.relative(root, file)}`);
  for (const issue of brandingIssues) console.error(`- Branding issue: ${issue}`);
  if (testingToolsEnabled) console.error('- Developer Tools are enabled. Remove EXPO_PUBLIC_ENABLE_TEST_TOOLS=true before launch.');
  process.exit(1);
}

console.log('Release configuration is present. No secret values were printed.');
