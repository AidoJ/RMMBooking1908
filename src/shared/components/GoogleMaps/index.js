/**
 * Google Maps Shared Components
 * Export all Google Maps utilities for easy importing
 */

import GoogleMapsLoader from './GoogleMapsLoader.js';
import AddressAutocomplete from './AddressAutocomplete.js';
import GeocodingUtils from './geocodingUtils.js';

// Initialize with environment-specific API key
const initGoogleMaps = (apiKey) => {
  return GoogleMapsLoader.init(apiKey);
};

// Export everything
export {
  GoogleMapsLoader,
  AddressAutocomplete,
  GeocodingUtils,
  initGoogleMaps
};

// Default export for convenience
export default {
  GoogleMapsLoader,
  AddressAutocomplete,
  GeocodingUtils,
  initGoogleMaps
};

// Also make available globally for vanilla JS usage
if (typeof window !== 'undefined') {
  window.SharedGoogleMaps = {
    GoogleMapsLoader,
    AddressAutocomplete,
    GeocodingUtils,
    initGoogleMaps
  };
}
