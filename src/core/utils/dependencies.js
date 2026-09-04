import { IntegrationError } from '../errors/IntegrationError.js';

/**
 * Safely and lazily imports an optional external provider SDK package.
 *
 * @param {string} packageName - Name of the npm package (e.g., 'stripe', 'razorpay', 'resend').
 * @param {string} providerName - Name of the provider for error context.
 * @param {Function} [customLoader] - Optional custom import loader function for testing.
 * @returns {Promise<any>} The loaded module namespace or default export.
 * @throws {IntegrationError} If the optional package is not installed.
 */
export async function loadOptionalDependency(packageName, providerName, customLoader = null) {
  try {
    const loader = customLoader || ((pkg) => import(pkg));
    const mod = await loader(packageName);
    return mod;
  } catch (error) {
    if (error?.code === 'MISSING_PROVIDER_DEPENDENCY' || error?.code === 'UNSUPPORTED_PROVIDER') {
      throw error;
    }

    const isMissingModule =
      error?.code === 'ERR_MODULE_NOT_FOUND' ||
      error?.code === 'MODULE_NOT_FOUND' ||
      error?.message?.includes(`Cannot find module '${packageName}'`) ||
      error?.message?.includes(`Cannot find package '${packageName}'`);

    if (isMissingModule) {
      throw new IntegrationError(
        `The optional dependency '${packageName}' is required to use the '${providerName}' provider. Please install it with: npm install ${packageName}`,
        {
          code: 'MISSING_PROVIDER_DEPENDENCY',
          statusCode: 500,
          provider: providerName,
          details: { dependency: packageName }
        }
      );
    }

    throw new IntegrationError(
      `Failed to load optional dependency '${packageName}' for provider '${providerName}': ${error.message}`,
      {
        code: 'DEPENDENCY_LOAD_ERROR',
        statusCode: 500,
        provider: providerName,
        details: { dependency: packageName, originalError: error.message }
      }
    );
  }
}
