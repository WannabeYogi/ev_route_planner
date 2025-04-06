'use client';

import './styles/button.css';

import { useEffect, useState } from 'react';

import ClientMap from './components/ClientMap';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import SearchBox from './components/SearchBox';

export default function Home() {
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    batteryPercentage: '',
    batteryRange: ''
  });

  const [mapLocations, setMapLocations] = useState({
    source: null,
    destination: null,
    userLocation: null
  });

  const [selectingLocation, setSelectingLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Get user's current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get address
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?` +
              `access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
            );
            const data = await response.json();
            const address = data.features[0]?.place_name || 'Current Location';
            
            setMapLocations(prev => ({
              ...prev,
              userLocation: { lat: latitude, lng: longitude },
              source: { lat: latitude, lng: longitude }
            }));
            
            setFormData(prev => ({
              ...prev,
              source: address
            }));
          } catch (error) {
            console.error('Error getting address:', error);
          }
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsLoadingLocation(false);
        }
      );
    } else {
      console.log('Geolocation is not supported by this browser.');
      setIsLoadingLocation(false);
    }
  };

  const handleLocationSelect = (location, type) => {
    setMapLocations(prev => ({
      ...prev,
      [type]: { lat: location.lat, lng: location.lng }
    }));
    setFormData(prev => ({
      ...prev,
      [type]: location.name
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // The route will be automatically shown when both locations are selected
    console.log('Form submitted:', formData);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Form Section - Always First on Mobile */}
            <div className="py-6 sm:py-8 lg:py-12">
              <div className="max-w-[450px] mx-auto lg:mx-0">
                <h1 className="text-3xl sm:text-4xl font-bold text-black mb-3 sm:mb-4">
                  Smart EV Route Planner
                </h1>
                <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
                  Find the optimal route with charging stations for your electric vehicle journey.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -mt-1 w-2 h-2 bg-black rounded-full"></div>
                    <SearchBox
                      placeholder="Enter pickup location"
                      value={formData.source}
                      onLocationSelect={(location) => handleLocationSelect(location, 'source')}
                    />
                    {isLoadingLocation && (
                      <div className="absolute right-4 top-1/2 -mt-2 text-sm text-gray-500">
                        Getting location...
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -mt-1 w-2 h-2 bg-gray-600 rounded-full"></div>
                    <SearchBox
                      placeholder="Enter drop-off location"
                      value={formData.destination}
                      onLocationSelect={(location) => handleLocationSelect(location, 'destination')}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Battery Percentage
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="batteryPercentage"
                          value={formData.batteryPercentage}
                          onChange={handleInputChange}
                          className="input-field pr-8"
                          placeholder="Current %"
                          min="0"
                          max="100"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          %
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Battery Range
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          name="batteryRange"
                          value={formData.batteryRange}
                          onChange={handleInputChange}
                          className="input-field pr-8"
                          placeholder="Range in km"
                          min="0"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          km
                        </span>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="button"
                    disabled={!mapLocations.source || !mapLocations.destination}
                  >
                    <div>
                      <div>
                        <div>
                          <svg 
                            className="w-5 h-5" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          Plan Route
                        </div>
                      </div>
                    </div>
                  </button>
                </form>
              </div>
            </div>

            {/* Map Container */}
            <div className="lg:order-2">
              <div className="h-[50vh] lg:h-[calc(100vh-8rem)] w-full rounded-lg overflow-hidden shadow-lg">
                <ClientMap 
                  sourceLocation={mapLocations.source}
                  destinationLocation={mapLocations.destination}
                  userLocation={mapLocations.userLocation}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
