/**
 * Shiprocket API HTTP Client
 * Handles authentication, token management, automatic 401 retries, and all raw API calls.
 * Uses official Shiprocket REST API (https://apidocs.shiprocket.in/)
 */

import axios from 'axios';
import https from 'https';
import dns from 'dns';
import dotenv from 'dotenv';
import { env } from '../../config/env.js';

// Resolve IPv4 first to eliminate Windows/ISP dual-stack latency
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore in older environments
}

const httpsAgent = new https.Agent({
  keepAlive: true,
  family: 4,
});

const SHIPROCKET_BASE_URL = env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_REFRESH_BUFFER_MS = 15 * 60 * 1000; // Refresh 15 minutes before 24h expiry

// In-memory token cache
let _tokenCache = {
  token: null,
  expiresAt: null,
};

/**
 * Authenticate with Shiprocket and get a Bearer token.
 * Tokens are valid for 24-240 hours per Shiprocket docs.
 */
async function authenticate() {
  try {
    dotenv.config({ override: true });
  } catch {
    // Ignore if running in constrained environment
  }

  const email = (process.env.SHIPROCKET_EMAIL || env.SHIPROCKET_EMAIL || '').trim();
  const password = (process.env.SHIPROCKET_PASSWORD || env.SHIPROCKET_PASSWORD || env.SHIPROCKET_API_KEY || '').trim();

  if (!email || !password) {
    throw new Error(
      'Shiprocket credentials missing: Please provide SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in server/.env'
    );
  }

  try {
    const res = await axios.post(
      `${SHIPROCKET_BASE_URL}/auth/login`,
      {
        email,
        password,
      },
      { timeout: 30000, httpsAgent }
    );

    if (res.data && res.data.token) {
      // Shiprocket tokens are valid for at least 24 hours
      _tokenCache = {
        token: res.data.token,
        expiresAt: Date.now() + 23 * 60 * 60 * 1000,
      };
      console.log('[Shiprocket] Auth token obtained successfully via /auth/login.');
      return _tokenCache.token;
    }

    throw new Error(res.data?.message || 'Login succeeded but token was not returned');
  } catch (loginErr) {
    _tokenCache = { token: null, expiresAt: null };
    const status = loginErr.response?.status;
    const errorMsg =
      loginErr.response?.data?.message ||
      loginErr.response?.data?.errors ||
      loginErr.message;
    console.error(`[Shiprocket Auth Failure] Status: ${status}, Message:`, errorMsg);

    const err = new Error(
      `Shiprocket authentication failed (${status || 'Network'}): ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}. Please verify SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in server/.env.`
    );
    err.statusCode = status || 401;
    throw err;
  }
}

/**
 * Get a valid Bearer token, refreshing if expired.
 */
export async function getToken() {
  const needsRefresh =
    !_tokenCache.token ||
    !_tokenCache.expiresAt ||
    Date.now() >= _tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS;

  if (needsRefresh) {
    await authenticate();
  }

  return _tokenCache.token;
}

/**
 * Format structured error from Shiprocket response
 */
function extractErrorMessage(data, status) {
  if (!data) return `HTTP ${status}`;
  if (typeof data === 'string') return data;
  if (data.message && typeof data.message === 'string') {
    if (data.errors && typeof data.errors === 'object') {
      const fieldErrors = Object.entries(data.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
      return `${data.message} (${fieldErrors})`;
    }
    return data.message;
  }
  if (data.errors) {
    if (typeof data.errors === 'object') {
      return Object.entries(data.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
    }
    return String(data.errors);
  }
  return JSON.stringify(data);
}

/**
 * Core HTTP execution with automatic 401 token refresh retry
 */
async function executeRequest(method, path, dataOrParams = {}, isRetry = false) {
  const token = await getToken();
  const url = `${SHIPROCKET_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;

  const config = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30000,
    httpsAgent,
  };

  if (method.toUpperCase() === 'GET') {
    config.params = dataOrParams;
  } else {
    config.data = dataOrParams;
  }

  try {
    const res = await axios(config);
    return res.data;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;

      // If token expired on server, refresh once and retry
      if (status === 401 && !isRetry) {
        console.warn(`[Shiprocket] Received 401 for ${method} ${path}. Refreshing token and retrying...`);
        _tokenCache = { token: null, expiresAt: null };
        return executeRequest(method, path, dataOrParams, true);
      }

      const message = extractErrorMessage(err.response.data, status);
      console.error(`[Shiprocket API Error] ${method} ${path} -> ${status}: ${message}`);

      const apiErr = new Error(`Shiprocket API error: ${message}`);
      apiErr.statusCode = status;
      apiErr.shiprocketData = err.response.data;
      throw apiErr;
    }

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      console.error(`[Shiprocket Timeout] ${method} ${path}`);
      const timeoutErr = new Error('Shiprocket API timed out. Please retry.');
      timeoutErr.statusCode = 503;
      throw timeoutErr;
    }

    console.error(`[Shiprocket Network Error] ${method} ${path}:`, err.message);
    throw err;
  }
}

/**
 * Make a GET request to Shiprocket API.
 */
export async function srGet(path, params = {}) {
  return executeRequest('GET', path, params);
}

/**
 * Make a POST request to Shiprocket API.
 */
export async function srPost(path, data = {}) {
  return executeRequest('POST', path, data);
}

/**
 * Make a PUT request to Shiprocket API.
 */
export async function srPut(path, data = {}) {
  return executeRequest('PUT', path, data);
}

/**
 * Make a DELETE request to Shiprocket API.
 */
export async function srDelete(path, data = {}) {
  return executeRequest('DELETE', path, data);
}

/**
 * Force-refresh the token.
 */
export async function refreshToken() {
  _tokenCache = { token: null, expiresAt: null };
  return authenticate();
}

/**
 * Invalidate in-memory token cache.
 */
export function clearTokenCache() {
  _tokenCache = { token: null, expiresAt: null };
}

/**
 * Test connectivity and credentials with Shiprocket API.
 */
export async function testConnection() {
  try {
    clearTokenCache();
    const token = await authenticate();
    // Test a read endpoint
    const pickupRes = await srGet('/settings/company/pickup').catch(() => null);
    return {
      connected: true,
      authenticated: !!token,
      baseUrl: SHIPROCKET_BASE_URL,
      registeredPickupLocationsCount: pickupRes?.data?.shipping_address?.length || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      connected: false,
      authenticated: false,
      error: error.message,
      statusCode: error.statusCode || 500,
      timestamp: new Date().toISOString(),
    };
  }
}

export default {
  srGet,
  srPost,
  srPut,
  srDelete,
  refreshToken,
  clearTokenCache,
  getToken,
  testConnection,
};
