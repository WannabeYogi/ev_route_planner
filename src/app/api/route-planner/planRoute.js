// Constants 
const MIN_ARRIVAL_BATTERY = 10; // Minimum battery percentage on arrival
const CHARGING_SPEED_KW = 60;    // Charging speed in kW
const BATTERY_CAPACITY_KWH = 50; // Battery capacity in kWh

// Google Maps API Key - should be moved to env variable
const GOOGLE_API_KEY = "AIzaSyA8FXr0bT_nN_oTae0S2f_cNPZj-zNQRlQ";

/**
 * Calculate distance using Haversine formula (more accurate)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const toRad = (value) => (value * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const R = 6371; // Radius of earth in km
  return R * c;
}

/**
 * Get distance matrix from Google Maps API
 */
async function getDistanceMatrix(origin, destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      return data.rows[0].elements[0].distance.value / 1000; // Convert meters to km
    }
    
    // Fallback to haversine if API fails
    console.error('Distance Matrix API failed, using haversine fallback');
    return haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  } catch (error) {
    console.error('Error getting distance matrix:', error);
    // Fallback to haversine formula
    return haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  }
}

/**
 * Get EV charging stations using Google Places API
 */
async function getChargingStations(location, radius = 50000) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&keyword=EV%20charging%20station&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results.slice(0, 5).map(place => ({
        name: place.name.includes('Charging') ? place.name : `${place.name} Charging Station`,
        id: place.place_id,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        vicinity: place.vicinity || 'Unknown location',
        address: place.vicinity || 'Unknown location',
      }));
    }
    
    // If no results, create fallback stations
    console.warn('No charging stations found, creating fallback');
    return createFallbackStations(location);
  } catch (error) {
    console.error('Error getting charging stations:', error);
    return createFallbackStations(location);
  }
}

/**
 * Create fallback stations when API fails
 */
function createFallbackStations(location) {
  return [
    {
      name: 'Fallback Charging Station 1',
      id: 'fallback1',
      lat: location.lat + 0.05,
      lng: location.lng + 0.05,
      vicinity: 'Estimated location',
      address: 'Fallback location'
    },
    {
      name: 'Fallback Charging Station 2',
      id: 'fallback2',
      lat: location.lat - 0.05,
      lng: location.lng - 0.05,
      vicinity: 'Estimated location',
      address: 'Fallback location'
    }
  ];
}

/**
 * Get location details using reverse geocoding
 */
async function getLocationDetails(lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return 'Unknown location';
  } catch (error) {
    console.error('Error getting location details:', error);
    return 'Location details unavailable';
  }
}

/**
 * Calculate bearing between two points
 */
function getBearing(startPoint, endPoint) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const toDeg = (rad) => rad * (180 / Math.PI);
  
  const lat1 = toRad(startPoint.lat);
  const lat2 = toRad(endPoint.lat);
  const lng1 = toRad(startPoint.lng);
  const lng2 = toRad(endPoint.lng);
  
  const dLon = lng2 - lng1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let bearing = toDeg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;
  
  return bearing;
}

/**
 * Get a point at a given distance and bearing from start point
 */
function getPointAtDistance(startPoint, distance, bearing) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const toDeg = (rad) => rad * (180 / Math.PI);
  
  const R = 6371; // Earth's radius in km
  const lat1 = toRad(startPoint.lat);
  const lng1 = toRad(startPoint.lng);
  const brng = toRad(bearing);
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance/R) + 
    Math.cos(lat1) * Math.sin(distance/R) * Math.cos(brng)
  );
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(distance/R) * Math.cos(lat1),
    Math.cos(distance/R) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/**
 * Plan an EV route with charging stations
 */
export default async function planEvRoute(source, destination, initialBatteryPercent, batteryCapacity) {
  console.log(`Planning route from (${source.lat}, ${source.lng}) to (${destination.lat}, ${destination.lng})`);
  console.log(`Battery: ${initialBatteryPercent}%, Capacity: ${batteryCapacity} km`);
  
  // Initialize result
  const result = {
    path: [],
    stations: [],
    total_distance: 0,
    total_time: 0,
    battery_info: {
      initial: initialBatteryPercent,
      arrival: 0,
      capacity: batteryCapacity,
    }
  };
  
  // Add source and destination to stations list
  const sourceAddress = await getLocationDetails(source.lat, source.lng);
  const destAddress = await getLocationDetails(destination.lat, destination.lng);
  
  result.stations.push({
    name: "Starting Point",
    id: "Source",
    type: "source",
    location: { lat: source.lat, lng: source.lng },
    address: sourceAddress
  });
  
  result.stations.push({
    name: "Destination",
    id: "Destination",
    type: "destination",
    location: { lat: destination.lat, lng: destination.lng },
    address: destAddress
  });
  
  // Check if direct route is possible
  const directDistance = await getDistanceMatrix(source, destination);
  console.log(`Direct distance: ${directDistance} km`);
  
  // Calculate effective range based on initial battery
  const usableRange = (initialBatteryPercent / 100) * batteryCapacity;
  console.log(`Usable range: ${usableRange} km`);
  
  // Calculate maximum safe distance that guarantees MIN_ARRIVAL_BATTERY% remaining
  const maxSafeDistance = ((initialBatteryPercent - MIN_ARRIVAL_BATTERY) / 100) * batteryCapacity;
  console.log(`Maximum safe distance: ${maxSafeDistance} km`);
  
  // Verify if direct route is possible while maintaining minimum battery
  const directDischarge = (directDistance / batteryCapacity) * 100;
  const remainingBattery = initialBatteryPercent - directDischarge;
  
  if (directDistance <= maxSafeDistance) {
    console.log("Direct route is possible, no charging needed");
    
    // Directly reachable
    result.path.push({
      from: "Source",
      to: "Destination",
      charge_at_from: initialBatteryPercent,
      distance: directDistance,
      from_coords: { lat: source.lat, lng: source.lng },
      to_coords: { lat: destination.lat, lng: destination.lng },
      station_name: "Starting Point"
    });
    
    result.total_distance = directDistance;
    result.total_time = directDistance / 60 * 60;  // Assuming 60 km/h average speed
    result.battery_info.arrival = remainingBattery;
    result.total_charging_time = 0;  // No charging needed for direct route
    
    return result;
  }
  
  // Need to find charging stations
  console.log("Finding charging stations for the route");
  
  // Variables for the journey
  let current = { ...source };
  let currentId = "Source";
  let currentStationName = "Starting Point";
  let currentBattery = initialBatteryPercent;
  
  let totalDistance = 0;
  let stationCounter = 0;
  
  // Limit to prevent infinite loops
  const maxStations = 10;  // Increased to handle long routes
  
  while (stationCounter < maxStations) {
    console.log(`Finding station #${stationCounter+1}`);
    
    // Calculate remaining range with current battery
    const currentRange = (currentBattery / 100) * batteryCapacity;
    console.log(`Current battery: ${currentBattery}%, range: ${currentRange} km`);
    
    // Calculate maximum safe distance that guarantees MIN_ARRIVAL_BATTERY% remaining
    const maxSafeDistance = ((currentBattery - MIN_ARRIVAL_BATTERY) / 100) * batteryCapacity;
    console.log(`Maximum safe distance: ${maxSafeDistance} km`);
    
    // Calculate distance to destination
    const distanceToDest = await getDistanceMatrix(current, destination);
    console.log(`Distance to destination: ${distanceToDest} km`);
    
    // Check if destination is reachable directly
    if (distanceToDest <= maxSafeDistance) {
      console.log("Destination is reachable from current location");
      
      // Calculate arrival battery percentage
      const arrivalBattery = currentBattery - (distanceToDest / batteryCapacity * 100);
      console.log(`Arrival battery: ${arrivalBattery}%`);
      
      // We can reach destination directly
      result.path.push({
        from: currentId,
        to: "Destination",
        charge_at_from: currentBattery,
        distance: distanceToDest,
        from_coords: { lat: current.lat, lng: current.lng },
        to_coords: { lat: destination.lat, lng: destination.lng },
        station_name: currentStationName
      });
      
      totalDistance += distanceToDest;
      result.total_distance = totalDistance;
      result.total_time = totalDistance / 60 * 60;  // Assuming 60 km/h average speed
      result.battery_info.arrival = arrivalBattery;
      
      // Calculate charging time
      const chargingTimePerStop = (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60);  // Time in minutes for 100% charge
      result.total_charging_time = stationCounter * chargingTimePerStop;
      
      console.log("Route planning completed successfully");
      return result;
    }
    
    // We need to find a charging station
    // Target stopping when battery would reach around MIN_ARRIVAL_BATTERY + 5% for safety margin
    const targetBatteryAtArrival = MIN_ARRIVAL_BATTERY + 5;
    let targetDistance = ((currentBattery - targetBatteryAtArrival) / 100) * batteryCapacity;
    console.log(`Target distance to next station: ${targetDistance} km`);
    
    // Limit target distance to a reasonable value
    targetDistance = Math.min(targetDistance, maxSafeDistance * 0.9);  // 90% of max safe distance for extra margin
    
    // Calculate ideal next point along the path to destination
    const bearing = getBearing(current, destination);
    const searchPoint = getPointAtDistance(current, Math.min(targetDistance, distanceToDest * 0.7), bearing);
    console.log(`Searching around point: (${searchPoint.lat}, ${searchPoint.lng})`);
    
    // Search for charging stations
    const searchRadius = Math.min(50000, targetDistance * 300);  // Convert km to meters
    const stations = await getChargingStations(searchPoint, searchRadius);
    
    // Find best station that's within safe distance
    let bestStation = null;
    let bestScore = Infinity;
    
    for (const station of stations) {
      const stationCoords = { lat: station.lat, lng: station.lng };
      
      // Distance from current to station
      const distToStation = await getDistanceMatrix(current, stationCoords);
      
      // Calculate battery remaining after travel
      const remainingBatteryAtStation = currentBattery - (distToStation / batteryCapacity * 100);
      
      // STRICT SAFETY REQUIREMENT: Must have at least MIN_ARRIVAL_BATTERY% after reaching the station
      if (distToStation <= maxSafeDistance) {
        console.log(`Station ${station.name}: distance=${distToStation} km, battery=${remainingBatteryAtStation}% - WITHIN SAFE RANGE`);
        
        // Distance from station to destination
        const distStationToDest = await getDistanceMatrix(stationCoords, destination);
        
        // Score based on:
        // 1. How close it is to target distance (lower deviation is better)
        // 2. How well it adheres to the path to destination (closer to direct line is better)
        const distanceDeviation = Math.abs(distToStation - targetDistance);
        
        // Path adherence - roughly estimate as deviation from straight line path
        const directPathDeviation = (distToStation + distStationToDest) - distanceToDest;
        
        // Calculate score - lower is better
        const score = distanceDeviation * 0.7 + directPathDeviation * 0.3;
        
        console.log(`  Score: ${score}`);
        
        if (score < bestScore) {
          bestScore = score;
          bestStation = { ...station, distToStation, remainingBatteryAtStation };
        }
      } else {
        console.log(`Station ${station.name}: distance=${distToStation} km - TOO FAR (exceeds ${maxSafeDistance} km)`);
      }
    }
    
    // If no suitable station found, create a fallback within safe range
    if (!bestStation) {
      console.log("No suitable station found, creating fallback within safe range");
      
      // Use 85% of max safe distance for extra margin
      const safeFallbackDistance = maxSafeDistance * 0.85;
      const fallbackPoint = getPointAtDistance(current, safeFallbackDistance, bearing);
      
      const stationId = `S${stationCounter}`;
      const stationName = "Fallback Charging Station";
      
      // Calculate battery discharge
      const discharge = (safeFallbackDistance / batteryCapacity) * 100;
      const nextBattery = currentBattery - discharge;
      
      result.stations.push({
        name: stationName,
        id: stationId,
        type: "station",
        vicinity: "Estimated location",
        location: { lat: fallbackPoint.lat, lng: fallbackPoint.lng },
        address: "Fallback location, no charging station found nearby",
        charging_time_minutes: (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60),
        remaining_battery: nextBattery
      });
      
      result.path.push({
        from: currentId,
        to: stationId,
        charge_at_from: currentBattery,
        distance: safeFallbackDistance,
        from_coords: { lat: current.lat, lng: current.lng },
        to_coords: { lat: fallbackPoint.lat, lng: fallbackPoint.lng },
        station_name: currentStationName,
        from_address: await getLocationDetails(current.lat, current.lng),
        to_address: "Fallback location, no charging station found nearby",
        charging_time_minutes: (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60),
        driving_time_minutes: safeFallbackDistance / 60 * 60,
        arrival_battery: nextBattery
      });
      
      // Update totals
      totalDistance += safeFallbackDistance;
      
      // Move to next station
      current = { ...fallbackPoint };
      currentId = stationId;
      currentStationName = stationName;
    } else {
      // Process the selected station
      const stationId = `S${stationCounter}`;
      
      console.log(`Selected station: ${bestStation.name}`);
      console.log(`Distance to station: ${bestStation.distToStation} km`);
      console.log(`Battery after travel: ${bestStation.remainingBatteryAtStation}%`);
      
      // Add to stations list
      const chargingTime = (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60);  // Time in minutes for full charge
      
      result.stations.push({
        name: bestStation.name,
        id: stationId,
        type: "station",
        vicinity: bestStation.vicinity,
        location: { lat: bestStation.lat, lng: bestStation.lng },
        address: bestStation.address,
        charging_time_minutes: chargingTime,
        remaining_battery: bestStation.remainingBatteryAtStation
      });
      
      // Add to path
      result.path.push({
        from: currentId,
        to: stationId,
        charge_at_from: currentBattery,
        distance: bestStation.distToStation,
        from_coords: { lat: current.lat, lng: current.lng },
        to_coords: { lat: bestStation.lat, lng: bestStation.lng },
        station_name: currentStationName,
        from_address: await getLocationDetails(current.lat, current.lng),
        to_address: bestStation.address,
        charging_time_minutes: chargingTime,
        driving_time_minutes: bestStation.distToStation / 60 * 60,
        arrival_battery: bestStation.remainingBatteryAtStation
      });
      
      // Update totals
      totalDistance += bestStation.distToStation;
      
      // Move to next station
      current = { lat: bestStation.lat, lng: bestStation.lng };
      currentId = stationId;
      currentStationName = bestStation.name;
    }
    
    // Charge to 100%
    currentBattery = 100;
    console.log(`Charged to ${currentBattery}%`);
    
    stationCounter++;
  }
  
  // If we get here, we've hit the maximum stations limit
  console.log(`Reached maximum stations (${maxStations}) without completing route`);
  
  // Calculate remaining part of the journey
  const remainingDistance = await getDistanceMatrix(current, destination);
  const remainingDischarge = (remainingDistance / batteryCapacity) * 100;
  const arrivalBattery = currentBattery - remainingDischarge;
  
  // Complete the route with our best effort
  result.path.push({
    from: currentId,
    to: "Destination",
    charge_at_from: currentBattery,
    distance: remainingDistance,
    from_coords: { lat: current.lat, lng: current.lng },
    to_coords: { lat: destination.lat, lng: destination.lng },
    station_name: currentStationName,
    arrival_battery: arrivalBattery
  });
  
  // Calculate final values
  totalDistance += remainingDistance;
  result.total_distance = totalDistance;
  result.total_time = totalDistance / 60 * 60;  // Assuming 60 km/h average speed
  result.battery_info.arrival = arrivalBattery;
  
  // Calculate charging time
  const chargingTimePerStop = (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60);  // Time in minutes for full charge
  result.total_charging_time = stationCounter * chargingTimePerStop;
  
  // Add warning if arrival battery is low
  if (arrivalBattery < MIN_ARRIVAL_BATTERY) {
    result.warning = `Warning: This journey may not be feasible with the current parameters. Final arrival battery would be ${arrivalBattery.toFixed(1)}%, which is below the minimum threshold of ${MIN_ARRIVAL_BATTERY}%.`;
  } else {
    result.warning = `This journey requires approximately ${stationCounter} charging stops. The route is about ${totalDistance.toFixed(1)} km with an estimated total charging time of ${Math.round(result.total_charging_time)} minutes.`;
  }
  
  return result;
} 