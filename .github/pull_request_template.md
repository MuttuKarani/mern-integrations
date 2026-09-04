## Description

Please provide a summary of the change, including motivation, context, and any related issues.

Fixes / Closes #(issue number if applicable)

---

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] CI/CD or repository hardening
- [ ] Refactoring or performance improvement

---

## Pre-Merge Quality Checklist

Before submitting this PR, please confirm that your changes meet all repository standards:

- [ ] **Native ESM Compliance**: Code uses standard ECMAScript modules (`import`/`export`) without CommonJS or transpilation.
- [ ] **Zero Required Runtime Dependencies**: The package root has zero required runtime dependencies. All provider SDKs are optional peer dependencies.
- [ ] **Unit & Integration Tests**: All existing and new tests pass cleanly (`npm test`).
- [ ] **Coverage Quality Gates**: Code coverage meets or exceeds repository thresholds (`npm run test:coverage`):
  - Statements $\ge$ 90%
  - Branches $\ge$ 75%
  - Functions $\ge$ 90%
  - Lines $\ge$ 90%
- [ ] **Security Audit**: Dependency audit reports zero high/critical vulnerabilities (`npm audit`).
- [ ] **Package Integrity**: Dry run pack contains only intended distribution files (`npm pack --dry-run`).
- [ ] **Code Formatting**: No trailing whitespace or formatting issues (`git diff --check`).
- [ ] **Credential Safety**: No hardcoded API keys, secrets, tokens, or live production credentials exist in code or examples.
- [ ] **Examples & Documentation**: Relevant provider examples and documentation in `README.md` and `examples/` have been updated if applicable.
