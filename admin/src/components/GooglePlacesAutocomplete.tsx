import React, { useEffect, useRef, useState } from 'react';
import { Input } from 'antd';

interface GooglePlacesAutocompleteProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onPlaceSelect?: (place: {
    address: string;
    lat: number;
    lng: number;
    name?: string;
  }) => void;
  style?: React.CSSProperties;
  rows?: number;
}

declare global {
  interface Window {
    google: {
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, options?: any) => {
            addListener: (event: string, callback: () => void) => void;
            getPlace: () => any;
          };
          AutocompleteSessionToken: new () => any;
        };
        Geocoder: new () => {
          geocode: (request: any, callback: (results: any[], status: string) => void) => void;
        };
      };
    };
  }
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  value = '',
  placeholder = 'Enter address...',
  onChange,
  onPlaceSelect,
  style,
  rows
}) => {
  const inputRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('✅ Google Maps API loaded');
        setIsGoogleMapsLoaded(true);
      } else {
        console.log('⏳ Waiting for Google Maps API...');
        setTimeout(checkGoogleMaps, 100);
      }
    };
    
    checkGoogleMaps();
  }, []);

  // Initialize autocomplete when Google Maps is loaded
  useEffect(() => {
    if (!isGoogleMapsLoaded || !inputRef.current || isInitialized) return;

    try {
      console.log('🔍 Initializing Google Places Autocomplete...');

      // Resolve the underlying HTMLInputElement from Ant Design components
      let htmlInput: any = null;
      const refCurrent: any = inputRef.current;
      if (refCurrent?.input) {
        // AntD Input exposes the native input element at .input
        htmlInput = refCurrent.input;
      } else if (refCurrent?.resizableTextArea?.textArea) {
        // AntD TextArea exposes the native textarea element here
        // Note: Autocomplete requires an HTMLInputElement, so we will skip attaching to textarea
        htmlInput = null;
      } else if (refCurrent instanceof window.HTMLInputElement) {
        htmlInput = refCurrent;
      }

      if (!htmlInput) {
        console.warn('⚠️ Could not resolve HTMLInputElement for Google Autocomplete. Skipping initialization.');
        return;
      }

      // Create session token for better prediction quality
      const sessionToken = new window.google.maps.places.AutocompleteSessionToken();

      // Initialize autocomplete on the HTMLInputElement
      const autocomplete = new window.google.maps.places.Autocomplete(htmlInput, {
        // types: ['geocode'], // Removed to allow hotels, POIs, etc.
        componentRestrictions: { country: 'au' },
        sessionToken: sessionToken,
        fields: ['formatted_address', 'geometry', 'name']
      });

      autocompleteRef.current = autocomplete;

      // Add place_changed listener - EXACTLY like frontend
      autocomplete.addListener('place_changed', () => {
        console.log('📍 Place selection triggered');
        const place = autocomplete.getPlace();
        console.log('Selected place:', place);

        if (place && place.geometry) {
          const selected = {
            name: place.name || '',
            address: place.formatted_address || value,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          };
          
          console.log('✅ Address selected:', selected);
          
          // Update the input value
          if (onChange) {
            onChange(selected.address);
          }
          
          // Notify parent component with coordinates
          if (onPlaceSelect) {
            onPlaceSelect(selected);
          }
        } else {
          console.warn('⚠️ Place selected but no geometry available');
        }
      });

      setIsInitialized(true);
      console.log('✅ Google Places Autocomplete initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Google Places Autocomplete:', error);
    }
  }, [isGoogleMapsLoaded, onChange, onPlaceSelect, value]);

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (onChange) {
      onChange(newValue);
    }
  };

  // Handle blur event - frontend doesn't do manual geocoding on blur
  const handleBlur = () => {
    // Frontend only geocodes when no coordinates are available from autocomplete
    // This is handled in the parent component's checkTherapistCoverageForAddress
  };

  if (rows && rows > 1) {
    return (
      <Input.TextArea
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={handleInputChange}
        onBlur={handleBlur}
        style={style}
        rows={rows}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      placeholder={placeholder}
      onChange={handleInputChange}
      onBlur={handleBlur}
      style={style}
    />
  );
};

export default GooglePlacesAutocomplete;
