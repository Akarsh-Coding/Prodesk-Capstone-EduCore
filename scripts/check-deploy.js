#!/usr/bin/env node
// Pre-deploy check. Run from the repository root:   node scripts/check-deploy.js
//
// Render and Vercel build from what GIT contains, on case-sensitive Linux. Windows hides several
// problems (wrong letter case in an import, a file you never `git add`-ed, a package missing from
// package.json). This script checks the tracked files the way Linux will see them.
//
// No dependencies: plain Node. Exit code 1 if anything fails.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

let problems = 0;
const section = (title) => console.log(`\n== ${title}`);
const ok = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => {
  problems += 1;
  console.log(`  FAIL  ${msg}`);
};

// ---------------------------------------------------------------- tracked files
let tracked;
try {
  tracked = git('ls-files', '-z').split('\0').filter(Boolean);
} catch {
  console.error('This does not look like a git repository (or git is not installed). Run it from the repo root.');
  process.exit(2);
}
const trackedSet = new Set(tracked);
const trackedLower = new Map();
for (const file of tracked) {
  const key = file.toLowerCase();
  trackedLower.set(key, [...(trackedLower.get(key) || []), file]);
}

const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;
const ENV_TEMPLATE = /\.(example|sample|template)$/;
const isRealEnvFile = (file) => ENV_FILE.test(file) && !ENV_TEMPLATE.test(file);

// ---------------------------------------------------------------- 1. env files
section('1. Environment files were never committed');
const trackedEnv = tracked.filter(isRealEnvFile);
if (trackedEnv.length) trackedEnv.forEach((f) => fail(`${f} is tracked by git. Remove it: git rm --cached ${f}`));
else ok('no .env file is tracked');

try {
  const everTouched = new Set(
    git('log', '--all', '--name-only', '--pretty=format:')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );
  const inHistory = [...everTouched].filter(isRealEnvFile);
  if (inHistory.length) {
    inHistory.forEach((f) =>
      fail(`${f} exists in git HISTORY. Deleting it now is not enough: rotate every secret that was in it.`)
    );
  } else {
    ok('no .env file appears anywhere in the git history');
  }
} catch {
  ok('history check skipped (no commits yet)');
}

// ---------------------------------------------------------------- 2. secrets in code
section('2. No secrets in tracked files');
const SECRET_PATTERNS = [
  { name: 'Stripe LIVE key', re: /\b(sk|rk)_live_[0-9a-zA-Z]{10,}/ },
  { name: 'Stripe test secret key', re: /\b(sk|rk)_test_[0-9a-zA-Z]{16,}/ },
  { name: 'Stripe webhook secret', re: /\bwhsec_[0-9a-zA-Z]{16,}/ },
  { name: 'MongoDB URI with a password', re: /mongodb(\+srv)?:\/\/[^\s'"<>:@/]+:[^\s'"<>@/]+@/ },
  { name: 'hard-coded JWT_SECRET', re: /JWT_SECRET\s*[=:]\s*['"]?[A-Za-z0-9+/=_-]{32,}/, skipIf: /replace|your|example|change|placeholder/i },
];
const SKIP_CONTENT = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$|\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i;
let secretHits = 0;
for (const file of tracked) {
  if (SKIP_CONTENT.test(file)) continue;
  let text;
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 2 * 1024 * 1024 || buf.includes(0)) continue; // large or binary
    text = buf.toString('utf8');
  } catch {
    continue; // listed by git but missing on disk
  }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const p of SECRET_PATTERNS) {
      const m = line.match(p.re);
      if (m && !(p.skipIf && p.skipIf.test(line))) {
        secretHits += 1;
        fail(`${file}:${i + 1} looks like a ${p.name}`);
      }
    }
  });
}
if (!secretHits) ok('no keys, passwords or connection strings found in tracked files');

try {
  const historyPatterns = [
    { name: 'a Stripe key', pattern: '(sk|rk)_(live|test)_[0-9a-zA-Z]{16,}' },
    { name: 'a MongoDB connection string with a password', pattern: 'mongodb(\\+srv)?://[^ <>:@/]+:[^ <>@/]+@' },
  ];
  let found = false;
  for (const { name, pattern } of historyPatterns) {
    const commits = git('log', '--all', '--oneline', '-G', pattern).trim();
    if (commits) {
      found = true;
      fail(`${name} was committed at some point (commits below). Rotate it.\n${commits.split('\n').slice(0, 5).map((c) => `          ${c}`).join('\n')}`);
    }
  }
  if (!found) ok('no secret-like strings in the git history');
} catch {
  ok('history secret scan skipped (no commits yet)');
}

// ---------------------------------------------------------------- 3. imports
section('3. Imports resolve on case-sensitive Linux, and every package is declared');
const SRC_EXT = /\.(js|jsx|mjs|cjs|ts|tsx)$/;
const RESOLVE_EXT = ['', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json'];
// Anchored to the start of a line so the word "from" inside ordinary text or a template string
// ("You will be removed from ...") is not mistaken for an import.
const IMPORT_RES = [
  /^[ \t]*(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"\n]+)['"]/gm, // import x from '...' / export { y } from '...'
  /^[ \t]*import\s*['"]([^'"\n]+)['"]/gm, // import './globals.css'
  /\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g, // import('...')
  /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g, // require('...')
];

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const declared = (dir) => {
  const pkg = readJson(path.posix.join(dir, 'package.json'));
  return pkg ? new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]) : null;
};
const depsByApp = { client: declared('client'), server: declared('server') };

const candidatesFor = (base) => {
  const list = RESOLVE_EXT.map((ext) => base + ext);
  RESOLVE_EXT.slice(1).forEach((ext) => list.push(`${base}/index${ext}`));
  return list;
};
const norm = (p) => path.posix.normalize(p);

let importProblems = 0;
const flag = (msg) => {
  importProblems += 1;
  fail(msg);
};

const sourceFiles = tracked.filter((f) => SRC_EXT.test(f) && /^(client|server)\//.test(f) && !/(^|\/)node_modules\//.test(f));
for (const file of sourceFiles) {
  const app = file.split('/')[0];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const specs = new Set();
  for (const re of IMPORT_RES) for (const m of text.matchAll(re)) specs.add(m[1]);

  for (const spec of specs) {
    let base = null;
    if (spec.startsWith('./') || spec.startsWith('../')) base = norm(path.posix.join(path.posix.dirname(file), spec));
    else if (spec.startsWith('@/') && app === 'client') base = norm(`client/src/${spec.slice(2)}`);

    if (base) {
      const candidates = candidatesFor(base);
      if (candidates.some((c) => trackedSet.has(c))) continue; // exact, case-sensitive match
      const wrongCase = candidates.flatMap((c) => trackedLower.get(c.toLowerCase()) || []);
      if (wrongCase.length) {
        flag(`${file}: import '${spec}' has the wrong letter case. Git tracks '${wrongCase[0]}'. Linux will fail to find it.`);
      } else if (candidates.some((c) => fs.existsSync(c))) {
        flag(`${file}: import '${spec}' points to a file that exists locally but is NOT tracked by git. Run: git add <file>`);
      } else {
        flag(`${file}: import '${spec}' cannot be resolved to any file.`);
      }
      continue;
    }

    // Bare package import (react, express, jwt-decode, ...)
    if (spec.startsWith('node:') || spec.startsWith('#')) continue;
    const parts = spec.split('/');
    const pkgName = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    if (builtinModules.includes(pkgName) || builtinModules.includes(spec)) continue;
    const deps = depsByApp[app];
    if (!deps) {
      flag(`${app}/package.json is missing or unreadable, so '${pkgName}' cannot be checked.`);
    } else if (!deps.has(pkgName)) {
      flag(`${file}: package '${pkgName}' is imported but not listed in ${app}/package.json. Run: cd ${app}; npm install ${pkgName}`);
    }
  }
}
if (!importProblems) ok(`${sourceFiles.length} source files checked: every import resolves exactly, every package is declared`);

// ---------------------------------------------------------------- 4. deploy settings in the repo
section('4. Deploy basics');
const serverPkg = readJson('server/package.json');
if (!serverPkg) fail('server/package.json is missing or is not tracked');
else if (!serverPkg.scripts || !serverPkg.scripts.start) fail('server/package.json has no "start" script (Render runs: npm start)');
else ok(`server start script: ${serverPkg.scripts.start}`);
if (!trackedSet.has('server/package-lock.json') || !trackedSet.has('client/package-lock.json')) {
  fail('package-lock.json is not tracked in server/ and/or client/ (commit both so installs are reproducible)');
} else ok('both package-lock.json files are tracked');
const clientPkg = readJson('client/package.json');
if (!clientPkg || !clientPkg.scripts || !clientPkg.scripts.build) fail('client/package.json has no "build" script');
else ok('client build script present');

let dirty = '';
try {
  dirty = git('status', '--porcelain').trim();
} catch {
  /* ignore */
}
if (dirty) fail(`uncommitted changes exist (they will NOT be deployed):\n${dirty.split('\n').slice(0, 10).map((l) => `          ${l}`).join('\n')}`);
else ok('working tree is clean');

try {
  const branch = git('branch', '--show-current').trim();
  console.log(`  info  current branch: ${branch || '(detached)'}${branch === 'main' ? '' : '   <- deployments follow "main"'}`);
  git('fetch', '--quiet');
  const ahead = git('rev-list', '--count', '@{u}..HEAD').trim();
  const behind = git('rev-list', '--count', 'HEAD..@{u}').trim();
  if (ahead !== '0') fail(`${ahead} commit(s) are not pushed yet. Run: git push origin ${branch}`);
  else ok('everything is pushed to the remote');
  if (behind !== '0') console.log(`  info  the remote has ${behind} commit(s) you do not have locally (git pull)`);
} catch {
  console.log('  info  could not compare with the remote (no upstream configured or offline)');
}

// ---------------------------------------------------------------- result
console.log(problems ? `\n${problems} problem(s) found. Fix them before deploying.` : '\nAll checks passed. Safe to deploy.');
process.exit(problems ? 1 : 0);
