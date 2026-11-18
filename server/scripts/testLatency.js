import https from 'https';
import dns from 'dns';

// Test with default DNS
console.log('Testing default connection...');
const t0 = Date.now();
const req = https.request('https://apiv2.shiprocket.in/v1/external/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  timeout: 25000,
}, (res) => {
  console.log('Default response in', Date.now() - t0, 'ms. Status:', res.statusCode);
});
req.on('error', (e) => console.log('Default error:', e.message, 'after', Date.now() - t0, 'ms'));
req.end('{}');

// Test with IPv4 forced
dns.setDefaultResultOrder('ipv4first');
console.log('Testing IPv4 first connection...');
const t1 = Date.now();
const req4 = https.request('https://apiv2.shiprocket.in/v1/external/auth/login', {
  method: 'POST',
  family: 4,
  headers: { 'Content-Type': 'application/json' },
  timeout: 25000,
}, (res) => {
  console.log('IPv4 response in', Date.now() - t1, 'ms. Status:', res.statusCode);
});
req4.on('error', (e) => console.log('IPv4 error:', e.message, 'after', Date.now() - t1, 'ms'));
req4.end('{}');

