'use client';

import { useEffect, useRef, useState } from 'react';

export default function SearchBox({ placeholder, onLocationSelect, value, onFocus }) {
  const [suggestions, setSuggestions] = useState([]);
  const [searchText, setSearchText] = useState(value || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timeoutRef = useRef(null);
  const suggestionBoxRef = useRef(null);

  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

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

  const searchLocation = async (query) => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&` +
        'country=in&' + // Limit to India
        'types=place,locality,neighborhood,address&' +
        'limit=5'
      );
      const data = await response.json();
      setSuggestions(data.features);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
    }
    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    setShowSuggestions(true);

    // Debounce API calls
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      searchLocation(value);
    }, 300);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchText(suggestion.place_name);
    setShowSuggestions(false);
    onLocationSelect({
      name: suggestion.place_name,
      lng: suggestion.center[0],
      lat: suggestion.center[1]
    });
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
    if (onFocus) onFocus();
  };

  return (
    <div className="relative w-full" ref={suggestionBoxRef}>
      <input
        type="text"
        value={searchText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className="input-field pl-8 pr-4 w-full text-base sm:text-base rounded-lg"
      />
      
      {showSuggestions && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-[40vh] sm:max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 sm:p-4 text-center text-gray-500">
              Searching...
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="font-medium text-sm sm:text-base text-black truncate">{suggestion.text}</div>
                <div className="text-xs sm:text-sm text-gray-500 truncate">{suggestion.place_name}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
} 