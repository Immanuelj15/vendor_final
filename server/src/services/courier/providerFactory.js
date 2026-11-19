import { delhiveryProvider } from './delhiveryProvider.js';

export const providerFactory = {
  getProvider(providerName) {
    switch (providerName?.toUpperCase()) {
      case 'DELHIVERY':
        return delhiveryProvider;
      case 'SHIPROCKET':
        return delhiveryProvider; // Forwarded to Delhivery
      default:
        return delhiveryProvider;
    }
  }
};

export default providerFactory;
