/**
 * Shared Google Maps API Loader
 * Used by both booking platform and admin panel
 */

class GoogleMapsLoader {
  constructor() {
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
    this.apiKey = null;
  }

  /**
   * Initialize with API key from environment variables
   */
  init(apiKey) {
    this.apiKey = apiKey || 'AIzaSyBSFcQHl262KbU3H7-N6AdzEj-VO-wRASI';
    return this;
  }

  /**
   * Load Google Maps API if not already loaded
   */
  async load() {
    if (this.isLoaded) {
      return window.google;
    }

    if (this.isLoading) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        this.isLoaded = true;
        this.isLoading = false;
        resolve(window.google);
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      // Handle successful load
      script.onload = () => {
        this.isLoaded = true;
        this.isLoading = false;
        resolve(window.google);
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
   * Check if Google Maps is ready
   */
  isReady() {
    return this.isLoaded && window.google && window.google.maps;
  }

  /**
   * Get Google Maps API
   */
  getApi() {
    if (this.isReady()) {
      return window.google;
    }
    throw new Error('Google Maps API not loaded. Call load() first.');
  }
}

// Create singleton instance
const googleMapsLoader = new GoogleMapsLoader();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = googleMapsLoader;
}
if (typeof window !== 'undefined') {
  window.GoogleMapsLoader = googleMapsLoader;
}

export default googleMapsLoader;
