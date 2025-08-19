# Shared Google Maps Components

This directory contains shared Google Maps utilities that can be used by both the booking platform and admin panel.

## Components

### 1. GoogleMapsLoader
Handles loading the Google Maps API only once and provides a singleton instance.

```javascript
import { GoogleMapsLoader } from '/src/shared/components/GoogleMaps/index.js';

// Initialize with API key
GoogleMapsLoader.init('your-api-key');

// Load the API
await GoogleMapsLoader.load();

// Check if ready
if (GoogleMapsLoader.isReady()) {
  const google = GoogleMapsLoader.getApi();
  // Use Google Maps API
}
```

### 2. AddressAutocomplete
Provides address autocomplete functionality with Australian address validation.

```javascript
import { AddressAutocomplete } from '/src/shared/components/GoogleMaps/index.js';

const input = document.getElementById('address-input');
const autocomplete = new AddressAutocomplete(input, {
  onPlaceSelected: (addressData) => {
    console.log('Selected address:', addressData);
    // addressData contains:
    // - formatted_address
    // - components (street, city, state, postcode, etc.)
    // - geometry (lat, lng)
    // - place_id
  },
  onError: (error) => {
    console.error('Error:', error);
  }
});
```

### 3. GeocodingUtils
Provides geocoding, distance calculation, and location utilities.

```javascript
import { GeocodingUtils } from '/src/shared/components/GoogleMaps/index.js';

// Geocode an address
const coords = await GeocodingUtils.geocodeAddress('123 Collins St, Melbourne VIC');

// Reverse geocode coordinates
const address = await GeocodingUtils.reverseGeocode(-37.8136, 144.9631);

// Calculate distance between two points
const distance = GeocodingUtils.calculateDistance(lat1, lng1, lat2, lng2);

// Find nearby therapists
const nearby = await GeocodingUtils.findNearbyTherapists(address, therapistList, 50);

// Get user's current location
const currentLocation = await GeocodingUtils.getCurrentLocation();
```

## Usage in Booking Platform (Vanilla JS)

```html
<script type="module">
  import { initGoogleMaps, AddressAutocomplete } from '/src/shared/components/GoogleMaps/index.js';
  
  // Initialize
  initGoogleMaps('your-api-key');
  
  // Setup address autocomplete
  const addressInput = document.getElementById('address');
  new AddressAutocomplete(addressInput, {
    onPlaceSelected: (data) => {
      // Handle selected address
      console.log('Address selected:', data);
    }
  });
</script>
```

## Usage in Admin Panel (React)

```jsx
import React, { useEffect, useRef } from 'react';
import { AddressAutocomplete, initGoogleMaps } from '/src/shared/components/GoogleMaps/index.js';

const AddressInput = ({ onAddressSelect }) => {
  const inputRef = useRef();
  const autocompleteRef = useRef();

  useEffect(() => {
    // Initialize Google Maps
    initGoogleMaps(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
    
    // Setup autocomplete
    autocompleteRef.current = new AddressAutocomplete(inputRef.current, {
      onPlaceSelected: onAddressSelect
    });

    return () => {
      // Cleanup
      if (autocompleteRef.current) {
        autocompleteRef.current.destroy();
      }
    };
  }, [onAddressSelect]);

  return <input ref={inputRef} placeholder="Enter address..." />;
};
```

## Environment Variables

Make sure to set up your Google Maps API key:

- **Booking Platform**: Use in HTML script tag or environment variable
- **Admin Panel**: Use `REACT_APP_GOOGLE_MAPS_API_KEY` environment variable

## Features

- ✅ Single Google Maps API loader (prevents multiple loads)
- ✅ Australian address validation and restrictions
- ✅ Address autocomplete with status indicators
- ✅ Geocoding and reverse geocoding
- ✅ Distance calculations
- ✅ Therapist proximity search
- ✅ Current location detection
- ✅ Works with both vanilla JS and React
- ✅ Error handling and status indicators
- ✅ Cleanup methods to prevent memory leaks

## API Key Requirements

Your Google Maps API key needs these services enabled:
- Maps JavaScript API
- Places API
- Geocoding API

## Browser Support

- Modern browsers with ES6 module support
- Requires HTTPS for geolocation features
- Graceful fallback for unsupported browsers
