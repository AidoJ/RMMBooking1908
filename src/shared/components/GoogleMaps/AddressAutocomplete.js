/**
 * Shared Address Autocomplete Component
 * Extracted from booking platform and enhanced for reuse
 */

import googleMapsLoader from './GoogleMapsLoader.js';

class AddressAutocomplete {
  constructor(inputElement, options = {}) {
    this.inputElement = inputElement;
    this.autocomplete = null;
    this.options = {
      types: ['address'],
      componentRestrictions: { country: 'AU' }, // Restrict to Australia
      fields: ['address_components', 'formatted_address', 'geometry'],
      ...options
    };
    
    // Callbacks
    this.onPlaceSelected = options.onPlaceSelected || (() => {});
    this.onError = options.onError || ((error) => console.error('Address autocomplete error:', error));
    
    this.init();
  }

  async init() {
    try {
      await googleMapsLoader.load();
      this.setupAutocomplete();
    } catch (error) {
      this.onError(error);
    }
  }

  setupAutocomplete() {
    if (!this.inputElement) {
      throw new Error('Input element is required for address autocomplete');
    }

    const google = googleMapsLoader.getApi();
    
    // Create autocomplete instance
    this.autocomplete = new google.maps.places.Autocomplete(this.inputElement, this.options);
    
    // Listen for place selection
    this.autocomplete.addListener('place_changed', () => {
      this.handlePlaceSelection();
    });

    // Add status indicator
    this.addStatusIndicator();
  }

  handlePlaceSelection() {
    const place = this.autocomplete.getPlace();
    
    if (!place.geometry) {
      this.showStatus('Invalid address selected', 'error');
      return;
    }

    // Parse address components
    const addressData = this.parseAddressComponents(place);
    
    // Show success status
    this.showStatus('✓ Address verified', 'success');
    
    // Call callback with parsed data
    this.onPlaceSelected(addressData);
  }

  parseAddressComponents(place) {
    const components = {};
    
    // Extract address components
    if (place.address_components) {
      place.address_components.forEach(component => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          components.streetNumber = component.long_name;
        }
        if (types.includes('route')) {
          components.streetName = component.long_name;
        }
        if (types.includes('locality')) {
          components.city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          components.state = component.short_name;
        }
        if (types.includes('postal_code')) {
          components.postcode = component.long_name;
        }
        if (types.includes('country')) {
          components.country = component.long_name;
          components.countryCode = component.short_name;
        }
      });
    }

    return {
      formatted_address: place.formatted_address,
      components: components,
      geometry: {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      },
      place_id: place.place_id
    };
  }

  addStatusIndicator() {
    // Create status element if it doesn't exist
    let statusElement = this.inputElement.parentNode.querySelector('.address-status');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.className = 'address-status';
      statusElement.style.cssText = `
        font-size: 0.9rem;
        margin-top: 0.3rem;
        min-height: 20px;
      `;
      this.inputElement.parentNode.appendChild(statusElement);
    }
    this.statusElement = statusElement;
  }

  showStatus(message, type = 'info') {
    if (!this.statusElement) return;
    
    const colors = {
      success: '#52c41a',
      error: '#ff4d4f', 
      info: '#1890ff',
      warning: '#fa8c16'
    };

    this.statusElement.textContent = message;
    this.statusElement.style.color = colors[type] || colors.info;
    
    // Clear status after 3 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.textContent = '';
        }
      }, 3000);
    }
  }

  // Method to manually set address (useful for editing)
  setAddress(address) {
    if (this.inputElement) {
      this.inputElement.value = address;
    }
  }

  // Method to clear the input
  clear() {
    if (this.inputElement) {
      this.inputElement.value = '';
    }
    if (this.statusElement) {
      this.statusElement.textContent = '';
    }
  }

  // Method to get current value
  getValue() {
    return this.inputElement ? this.inputElement.value : '';
  }

  // Cleanup method
  destroy() {
    if (this.autocomplete) {
      google.maps.event.clearInstanceListeners(this.autocomplete);
    }
    if (this.statusElement) {
      this.statusElement.remove();
    }
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AddressAutocomplete;
}
if (typeof window !== 'undefined') {
  window.AddressAutocomplete = AddressAutocomplete;
}

export default AddressAutocomplete;
