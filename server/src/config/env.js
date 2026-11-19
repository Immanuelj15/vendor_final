import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.MONGO_URI) {
  throw new Error('FATAL CONFIG ERROR: MONGO_URI is required in environment variables!');
}
if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('FATAL CONFIG ERROR: JWT_ACCESS_SECRET is required in environment variables!');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL CONFIG ERROR: JWT_REFRESH_SECRET is required in environment variables!');
}

const INSECURE_DEFAULT_SECRETS = [
  'fairkart_access_secret_2026',
  'fairkart_refresh_secret_2026',
  'fairkart_super_secret_access_token_key_2026_x99!',
  'fairkart_super_secret_refresh_token_key_2026_z88!',
  'secret',
  'changeme',
  'admin',
  'password',
];

if (isProduction) {
  if (INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_ACCESS_SECRET) || (process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET.length < 16)) {
    console.warn('⚠️ WARNING: Using a default/demo JWT_ACCESS_SECRET in production. For maximum security, set a random 64-character secret in Render.');
  }
  if (INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_REFRESH_SECRET) || (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 16)) {
    console.warn('⚠️ WARNING: Using a default/demo JWT_REFRESH_SECRET in production. For maximum security, set a random 64-character secret in Render.');
  }
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_demo') {
    console.warn('⚠️ WARNING: A valid RAZORPAY_KEY_ID is recommended in production environment variables.');
  }
  if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === 'rzp_secret_demo') {
    console.warn('⚠️ WARNING: A valid RAZORPAY_KEY_SECRET is recommended in production environment variables.');
  }
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET === 'rzp_webhook_demo') {
    console.warn('⚠️ WARNING: A valid RAZORPAY_WEBHOOK_SECRET is recommended in production environment variables.');
  }
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fairkart',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'fairkart_access_secret_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fairkart_refresh_secret_2026',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_demo',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_demo',
  // ── Delhivery Logistics Integration ───────────────────────────────────────
  DELHIVERY_API_KEY: process.env.DELHIVERY_API_KEY || '9a946879afaa206fc6372d0564cdb66226c134fc',
  DELHIVERY_BASE_URL: process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com',
  DELHIVERY_CLIENT_NAME: process.env.DELHIVERY_CLIENT_NAME || 'BAAPOO MART',
  DELHIVERY_RETURN_NAME: process.env.DELHIVERY_RETURN_NAME || 'BAAPOO MART RETURNS',
  DELHIVERY_WEBHOOK_SECRET: process.env.DELHIVERY_WEBHOOK_SECRET || '9a946879afaa206fc6372d0564cdb66226c134fc',

  // ── Legacy Shiprocket (For backward compatibility) ────────────────────────
  SHIPROCKET_API_KEY: process.env.SHIPROCKET_API_KEY || '',
  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL || '',
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD || process.env.SHIPROCKET_API_KEY || '',
  SHIPROCKET_BASE_URL: process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external',
  SHIPROCKET_WEBHOOK_SECRET: process.env.SHIPROCKET_WEBHOOK_SECRET || 'sr_webhook_demo',
};
