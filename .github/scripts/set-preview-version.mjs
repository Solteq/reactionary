// Stamps a preview version onto the built package manifests in dist/packages.
//
// `nx release version` cannot be used here: nx rejects the standalone
// subcommand while `release.git` is set in nx.json, and that setting is needed
// by the real release. The built manifests carry the placeholder version
// 0.0.1, with internal dependencies pinned to it, so both are rewritten.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [version] = process.argv.slice(2);
if (!version) {
  console.error('usage: set-preview-version.mjs <version>');
  process.exit(1);
}

const distDir = 'dist/packages';
const manifests = readdirSync(distDir).map((dir) => join(distDir, dir, 'package.json'));
const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

for (const path of manifests) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.version = version;
  for (const field of dependencyFields) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (name.startsWith('@reactionary/')) {
        manifest[field][name] = version;
      }
    }
  }
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${manifest.name}@${version}`);
}
