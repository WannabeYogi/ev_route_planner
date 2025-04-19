'use client';

import { DirectionsRenderer, GoogleMap, Marker } from '@react-google-maps/api';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useGoogleMaps } from '../utils/GoogleMapsLoader';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
};

const defaultCenter = {
  lat: 20.5937, // Center of India roughly
  lng: 78.9629,
};

const MapComponent = ({ startLocation, destinationLocation, routeData }) => {
  const [map, setMap] = useState(null);
  const [directions, setDirections] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [mapError, setMapError] = useState(null);
  const directionsService = useRef(null);
  const mapRef = useRef(null);

  // Use our shared Google Maps loader
  const { isLoaded, loadError, maps } = useGoogleMaps();

  // Handle map load
  const onLoad = useCallback((map) => {
    console.log('Map loaded successfully');
    mapRef.current = map;
    setMap(map);
  }, []);

  // Handle map unmount
  const onUnmount = useCallback(() => {
    console.log('Map unmounted');
    mapRef.current = null;
    setMap(null);
  }, []);

  // Calculate and display route from algorithm results if available
  useEffect(() => {
    if (!isLoaded || !maps || !map) return;
    
    if (routeData && routeData.route && routeData.route.length > 1) {
      // Use route data from the algorithm
      console.log('Using route data from algorithm');
      
      try {
        // Create a DirectionsService if it doesn't exist
        if (!directionsService.current) {
          directionsService.current = new maps.DirectionsService();
        }

        // Create waypoints from route
        const waypoints = routeData.chargingStops.map(stop => ({
          location: new maps.LatLng(stop.location[0], stop.location[1]),
          stopover: true
        }));

        // Calculate route with all charging stops as waypoints
        directionsService.current.route(
          {
            origin: new maps.LatLng(routeData.route[0][0], routeData.route[0][1]),
            destination: new maps.LatLng(
              routeData.route[routeData.route.length - 1][0], 
              routeData.route[routeData.route.length - 1][1]
            ),
            waypoints: waypoints,
            travelMode: maps.TravelMode.DRIVING,
            optimizeWaypoints: false, // Don't reorder waypoints
          },
          (result, status) => {
            if (status === maps.DirectionsStatus.OK) {
              setDirections(result);
              
              // Set bounds to fit the route
              const newBounds = new maps.LatLngBounds();
              result.routes[0].bounds.extend(result.routes[0].bounds.getNorthEast());
              result.routes[0].bounds.extend(result.routes[0].bounds.getSouthWest());
              map.fitBounds(newBounds);
              
              setMapError(null);
            } else {
              console.error(`Error displaying route: ${status}`);
              setMapError(`Error displaying route: ${status}`);
            }
          }
        );
        
        return;
      } catch (error) {
        console.error('Error displaying algorithm route:', error);
        setMapError('Error displaying route. Please try again.');
      }
    }
    
    // Fall back to direct route if no algorithm route data or it failed
    if (startLocation && destinationLocation) {
      try {
        // Create directions service if it doesn't exist
        if (!directionsService.current) {
          directionsService.current = new maps.DirectionsService();
        }

        // Create bounds to fit both locations
        const newBounds = new maps.LatLngBounds();
        newBounds.extend(new maps.LatLng(startLocation.lat, startLocation.lng));
        newBounds.extend(new maps.LatLng(destinationLocation.lat, destinationLocation.lng));
        setBounds(newBounds);

        // Calculate direct route
        directionsService.current.route(
          {
            origin: { lat: startLocation.lat, lng: startLocation.lng },
            destination: { lat: destinationLocation.lat, lng: destinationLocation.lng },
            travelMode: maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === maps.DirectionsStatus.OK) {
              setDirections(result);
              setMapError(null);
            } else {
              console.error(`Error fetching directions: ${status}`);
              setDirections(null);
              setMapError(`Error finding route: ${status}`);
            }
          }
        );
      } catch (error) {
        console.error('Error calculating route:', error);
        setMapError('Error calculating route. Please try again.');
      }
    }
  }, [isLoaded, maps, map, startLocation, destinationLocation, routeData]);

  // Fit bounds when map and bounds are available
  useEffect(() => {
    if (map && bounds) {
      try {
        map.fitBounds(bounds);
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [map, bounds]);

  // Set center to start location if only start is available
  useEffect(() => {
    if (map && startLocation && !destinationLocation && !routeData) {
      try {
        map.setCenter({ lat: startLocation.lat, lng: startLocation.lng });
        map.setZoom(14);
      } catch (error) {
        console.error('Error setting center:', error);
      }
    }
  }, [map, startLocation, destinationLocation, routeData]);

  // If there's a load error or other map error
  if (loadError || mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
        <div className="text-red-500 text-center">
          {mapError || `Error loading Google Maps: ${loadError?.message || 'Unknown error'}`}
        </div>
      </div>
    );
  }

  // If the map is still loading
  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
        <div className="text-center">
          <div className="text-gray-500 mb-3">Loading Map...</div>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-md">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={startLocation || defaultCenter}
        zoom={10}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        }}
      >
        {/* If directions are not available, show individual markers */}
        {!directions && (
          <>
            {/* Render start location marker */}
            {startLocation && (
              <Marker
                position={{ lat: startLocation.lat, lng: startLocation.lng }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                  scaledSize: new maps.Size(40, 40),
                }}
                title="Start Location"
              />
            )}

            {/* Render destination marker */}
            {destinationLocation && (
              <Marker
                position={{ lat: destinationLocation.lat, lng: destinationLocation.lng }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                  scaledSize: new maps.Size(40, 40),
                }}
                title="Destination"
              />
            )}

            {/* Render charging stations if available */}
            {routeData && routeData.chargingStops && routeData.chargingStops.map((stop, index) => (
              <Marker
                key={`charging-${index}`}
                position={{ lat: stop.location[0], lng: stop.location[1] }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                  scaledSize: new maps.Size(36, 36),
                }}
                title={`${stop.name} - ${stop.chargingSpeedKW}kW`}
              />
            ))}
          </>
        )}

        {/* If directions are available, show directions with custom markers */}
        {directions && (
          <>
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true, // Suppress default markers
                polylineOptions: {
                  strokeColor: "#4F46E5",
                  strokeWeight: 5,
                  strokeOpacity: 0.8,
                },
              }}
            />
            
            {/* Add custom start marker */}
            {startLocation && (
              <Marker
                position={{ lat: startLocation.lat, lng: startLocation.lng }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                  scaledSize: new maps.Size(40, 40),
                }}
                title="Start Location"
              />
            )}
            
            {/* Add custom destination marker */}
            {destinationLocation && (
              <Marker
                position={{ lat: destinationLocation.lat, lng: destinationLocation.lng }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                  scaledSize: new maps.Size(40, 40),
                }}
                title="Destination"
              />
            )}
            
            {/* Add custom charging station markers */}
            {routeData && routeData.chargingStops && routeData.chargingStops.map((stop, index) => (
              <Marker
                key={`charging-${index}`}
                position={{ lat: stop.location[0], lng: stop.location[1] }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                  scaledSize: new maps.Size(36, 36),
                }}
                title={`${stop.name} - ${stop.chargingSpeedKW}kW`}
              />
            ))}
          </>
        )}
      </GoogleMap>
    </div>
  );
};

export default MapComponent; 