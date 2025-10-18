/**
 * Unified Geocoding Service for Therapist App
 * TypeScript version of the shared geocoding utilities
 * Handles environment variables and provides consistent geocoding across components
 */

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id?: string;
  address_components?: any[];
}

interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  city?: string;
  state?: string;
  stateLong?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
}

interface GeocodeResponse {
  success: boolean;
  data?: GeocodeResult;
  error?: string;
  address_verified: boolean;
}

class GeocodingService {
  private geocoder: any = null;
  private isLoaded = false;
  private isLoading = false;
  private loadPromise: Promise<any> | null = null;

  /**
   * Get Google Maps API key from environment variables with fallback
   */
  private getApiKey(): string {
    // Try Vite environment variable first (therapist app)
    const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (viteKey) return viteKey;

    // Try standard environment variable
    const envKey = process.env.GOOGLE_MAPS_API_KEY;
    if (envKey) return envKey;

    // Fallback to the working key from booking platform (temporary)
    console.warn('No environment variable found for Google Maps API key, using fallback');
    return 'AIzaSyBSFcQHl262KbU3H7-N6AdzEj-VO-wRASI';
  }

  /**
   * Load Google Maps API if not already loaded
   */
  private async loadGoogleMaps(): Promise<any> {
    if (this.isLoaded && (window as any).google) {
      return (window as any).google;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if Google Maps is already loaded
      if ((window as any).google && (window as any).google.maps) {
        this.isLoaded = true;
        this.isLoading = false;
        this.geocoder = new (window as any).google.maps.Geocoder();
        resolve((window as any).google);
        return;
      }

      // Create script element
      const script = document.createElement('script');
      const apiKey = this.getApiKey();
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing`;
      script.async = true;
      script.defer = true;

      // Handle successful load
      script.onload = () => {
        this.isLoaded = true;
        this.isLoading = false;
        this.geocoder = new (window as any).google.maps.Geocoder();
        resolve((window as any).google);
      };

      // Handle load error
      script.onerror = () => {
        this.isLoading = false;
        reject(new Error('Failed to load Google Maps API'));
      };

      // Add script to document
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Initialize the geocoding service
   */
  private async init(): Promise<void> {
    if (this.geocoder) return;

    await this.loadGoogleMaps();
    if (!this.geocoder) {
      this.geocoder = new (window as any).google.maps.Geocoder();
    }
  }

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodeResponse> {
    try {
      await this.init();

      return new Promise((resolve) => {
        this.geocoder.geocode({ address: address }, (results: any[], status: string) => {
          const google = (window as any).google;

          if (status === google.maps.GeocoderStatus.OK && results[0]) {
            const result = results[0];
            resolve({
              success: true,
              address_verified: true,
              data: {
                lat: result.geometry.location.lat(),
                lng: result.geometry.location.lng(),
                formatted_address: result.formatted_address,
                place_id: result.place_id,
                address_components: result.address_components
              }
            });
          } else {
            resolve({
              success: false,
              address_verified: false,
              error: `Geocoding failed: ${status}`
            });
          }
        });
      });
    } catch (error: any) {
      return {
        success: false,
        address_verified: false,
        error: error.message || 'Unknown geocoding error'
      };
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Check if coordinates are within Australia (rough bounds)
   */
  isInAustralia(lat: number, lng: number): boolean {
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
   * Parse address components into structured data
   */
  parseAddressComponents(components: any[]): AddressComponents {
    const parsed: AddressComponents = {};

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

  /**
   * Set up address autocomplete for an input element
   */
  async setupAddressAutocomplete(
    inputElement: HTMLInputElement,
    onPlaceSelected: (result: GeocodeResult) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      await this.init();
      const google = (window as any).google;

      const autocomplete = new google.maps.places.Autocomplete(inputElement, {
        types: ['address'],
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry) {
          if (onError) onError('Invalid address selected');
          return;
        }

        // Update the input field with the formatted address
        inputElement.value = place.formatted_address;

        const result: GeocodeResult = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          formatted_address: place.formatted_address,
          place_id: place.place_id,
          address_components: place.address_components
        };

        onPlaceSelected(result);
      });

    } catch (error: any) {
      if (onError) onError(error.message || 'Failed to setup address autocomplete');
    }
  }

  /**
   * Check if Google Maps is ready
   */
  isReady(): boolean {
    return this.isLoaded && (window as any).google && (window as any).google.maps;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Create singleton instance
const geocodingService = new GeocodingService();

export default geocodingService;
export type { GeocodeResult, GeocodeResponse, AddressComponents };
