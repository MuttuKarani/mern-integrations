/**
 * Example: Enterprise Idempotency Key Middleware
 *
 * Demonstrates how to prevent duplicate payment mutations, orders, and emails
 * using the standard Idempotency-Key HTTP header.
 *
 * Run with: npm run example:idempotency
 * Or: node examples/middleware/idempotency.example.js
 */

import {
  idempotencyMiddleware,
  InMemoryIdempotencyStore
} from '../../src/index.js';
import { EventEmitter } from 'node:events';

async function runIdempotencyExample() {
  console.log('=== mern-integrations: Idempotency Key Middleware Example ===\n');

  // 1. Initialize store and middleware
  const store = new InMemoryIdempotencyStore({
    maxEntries: 1000,
    cleanupIntervalMs: 0 // In examples, no background interval needed
  });

  const middleware = idempotencyMiddleware({
    headerName: 'idempotency-key',
    required: false,
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
    store
  });

  /**
   * Helper to simulate an Express request/response cycle.
   */
  function simulateRequest({ key, body, path = '/api/orders' }) {
    const req = {
      method: 'POST',
      path,
      url: path,
      baseUrl: '',
      headers: key ? { 'idempotency-key': key } : {},
      body
    };

    const res = new EventEmitter();
    res.statusCode = 200;
    res._headers = {};
    res._body = null;

    res.setHeader = (k, v) => { res._headers[k.toLowerCase()] = v; };
    res.getHeader = (k) => res._headers[k.toLowerCase()];
    res.hasHeader = (k) => k.toLowerCase() in res._headers;
    res.getHeaders = () => ({ ...res._headers });
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (data) => {
      res._body = data;
      res.emit('finish');
      return res;
    };
    res.json = (data) => {
      res._body = data;
      res.emit('finish');
      return res;
    };

    return { req, res };
  }

  const idempotencyKey = `order_checkout_${Date.now()}`;
  const orderPayload = {
    customerId: 'cust_9876',
    amountPaise: 49900,
    items: ['Pro Subscription Year 1']
  };

  let executionCounter = 0;

  // Handler function simulating database write & payment authorization
  function handleCreateOrder(req, res) {
    executionCounter++;
    console.log(`[Handler] Executing order placement logic... (Run count: ${executionCounter})`);
    res.status(201).json({
      orderId: `ord_${Date.now()}`,
      status: 'CHARGED',
      amount: req.body.amountPaise,
      created: new Date().toISOString()
    });
  }

  // Step 1: First request with idempotency key
  console.log('--- 1. First Incoming Request (Normal Execution) ---');
  console.log('Idempotency Key:', idempotencyKey);
  console.log('Payload:', JSON.stringify(orderPayload));

  const req1 = simulateRequest({ key: idempotencyKey, body: orderPayload });
  await middleware(req1.req, req1.res, () => handleCreateOrder(req1.req, req1.res));
  await new Promise((r) => setTimeout(r, 20));

  console.log('Response Status:', req1.res.statusCode);
  console.log('Response Body:', req1.res._body);
  console.log('Idempotent-Replayed Header:', req1.res.getHeader('Idempotent-Replayed') || 'None (fresh run)');
  console.log();

  // Step 2: Second duplicate request with SAME idempotency key & payload
  console.log('--- 2. Duplicate Request (Simulating Network Retry / Accidental Double Click) ---');
  console.log('Idempotency Key:', idempotencyKey);

  const req2 = simulateRequest({ key: idempotencyKey, body: orderPayload });
  await middleware(req2.req, req2.res, () => handleCreateOrder(req2.req, req2.res));
  await new Promise((r) => setTimeout(r, 20));

  console.log('Response Status:', req2.res.statusCode);
  console.log('Response Body:', req2.res._body);
  console.log('Idempotent-Replayed Header:', req2.res.getHeader('Idempotent-Replayed'));
  console.log('Total Handler Executions:', executionCounter, '(Guaranteed exactly once!)');
  console.log();

  // Step 3: Malicious or accidental key reuse with DIFFERENT payload
  console.log('--- 3. Key Reuse with Mismatched Payload (Payload Tampering / Key Collision) ---');
  const alteredPayload = {
    customerId: 'cust_9876',
    amountPaise: 999900 // Different amount!
  };

  const req3 = simulateRequest({ key: idempotencyKey, body: alteredPayload });
  let caughtError = null;

  await middleware(req3.req, req3.res, (err) => {
    caughtError = err;
  });

  if (caughtError) {
    console.log('Caught Expected Error:', caughtError.name);
    console.log('Error Code:', caughtError.code);
    console.log('Status Code:', caughtError.statusCode);
    console.log('Message:', caughtError.message);
  }

  store.destroy();
  console.log('\n=== Example Completed Successfully ===');
}

runIdempotencyExample().catch(console.error);
