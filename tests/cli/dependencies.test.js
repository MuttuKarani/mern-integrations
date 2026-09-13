import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  PROVIDER_DEPENDENCIES,
  getRequiredDependencies,
  isPackageInstalled,
  detectPackageManager,
  getInstallCommand,
  installDependencies
} from '../../bin/dependencies.js';

describe('CLI Dependencies Resolver (bin/dependencies.js)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mern-cli-deps-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('PROVIDER_DEPENDENCIES Map', () => {
    it('accurately lists zero-dependency providers with empty arrays', () => {
      expect(PROVIDER_DEPENDENCIES.phonepe).toEqual([]);
      expect(PROVIDER_DEPENDENCIES.ccavenue).toEqual([]);
      expect(PROVIDER_DEPENDENCIES.twilio).toEqual([]);
      expect(PROVIDER_DEPENDENCIES.msg91).toEqual([]);
      expect(PROVIDER_DEPENDENCIES.messagebird).toEqual([]);
    });

    it('accurately lists providers requiring external SDKs', () => {
      expect(PROVIDER_DEPENDENCIES.razorpay).toEqual(['razorpay']);
      expect(PROVIDER_DEPENDENCIES.stripe).toEqual(['stripe']);
      expect(PROVIDER_DEPENDENCIES.resend).toEqual(['resend']);
      expect(PROVIDER_DEPENDENCIES.nodemailer).toEqual(['nodemailer']);
      expect(PROVIDER_DEPENDENCIES.ses).toEqual(['@aws-sdk/client-ses']);
      expect(PROVIDER_DEPENDENCIES.cloudinary).toEqual(['cloudinary']);
      expect(PROVIDER_DEPENDENCIES.s3).toEqual([
        '@aws-sdk/client-s3',
        '@aws-sdk/lib-storage',
        '@aws-sdk/s3-request-presigner'
      ]);
    });
  });

  describe('getRequiredDependencies()', () => {
    it('returns only core package when zero-SDK providers selected', () => {
      const deps = getRequiredDependencies(
        {
          payments: ['phonepe'],
          sms: 'twilio'
        },
        tempDir
      );

      expect(deps).toEqual(['mern-integrations']);
    });

    it('returns core package plus required SDKs for selected providers', () => {
      const deps = getRequiredDependencies(
        {
          payments: ['razorpay'],
          email: 'resend',
          storage: 'cloudinary'
        },
        tempDir
      );

      expect(deps).toEqual(['cloudinary', 'mern-integrations', 'razorpay', 'resend']);
    });

    it('handles multiple payments and S3 multi-package requirements', () => {
      const deps = getRequiredDependencies(
        {
          payments: ['stripe', 'phonepe'],
          storage: 's3'
        },
        tempDir
      );

      expect(deps).toContain('@aws-sdk/client-s3');
      expect(deps).toContain('@aws-sdk/lib-storage');
      expect(deps).toContain('@aws-sdk/s3-request-presigner');
      expect(deps).toContain('stripe');
      expect(deps).toContain('mern-integrations');
    });

    it('omits core package if already installed in project package.json', () => {
      const pkgJson = {
        name: 'test-app',
        dependencies: {
          'mern-integrations': '^1.0.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

      const deps = getRequiredDependencies(
        {
          payments: ['phonepe'],
          sms: 'twilio'
        },
        tempDir
      );

      expect(deps).toEqual([]);
    });
  });

  describe('isPackageInstalled()', () => {
    it('returns false when package.json does not exist', () => {
      expect(isPackageInstalled('resend', tempDir)).toBe(false);
    });

    it('returns true when package is in dependencies, devDependencies, or peerDependencies', () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: { resend: '^3.0.0' },
          devDependencies: { jest: '^29.0.0' },
          peerDependencies: { react: '^18.0.0' }
        })
      );

      expect(isPackageInstalled('resend', tempDir)).toBe(true);
      expect(isPackageInstalled('jest', tempDir)).toBe(true);
      expect(isPackageInstalled('react', tempDir)).toBe(true);
      expect(isPackageInstalled('stripe', tempDir)).toBe(false);
    });
  });

  describe('detectPackageManager()', () => {
    it('defaults to npm if no lockfile present', () => {
      expect(detectPackageManager(tempDir)).toBe('npm');
    });

    it('detects pnpm via pnpm-lock.yaml', () => {
      fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      expect(detectPackageManager(tempDir)).toBe('pnpm');
    });

    it('detects yarn via yarn.lock', () => {
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');
      expect(detectPackageManager(tempDir)).toBe('yarn');
    });

    it('detects bun via bun.lockb', () => {
      fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');
      expect(detectPackageManager(tempDir)).toBe('bun');
    });

    it('detects npm via package-lock.json', () => {
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '');
      expect(detectPackageManager(tempDir)).toBe('npm');
    });
  });

  describe('getInstallCommand()', () => {
    it('returns empty string if packages list is empty', () => {
      expect(getInstallCommand([], { pm: 'npm' })).toBe('');
    });

    it('formats command properly for npm, pnpm, yarn, and bun', () => {
      const pkgs = ['resend', 'cloudinary'];
      expect(getInstallCommand(pkgs, { pm: 'npm' })).toBe('npm install resend cloudinary');
      expect(getInstallCommand(pkgs, { pm: 'pnpm' })).toBe('pnpm add resend cloudinary');
      expect(getInstallCommand(pkgs, { pm: 'yarn' })).toBe('yarn add resend cloudinary');
      expect(getInstallCommand(pkgs, { pm: 'bun' })).toBe('bun add resend cloudinary');
    });
  });

  describe('installDependencies()', () => {
    it('returns skipped when package list is empty', () => {
      const result = installDependencies([], { cwd: tempDir });
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('returns dryRun result without executing command', () => {
      const result = installDependencies(['resend'], {
        cwd: tempDir,
        pm: 'npm',
        dryRun: true
      });
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.command).toBe('npm install resend');
    });
  });
});
