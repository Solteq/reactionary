import { zod2md } from 'zod2md';
import { writeFileSync } from 'fs';
import * as td from 'typedoc';
import type { TypeDocOptions } from 'typedoc';
import type { PluginOptions as MarkdownPluginOptions } from 'typedoc-plugin-markdown';
import fs from 'fs/promises';
import path from 'path';

type TypedocWithMarkdownOptions = TypeDocOptions & MarkdownPluginOptions;

const projects = [
  {
    entry: 'core/src/schemas/index.ts',
    title: 'Schemas',
    output: 'documentation/docs/schemas/schemas.md',
  },
];

async function main() {
  for (const project of projects) {
    const markdown = await zod2md({
      entry: project.entry,
      title: `${project.title} Schemas`,
      tsconfig: './core/tsconfig.lib.json',
    });
    writeFileSync(project.output, markdown);
  }

  const typedocConfig = {
    entryPoints: ['core/src/providers/*.provider.ts'],
    tsconfig: 'core/tsconfig.lib.json',
    plugin: ['typedoc-plugin-markdown'],
    out: 'documentation/docs/providers',
    outputFileStrategy: 'modules',
    categorizeByGroup: true,
    readme: 'none',
    membersWithOwnFile: [],
    modulesFileName: undefined,
  } satisfies TypedocWithMarkdownOptions;
  const app = await td.Application.bootstrapWithPlugins(typedocConfig);

  const project = await app.convert();
  if (project) {
    await app.generateOutputs(project);

    await fs.rm(path.join('documentation/docs/providers', 'README.md'), {
      force: true,
    });
  }
}

main();
