/**
 * Shared Geocoding Utilities
 * Used by both booking platform and admin panel for location operations
 */

import googleMapsLoader from './GoogleMapsLoader.js';

class GeocodingUtils {
  constructor() {
    this.geocoder = null;
  }

  async init() {
    await googleMapsLoader.load();
    const google = googleMapsLoader.getApi();
    this.geocoder = new google.maps.Geocoder();
  }

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address) {
    if (!this.geocoder) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ address: address }, (results, status) => {
        const google = googleMapsLoader.getApi();
        
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          const result = results[0];
          resolve({
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            formatted_address: result.formatted_address,
            place_id: result.place_id,
            address_components: result.address_components
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(lat, lng) {
    if (!this.geocoder) {
      await this.init();
    }

    const google = googleMapsLoader.getApi();
    const latlng = new google.maps.LatLng(lat, lng);

    return new Promise((resolve, reject) => {
      this.geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
          const result = results[0];
          resolve({
            formatted_address: result.formatted_address,
            place_id: result.place_id,
            address_components: result.address_components
          });
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`));
        }
      });
    });
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lng1, lat2, lng2, unit = 'km') {
    const R = unit === 'km' ? 6371 : 3959; // Earth's radius in km or miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Find nearby therapists within radius
   */
  async findNearbyTherapists(address, therapists, maxDistance = 50) {
    try {
      const addressCoords = await this.geocodeAddress(address);
      const nearbyTherapists = [];

      therapists.forEach(therapist => {
        if (therapist.latitude && therapist.longitude) {
          const distance = this.calculateDistance(
            addressCoords.lat,
            addressCoords.lng,
            therapist.latitude,
            therapist.longitude
          );

          if (distance <= maxDistance) {
            nearbyTherapists.push({
              ...therapist,
              distance: Math.round(distance * 10) / 10 // Round to 1 decimal
            });
          }
        }
      });

      // Sort by distance
      nearbyTherapists.sort((a, b) => a.distance - b.distance);
      
      return {
        customerLocation: addressCoords,
        nearbyTherapists: nearbyTherapists
      };
    } catch (error) {
      console.error('Error finding nearby therapists:', error);
      throw error;
    }
  }

  /**
   * Get user's current location
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          try {
            const address = await this.reverseGeocode(lat, lng);
            resolve({
              lat: lat,
              lng: lng,
              ...address
            });
          } catch (error) {
            // Still return coordinates even if reverse geocoding fails
            resolve({
              lat: lat,
              lng: lng,
              formatted_address: `${lat}, ${lng}`
            });
          }
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  /**
   * Validate if coordinates are within Australia
   */
  isInAustralia(lat, lng) {
    // Rough bounding box for Australia
    const bounds = {
      north: -9.0,
      south: -54.0,
      east: 159.0,
      west: 112.0
    };

    return lat >= bounds.south && lat <= bounds.north && 
           lng >= bounds.west && lng <= bounds.east;
  }

  /**
   * Format distance for display
   */
  formatDistance(distance, unit = 'km') {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}${unit}`;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Parse address components into structured data
   */
  parseAddressComponents(components) {
    const parsed = {};
    
    components.forEach(component => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        parsed.streetNumber = component.long_name;
      }
      if (types.includes('route')) {
        parsed.streetName = component.long_name;
      }
      if (types.includes('locality')) {
        parsed.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        parsed.state = component.short_name;
        parsed.stateLong = component.long_name;
      }
      if (types.includes('postal_code')) {
        parsed.postcode = component.long_name;
      }
      if (types.includes('country')) {
        parsed.country = component.long_name;
        parsed.countryCode = component.short_name;
      }
    });

    return parsed;
  }
}

// Create singleton instance
const geocodingUtils = new GeocodingUtils();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = geocodingUtils;
}
if (typeof window !== 'undefined') {
  window.GeocodingUtils = geocodingUtils;
}

export default geocodingUtils;
