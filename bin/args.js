/**
 * CLI Argument Parser for mern-integrations
 * Zero-dependency argument parsing for Node.js >= 18.0.0
 */

const PKG_VERSION = '1.0.0';

/**
 * Parses raw command-line arguments (process.argv.slice(2)).
 * @param {string[]} rawArgs
 * @returns {object} Parsed options and command
 */
export function parseArgs(rawArgs = []) {
  const result = {
    command: 'init', // default command
    framework: 'express',
    payments: [],
    email: null,
    sms: null,
    storage: null,
    middlewares: [],
    targetDir: './src/integrations',
    install: null, // null means prompt, true/false means explicit
    packageManager: 'auto',
    yes: false,
    dryRun: false,
    help: false,
    version: false,
    unknown: []
  };

  const args = [...rawArgs];

  // Check first positional argument for command
  if (args.length > 0 && !args[0].startsWith('-')) {
    const cmd = args.shift().toLowerCase();
    if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
      result.help = true;
      result.command = 'help';
      return result;
    }
    if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
      result.version = true;
      result.command = 'version';
      return result;
    }
    result.command = cmd;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--install') {
      result.install = true;
    } else if (arg === '--no-install') {
      result.install = false;
    } else if (arg === '--framework' || arg === '-f') {
      result.framework = (args[++i] || 'express').toLowerCase();
    } else if (arg.startsWith('--framework=')) {
      result.framework = arg.split('=')[1].toLowerCase();
    } else if (arg === '--payments' || arg === '-p') {
      const val = args[++i] || '';
      result.payments = parseList(val);
    } else if (arg.startsWith('--payments=')) {
      result.payments = parseList(arg.split('=')[1]);
    } else if (arg === '--email' || arg === '-e') {
      result.email = (args[++i] || '').toLowerCase();
    } else if (arg.startsWith('--email=')) {
      result.email = arg.split('=')[1].toLowerCase();
    } else if (arg === '--sms' || arg === '-s') {
      result.sms = (args[++i] || '').toLowerCase();
    } else if (arg.startsWith('--sms=')) {
      result.sms = arg.split('=')[1].toLowerCase();
    } else if (arg === '--storage' || arg === '-st') {
      result.storage = (args[++i] || '').toLowerCase();
    } else if (arg.startsWith('--storage=')) {
      result.storage = arg.split('=')[1].toLowerCase();
    } else if (arg === '--middlewares' || arg === '-m') {
      const val = args[++i] || '';
      result.middlewares = parseList(val);
    } else if (arg.startsWith('--middlewares=')) {
      result.middlewares = parseList(arg.split('=')[1]);
    } else if (arg === '--target-dir' || arg === '-d') {
      result.targetDir = args[++i] || './src/integrations';
    } else if (arg.startsWith('--target-dir=')) {
      result.targetDir = arg.split('=')[1] || './src/integrations';
    } else if (arg === '--package-manager' || arg === '--pm') {
      result.packageManager = (args[++i] || 'auto').toLowerCase();
    } else if (arg.startsWith('--package-manager=') || arg.startsWith('--pm=')) {
      result.packageManager = arg.split('=')[1].toLowerCase();
    } else if (!arg.startsWith('-') && !result.targetDirSpecified) {
      // Positional target directory if provided
      result.targetDir = arg;
      result.targetDirSpecified = true;
    } else {
      result.unknown.push(arg);
    }
  }

  // Sanitize 'none' selections
  if (result.payments.includes('none')) result.payments = [];
  if (result.email === 'none') result.email = null;
  if (result.sms === 'none') result.sms = null;
  if (result.storage === 'none') result.storage = null;
  if (result.middlewares.includes('none')) result.middlewares = [];

  return result;
}

/**
 * Splits comma-separated values and trims whitespace.
 * @param {string} str
 * @returns {string[]}
 */
function parseList(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns formatted CLI help text.
 * @returns {string}
 */
export function getHelpText() {
  return `
mern-integrations CLI v${PKG_VERSION}
Interactive Scaffolder & Setup Tool for MERN and Node.js Integrations

USAGE:
  $ npx mern-integrations [command] [options]
  $ mern-integrations init [targetDir] [options]

COMMANDS:
  init [targetDir]      Scaffold integrations interactively (default command)
  help                  Display help information
  version               Display package version

OPTIONS:
  -f,  --framework <name>     Target framework: express (default) or next
  -p,  --payments <list>      Payment provider(s): cashfree, phonepe, razorpay, stripe, ccavenue, none
  -e,  --email <provider>     Email provider: resend, nodemailer, ses, none
  -s,  --sms <provider>       SMS/OTP provider: twilio, msg91, messagebird, none
  -st, --storage <provider>   Storage provider: cloudinary, s3, none
  -m,  --middlewares <list>   Middlewares: idempotency, webhook-normalizer, none
  -d,  --target-dir <path>    Target directory (default: ./src/integrations)
       --install              Automatically install peer dependencies
       --no-install           Skip dependency installation
       --pm <manager>         Package manager: npm, pnpm, yarn, bun, auto
  -y,  --yes                  Accept defaults non-interactively
       --dry-run              Preview generated files without writing to disk
  -h,  --help                 Show help information
  -v,  --version              Show version number

EXAMPLES:
  # Interactive wizard (recommended):
  $ npx mern-integrations init

  # Non-interactive scaffolding:
  $ npx mern-integrations init --payments phonepe --email resend --sms twilio --yes

  # Dry-run preview:
  $ npx mern-integrations init --payments razorpay --storage cloudinary --dry-run
`;
}

/**
 * Returns formatted version string.
 * @returns {string}
 */
export function getVersionText() {
  return `mern-integrations v${PKG_VERSION}`;
}
