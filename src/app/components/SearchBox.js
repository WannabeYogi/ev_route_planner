'use client';

import { useEffect, useRef, useState } from 'react';

import { useGoogleMaps } from '../utils/GoogleMapsLoader';

export default function SearchBox({ placeholder, onLocationSelect, value, onFocus }) {
  const [searchText, setSearchText] = useState(value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const suggestionBoxRef = useRef(null);

  // Use our shared Google Maps loader
  const { isLoaded, loadError, maps } = useGoogleMaps();

  // Update searchText when value prop changes
  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  // Initialize Google Maps Autocomplete when the script is loaded
  useEffect(() => {
    if (!isLoaded || !maps || !inputRef.current) return;

    try {
      // Create autocomplete instance
      autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' }, // Restrict to India
        fields: ['address_components', 'geometry', 'name', 'formatted_address', 'place_id'],
        types: ['geocode', 'establishment'], // Search for addresses and establishments
      });

      // Add listener for place selection
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (!place.geometry) {
          // User entered the name of a place that was not suggested
          console.error('No details available for this place');
          return;
        }

        // Get the place details
        const location = {
          name: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id
        };

        setSearchText(place.formatted_address);
        setShowSuggestions(false);
        onLocationSelect(location);
      });

      return () => {
        // Cleanup listener when component unmounts
        if (autocompleteRef.current && maps) {
          maps.event.removeListener(listener);
        }
      };
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }
  }, [isLoaded, maps, onLocationSelect]);

  // Handle click outside suggestions box
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    // We don't need to manually fetch suggestions, Google's autocomplete handles this
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
    if (onFocus) onFocus();
  };

  // If Google Maps fails to load, still allow manual input without autocomplete
  if (loadError) {
    return (
      <div className="relative w-full">
        <input
          type="text"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            // Allow user to set location manually even without the API
            if (e.target.value) {
              onLocationSelect({ 
                name: e.target.value, 
                lat: 0, 
                lng: 0, 
                isManualInput: true 
              });
            }
          }}
          placeholder={`${placeholder} (manual entry)`}
          className="input-field pl-8 pr-4 w-full text-base sm:text-base rounded-lg"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={suggestionBoxRef}>
      <input
        ref={inputRef}
        type="text"
        value={searchText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className="input-field pl-8 pr-4 w-full text-base sm:text-base rounded-lg"
        disabled={!isLoaded}
      />
      
      {!isLoaded && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
} 