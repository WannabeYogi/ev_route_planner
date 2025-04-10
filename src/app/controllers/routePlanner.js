export async function planRoute(source, destination, vehicleType, initialBatteryPercentage) {
  try {
    // Default to 100% initial battery if not provided
    const batteryPercentage = initialBatteryPercentage ? parseFloat(initialBatteryPercentage) : 100;
    
    // Ensure the battery percentage is valid
    if (isNaN(batteryPercentage) || batteryPercentage < 0 || batteryPercentage > 100) {
      throw new Error('Invalid battery percentage. Must be a number between 0 and 100.');
    }

    // Set minimum threshold to 15% to prevent complete battery depletion
    const MINIMUM_BATTERY_THRESHOLD = 15;

    // Basic validation of input coordinates
    if (!source || !source.lat || !source.lng || !destination || !destination.lat || !destination.lng) {
      throw new Error('Invalid source or destination coordinates.');
    }

    // Validate vehicle type
    if (!vehicleType) {
      throw new Error('Vehicle type is required.');
    }

    // Log inputs for debugging
    console.log('Planning route with:', {
      source,
      destination,
      vehicleType,
      batteryPercentage,
      minimumThreshold: MINIMUM_BATTERY_THRESHOLD
    });

    // Call the Python backend API
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/plan_route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: {
          lat: source.lat,
          lng: source.lng
        },
        destination: {
          lat: destination.lat,
          lng: destination.lng
        },
        vehicle_type: vehicleType,
        initial_battery_percentage: batteryPercentage,
        minimum_battery_threshold: MINIMUM_BATTERY_THRESHOLD
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to plan route: ${errorText}`);
    }

    const routeData = await response.json();
    
    // Format the route data for frontend use
    const formattedRoute = formatRouteData(routeData, source, destination);
    
    return formattedRoute;
  } catch (error) {
    console.error('Route planning error:', error);
    throw error;
  }
}

// Function to format route data from the API for frontend display
function formatRouteData(routeData, source, destination) {
  // Create a proper path with coordinates
  const formattedPath = [];
  
  // Add source as the first location
  if (routeData.path && routeData.path.length > 0) {
    for (let i = 0; i < routeData.path.length; i++) {
      const segment = routeData.path[i];
      
      // Add formatted segment with coordinates
      formattedPath.push({
        from_coords: {
          lat: segment.from_lat,
          lng: segment.from_lng,
        },
        to_coords: {
          lat: segment.to_lat,
          lng: segment.to_lng,
        },
        distance: segment.distance,
        duration: segment.duration,
        battery_used: segment.battery_used,
        battery_remaining: segment.battery_remaining
      });
    }
  }

  // Format charging stations with additional data
  const formattedStations = [];
  
  // Add source as a station
  formattedStations.push({
    id: 'source',
    name: 'Starting Point',
    type: 'source',
    location: {
      lat: source.lat,
      lng: source.lng,
    }
  });
  
  // Add charging stations
  if (routeData.charging_stations && routeData.charging_stations.length > 0) {
    routeData.charging_stations.forEach((station, index) => {
      formattedStations.push({
        id: station.id || `charging-station-${index}`,
        name: station.name || `S${index + 1} Charging Station`,
        type: 'charging',
        location: {
          lat: station.lat,
          lng: station.lng,
        },
        charging_time: station.charging_time,
        battery_before: station.battery_before,
        battery_after: station.battery_after
      });
    });
  }
  
  // Add destination as a station
  formattedStations.push({
    id: 'destination',
    name: 'Destination',
    type: 'destination',
    location: {
      lat: destination.lat,
      lng: destination.lng,
    }
  });

  return {
    path: formattedPath,
    stations: formattedStations,
    total_distance: routeData.total_distance,
    total_duration: routeData.total_duration,
    total_charging_time: routeData.total_charging_time,
    battery_used: routeData.battery_used,
    initial_battery: routeData.initial_battery,
    final_battery: routeData.final_battery
  };
} 