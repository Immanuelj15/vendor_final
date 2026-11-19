/**
 * Backward compatibility proxy: delegates to delhiveryClient
 */

import delhiveryClient, {
  dlGet,
  dlPost,
  dlPut,
  testConnection,
} from './delhiveryClient.js';

export const srGet = dlGet;
export const srPost = dlPost;
export const srPut = dlPut;
export const testConnectionShiprocket = testConnection;
export { testConnection };

export default {
  ...delhiveryClient,
  srGet,
  srPost,
  srPut,
  testConnection,
};
