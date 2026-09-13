/**
 * Interactive Terminal Wizard for mern-integrations CLI
 * Zero-dependency readline interface for Node.js >= 18.0.0
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ANSI terminal colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

/**
 * Runs the interactive CLI questionnaire.
 * @param {object} initialOptions Existing options or CLI flag overrides
 * @returns {Promise<object>} Complete options object
 */
export async function runWizard(initialOptions = {}) {
  const rl = readline.createInterface({ input, output });

  try {
    console.log(`
${c.cyan}┌─────────────────────────────────────────────────────────────┐${c.reset}
${c.cyan}│${c.reset}   ${c.bold}mern-integrations setup wizard${c.reset}                            ${c.cyan}│${c.reset}
${c.cyan}│${c.reset}   ${c.dim}Interactive Scaffolder for MERN & Node.js Integrations${c.reset}    ${c.cyan}│${c.reset}
${c.cyan}└─────────────────────────────────────────────────────────────┘${c.reset}
`);

    const result = { ...initialOptions };

    // 1. Framework selection
    if (!initialOptions.frameworkSpecified) {
      console.log(`${c.bold}? Select your application framework:${c.reset}`);
      console.log(`  ${c.green}1)${c.reset} Express.js (Standard MERN backend) ${c.dim}[default]${c.reset}`);
      console.log(`  ${c.green}2)${c.reset} Next.js (App Router)`);
      const ans = (await rl.question(`${c.cyan}Enter number (1-2) [1]: ${c.reset}`)).trim();
      result.framework = ans === '2' ? 'next' : 'express';
      console.log(`${c.green}✔ Selected framework:${c.reset} ${result.framework}\n`);
    }

    // 2. Payments selection
    if (!initialOptions.paymentsSpecified) {
      console.log(`${c.bold}? Which payment provider(s) do you need?${c.reset} ${c.dim}(comma-separated numbers)${c.reset}`);
      console.log(`  ${c.green}1)${c.reset} PhonePe (UPI, QR & Standard Checkout)`);
      console.log(`  ${c.green}2)${c.reset} Razorpay (Cards, Netbanking, UPI)`);
      console.log(`  ${c.green}3)${c.reset} Stripe (Global Cards & Elements)`);
      console.log(`  ${c.green}4)${c.reset} CCAvenue (Indian Gateway & Netbanking)`);
      console.log(`  ${c.green}5)${c.reset} None / Skip`);
      const ans = (await rl.question(`${c.cyan}Enter numbers (e.g. 1,2) [1]: ${c.reset}`)).trim() || '1';

      const map = { '1': 'phonepe', '2': 'razorpay', '3': 'stripe', '4': 'ccavenue', '5': 'none' };
      const selected = ans
        .split(',')
        .map((k) => map[k.trim()] || k.trim().toLowerCase())
        .filter((k) => k && k !== 'none');

      result.payments = Array.from(new Set(selected));
      console.log(`${c.green}✔ Payments:${c.reset} ${result.payments.length ? result.payments.join(', ') : 'None'}\n`);
    }

    // 3. Email selection
    if (!initialOptions.emailSpecified) {
      console.log(`${c.bold}? Which email provider do you need?${c.reset}`);
      console.log(`  ${c.green}1)${c.reset} Resend (Modern developer-first email) ${c.dim}[default]${c.reset}`);
      console.log(`  ${c.green}2)${c.reset} Nodemailer (Self-hosted SMTP)`);
      console.log(`  ${c.green}3)${c.reset} Amazon SES (AWS SES v3)`);
      console.log(`  ${c.green}4)${c.reset} None / Skip`);
      const ans = (await rl.question(`${c.cyan}Enter number (1-4) [1]: ${c.reset}`)).trim() || '1';

      const map = { '1': 'resend', '2': 'nodemailer', '3': 'ses', '4': null };
      result.email = map[ans] !== undefined ? map[ans] : null;
      console.log(`${c.green}✔ Email:${c.reset} ${result.email || 'None'}\n`);
    }

    // 4. SMS selection
    if (!initialOptions.smsSpecified) {
      console.log(`${c.bold}? Which SMS / OTP / WhatsApp provider do you need?${c.reset}`);
      console.log(`  ${c.green}1)${c.reset} Twilio (Global SMS, WhatsApp & Verify OTP) ${c.dim}[default]${c.reset}`);
      console.log(`  ${c.green}2)${c.reset} MSG91 (Indian DLT SMS & Flow OTP)`);
      console.log(`  ${c.green}3)${c.reset} MessageBird (Global SMS & WhatsApp)`);
      console.log(`  ${c.green}4)${c.reset} None / Skip`);
      const ans = (await rl.question(`${c.cyan}Enter number (1-4) [1]: ${c.reset}`)).trim() || '1';

      const map = { '1': 'twilio', '2': 'msg91', '3': 'messagebird', '4': null };
      result.sms = map[ans] !== undefined ? map[ans] : null;
      console.log(`${c.green}✔ SMS:${c.reset} ${result.sms || 'None'}\n`);
    }

    // 5. Storage selection
    if (!initialOptions.storageSpecified) {
      console.log(`${c.bold}? Which cloud storage provider do you need?${c.reset}`);
      console.log(`  ${c.green}1)${c.reset} Cloudinary (Images & Media optimization) ${c.dim}[default]${c.reset}`);
      console.log(`  ${c.green}2)${c.reset} AWS S3 (Scalable Object Storage)`);
      console.log(`  ${c.green}3)${c.reset} None / Skip`);
      const ans = (await rl.question(`${c.cyan}Enter number (1-3) [1]: ${c.reset}`)).trim() || '1';

      const map = { '1': 'cloudinary', '2': 's3', '3': null };
      result.storage = map[ans] !== undefined ? map[ans] : null;
      console.log(`${c.green}✔ Storage:${c.reset} ${result.storage || 'None'}\n`);
    }

    // 6. Middlewares
    if (!initialOptions.middlewaresSpecified) {
      console.log(`${c.bold}? Enable Enterprise Middlewares?${c.reset} ${c.dim}(comma-separated)${c.reset}`);
      console.log(`  ${c.green}1)${c.reset} Both (Idempotency Key + Unified Webhook Normalizer) ${c.dim}[default]${c.reset}`);
      console.log(`  ${c.green}2)${c.reset} Idempotency Key Middleware only`);
      console.log(`  ${c.green}3)${c.reset} Unified Webhook Normalizer only`);
      console.log(`  ${c.green}4)${c.reset} None`);
      const ans = (await rl.question(`${c.cyan}Enter number (1-4) [1]: ${c.reset}`)).trim() || '1';

      if (ans === '2') {
        result.middlewares = ['idempotency'];
      } else if (ans === '3') {
        result.middlewares = ['webhook-normalizer'];
      } else if (ans === '4') {
        result.middlewares = [];
      } else {
        result.middlewares = ['idempotency', 'webhook-normalizer'];
      }
      console.log(`${c.green}✔ Middlewares:${c.reset} ${result.middlewares.length ? result.middlewares.join(', ') : 'None'}\n`);
    }

    // 7. Target directory
    if (!initialOptions.targetDirSpecified) {
      const defaultDir = result.framework === 'next' ? './app/api/integrations' : './src/integrations';
      const ans = (await rl.question(`${c.bold}? Target directory [${defaultDir}]:${c.reset} `)).trim();
      result.targetDir = ans || defaultDir;
      console.log(`${c.green}✔ Target directory:${c.reset} ${result.targetDir}\n`);
    }

    // 8. Auto install dependencies
    if (result.install === null) {
      const ans = (await rl.question(`${c.bold}? Install required peer dependencies automatically? (Y/n) [Y]:${c.reset} `)).trim().toLowerCase();
      result.install = ans === '' || ans === 'y' || ans === 'yes';
      console.log(`${c.green}✔ Auto install:${c.reset} ${result.install ? 'Yes' : 'No'}\n`);
    }

    return result;
  } finally {
    rl.close();
  }
}
