/**
 * Dependency Calculator & Package Manager Resolver for mern-integrations CLI
 * Zero-dependency peer dependency resolution for Node.js >= 18.0.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Provider-to-peer-dependency mapping.
 * Empty array indicates zero external SDK dependencies (native REST/crypto).
 */
export const PROVIDER_DEPENDENCIES = {
  // Payments
  phonepe: [],
  ccavenue: [],
  razorpay: ['razorpay'],
  stripe: ['stripe'],

  // Email
  resend: ['resend'],
  nodemailer: ['nodemailer'],
  ses: ['@aws-sdk/client-ses'],

  // SMS
  twilio: [],
  msg91: [],
  messagebird: [],

  // Storage
  cloudinary: ['cloudinary'],
  s3: [
    '@aws-sdk/client-s3',
    '@aws-sdk/lib-storage',
    '@aws-sdk/s3-request-presigner'
  ]
};

/**
 * Calculates all required npm packages for a given integration configuration.
 * @param {object} options
 * @param {string[]} [options.payments]
 * @param {string} [options.email]
 * @param {string} [options.sms]
 * @param {string} [options.storage]
 * @param {string} [options.cwd=process.cwd()]
 * @returns {string[]} Deduplicated list of packages to install
 */
export function getRequiredDependencies(options = {}, cwd = process.cwd()) {
  const packages = new Set();

  // 1. Core package if not already present in package.json
  const hasCorePackage = isPackageInstalled('mern-integrations', cwd);
  if (!hasCorePackage) {
    packages.add('mern-integrations');
  }

  // 2. Payments
  const payments = Array.isArray(options.payments) ? options.payments : [];
  for (const provider of payments) {
    const deps = PROVIDER_DEPENDENCIES[provider?.toLowerCase()] || [];
    deps.forEach((pkg) => packages.add(pkg));
  }

  // 3. Email
  if (options.email) {
    const deps = PROVIDER_DEPENDENCIES[options.email.toLowerCase()] || [];
    deps.forEach((pkg) => packages.add(pkg));
  }

  // 4. SMS
  if (options.sms) {
    const deps = PROVIDER_DEPENDENCIES[options.sms.toLowerCase()] || [];
    deps.forEach((pkg) => packages.add(pkg));
  }

  // 5. Storage
  if (options.storage) {
    const deps = PROVIDER_DEPENDENCIES[options.storage.toLowerCase()] || [];
    deps.forEach((pkg) => packages.add(pkg));
  }

  return Array.from(packages).sort();
}

/**
 * Checks if a package is listed in dependencies or devDependencies of package.json in cwd.
 * @param {string} packageName
 * @param {string} cwd
 * @returns {boolean}
 */
export function isPackageInstalled(packageName, cwd = process.cwd()) {
  try {
    const pkgJsonPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies
    };
    return Boolean(allDeps[packageName]);
  } catch {
    return false;
  }
}

/**
 * Detects the package manager used in the target project.
 * @param {string} cwd
 * @returns {'npm' | 'pnpm' | 'yarn' | 'bun'}
 */
export function detectPackageManager(cwd = process.cwd()) {
  try {
    if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) return 'bun';
    if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
  } catch {
    // fallback to npm
  }
  return 'npm';
}

/**
 * Constructs the shell command to install packages using the chosen package manager.
 * @param {string[]} packages
 * @param {object} [options]
 * @param {string} [options.pm='npm']
 * @returns {string}
 */
export function getInstallCommand(packages = [], options = {}) {
  if (!packages || packages.length === 0) return '';
  const pm = options.pm || 'npm';
  const pkgList = packages.join(' ');

  switch (pm) {
    case 'pnpm':
      return `pnpm add ${pkgList}`;
    case 'yarn':
      return `yarn add ${pkgList}`;
    case 'bun':
      return `bun add ${pkgList}`;
    case 'npm':
    default:
      return `npm install ${pkgList}`;
  }
}

/**
 * Runs the install command.
 * @param {string[]} packages
 * @param {object} [options]
 * @param {string} [options.pm]
 * @param {string} [options.cwd]
 * @param {boolean} [options.dryRun]
 * @param {function} [options.logger]
 * @returns {{ success: boolean, command: string, error?: string }}
 */
export function installDependencies(packages = [], options = {}) {
  const pm = options.pm === 'auto' || !options.pm ? detectPackageManager(options.cwd) : options.pm;
  const command = getInstallCommand(packages, { pm });

  if (!command) {
    return { success: true, command: '', skipped: true };
  }

  if (options.dryRun) {
    return { success: true, command, dryRun: true };
  }

  const log = options.logger || console.log;
  log(`\n\x1b[36mRunning:\x1b[0m ${command}\n`);

  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  const result = spawnSync(cmd, args, {
    cwd: options.cwd || process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  if (result.status !== 0) {
    return {
      success: false,
      command,
      error: `Command failed with exit code ${result.status}`
    };
  }

  return { success: true, command };
}
