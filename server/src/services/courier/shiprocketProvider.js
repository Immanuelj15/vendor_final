/**
 * Backward compatibility proxy: delegates all operations to delhiveryProvider
 */

import { delhiveryProvider } from './delhiveryProvider.js';

export const shiprocketProvider = delhiveryProvider;
export default delhiveryProvider;
