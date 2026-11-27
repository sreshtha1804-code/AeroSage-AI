// Repository-level invariants: security, deployment compatibility and accessibility/responsive contracts
// that must keep holding as the code changes. They read real project files; nothing is mocked.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const walk = (dir) =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
const sourceFiles = [...walk('src'), ...walk('server')].filter((file) => /\.(js|jsx)$/.test(file));
const textFiles = [
  ...sourceFiles,
  // This file defines the secret patterns, so it cannot scan itself.
  ...walk('tests').filter((file) => !file.endsWith('hygiene.test.js')),
  'README.md',
  '.env.example',
  'index.html',
  'render.yaml',
  'vercel.json',
];

describe('secrets and unsafe code', () => {
  const SECRET_PATTERNS = [
    /AIza[0-9A-Za-z_-]{30,}/,
    /sk-[A-Za-z0-9]{32,}/,
    /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /service_role/,
  ];
  it.each(textFiles)('%s contains no credentials', (file) => {
    const text = read(file);
    for (const pattern of SECRET_PATTERNS)
      expect(text, `${file} matches ${pattern}`).not.toMatch(pattern);
  });

  it('the frontend only reads the public API URL from the environment', () => {
    const used = new Set(
      sourceFiles
        .filter((f) => f.startsWith('src'))
        .flatMap((f) => [...read(f).matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1])),
    );
    expect([...used]).toEqual(['VITE_API_URL']);
  });

  it('the frontend never references server-only secrets', () => {
    for (const file of sourceFiles.filter((f) => f.startsWith('src'))) {
      expect(read(file), file).not.toMatch(/GEMINI_API_KEY|SUPABASE_SERVICE_KEY|process\.env/);
    }
  });

  it.each(sourceFiles.filter((f) => f.startsWith('src')))('%s avoids unsafe DOM APIs', (file) => {
    expect(read(file)).not.toMatch(
      /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\(|new Function\(|document\.write\(/,
    );
  });

  it('.env files are git-ignored', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/node_modules/);
  });

  it('server code has no direct console calls outside the logger', () => {
    for (const file of sourceFiles.filter(
      (f) => f.startsWith('server') && !f.endsWith('logger.js'),
    )) {
      expect(read(file), file).not.toMatch(/console\./);
    }
  });
});

describe('Vercel security headers (vercel.json)', () => {
  const config = JSON.parse(read('vercel.json'));
  const headers = Object.fromEntries(
    config.headers[0].headers.map(({ key, value }) => [key, value]),
  );
  const csp = Object.fromEntries(
    headers['Content-Security-Policy'].split(';').map((part) =>
      part
        .trim()
        .split(/\s+(.*)/s)
        .slice(0, 2),
    ),
  );

  it('keeps the build settings Vercel relies on', () => {
    expect(config).toMatchObject({
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
    });
  });
  it('enforces a strict Content-Security-Policy that still lets the app reach its API', () => {
    expect(csp['default-src']).toBe("'self'");
    expect(csp['script-src']).toBe("'self'");
    expect(csp['script-src']).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp['connect-src']).toBe("'self' https://aerosage-api.onrender.com");
    expect(csp['object-src']).toBe("'none'");
    expect(csp['frame-ancestors']).toBe("'none'");
    expect(csp['base-uri']).toBe("'self'");
    expect(csp['img-src']).toMatch(/data:/); // the favicon is a data: URI
  });
  it('sets the other hardening headers', () => {
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/);
    expect(headers['Permissions-Policy']).toMatch(/geolocation=\(\)/);
  });
  it('the page loads no external resources that the CSP would block', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/); // no inline scripts
    expect(html).not.toMatch(/<link[^>]+href="https?:/); // no external stylesheets/fonts
    expect(html).not.toMatch(/<style/);
  });
});

describe('Render deployment compatibility', () => {
  const blueprint = read('render.yaml');
  const pkg = JSON.parse(read('package.json'));
  it('keeps the start command, health check and Node version', () => {
    expect(blueprint).toMatch(/startCommand: npm start/);
    expect(blueprint).toMatch(/healthCheckPath: \/api\/health/);
    expect(blueprint).toMatch(/key: NODE_VERSION\s+value: 20/);
    expect(pkg.scripts.start).toBe('node server/index.js');
    expect(pkg.scripts.build).toBe('vite build');
  });
  it('every environment variable the server reads is documented in .env.example', () => {
    const used = new Set(
      [...read('server/config.js').matchAll(/env\.([A-Z_]+)/g)].map((m) => m[1]),
    );
    const documented = read('.env.example');
    for (const name of used) expect(documented, name).toContain(name);
    expect(used.has('GEMINI_API_KEY')).toBe(true);
  });
  it('the production runtime dependencies are only what the server needs', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(
      [
        'cors',
        'dotenv',
        'express',
        'express-rate-limit',
        'helmet',
        'lucide-react',
        'react',
        'react-dom',
        'recharts',
      ].sort(),
    );
  });
  it('is version 3 and keeps the project identity', () => {
    expect(pkg.version).toBe('3.0.0');
    expect(read('README.md')).toMatch(/AeroSage AI/);
    expect(read('README.md')).toMatch(/Smart Environmental Health Assistant/);
  });
});

describe('accessibility and responsive contracts (static)', () => {
  const html = read('index.html');
  const css = read('src/index.css');
  it('declares language, a responsive viewport that allows zoom, a description and a noscript message', () => {
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<meta name="viewport" content="width=device-width,initial-scale=1" \/>/);
    expect(html).not.toMatch(/user-scalable=no|maximum-scale=1/);
    expect(html).toMatch(/<meta\s+name="description"/);
    expect(html).toMatch(/<noscript[\s>]/);
  });
  it('respects reduced-motion and shows a visible keyboard focus style', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:/);
  });
  it('every component that renders a table makes it scroll sideways instead of overflowing small screens', () => {
    for (const file of sourceFiles.filter((f) => f.startsWith('src/components'))) {
      const text = read(file);
      if (text.includes('<table')) expect(text, file).toMatch(/overflow-(x-)?auto/);
    }
  });
  it('the navigation keeps text labels available to screen readers when icons-only on small screens', () => {
    expect(read('src/App.jsx')).toMatch(/sr-only sm:not-sr-only/);
  });
  it('layouts collapse to one column on small screens (mobile-first grids)', () => {
    const grids = sourceFiles
      .filter((f) => f.startsWith('src'))
      .flatMap((f) => [...read(f).matchAll(/className="[^"]*\bgrid\b[^"]*"/g)].map((m) => m[0]));
    const multiColumn = grids.filter(
      (c) => /grid-cols-[2-9]/.test(c) && !/(sm|md|lg):grid-cols/.test(c),
    );
    // 2-column grids of compact tiles/inputs are intentional; anything wider must be responsive.
    expect(multiColumn.filter((c) => /grid-cols-[3-9]/.test(c))).toEqual([]);
  });
});
