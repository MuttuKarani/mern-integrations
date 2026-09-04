import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const consumerRoot = path.resolve(__dirname, '..');

describe('A. Base Installation Verification', () => {
  it('should have zero optional SDKs installed in consumer node_modules during base install', () => {
    const nodeModulesPath = path.join(consumerRoot, 'node_modules');
    const installedPackages = fs.readdirSync(nodeModulesPath);

    const optionalSDKs = [
      'razorpay',
      'stripe',
      'resend',
      'nodemailer',
      'cloudinary',
      '@aws-sdk'
    ];

    for (const sdk of optionalSDKs) {
      assert.equal(
        installedPackages.includes(sdk),
        false,
        `Optional SDK "${sdk}" must not be automatically installed`
      );
    }

    assert.equal(
      installedPackages.includes('mern-integrations'),
      true,
      'mern-integrations must be installed in node_modules'
    );
  });
});
