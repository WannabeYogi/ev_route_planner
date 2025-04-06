import { useEffect, useRef } from 'react';
import { useLoadScript } from '@react-google-maps/api';

const PlacesAutocomplete = ({ onPlaceSelect, placeholder, value, name }) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (window.google) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'geometry', 'name', 'formatted_address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        onPlaceSelect(name, place);
      });
    }
  }, [onPlaceSelect, name]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      name={name}
      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      placeholder={placeholder}
    />
  );
};

export default PlacesAutocomplete; 