'use client';

import { findNearbyChargingStations, getStationPopupContent, loadChargingStations } from '../utils/chargingStations';
import { useEffect, useRef, useState } from 'react';

import mapboxgl from 'mapbox-gl';

// Initialize Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function ClientMap({ sourceLocation, destinationLocation, userLocation }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [chargingStations, setChargingStations] = useState([]);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const userMarkerRef = useRef(null);

  // Load charging stations data
  useEffect(() => {
    loadChargingStations().then(stations => {
      setChargingStations(stations);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [78.9629, 20.5937], // Center of India
        zoom: 4,
        dragRotate: false, // Disable rotation for better mobile experience
        touchZoomRotate: true // Enable touch zoom
      });

      // Add navigation controls with touch support
      map.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }), 
        'top-right'
      );

      // Add geolocate control
      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        }),
        'top-right'
      );
    }

    // Update map when user location changes
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 13
      });

      // Add or update user location marker
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        el.style.backgroundColor = '#4A90E2';
        el.style.width = '15px';
        el.style.height = '15px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 0 0 2px #4A90E2';

        userMarkerRef.current = new mapboxgl.Marker(el)
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current);
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }
    }
  }, [userLocation]);

  // Clear existing markers and route
  const clearMapObjects = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (routeRef.current && map.current.getLayer('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
      routeRef.current = null;
    }
  };

  // Update markers and fetch route when locations change
  useEffect(() => {
    if (!map.current || !sourceLocation || !destinationLocation) return;

    clearMapObjects();

    // Add source marker
    const sourceMarker = new mapboxgl.Marker({ color: '#000000' })
      .setLngLat([sourceLocation.lng, sourceLocation.lat])
      .addTo(map.current);
    markersRef.current.push(sourceMarker);

    // Add destination marker
    const destMarker = new mapboxgl.Marker({ color: '#666666' })
      .setLngLat([destinationLocation.lng, destinationLocation.lat])
      .addTo(map.current);
    markersRef.current.push(destMarker);

    // Fetch route
    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${sourceLocation.lng},${sourceLocation.lat};${destinationLocation.lng},${destinationLocation.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
        );
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          routeRef.current = route;

          // Add route layer
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#000',
              'line-width': 4
            }
          });

          // Fit bounds to show the entire route
          const bounds = new mapboxgl.LngLatBounds();
          route.geometry.coordinates.forEach(coord => bounds.extend(coord));
          map.current.fitBounds(bounds, { padding: 50 });

          // Find and display nearby charging stations
          const nearbyStations = findNearbyChargingStations(route.geometry.coordinates, chargingStations);
          nearbyStations.forEach(station => {
            const marker = new mapboxgl.Marker({ color: '#00ff00' })
              .setLngLat([station.longitude, station.lattitude])
              .setPopup(new mapboxgl.Popup().setHTML(getStationPopupContent(station)))
              .addTo(map.current);
            markersRef.current.push(marker);
          });
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    };

    fetchRoute();

    // Cleanup function
    return () => {
      clearMapObjects();
    };
  }, [sourceLocation, destinationLocation, chargingStations]);

  return (
    <div ref={mapContainer} className="w-full h-full touch-manipulation" style={{ minHeight: '300px' }} />
  );
} 