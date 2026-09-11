/**
 * Express middleware helper to preserve the raw request body as a Buffer on `req.rawBody`.
 * Crucial for webhook HMAC signature verification (Stripe, Razorpay, CCAvenue, etc.).
 *
 * @returns {import('express').RequestHandler} Express middleware handler.
 */
export function rawBodyMiddleware() {
  return (req, res, next) => {
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      return next();
    }

    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      req.rawBody = rawBody;

      // Automatically attempt to parse JSON body if content-type is application/json and req.body is empty
      if (!req.body || Object.keys(req.body).length === 0) {
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            req.body = JSON.parse(rawBody.toString('utf8'));
          } catch {
            // Keep req.body untouched if JSON parsing fails
          }
        }
      }

      next();
    });

    req.on('error', (err) => {
      next(err);
    });
  };
}
