/**
 * Scaffolding Generator Engine for mern-integrations CLI
 * Zero-dependency template generator for Node.js >= 18.0.0
 */

import fs from 'node:fs';
import path from 'node:path';

import { generateEnvTemplate } from './templates/env.js';
import { generateConfigTemplate } from './templates/config.js';
import { generateExpressRoutesTemplate } from './templates/express/routes.js';
import {
  generatePaymentController,
  generateEmailController,
  generateSMSController,
  generateStorageController,
  generateWebhookController
} from './templates/express/controllers.js';
import {
  generateNextPaymentRoute,
  generateNextWebhookRoute
} from './templates/nextjs/route.js';

/**
 * Generates scaffolding files based on user options.
 * @param {object} options
 * @param {string} [options.framework='express'] 'express' | 'next'
 * @param {string[]} [options.payments=[]]
 * @param {string} [options.email]
 * @param {string} [options.sms]
 * @param {string} [options.storage]
 * @param {string[]} [options.middlewares=[]]
 * @param {string} [options.targetDir='./src/integrations']
 * @param {string} [options.cwd=process.cwd()]
 * @param {boolean} [options.dryRun=false]
 * @returns {{ success: boolean, files: Array<{ path: string, relativePath: string, action: string, content: string }> }}
 */
export function generateScaffold(options = {}) {
  const cwd = options.cwd || process.cwd();
  const targetDir = path.resolve(cwd, options.targetDir || './src/integrations');
  const framework = (options.framework || 'express').toLowerCase();
  const dryRun = Boolean(options.dryRun);

  const payments = Array.isArray(options.payments) ? options.payments : [];
  const middlewares = Array.isArray(options.middlewares) ? options.middlewares : [];
  const files = [];

  // 1. Generate config.js
  const configContent = generateConfigTemplate(options);
  files.push({
    path: path.join(targetDir, 'config.js'),
    relativePath: path.relative(cwd, path.join(targetDir, 'config.js')),
    content: configContent,
    action: 'created'
  });

  // 2. Framework-specific files
  if (framework === 'express') {
    // routes.js
    const routesContent = generateExpressRoutesTemplate(options);
    files.push({
      path: path.join(targetDir, 'routes.js'),
      relativePath: path.relative(cwd, path.join(targetDir, 'routes.js')),
      content: routesContent,
      action: 'created'
    });

    const ctrlDir = path.join(targetDir, 'controllers');

    // Payments controller
    if (payments.length > 0) {
      files.push({
        path: path.join(ctrlDir, 'payment.controller.js'),
        relativePath: path.relative(cwd, path.join(ctrlDir, 'payment.controller.js')),
        content: generatePaymentController(options),
        action: 'created'
      });
    }

    // Email controller
    if (options.email) {
      files.push({
        path: path.join(ctrlDir, 'email.controller.js'),
        relativePath: path.relative(cwd, path.join(ctrlDir, 'email.controller.js')),
        content: generateEmailController(options),
        action: 'created'
      });
    }

    // SMS controller
    if (options.sms) {
      files.push({
        path: path.join(ctrlDir, 'sms.controller.js'),
        relativePath: path.relative(cwd, path.join(ctrlDir, 'sms.controller.js')),
        content: generateSMSController(options),
        action: 'created'
      });
    }

    // Storage controller
    if (options.storage) {
      files.push({
        path: path.join(ctrlDir, 'storage.controller.js'),
        relativePath: path.relative(cwd, path.join(ctrlDir, 'storage.controller.js')),
        content: generateStorageController(options),
        action: 'created'
      });
    }

    // Webhook controller
    if (payments.length > 0 && middlewares.includes('webhook-normalizer')) {
      files.push({
        path: path.join(ctrlDir, 'webhook.controller.js'),
        relativePath: path.relative(cwd, path.join(ctrlDir, 'webhook.controller.js')),
        content: generateWebhookController(options),
        action: 'created'
      });
    }
  } else if (framework === 'next') {
    // Next.js App Router endpoints under targetDir (e.g. app/api/integrations)
    if (payments.length > 0) {
      files.push({
        path: path.join(targetDir, 'payments', 'route.js'),
        relativePath: path.relative(cwd, path.join(targetDir, 'payments', 'route.js')),
        content: generateNextPaymentRoute(options),
        action: 'created'
      });
    }

    if (payments.length > 0 && middlewares.includes('webhook-normalizer')) {
      files.push({
        path: path.join(targetDir, 'webhooks', 'route.js'),
        relativePath: path.relative(cwd, path.join(targetDir, 'webhooks', 'route.js')),
        content: generateNextWebhookRoute(options),
        action: 'created'
      });
    }
  }

  // 3. Environment variables (.env.example)
  const envContent = generateEnvTemplate(options);
  const envPath = path.join(cwd, '.env.example');
  let envAction = 'created';
  let finalEnvContent = envContent;

  if (fs.existsSync(envPath)) {
    const existingEnv = fs.readFileSync(envPath, 'utf8');
    if (!existingEnv.includes('mern-integrations Environment Variables')) {
      finalEnvContent = existingEnv.trimEnd() + '\n\n' + envContent;
      envAction = 'appended';
    } else {
      envAction = 'skipped';
    }
  }

  if (envAction !== 'skipped') {
    files.push({
      path: envPath,
      relativePath: '.env.example',
      content: finalEnvContent,
      action: envAction
    });
  }

  // 4. Write to disk if not dryRun
  if (!dryRun) {
    for (const file of files) {
      const dir = path.dirname(file.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file.path, file.content, 'utf8');
    }
  }

  return {
    success: true,
    dryRun,
    targetDir,
    files
  };
}
