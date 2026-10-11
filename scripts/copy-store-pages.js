const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'public');
const outputRoot = path.join(root, 'dist');
const pages = ['privacy', 'support', 'challenge'];
const sharedAssets = ['myprs-link-preview.png'];

for (const page of pages) {
  const source = path.join(sourceRoot, page, 'index.html');
  const destinationDir = path.join(outputRoot, page);
  const destination = path.join(destinationDir, 'index.html');
  if (!fs.existsSync(source)) throw new Error(`Missing store page: ${source}`);
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.copyFileSync(source, destination);
}

for (const asset of sharedAssets) {
  const source = path.join(sourceRoot, asset);
  const destination = path.join(outputRoot, asset);
  if (!fs.existsSync(source)) throw new Error(`Missing shared asset: ${source}`);
  fs.copyFileSync(source, destination);
}

const rootIndex = path.join(outputRoot, 'index.html');
const rootSocialMeta = `
  <meta name="description" content="Log workouts, track PRs and turn progress into collectible MyPRS Wrapped cards." />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MyPRS" />
  <meta property="og:title" content="MyPRS" />
  <meta property="og:description" content="Your work. Your numbers. Your progress." />
  <meta property="og:image" content="https://myprs.app/myprs-link-preview.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="MyPRS" />
  <meta name="twitter:image" content="https://myprs.app/myprs-link-preview.png" />
`;
if (fs.existsSync(rootIndex)) {
  const html = fs.readFileSync(rootIndex, 'utf8');
  if (!html.includes('property="og:site_name"')) {
    fs.writeFileSync(rootIndex, html.replace('</head>', `${rootSocialMeta}</head>`));
  }
}

console.log(`Copied ${pages.length} store-support pages and link-preview branding into the web release.`);
