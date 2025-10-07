'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { Loader } from '@googlemaps/js-api-loader';

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const GoogleMapsContext = createContext({
  isLoaded: false,
  loadError: null,
  maps: null,
});

const loader = new Loader({
  apiKey: MAPS_API_KEY,
  version: 'quarterly',
  libraries: ['places'],
  language: 'en',
  region: 'IN',
});

let isLoading = false;
let mapsInstance = null;

export function GoogleMapsProvider({ children }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [maps, setMaps] = useState(null);

  useEffect(() => {
    if (isLoading || isLoaded || mapsInstance) return;
    
    isLoading = true;
    console.log('Loading Google Maps...');
    
    loader
      .load()
      .then((google) => {
        console.log('Google Maps loaded successfully');
        mapsInstance = google.maps;
        setMaps(google.maps);
        setIsLoaded(true);
        isLoading = false;
      })
      .catch((error) => {
        console.error('Error loading Google Maps:', error);
        setLoadError(error);
        isLoading = false;
      });
      
    return () => {
    };
  }, []);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError, maps }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
} 