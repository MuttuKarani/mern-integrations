# Production Release Checklist for `mern-integrations`

This checklist must be followed step-by-step before every production release to npm.

---

## 1. Pre-Release Verification

- [ ] **Clean Working Tree**: Ensure `git status` is clean with no unstaged changes or temporary files.
- [ ] **Branch**: Ensure release branch is merged into `master` and up-to-date with remote origin (`git pull origin master`).
- [ ] **Automated Test Suite**: All unit and integration tests pass cleanly (`npm test`).
- [ ] **Coverage Quality Gates**: Coverage meets or exceeds repository thresholds (`npm run test:coverage`):
  - Statements $\ge 90\%$
  - Branches $\ge 75\%$
  - Functions $\ge 90\%$
  - Lines $\ge 90\%$
- [ ] **Security Audit**: Dependency vulnerability scan reports 0 vulnerabilities (`npm audit`).
- [ ] **Whitespace & Formatting**: Zero trailing whitespace or formatting errors (`git diff --check`).
- [ ] **Package Metadata**:
  - `name`: `mern-integrations`
  - `version`: Version is bumped according to SemVer (e.g. `1.0.0`).
  - `engines`: `"node": ">=18.0.0"`.
  - `exports`: Root (`.`), `./payments`, `./email`, `./sms`, `./storage`, `./package.json`.
  - `files`: Whitelist contains only distribution files: `["src", "README.md", "LICENSE", "CHANGELOG.md"]`.
  - `sideEffects`: `false`.
  - `publishConfig`: `{ "access": "public" }`.
- [ ] **Documentation**: `README.md` and `examples/` accurately reflect the public API and installation commands.
- [ ] **Changelog**: `CHANGELOG.md` documents all new features, fixes, and breaking changes under the target release header.

---

## 2. Packaging Validation

- [ ] **Dry Run Pack**: Run `npm pack --dry-run` and review tarball contents:
  ```bash
  npm pack --dry-run
  ```
- [ ] **Verify Whitelist Inclusions**:
  - `package.json`
  - `README.md`
  - `LICENSE`
  - `CHANGELOG.md`
  - `src/` (all JavaScript source files)
- [ ] **Verify Exclusions**:
  - `tests/` is NOT included
  - `examples/` is NOT included
  - `consumer-test/` is NOT included
  - `coverage/` is NOT included
  - `.github/` is NOT included
  - `.env*` files are NOT included
  - `node_modules/` is NOT included
  - Editor/OS files (`.vscode`, `.idea`, `.DS_Store`) are NOT included

---

## 3. Fresh Consumer Installation Simulation

- [ ] Generate local tarball:
  ```bash
  npm pack
  ```
- [ ] In a temporary directory outside the repository:
  ```bash
  mkdir /tmp/release-consumer-test && cd /tmp/release-consumer-test
  npm init -y
  npm install /path/to/mern-integrations-1.0.0.tgz
  ```
- [ ] Verify:
  - Base installation installs **0** required third-party provider SDKs.
  - Root import (`import { createPaymentProvider, ... } from 'mern-integrations'`) works.
  - Subpath imports (`mern-integrations/payments`, `mern-integrations/email`, etc.) work.
  - Zero-SDK providers (`ccavenue`, `msg91`, `messagebird`) work out of the box.
  - Uninstalled SDK providers throw `IntegrationError` with `MISSING_PROVIDER_DEPENDENCY` and installation instructions.
  - Installing a single SDK (`npm install razorpay`) enables that provider without affecting others.

---

## 4. Manual npm Publishing Execution

> **Note**: Publishing to npm is a **manual** process. Never automate publishing from CI without two-factor authentication (2FA).

1. **Authenticate with npm**:
   ```bash
   npm login
   npm whoami
   ```

2. **Publish Package**:
   ```bash
   npm publish --access public
   ```

3. **Tag Git Release**:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

---

## 5. Post-Publish Verification

- [ ] **npm Registry Inspection**:
  ```bash
  npm view mern-integrations version
  npm view mern-integrations dist-tags
  ```
- [ ] **Global Consumer Test**:
  ```bash
  npx -y --package=mern-integrations node -e "import('mern-integrations').then(m => console.log('Successfully imported mern-integrations:', Object.keys(m).length, 'exports'))"
  ```
- [ ] **GitHub Release**: Create a new GitHub Release matching tag `v1.0.0` with notes from `CHANGELOG.md`.
