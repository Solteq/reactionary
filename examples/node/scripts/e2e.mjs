#!/usr/bin/env node
// Runs the live capability specs of examples/node against the real backends in .env, for the providers that can be reached.
//   pnpm --dir examples/node e2e                                  every spec, every reachable provider
//   pnpm --dir examples/node e2e --provider Algolia,Medusa        only these
//   pnpm --dir examples/node e2e --spec product-search,cart       only spec files whose name contains one of these
//   pnpm --dir examples/node e2e --check                          only say which backends can be reached
//   pnpm --dir examples/node e2e -- --reporter=verbose            everything after -- goes to vitest
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const specDir = join(here, '..', 'src', 'capabilities');
// The .env of the repo root, wherever the script is started from
config({ path: join(repoRoot, '.env'), quiet: true });

const EXIT_BAD_ARGS = 2;
const EXIT_NOTHING_REACHABLE = 3;

const env = process.env;

/** The providers of the specs (the values of PrimaryProvider), where to ask whether they are up, and whether they are in the offline hours. */
const PROVIDERS = {
  Fake: { configured: () => true, url: () => undefined, offlineHours: false },
  Medusa: { configured: () => !!env.MEDUSA_API_URL, url: () => `${env.MEDUSA_API_URL?.replace(/\/$/, '')}/health`, offlineHours: true },
  Algolia: { configured: () => !!env.ALGOLIA_APP_ID, url: () => `https://${env.ALGOLIA_APP_ID}-dsn.algolia.net/1/isalive`, offlineHours: false },
  Meilisearch: { configured: () => !!env.MEILISEARCH_API_URL, url: () => `${env.MEILISEARCH_API_URL?.replace(/\/$/, '')}/health`, offlineHours: true },
  Commercetools: { configured: () => !!env.CTP_API_URL, url: () => env.CTP_API_URL, offlineHours: false },
  Magento: { configured: () => !!env.MAGENTO_BASE_URL, url: () => env.MAGENTO_BASE_URL, offlineHours: false },
  Unomi: { configured: () => !!env.UNOMI_API_URL, url: () => env.UNOMI_API_URL, offlineHours: true },
};

function parseArgs(argv) {
  const args = { providers: undefined, specs: undefined, check: false, rest: [] };
  const split = argv.indexOf('--');
  const own = split === -1 ? argv : argv.slice(0, split);
  args.rest = split === -1 ? [] : argv.slice(split + 1);
  for (let i = 0; i < own.length; i++) {
    if (own[i] === '--provider' || own[i] === '--spec') {
      const names = own[++i]?.split(',').map((name) => name.trim()).filter(Boolean);
      if (!names || names.length === 0) {
        console.error(`${own[i - 1]} needs a value`);
        process.exit(EXIT_BAD_ARGS);
      }
      if (own[i - 1] === '--provider') args.providers = names;
      else args.specs = names;
    } else if (own[i] === '--check') args.check = true;
    else {
      console.error(`Unknown argument: ${own[i]}`);
      process.exit(EXIT_BAD_ARGS);
    }
  }
  return args;
}

/** True in the hours the shared demo backends are switched off: 19:00-07:00 Europe/Copenhagen and the whole weekend. */
function inOfflineHours(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  return weekday === 'Sat' || weekday === 'Sun' || hour >= 19 || hour < 7;
}

/** Whether a backend answers. A firewall that blocks the host (the sandbox) answers 403 with its own text, which is not the backend. */
async function check(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (response.status === 403) {
      const body = await response.text();
      if (/Approval required|Blocked by/i.test(body)) return { up: false, reason: body.trim().split('\n')[0].slice(0, 120) };
    }
    // Any other answer below 500 means the backend is there: a root URL often answers 401 or 404
    return { up: response.status < 500 };
  } catch {
    return { up: false };
  }
}

const args = parseArgs(process.argv.slice(2));
const wanted = args.providers ?? Object.keys(PROVIDERS);
const unknown = wanted.filter((name) => !(name in PROVIDERS));
if (unknown.length > 0) {
  console.error(`Unknown provider: ${unknown.join(', ')}. Known: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(EXIT_BAD_ARGS);
}

const offline = inOfflineHours();
const runnable = [];
for (const name of wanted) {
  const provider = PROVIDERS[name];
  if (!provider.configured()) {
    console.log(`${name.padEnd(14)} not configured in .env, not run`);
  } else if (provider.url() === undefined) {
    console.log(`${name.padEnd(14)} no backend needed`);
    runnable.push(name);
  } else {
    const { up, reason } = await check(provider.url());
    if (up) {
      console.log(`${name.padEnd(14)} reachable`);
      runnable.push(name);
    } else {
      const hint = reason ? ` (${reason})` : provider.offlineHours && offline ? ' (the shared backend is switched off 19:00-07:00 Europe/Copenhagen and at weekends)' : '';
      console.log(`${name.padEnd(14)} NOT reachable, not run${hint}`);
    }
  }
}

if (args.check) process.exit(0);
if (runnable.length === 0) {
  console.error('No provider can be reached, nothing to run.');
  process.exit(EXIT_NOTHING_REACHABLE);
}

const specs = readdirSync(specDir)
  .filter((file) => file.endsWith('.spec.ts'))
  .filter((file) => args.specs === undefined || args.specs.some((part) => file.includes(part)))
  .map((file) => join('src', 'capabilities', file));
if (specs.length === 0) {
  console.error(`No spec file matches ${args.specs?.join(', ')}`);
  process.exit(EXIT_BAD_ARGS);
}

// The specs name the provider in their titles (describe.each over PrimaryProvider), so a name filter picks the providers
const filter = `(${runnable.join('|')})`;
console.log(`\nRunning ${specs.length} spec file(s) for ${runnable.join(', ')}\n`);
const result = spawnSync('npx', ['vitest', 'run', '--root', 'examples/node', '-t', filter, ...specs, ...args.rest], {
  cwd: repoRoot,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
