#!/usr/bin/env node

/**
 * mern-integrations CLI
 * Interactive setup & scaffolding tool for MERN and Node.js integrations
 */

import { parseArgs, getHelpText, getVersionText } from './args.js';
import { runWizard } from './wizard.js';
import { generateScaffold } from './generator.js';
import {
  getRequiredDependencies,
  detectPackageManager,
  installDependencies
} from './dependencies.js';

// ANSI terminal colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

export async function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(getHelpText());
    return 0;
  }

  if (parsed.version) {
    console.log(getVersionText());
    return 0;
  }

  if (parsed.command !== 'init') {
    console.error(`${c.red}Unknown command: "${parsed.command}".${c.reset}`);
    console.log(getHelpText());
    return 1;
  }

  try {
    let options = { ...parsed, cwd };

    // Run interactive wizard if not in non-interactive mode (--yes)
    if (!parsed.yes) {
      options = await runWizard(options);
    } else {
      // In non-interactive mode, default install to false unless explicitly specified
      if (options.install === null) {
        options.install = false;
      }
    }

    console.log(`\n${c.bold}⚙ Generating integration scaffold...${c.reset}`);
    const scaffoldResult = generateScaffold(options);

    console.log(`\n${c.green}✔ Successfully generated files:${c.reset}`);
    for (const file of scaffoldResult.files) {
      const tag = file.action === 'appended' ? `${c.yellow}[appended]${c.reset}` : `${c.green}[created]${c.reset}`;
      console.log(`  ${tag} ${file.relativePath}`);
    }

    // Dependency calculation
    const requiredDeps = getRequiredDependencies(options, cwd);
    const pm = options.packageManager === 'auto' ? detectPackageManager(cwd) : options.packageManager;

    if (requiredDeps.length > 0) {
      console.log(`\n${c.bold}📦 Peer dependencies for chosen providers:${c.reset}`);
      requiredDeps.forEach((dep) => console.log(`   - ${c.cyan}${dep}${c.reset}`));

      if (options.install) {
        console.log(`\n${c.bold}⚙ Installing packages using ${pm}...${c.reset}`);
        const installResult = installDependencies(requiredDeps, {
          cwd,
          pm,
          dryRun: options.dryRun
        });

        if (installResult.success) {
          console.log(`${c.green}✔ Dependencies successfully installed!${c.reset}`);
        } else {
          console.error(`${c.red}✖ Failed to install dependencies:${c.reset} ${installResult.error}`);
          console.log(`Please run manually: ${c.cyan}${installResult.command}${c.reset}`);
        }
      } else {
        const installCmd = pm === 'pnpm' ? `pnpm add ${requiredDeps.join(' ')}` :
                           pm === 'yarn' ? `yarn add ${requiredDeps.join(' ')}` :
                           pm === 'bun' ? `bun add ${requiredDeps.join(' ')}` :
                           `npm install ${requiredDeps.join(' ')}`;
        console.log(`\nTo install dependencies later, run:`);
        console.log(`  ${c.cyan}${installCmd}${c.reset}`);
      }
    } else {
      console.log(`\n${c.green}✔ Selected providers require zero external SDK dependencies!${c.reset}`);
    }

    // Print summary instructions
    printSummary(options);
    return 0;
  } catch (error) {
    console.error(`\n${c.red}Error executing mern-integrations CLI:${c.reset}`, error.message || error);
    return 1;
  }
}

function printSummary(options) {
  const isExpress = (options.framework || 'express') === 'express';
  const routesPath = options.targetDir ? `${options.targetDir}/routes.js` : './src/integrations/routes.js';

  console.log(`
${c.cyan}┌─────────────────────────────────────────────────────────────┐${c.reset}
${c.cyan}│${c.reset}   ${c.bold}Integration setup complete! ✨${c.reset}                             ${c.cyan}│${c.reset}
${c.cyan}└─────────────────────────────────────────────────────────────┘${c.reset}

${c.bold}Next steps:${c.reset}
1. Open ${c.cyan}.env${c.reset} (or ${c.cyan}.env.example${c.reset}) and fill in your provider API keys.
`);

  if (isExpress) {
    console.log(`2. Mount the router in your Express app (e.g. src/app.js or src/server.js):
   ${c.dim}import integrationRouter from '${routesPath}';${c.reset}
   ${c.cyan}app.use('/api/integrations', integrationRouter);${c.reset}
`);
  } else {
    console.log(`2. Next.js App Router handlers have been generated in:
   ${c.cyan}${options.targetDir}${c.reset}
`);
  }

  console.log(`3. Run your dev server and verify endpoints!
`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Auto-execute when run directly as CLI binary
if (process.argv[1]) {
  try {
    const executedPath = path.resolve(process.argv[1]);
    const scriptPath = fileURLToPath(import.meta.url);
    if (executedPath === scriptPath) {
      main().then((code) => {
        if (code !== 0) process.exit(code);
      });
    }
  } catch {
    // ignore
  }
}

