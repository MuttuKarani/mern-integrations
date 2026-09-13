import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { jest } from '@jest/globals';

import { main } from '../../bin/cli.js';

describe('CLI Main Executable (bin/cli.js)', () => {
  let tempDir;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mern-cli-main-test-'));
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('exits with 0 and prints help when --help passed', async () => {
    const code = await main(['--help'], tempDir);
    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('mern-integrations CLI'));
  });

  it('exits with 0 and prints version when --version passed', async () => {
    const code = await main(['--version'], tempDir);
    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('mern-integrations v1.0.0'));
  });

  it('exits with 1 when unknown command provided', async () => {
    const code = await main(['unknown-cmd'], tempDir);
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
  });

  it('executes non-interactive dry-run successfully without disk changes', async () => {
    const code = await main(
      [
        'init',
        '--dry-run',
        '--yes',
        '--framework',
        'express',
        '--payments',
        'phonepe',
        '--email',
        'resend',
        '--sms',
        'twilio'
      ],
      tempDir
    );

    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generating integration scaffold'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Integration setup complete'));

    // In dry-run, no directory should be created on disk
    expect(fs.existsSync(path.join(tempDir, 'src/integrations'))).toBe(false);
  });

  it('executes live non-interactive scaffold and writes files to disk', async () => {
    const code = await main(
      [
        'init',
        '--yes',
        '--no-install',
        '--framework',
        'express',
        '--payments',
        'phonepe',
        '--target-dir',
        './custom-integrations'
      ],
      tempDir
    );

    expect(code).toBe(0);
    const configPath = path.join(tempDir, 'custom-integrations/config.js');
    expect(fs.existsSync(configPath)).toBe(true);
  });
});
