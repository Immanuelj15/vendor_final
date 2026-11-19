/**
 * Delhivery Express API HTTP Client
 * Direct integration with Delhivery Logistics API (https://track.delhivery.com)
 * Using API Token Authentication
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

const DELHIVERY_BASE_URL = env.DELHIVERY_BASE_URL || 'https://track.delhivery.com';
const DELHIVERY_API_KEY = env.DELHIVERY_API_KEY || '9a946879afaa206fc6372d0564cdb66226c134fc';

/**
 * Get the active Delhivery API Key
 */
export function getApiKey() {
  try {
    dotenv.config({ override: true });
  } catch {
    // Ignore in constrained environments
  }
  return (process.env.DELHIVERY_API_KEY || env.DELHIVERY_API_KEY || DELHIVERY_API_KEY).trim();
}

/**
 * Extract human-readable error messages from Delhivery API response
 */
function extractErrorMessage(data, status) {
  if (!data) return `HTTP ${status}`;
  if (typeof data === 'string') return data;
  if (data.error && typeof data.error === 'string') return data.error;
  if (data.Error && typeof data.Error === 'string') return data.Error;
  if (data.rmk && typeof data.rmk === 'string') return data.rmk;
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.detail && typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.packages) && data.packages[0]?.remarks) {
    return data.packages[0].remarks.join(', ');
  }
  return JSON.stringify(data);
}

/**
 * Core HTTP execution for Delhivery
 */
async function executeRequest(method, path, dataOrParams = {}, isFormUrlEncoded = false) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Delhivery API key missing. Please provide DELHIVERY_API_KEY in server/.env');
  }

  const url = `${DELHIVERY_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;

  const headers = {
    Authorization: `Token ${apiKey}`,
    Accept: 'application/json',
  };

  if (isFormUrlEncoded) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (method.toUpperCase() !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    method,
    url,
    headers,
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
      const message = extractErrorMessage(err.response.data, status);
      console.error(`[Delhivery API Error] ${method} ${path} -> ${status}: ${message}`);

      const apiErr = new Error(`Delhivery API error: ${message}`);
      apiErr.statusCode = status;
      apiErr.delhiveryData = err.response.data;
      throw apiErr;
    }

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      console.error(`[Delhivery Timeout] ${method} ${path}`);
      const timeoutErr = new Error('Delhivery API request timed out. Please retry.');
      timeoutErr.statusCode = 503;
      throw timeoutErr;
    }

    console.error(`[Delhivery Network Error] ${method} ${path}:`, err.message);
    throw err;
  }
}

/**
 * Make a GET request to Delhivery API
 */
export async function dlGet(path, params = {}) {
  return executeRequest('GET', path, params);
}

/**
 * Make a POST request to Delhivery API
 */
export async function dlPost(path, data = {}, isFormUrlEncoded = false) {
  return executeRequest('POST', path, data, isFormUrlEncoded);
}

/**
 * Make a PUT request to Delhivery API
 */
export async function dlPut(path, data = {}) {
  return executeRequest('PUT', path, data);
}

/**
 * Test connectivity and token validity with Delhivery API
 */
export async function testConnection() {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        connected: false,
        authenticated: false,
        error: 'DELHIVERY_API_KEY is not configured',
        baseUrl: DELHIVERY_BASE_URL,
        timestamp: new Date().toISOString(),
      };
    }

    // Test pincode serviceability endpoint
    const res = await dlGet('/c/api/pin-codes/json/', { filter_codes: '110001' });
    const isSuccess = Array.isArray(res?.delivery_codes) && res.delivery_codes.length > 0;

    return {
      connected: true,
      authenticated: isSuccess,
      baseUrl: DELHIVERY_BASE_URL,
      registeredPickupLocationsCount: 1,
      provider: 'DELHIVERY',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      connected: false,
      authenticated: false,
      error: error.message,
      statusCode: error.statusCode || 500,
      baseUrl: DELHIVERY_BASE_URL,
      provider: 'DELHIVERY',
      timestamp: new Date().toISOString(),
    };
  }
}

export default {
  dlGet,
  dlPost,
  dlPut,
  getApiKey,
  testConnection,
};
