import fs from 'fs';
import path from 'path';
import { Settings } from '../models/Settings.js';
import { PlatformFinancialConfig } from '../models/PlatformFinancialConfig.js';
import { env } from '../config/env.js';

export const brandingService = {
  /**
   * Resolve dynamic website branding snapshot
   */
  async getBrandingSnapshot() {
    // 1. Query settings
    const settingsList = await Settings.find({
      key: {
        $in: [
          'PLATFORM_NAME',
          'BRAND_NAME',
          'PLATFORM_TAGLINE',
          'SUPPORT_EMAIL',
          'SUPPORT_PHONE',
          'LEGAL_COMPANY_NAME',
          'REGISTERED_ADDRESS',
          'PLATFORM_GSTIN',
          'PLATFORM_PAN',
          'BRAND_LOGO_PATH',
          'PRIMARY_COLOR',
          'SECONDARY_COLOR',
        ],
      },
    }).lean();

    const settingsMap = {};
    settingsList.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    // 2. Query platform financial config if present
    const finConfig = await PlatformFinancialConfig.findOne().lean().catch(() => null);

    // 3. Resolve logo file path on disk
    // Search in client public directory relative to server root
    const possibleLogoPaths = [
      settingsMap['BRAND_LOGO_PATH'],
      path.resolve(process.cwd(), '../client/public/images/baapoo-mart-logo.png'),
      path.resolve(process.cwd(), 'client/public/images/baapoo-mart-logo.png'),
      path.resolve(process.cwd(), 'public/images/baapoo-mart-logo.png'),
      path.resolve(process.cwd(), '../public/images/baapoo-mart-logo.png'),
    ].filter(Boolean);

    let resolvedLogoPath = null;
    for (const p of possibleLogoPaths) {
      if (fs.existsSync(p)) {
        resolvedLogoPath = p;
        break;
      }
    }

    const brandName = settingsMap['BRAND_NAME'] || settingsMap['PLATFORM_NAME'] || 'BAAPOO MART';
    const legalName = settingsMap['LEGAL_COMPANY_NAME'] || 'BAAPOO MART Digital Commerce Pvt. Ltd.';
    const tagline = settingsMap['PLATFORM_TAGLINE'] || 'BUY INDIAN • BUILD INDIA';
    const websiteUrl = env.CLIENT_URL || 'https://baapoomart.com';
    const supportEmail = settingsMap['SUPPORT_EMAIL'] || 'support@baapoomart.com';
    const supportPhone = settingsMap['SUPPORT_PHONE'] || '+91 80 4567 8900';
    const registeredAddress =
      settingsMap['REGISTERED_ADDRESS'] ||
      'Level 4, Tech Innovation Hub, Outer Ring Road, Bengaluru, Karnataka 560103, India';
    const gstin = finConfig?.gstin || settingsMap['PLATFORM_GSTIN'] || '';
    const pan = finConfig?.pan || settingsMap['PLATFORM_PAN'] || '';
    const primaryColor = settingsMap['PRIMARY_COLOR'] || '#30358F'; // BAAPOO Navy
    const secondaryColor = settingsMap['SECONDARY_COLOR'] || '#F7941D'; // BAAPOO Saffron

    return {
      brandName,
      legalName,
      tagline,
      logoPath: resolvedLogoPath,
      websiteUrl,
      supportEmail,
      supportPhone,
      registeredAddress,
      gstin,
      pan,
      primaryColor,
      secondaryColor,
    };
  },
};

export default brandingService;

