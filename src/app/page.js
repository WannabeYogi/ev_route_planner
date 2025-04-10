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
  const [routeResult, setRouteResult] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState(null);

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

  const calculateRoute = async (e) => {
    e.preventDefault();
    setRouteError(null);
    setIsCalculatingRoute(true);
    
    try {
      console.log('Calculating route with parameters:', {
        source: mapLocations.source,
        destination: mapLocations.destination,
        batteryPercentage: formData.batteryPercentage,
        batteryRange: formData.batteryRange
      });
      
      const response = await fetch('/api/route-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: mapLocations.source,
          destination: mapLocations.destination,
          batteryPercentage: formData.batteryPercentage,
          batteryRange: formData.batteryRange
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate route');
      }
      
      console.log('Route calculated successfully:', data);
      setRouteResult(data);
      
      // Scroll to the results after a short delay
      setTimeout(() => {
        const resultsElement = document.getElementById('route-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
    } catch (error) {
      console.error('Error calculating route:', error);
      setRouteError(error.message || 'Failed to calculate route. Please try again.');
    } finally {
      setIsCalculatingRoute(false);
    }
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

                <form onSubmit={calculateRoute} className="space-y-4 sm:space-y-6">
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
                    disabled={!mapLocations.source || !mapLocations.destination || isCalculatingRoute}
                  >
                    {isCalculatingRoute ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Calculating Route...</span>
                      </div>
                    ) : (
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
                    )}
                  </button>
                  
                  {isCalculatingRoute && (
                    <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">Calculating Optimal Route</h3>
                        <p className="text-gray-600 text-center max-w-md">
                          Finding the best charging stations along your route. This may take a moment...
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {routeError && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                      {routeError}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Map Section - Second on Mobile */}
            <div className="bg-gray-100 rounded-xl overflow-hidden relative h-[400px] md:h-[500px] lg:h-[600px]">
                <ClientMap 
                  sourceLocation={mapLocations.source}
                  destinationLocation={mapLocations.destination}
                  userLocation={mapLocations.userLocation}
                routeResults={routeResult}
                />
            </div>
          </div>
          
          {/* Route Results - Below Map */}
          {routeResult && (
            <div id="route-results" className="mt-8 p-6 bg-white rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-6">Optimal Route</h2>
              
              {/* Route Summary Stats - Similar to the image */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col">
                  <div className="text-sm text-gray-500">Total Distance</div>
                  <div className="text-xl font-medium text-green-700">
                    {routeResult.total_distance !== undefined 
                      ? `${routeResult.total_distance.toFixed(2)} km` 
                      : "Calculating..."}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="text-sm text-gray-500">Estimated Driving Time</div>
                  <div className="text-xl font-medium text-green-700">
                    {routeResult.total_time !== undefined 
                      ? `${Math.round(routeResult.total_time)} mins` 
                      : "Calculating..."}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="text-sm text-gray-500">Total Charging Time</div>
                  <div className="text-xl font-medium text-green-700">
                    {routeResult.total_charging_time !== undefined 
                      ? `${Math.round(routeResult.total_charging_time)} mins` 
                      : "Calculating..."}
                  </div>
                </div>
              </div>
              
              {/* Horizontal Detailed Route Summary */}
              <div className="overflow-x-auto mb-6 pb-4">
                <div className="relative min-w-full">
                  <div className="flex items-center">
                    {/* Connecting Line */}
                    <div className="absolute h-1 bg-gray-300 left-0 right-0 top-24 z-0"></div>
                    
                    {/* Path Points */}
                    <div className="flex items-start justify-between w-full relative z-10">
                      {/* Starting Point */}
                      <div className="flex flex-col items-center max-w-[150px] mx-1">
                        <div className="h-8 w-8 bg-green-500 rounded-full mb-3 mt-20 z-10"></div>
                        <div className="text-center">
                          <div className="font-semibold text-sm">Starting Point</div>
                          <div className="text-xs text-gray-600 truncate w-full" title={routeResult.stations?.find(s => s.id === "Source")?.address}>
                            {routeResult.stations?.find(s => s.id === "Source")?.address?.length > 30 
                              ? routeResult.stations?.find(s => s.id === "Source")?.address?.substring(0, 30) + "..." 
                              : routeResult.stations?.find(s => s.id === "Source")?.address || "Source"}
                          </div>
                          <div className="text-xs font-medium mt-1">
                            {routeResult.battery_info?.initial || 0}% battery
                          </div>
                          <div className="text-xs mt-1">{routeResult.path?.[0]?.distance?.toFixed(1) || 0} km</div>
                          <div className="text-xs mt-1">100%</div>
                        </div>
                      </div>
                      
                      {/* Charging Stations */}
                      {routeResult.stations?.filter(s => s.type === "station").map((station, idx) => {
                        const pathSegment = routeResult.path?.find(p => p.to === station.id);
                        const nextSegment = routeResult.path?.find(p => p.from === station.id);
                        
                        return (
                          <div key={idx} className="flex flex-col items-center max-w-[150px] mx-1">
                            <div className="text-center mb-1 h-14 flex items-center">
                              <div className="w-full">
                                <div className="text-xs font-medium truncate" title={station.name}>{station.name}</div>
                                <div className="text-[10px] text-gray-600 truncate w-full" title={station.address}>
                                  {station.address?.length > 25 
                                    ? station.address?.substring(0, 25) + "..." 
                                    : station.address || station.vicinity || "Address unavailable"}
                                </div>
                              </div>
                            </div>
                            <div className="h-8 w-8 bg-blue-500 rounded-full my-2 z-10"></div>
                            <div className="text-center">
                              <div className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 inline-block">
                                Charge: {Math.round(station.charging_time_minutes || 0)} mins
                              </div>
                              <div className="mt-1 text-xs">
                                {pathSegment?.distance ? `${Math.round(pathSegment.distance)} km` : ""}
                              </div>
                              <div className="text-xs mt-1">
                                {Math.round(nextSegment?.charge_at_from || 0)}%
                              </div>
                              <div className="text-xs mt-1">
                                100%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Destination */}
                      <div className="flex flex-col items-center max-w-[150px] mx-1">
                        <div className="h-8 w-8 bg-red-500 rounded-full mb-3 mt-20 z-10"></div>
                        <div className="text-center">
                          <div className="font-semibold text-sm">Destination</div>
                          <div className="text-xs text-gray-600 truncate w-full" title={routeResult.stations?.find(s => s.id === "Destination")?.address}>
                            {routeResult.stations?.find(s => s.id === "Destination")?.address?.length > 30 
                              ? routeResult.stations?.find(s => s.id === "Destination")?.address?.substring(0, 30) + "..." 
                              : routeResult.stations?.find(s => s.id === "Destination")?.address || "Destination"}
                          </div>
                          <div className="text-xs font-medium mt-1">
                            Arrival: {Math.round(routeResult.battery_info?.arrival || 0)}% battery
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Warning Message */}
              {routeResult.warning && (
                <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                  {routeResult.warning}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
