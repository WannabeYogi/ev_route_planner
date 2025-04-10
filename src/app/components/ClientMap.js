'use client';

import { findNearbyChargingStations, getStationPopupContent, loadChargingStations } from '../utils/chargingStations';
import { useEffect, useRef, useState } from 'react';

import mapboxgl from 'mapbox-gl';

// Initialize Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Fallback to Google Maps if Mapbox fails
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyA8FXr0bT_nN_oTae0S2f_cNPZj-zNQRlQ";

export default function ClientMap({ sourceLocation, destinationLocation, userLocation, routeResults }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [chargingStations, setChargingStations] = useState([]);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [useGoogleMaps, setUseGoogleMaps] = useState(true);
  const googleMapRef = useRef(null);
  const googleMarkersRef = useRef([]);
  const googleRouteRef = useRef(null);

  // Load charging stations data
  useEffect(() => {
    loadChargingStations().then(stations => {
      setChargingStations(stations);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!map.current && !useGoogleMaps) {
      try {
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
      } catch (error) {
        console.error("Failed to initialize Mapbox:", error);
        setUseGoogleMaps(true);
      }
    }
    
    // Fallback to Google Maps if Mapbox fails
    if (useGoogleMaps && !googleMapRef.current && typeof window !== 'undefined') {
      try {
        // Load Google Maps script dynamically if not available
        if (!window.google || !window.google.maps) {
          console.log("Loading Google Maps script...");
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
          script.async = true;
          script.defer = true;
          document.head.appendChild(script);
          
          script.onload = () => {
            console.log("Google Maps script loaded successfully");
            initializeGoogleMap();
          };
          
          script.onerror = (error) => {
            console.error("Failed to load Google Maps script:", error);
            setUseGoogleMaps(false);
          };
        } else {
          console.log("Google Maps already loaded, initializing map");
          initializeGoogleMap();
        }
      } catch (error) {
        console.error("Failed to initialize Google Maps:", error);
        setUseGoogleMaps(false);
      }
    }

    // Function to initialize Google Maps
    function initializeGoogleMap() {
      if (!mapContainer.current) return;
      
      console.log("Initializing Google Maps");
      googleMapRef.current = new google.maps.Map(mapContainer.current, {
        center: { lat: 20.5937, lng: 78.9629 }, // Center of India
        zoom: 4,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });
      
      console.log("Google Maps initialized successfully");
    }

    // Update map when user location changes
    if (userLocation && map.current && !useGoogleMaps) {
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
    } else if (userLocation && googleMapRef.current && useGoogleMaps) {
      googleMapRef.current.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      googleMapRef.current.setZoom(13);
    }
  }, [userLocation, useGoogleMaps]);

  // Clear existing Mapbox markers and route
  const clearMapboxObjects = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (map.current) {
      // Remove route layers if they exist
      if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
      }
      if (map.current.getLayer('route-background')) {
        map.current.removeLayer('route-background');
      }
      // Remove route source if it exists
      if (map.current.getSource('route')) {
      map.current.removeSource('route');
      }
      routeRef.current = null;
    }
  };

  // Clear existing Google Maps markers and route
  const clearGoogleMapObjects = () => {
    googleMarkersRef.current.forEach(marker => marker.setMap(null));
    googleMarkersRef.current = [];

    if (googleRouteRef.current) {
      googleRouteRef.current.setMap(null);
      googleRouteRef.current = null;
    }
  };

  // Display optimized route on appropriate map
  useEffect(() => {
    if ((!map.current && !googleMapRef.current) || !routeResults) return;
    
    try {
      if (useGoogleMaps) {
        displayRouteOnGoogleMaps();
      } else {
        displayRouteOnMapbox();
      }
    } catch (error) {
      console.error('Error rendering route:', error);
      
      // If Mapbox fails, try Google Maps as fallback
      if (!useGoogleMaps) {
        setUseGoogleMaps(true);
      }
    }
  }, [routeResults, useGoogleMaps]);

  // Function to display route on Mapbox
  const displayRouteOnMapbox = () => {
    if (!map.current || !routeResults) return;
    
    clearMapboxObjects();

    // Validate path data exists
    if (!routeResults.path || !Array.isArray(routeResults.path) || routeResults.path.length === 0) {
      console.error('No valid path data in route results');
      return;
    }

    // Extract route coordinates from the path
    const coordinates = [];
    routeResults.path.forEach(segment => {
      if (segment.from_coords && segment.from_coords.lng && segment.from_coords.lat) {
        coordinates.push([segment.from_coords.lng, segment.from_coords.lat]);
      }
      if (segment.to_coords && segment.to_coords.lng && segment.to_coords.lat) {
        coordinates.push([segment.to_coords.lng, segment.to_coords.lat]);
      }
    });

    if (coordinates.length < 2) {
      console.error('Not enough valid coordinates to draw a route');
      return;
    }

    // Create a GeoJSON object for the route
    const routeGeometry = {
      type: 'LineString',
      coordinates: coordinates
    };

    // Add route source and layer
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
        geometry: routeGeometry
      }
    });

    // Add a background line for highlight effect
    map.current.addLayer({
      id: 'route-background',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#fff',
        'line-width': 8,
        'line-opacity': 0.7
      }
    });

    // Add main route line
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
        'line-color': '#3B82F6', // Blue color for route
        'line-width': 5,
        'line-opacity': 0.9
      }
    });

    // Add markers for all stations
    if (routeResults.stations && Array.isArray(routeResults.stations)) {
      routeResults.stations.forEach(station => {
        if (!station || !station.location || !station.location.lng || !station.location.lat) {
          return; // Skip invalid stations
        }

        let markerColor;
        if (station.type === 'source') {
          markerColor = '#00B020'; // Green for source
        } else if (station.type === 'destination') {
          markerColor = '#FF3B30'; // Red for destination
        } else {
          markerColor = '#007AFF'; // Blue for charging stations
        }

        // Create a more informative popup with better styling
        const marker = new mapboxgl.Marker({ 
          color: markerColor, 
          scale: 1.5,  // Increase size for better visibility
          anchor: 'bottom' // Anchor at bottom to work with label
        })
          .setLngLat([station.location.lng, station.location.lat])
          .setPopup(
            new mapboxgl.Popup({ maxWidth: '300px' }).setHTML(
              `<div style="padding: 12px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${station.name || 'Unknown'}</h3>
                <p style="margin: 5px 0"><strong>Type:</strong> ${station.type ? (station.type.charAt(0).toUpperCase() + station.type.slice(1)) : 'Station'}</p>
                ${station.type !== 'source' && station.type !== 'destination' ? 
                  `<p style="margin: 5px 0"><strong>Station ID:</strong> ${station.id || 'Unknown'}</p>
                   <p style="margin: 5px 0"><strong>Charging Station:</strong> ${station.name || 'Unknown'}</p>` : ''}
                <p style="margin: 5px 0"><strong>Coordinates:</strong> ${station.location.lat.toFixed(4)}, ${station.location.lng.toFixed(4)}</p>
              </div>`
            )
          )
              .addTo(map.current);
            markersRef.current.push(marker);

        // Add a text label for charging stations
        if (station.type !== 'source' && station.type !== 'destination' && station.id && station.id.startsWith('S')) {
          // Create a custom label element
          const el = document.createElement('div');
          el.className = 'station-label';
          el.textContent = station.id;
          el.style.color = 'white';
          el.style.backgroundColor = markerColor;
          el.style.padding = '3px 6px';
          el.style.borderRadius = '12px';
          el.style.fontSize = '14px';
          el.style.fontWeight = 'bold';
          el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
          el.style.position = 'relative';
          el.style.textAlign = 'center';
          el.style.zIndex = '10';
          el.style.border = '2px solid white';
          el.style.minWidth = '30px';
          
          // Add the label as a marker positioned above the main marker
          const labelMarker = new mapboxgl.Marker({ 
            element: el,
            anchor: 'bottom',
            offset: [0, -15] // Offset to position above the main marker
          })
            .setLngLat([station.location.lng, station.location.lat])
            .addTo(map.current);
          markersRef.current.push(labelMarker);
        }
      });
    }

    // Fit bounds to show the entire route
    if (coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, { 
        padding: {top: 100, bottom: 100, left: 100, right: 100},
        maxZoom: 12 // Limit how far it zooms in to ensure we see the full route
      });
    }
  };

  // Function to display route on Google Maps
  const displayRouteOnGoogleMaps = () => {
    if (!googleMapRef.current || !routeResults || !window.google) return;
    
    clearGoogleMapObjects();

    // Validate path data exists
    if (!routeResults.path || !Array.isArray(routeResults.path) || routeResults.path.length === 0) {
      console.error('No valid path data in route results');
      return;
    }

    // Extract route coordinates
    const coordinates = [];
    routeResults.path.forEach(segment => {
      if (segment.from_coords && segment.from_coords.lng && segment.from_coords.lat) {
        coordinates.push({ lat: segment.from_coords.lat, lng: segment.from_coords.lng });
      }
      if (segment.to_coords && segment.to_coords.lng && segment.to_coords.lat) {
        coordinates.push({ lat: segment.to_coords.lat, lng: segment.to_coords.lng });
      }
    });

    if (coordinates.length < 2) {
      console.error('Not enough valid coordinates to draw a route');
      return;
    }

    // Create route polyline
    googleRouteRef.current = new google.maps.Polyline({
      path: coordinates,
      geodesic: true,
      strokeColor: '#4285F4',  // Google Maps blue
      strokeOpacity: 1.0,
      strokeWeight: 6,
      icons: [{
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
        repeat: '150px',
        offset: '100%'
      }]
    });
    googleRouteRef.current.setMap(googleMapRef.current);

    // Add markers for all stations
    if (routeResults.stations && Array.isArray(routeResults.stations)) {
      routeResults.stations.forEach(station => {
        if (!station || !station.location || !station.location.lng || !station.location.lat) {
          return; // Skip invalid stations
        }

        let icon;
        let title = station.name || 'Unknown';
        let label = '';
        
        if (station.type === 'source') {
          icon = {
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
            scaledSize: new google.maps.Size(45, 45)
          };
          title = 'Starting Point';
        } else if (station.type === 'destination') {
          icon = {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(45, 45)
          };
          title = 'Destination';
        } else {
          // Custom charging station icon
          icon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 10
          };
          
          // Extract station number for label
          if (station.id && station.id.startsWith('S')) {
            label = {
              text: station.id,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '12px'
            };
          }
        }

        const marker = new google.maps.Marker({
          position: { lat: station.location.lat, lng: station.location.lng },
          map: googleMapRef.current,
          title: title,
          icon: icon,
          label: label,
          animation: google.maps.Animation.DROP,
          zIndex: station.type === 'station' ? 10 : 5
        });

        // Add info window with more detailed content
        const infowindow = new google.maps.InfoWindow({
          content: `<div style="padding: 12px; max-width: 300px; font-family: Arial, sans-serif;">
            <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${title}</h3>
            ${station.type !== 'source' && station.type !== 'destination' ? 
              `<p style="margin: 5px 0; font-size: 14px;"><strong>Station ID:</strong> ${station.id || 'Unknown'}</p>
               ${station.vicinity ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Address:</strong> ${station.vicinity}</p>` : ''}` : ''}
            <p style="margin: 5px 0; font-size: 14px;"><strong>Type:</strong> ${station.type ? (station.type.charAt(0).toUpperCase() + station.type.slice(1)) : 'Station'}</p>
          </div>`
        });

        marker.addListener('click', () => {
          infowindow.open(googleMapRef.current, marker);
        });

        googleMarkersRef.current.push(marker);
      });
    }

    // Fit bounds to show the entire route
    if (coordinates.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      coordinates.forEach(coord => bounds.extend(coord));
      
      // Make sure all stations are included in the bounds
      if (routeResults.stations) {
        routeResults.stations.forEach(station => {
          if (station && station.location && station.location.lat && station.location.lng) {
            bounds.extend(new google.maps.LatLng(
              station.location.lat,
              station.location.lng
            ));
          }
        });
      }
      
      googleMapRef.current.fitBounds(bounds);
      
      // Add padding by zooming out slightly
      google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
        googleMapRef.current.setZoom(googleMapRef.current.getZoom() - 1);
      });
    }
  };

  // Update markers and fetch route when locations change
  useEffect(() => {
    if ((!map.current && !googleMapRef.current) || !sourceLocation || !destinationLocation || routeResults) return;

    // Clear previous markers
    if (useGoogleMaps) {
      clearGoogleMapObjects();
    } else {
      clearMapboxObjects();
    }

    // Add source and destination markers
    if (useGoogleMaps && googleMapRef.current) {
      // Source marker (Google Maps)
      const sourceMarker = new google.maps.Marker({
        position: { lat: sourceLocation.lat, lng: sourceLocation.lng },
        map: googleMapRef.current,
        title: 'Source',
        icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
      });
      googleMarkersRef.current.push(sourceMarker);

      // Destination marker (Google Maps)
      const destMarker = new google.maps.Marker({
        position: { lat: destinationLocation.lat, lng: destinationLocation.lng },
        map: googleMapRef.current,
        title: 'Destination',
        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
      });
      googleMarkersRef.current.push(destMarker);

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: sourceLocation.lat, lng: sourceLocation.lng });
      bounds.extend({ lat: destinationLocation.lat, lng: destinationLocation.lng });
      googleMapRef.current.fitBounds(bounds);
    } else if (map.current) {
      // Source marker (Mapbox)
      const sourceMarker = new mapboxgl.Marker({ 
        color: '#00B020', 
        scale: 1.5,
        anchor: 'bottom'
      })
        .setLngLat([sourceLocation.lng, sourceLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ maxWidth: '300px' }).setHTML(
            `<div style="padding: 12px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">Starting Point</h3>
              <p style="margin: 5px 0"><strong>Type:</strong> Source</p>
              <p style="margin: 5px 0"><strong>Coordinates:</strong> ${sourceLocation.lat.toFixed(4)}, ${sourceLocation.lng.toFixed(4)}</p>
            </div>`
          )
        )
        .addTo(map.current);
      markersRef.current.push(sourceMarker);

      // Destination marker (Mapbox)
      const destMarker = new mapboxgl.Marker({ 
        color: '#FF3B30', 
        scale: 1.5,
        anchor: 'bottom'
      })
        .setLngLat([destinationLocation.lng, destinationLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ maxWidth: '300px' }).setHTML(
            `<div style="padding: 12px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
              <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">Destination</h3>
              <p style="margin: 5px 0"><strong>Type:</strong> Destination</p>
              <p style="margin: 5px 0"><strong>Coordinates:</strong> ${destinationLocation.lat.toFixed(4)}, ${destinationLocation.lng.toFixed(4)}</p>
            </div>`
          )
        )
        .addTo(map.current);
      markersRef.current.push(destMarker);

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds()
        .extend([sourceLocation.lng, sourceLocation.lat])
        .extend([destinationLocation.lng, destinationLocation.lat]);
      map.current.fitBounds(bounds, { 
        padding: {top: 100, bottom: 100, left: 100, right: 100},
        maxZoom: 12 // Limit how far it zooms in
      });
    }
  }, [sourceLocation, destinationLocation, routeResults, useGoogleMaps]);

  return (
    <div className="w-full h-full" ref={mapContainer} />
  );
} 