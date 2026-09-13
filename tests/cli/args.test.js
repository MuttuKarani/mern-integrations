import { parseArgs, getHelpText, getVersionText } from '../../bin/args.js';

describe('CLI Args Parser (bin/args.js)', () => {
  it('returns default options when no arguments provided', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('init');
    expect(result.framework).toBe('express');
    expect(result.payments).toEqual([]);
    expect(result.email).toBeNull();
    expect(result.sms).toBeNull();
    expect(result.storage).toBeNull();
    expect(result.middlewares).toEqual([]);
    expect(result.targetDir).toBe('./src/integrations');
    expect(result.install).toBeNull();
    expect(result.packageManager).toBe('auto');
    expect(result.yes).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it('parses --help, -h, and "help" command', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
    expect(parseArgs(['help']).help).toBe(true);
    expect(parseArgs(['help']).command).toBe('help');
  });

  it('parses --version, -v, and "version" command', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
    expect(parseArgs(['version']).version).toBe(true);
    expect(parseArgs(['version']).command).toBe('version');
  });

  it('parses --framework / -f and --framework=value', () => {
    expect(parseArgs(['init', '--framework', 'next']).framework).toBe('next');
    expect(parseArgs(['init', '-f', 'next']).framework).toBe('next');
    expect(parseArgs(['init', '--framework=next']).framework).toBe('next');
  });

  it('parses --payments / -p with comma-separated list and removes duplicates/none', () => {
    const res1 = parseArgs(['init', '--payments', 'phonepe,razorpay']);
    expect(res1.payments).toEqual(['phonepe', 'razorpay']);

    const res2 = parseArgs(['init', '-p', 'stripe']);
    expect(res2.payments).toEqual(['stripe']);

    const res3 = parseArgs(['init', '--payments=ccavenue']);
    expect(res3.payments).toEqual(['ccavenue']);

    const res4 = parseArgs(['init', '--payments', 'none']);
    expect(res4.payments).toEqual([]);
  });

  it('parses --email / -e and sanitizes "none"', () => {
    expect(parseArgs(['init', '--email', 'resend']).email).toBe('resend');
    expect(parseArgs(['init', '-e', 'nodemailer']).email).toBe('nodemailer');
    expect(parseArgs(['init', '--email=ses']).email).toBe('ses');
    expect(parseArgs(['init', '--email', 'none']).email).toBeNull();
  });

  it('parses --sms / -s and sanitizes "none"', () => {
    expect(parseArgs(['init', '--sms', 'twilio']).sms).toBe('twilio');
    expect(parseArgs(['init', '-s', 'msg91']).sms).toBe('msg91');
    expect(parseArgs(['init', '--sms=messagebird']).sms).toBe('messagebird');
    expect(parseArgs(['init', '--sms', 'none']).sms).toBeNull();
  });

  it('parses --storage / -st and sanitizes "none"', () => {
    expect(parseArgs(['init', '--storage', 'cloudinary']).storage).toBe('cloudinary');
    expect(parseArgs(['init', '-st', 's3']).storage).toBe('s3');
    expect(parseArgs(['init', '--storage=cloudinary']).storage).toBe('cloudinary');
    expect(parseArgs(['init', '--storage', 'none']).storage).toBeNull();
  });

  it('parses --middlewares / -m and sanitizes "none"', () => {
    expect(parseArgs(['init', '--middlewares', 'idempotency,webhook-normalizer']).middlewares).toEqual([
      'idempotency',
      'webhook-normalizer'
    ]);
    expect(parseArgs(['init', '-m', 'idempotency']).middlewares).toEqual(['idempotency']);
    expect(parseArgs(['init', '--middlewares=none']).middlewares).toEqual([]);
  });

  it('parses --target-dir / -d and positional target directory', () => {
    expect(parseArgs(['init', '--target-dir', './custom/path']).targetDir).toBe('./custom/path');
    expect(parseArgs(['init', '-d', './custom/path']).targetDir).toBe('./custom/path');
    expect(parseArgs(['init', '--target-dir=./custom/path']).targetDir).toBe('./custom/path');
    expect(parseArgs(['init', './my-integrations']).targetDir).toBe('./my-integrations');
  });

  it('parses boolean and installation flags', () => {
    expect(parseArgs(['init', '--yes']).yes).toBe(true);
    expect(parseArgs(['init', '-y']).yes).toBe(true);
    expect(parseArgs(['init', '--dry-run']).dryRun).toBe(true);
    expect(parseArgs(['init', '--install']).install).toBe(true);
    expect(parseArgs(['init', '--no-install']).install).toBe(false);
  });

  it('parses --package-manager / --pm', () => {
    expect(parseArgs(['init', '--package-manager', 'pnpm']).packageManager).toBe('pnpm');
    expect(parseArgs(['init', '--pm', 'yarn']).packageManager).toBe('yarn');
    expect(parseArgs(['init', '--pm=bun']).packageManager).toBe('bun');
  });

  it('captures unknown arguments', () => {
    const res = parseArgs(['init', '--some-unknown-flag', 'value']);
    expect(res.unknown).toContain('--some-unknown-flag');
  });

  it('returns valid help and version text strings', () => {
    const help = getHelpText();
    expect(help).toContain('mern-integrations CLI');
    expect(help).toContain('USAGE:');
    expect(help).toContain('--framework');

    const version = getVersionText();
    expect(version).toContain('mern-integrations v1.0.0');
  });
});
