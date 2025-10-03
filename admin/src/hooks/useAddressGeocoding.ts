/**
 * React hook for address geocoding functionality
 * Provides both automatic and manual geocoding with loading states
 */

import { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import geocodingService, { type GeocodeResult, type GeocodeResponse } from '../services/geocodingService';

interface UseAddressGeocodingOptions {
  onGeocodeSuccess?: (result: GeocodeResult) => void;
  onGeocodeError?: (error: string) => void;
  onAddressChange?: (address: string) => void; // Called when address input changes
  autoGeocode?: boolean; // Whether to geocode automatically on address change
  debounceMs?: number; // Debounce time for automatic geocoding
}

interface UseAddressGeocodingReturn {
  // States
  isGeocoding: boolean;
  geocodeResult: GeocodeResult | null;
  geocodeError: string | null;
  addressVerified: boolean;

  // Functions
  geocodeAddress: (address: string) => Promise<void>;
  setupAutocomplete: (inputElement: HTMLInputElement) => void;
  clearGeocode: () => void;

  // For form integration
  coordinateFields: {
    latitude: number | undefined;
    longitude: number | undefined;
    address_verified: boolean;
  };
}

export const useAddressGeocoding = (
  options: UseAddressGeocodingOptions = {}
): UseAddressGeocodingReturn => {
  const {
    onGeocodeSuccess,
    onGeocodeError,
    onAddressChange,
    autoGeocode = true,
    debounceMs = 1000
  } = options;

  // States
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [addressVerified, setAddressVerified] = useState(false);

  // Refs for debouncing
  const debounceRef = useRef<NodeJS.Timeout>();

  /**
   * Clear all geocoding state
   */
  const clearGeocode = () => {
    setGeocodeResult(null);
    setGeocodeError(null);
    setAddressVerified(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  };

  /**
   * Geocode an address manually
   */
  const geocodeAddress = async (address: string): Promise<void> => {
    if (!address || address.trim().length < 5) {
      clearGeocode();
      return;
    }

    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const response: GeocodeResponse = await geocodingService.geocodeAddress(address.trim());

      if (response.success && response.data) {
        setGeocodeResult(response.data);
        setAddressVerified(true);
        setGeocodeError(null);
        
        if (onGeocodeSuccess) {
          onGeocodeSuccess(response.data);
        }

        // Show success message
        message.success('✓ Address verified and coordinates updated');
      } else {
        setGeocodeResult(null);
        setAddressVerified(false);
        setGeocodeError(response.error || 'Failed to verify address');
        
        if (onGeocodeError) {
          onGeocodeError(response.error || 'Failed to verify address');
        }

        // Show error message
        message.warning('Could not verify address. Please check and try again.');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Network error during address verification';
      setGeocodeResult(null);
      setAddressVerified(false);
      setGeocodeError(errorMessage);
      
      if (onGeocodeError) {
        onGeocodeError(errorMessage);
      }

      message.error('Network error. Please check your connection and try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  /**
   * Debounced geocoding for automatic address verification
   */
  const debouncedGeocode = (address: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      geocodeAddress(address);
    }, debounceMs);
  };

  /**
   * Set up address autocomplete for an input element
   */
  const setupAutocomplete = async (inputElement: HTMLInputElement) => {
    try {
      await geocodingService.setupAddressAutocomplete(
        inputElement,
        (result: GeocodeResult) => {
          setGeocodeResult(result);
          setAddressVerified(true);
          setGeocodeError(null);
          
          // Notify about the address change to update form field
          if (onAddressChange) {
            onAddressChange(result.formatted_address);
          }
          
          if (onGeocodeSuccess) {
            onGeocodeSuccess(result);
          }

          message.success('✓ Address verified via autocomplete');
        },
        (error: string) => {
          setGeocodeError(error);
          setAddressVerified(false);
          
          if (onGeocodeError) {
            onGeocodeError(error);
          }

          message.warning('Autocomplete error: ' + error);
        }
      );

      // Set up automatic geocoding on input blur if enabled
      if (autoGeocode) {
        const handleBlur = () => {
          const address = inputElement.value;
          if (address && address.trim().length >= 5) {
            debouncedGeocode(address);
          }
        };

        inputElement.addEventListener('blur', handleBlur);

        // Return cleanup function
        return () => {
          inputElement.removeEventListener('blur', handleBlur);
        };
      }
    } catch (error: any) {
      console.error('Failed to setup address autocomplete:', error);
      setGeocodeError('Failed to setup address autocomplete');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // States
    isGeocoding,
    geocodeResult,
    geocodeError,
    addressVerified,

    // Functions
    geocodeAddress,
    setupAutocomplete,
    clearGeocode,

    // For form integration
    coordinateFields: {
      latitude: geocodeResult?.lat,
      longitude: geocodeResult?.lng,
      address_verified: addressVerified
    }
  };
};

export default useAddressGeocoding;