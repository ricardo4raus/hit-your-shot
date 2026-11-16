/**
 * Screenshots of the game for pull requests, taken from the web build in a headless Chrome (the lead works on Windows without a phone
 * simulator). Exports the web bundle, serves it from a local port, opens it at phone size and saves PNGs of the screen between rounds,
 * during a round, and a strip of frames of the character shooting.
 *
 * Run from the repository root (needs Google Chrome installed):
 *     npm run screenshot                      writes screenshots/*.png
 *     npx tsx tools/screenshot.ts --skip-export   reuse the last dist/ export
 *     npx tsx tools/screenshot.ts --chrome "C:/path/to/chrome.exe"
 *
 * Nothing here is part of the app. The export goes to dist/ (ignored), CanvasKit is copied into public/ (ignored).
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(__dirname, '..');
const dist = join(root, 'dist');
const out = join(root, 'screenshots');
const PORT = 8799;
const WIDTH = 375;
const HEIGHT = 812;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findChrome(): string {
  const given = option('chrome', '');
  if (given) return given;
  for (const c of CHROME_CANDIDATES) if (existsSync(c)) return c;
  throw new Error('Google Chrome not found; pass --chrome <path>');
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function serve(dir: string, port: number): Server {
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0]!;
    let file = join(dir, decodeURIComponent(url));
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port);
  return server;
}

async function main(): Promise<void> {
  mkdirSync(join(root, 'public'), { recursive: true });
  copyFileSync(join(root, 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm'), join(root, 'public/canvaskit.wasm'));
  if (!flag('skip-export')) {
    console.log('exporting web bundle…');
    execSync('npx expo export --platform web --output-dir dist', { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  }
  mkdirSync(out, { recursive: true });
  const server = serve(dist, PORT);
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', (e) => console.log('page error:', e instanceof Error ? e.message : String(e)));
    page.on('console', (m) => {
      const type = m.type();
      if (type === 'error' || type === 'warn') console.log(`console ${type}:`, m.text());
    });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 90_000 });
    await page.waitForSelector('canvas', { timeout: 60_000 });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: join(out, '01-idle.png') });

    // Aim a little to the right, then press Play.
    await page.touchscreen.tap(WIDTH * 0.6, HEIGHT * 0.3);
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: join(out, '02-aimed.png') });
    const play = await page.$('[aria-label="Play"], [aria-label="Play again"]');
    if (!play) throw new Error('play button not found');
    await play.tap();
    // A strip of frames through the first shots.
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 90));
      await page.screenshot({ path: join(out, `03-round-${i}.png`), clip: { x: 0, y: HEIGHT * 0.35, width: WIDTH * 0.6, height: HEIGHT * 0.55 } });
    }
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: join(out, '04-midround.png') });
    await new Promise((r) => setTimeout(r, 7000));
    await page.screenshot({ path: join(out, '05-result.png') });
    console.log(`written: ${out}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
