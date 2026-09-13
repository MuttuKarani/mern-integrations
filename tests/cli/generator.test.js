import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { generateScaffold } from '../../bin/generator.js';

describe('CLI Scaffolding Generator (bin/generator.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mern-cli-gen-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('scaffolds complete Express architecture with controllers, routes, and config', () => {
    const result = generateScaffold({
      framework: 'express',
      payments: ['phonepe'],
      email: 'resend',
      sms: 'twilio',
      storage: 'cloudinary',
      middlewares: ['idempotency', 'webhook-normalizer'],
      targetDir: './src/integrations',
      cwd: tempDir
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);

    // Verify files created on disk
    const configPath = path.join(tempDir, 'src/integrations/config.js');
    const routesPath = path.join(tempDir, 'src/integrations/routes.js');
    const paymentCtrlPath = path.join(tempDir, 'src/integrations/controllers/payment.controller.js');
    const emailCtrlPath = path.join(tempDir, 'src/integrations/controllers/email.controller.js');
    const smsCtrlPath = path.join(tempDir, 'src/integrations/controllers/sms.controller.js');
    const storageCtrlPath = path.join(tempDir, 'src/integrations/controllers/storage.controller.js');
    const webhookCtrlPath = path.join(tempDir, 'src/integrations/controllers/webhook.controller.js');
    const envPath = path.join(tempDir, '.env.example');

    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(routesPath)).toBe(true);
    expect(fs.existsSync(paymentCtrlPath)).toBe(true);
    expect(fs.existsSync(emailCtrlPath)).toBe(true);
    expect(fs.existsSync(smsCtrlPath)).toBe(true);
    expect(fs.existsSync(storageCtrlPath)).toBe(true);
    expect(fs.existsSync(webhookCtrlPath)).toBe(true);
    expect(fs.existsSync(envPath)).toBe(true);

    // Verify contents of config.js
    const configContent = fs.readFileSync(configPath, 'utf8');
    expect(configContent).toContain("from 'mern-integrations'");
    expect(configContent).toContain('createPaymentProvider');
    expect(configContent).toContain('createEmailProvider');
    expect(configContent).toContain('createSMSProvider');
    expect(configContent).toContain('createStorageProvider');
    expect(configContent).toContain('InMemoryIdempotencyStore');
    expect(configContent).toContain("provider: 'phonepe'");
    expect(configContent).toContain("provider: 'resend'");
    expect(configContent).toContain("provider: 'twilio'");
    expect(configContent).toContain("provider: 'cloudinary'");

    // Verify routes.js has idempotency & rawBody middleware wiring
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    expect(routesContent).toContain('idempotencyMiddleware({ store: idempotencyStore })');
    expect(routesContent).toContain('rawBodyMiddleware()');
    expect(routesContent).toContain('createWebhookNormalizer');

    // Verify .env.example contains provider keys
    const envContent = fs.readFileSync(envPath, 'utf8');
    expect(envContent).toContain('PHONEPE_MERCHANT_ID');
    expect(envContent).toContain('RESEND_API_KEY');
    expect(envContent).toContain('TWILIO_ACCOUNT_SID');
    expect(envContent).toContain('CLOUDINARY_CLOUD_NAME');
  });

  it('scaffolds Next.js App Router route handlers', () => {
    const result = generateScaffold({
      framework: 'next',
      payments: ['phonepe'],
      middlewares: ['webhook-normalizer'],
      targetDir: './app/api/integrations',
      cwd: tempDir
    });

    expect(result.success).toBe(true);

    const configPath = path.join(tempDir, 'app/api/integrations/config.js');
    const paymentRoutePath = path.join(tempDir, 'app/api/integrations/payments/route.js');
    const webhookRoutePath = path.join(tempDir, 'app/api/integrations/webhooks/route.js');

    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(paymentRoutePath)).toBe(true);
    expect(fs.existsSync(webhookRoutePath)).toBe(true);

    const paymentContent = fs.readFileSync(paymentRoutePath, 'utf8');
    expect(paymentContent).toContain("import { NextResponse } from 'next/server'");
    expect(paymentContent).toContain('createOrder');

    const webhookContent = fs.readFileSync(webhookRoutePath, 'utf8');
    expect(webhookContent).toContain('normalizeWebhookEvent');
  });

  it('respects dryRun flag and does NOT write files to disk', () => {
    const targetDir = path.join(tempDir, 'dry-run-target');

    const result = generateScaffold({
      framework: 'express',
      payments: ['phonepe'],
      targetDir,
      cwd: tempDir,
      dryRun: true
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  it('cleanly appends to an existing .env.example without duplicating', () => {
    const envPath = path.join(tempDir, '.env.example');
    fs.writeFileSync(envPath, 'PORT=5000\nNODE_ENV=development\n', 'utf8');

    generateScaffold({
      framework: 'express',
      payments: ['phonepe'],
      cwd: tempDir
    });

    const envContent = fs.readFileSync(envPath, 'utf8');
    expect(envContent).toContain('PORT=5000');
    expect(envContent).toContain('PHONEPE_MERCHANT_ID');

    // Second run should skip duplicate appending
    generateScaffold({
      framework: 'express',
      payments: ['phonepe'],
      cwd: tempDir
    });

    const matches = envContent.match(/PHONEPE_MERCHANT_ID/g);
    expect(matches.length).toBe(1);
  });
});
