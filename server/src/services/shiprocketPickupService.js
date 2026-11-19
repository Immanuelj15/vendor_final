/**
 * Backwards Compatibility Adapter
 * Delegates all calls to delhiveryPickupService
 */

import { delhiveryPickupService, buildPickupLocationName } from './delhiveryPickupService.js';

export { buildPickupLocationName };
export const shiprocketPickupService = delhiveryPickupService;
export default delhiveryPickupService;
