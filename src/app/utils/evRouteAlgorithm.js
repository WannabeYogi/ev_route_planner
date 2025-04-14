'use client';

// Client-side version of the EV route algorithm
import { decode } from '@googlemaps/polyline-codec';

// Helper function to determine if code is running on the server
const isServer = typeof window === 'undefined';

// Import the server algorithm for re-export if needed
import { planEvRoute as serverPlanEvRoute } from './serverEvRouteAlgorithm';

/**
 * Makes a Google Maps API request using the appropriate method (direct or proxy)
 * @param {string} endpoint - API endpoint path (e.g., 'directions/json')
 * @param {Object} params - Query parameters for the API call
 * @returns {Promise<Object>} API response data
 */
async function makeGoogleMapsApiRequest(endpoint, params) {
  // Create URL search params
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, value);
  }
  
  try {
    let url;
    let response;
    
    if (isServer) {
      // Server-side: use direct fetch with API key
      url = `https://maps.googleapis.com/maps/api/${endpoint}?${searchParams.toString()}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      response = await fetch(url);
    } else {
      // Client-side: use our API proxy route
      searchParams.append('endpoint', endpoint);
      url = `/api/maps?${searchParams.toString()}`;
      response = await fetch(url);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error making Google Maps API request to ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Calculates distance between two coordinates using the Haversine formula
 * @param {[number, number]} coord1 - First coordinate [lat, lng]
 * @param {[number, number]} coord2 - Second coordinate [lat, lng]
 * @returns {number} Distance in kilometers
 */
function getDistance(coord1, coord2) {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Gets route path and time estimation using Google Maps Directions API
 * @param {[number, number]} start - Starting coordinates [lat, lng]
 * @param {[number, number]} end - Ending coordinates [lat, lng]
 * @returns {Promise<{path: Array<[number, number]>, duration: number}>} Path and duration
 */
async function getRoadPathAndTimeWithTraffic(start, end) {
  try {
    const [startLat, startLng] = start;
    const [endLat, endLng] = end;
    
    // Make API request through our helper function
    const data = await makeGoogleMapsApiRequest('directions/json', {
      origin: `${startLat},${startLng}`,
      destination: `${endLat},${endLng}`,
      mode: 'driving'
    });
    
    if (!data.routes || data.routes.length === 0) {
      return { path: [], duration: 0 };
    }
    
    let path = [];
    let totalDuration = 0;
    
    for (const leg of data.routes[0].legs) {
      totalDuration += leg.duration.value;
      
      for (const step of leg.steps) {
        const points = decode(step.polyline.points);
        path = [...path, ...points];
      }
    }
    
    return { 
      path: path.map(point => [point[0], point[1]]), 
      duration: totalDuration 
    };
  } catch (error) {
    console.error("Error getting directions:", error);
    return { path: [], duration: 0 };
  }
}

/**
 * Gets a point along a route at a specified distance
 * @param {Array<[number, number]>} routePoints - Array of route points
 * @param {number} distanceKm - Target distance in kilometers
 * @returns {[number, number]} Point along the route
 */
function getPointAlongRoute(routePoints, distanceKm) {
  let totalDistance = 0;
  
  for (let i = 1; i < routePoints.length; i++) {
    const segDistance = getDistance(routePoints[i - 1], routePoints[i]);
    totalDistance += segDistance;
    
    if (totalDistance >= distanceKm) {
      return routePoints[i];
    }
  }
  
  return routePoints[routePoints.length - 1];
}

/**
 * Searches for nearby EV charging stations
 * @param {[number, number]} location - Location coordinates [lat, lng]
 * @returns {Promise<Array>} Array of charging stations
 */
async function searchNearbyEvStations(location, initialRadius = 50000, maxRadius = 150000, step = 25000) {
  const [lat, lng] = location;
  let radius = initialRadius;
  
  while (radius <= maxRadius) {
    console.log(`Searching EV stations near [${lat}, ${lng}] within ${radius} meters...`);
    
    try {
      // Make API request through our helper function
      const data = await makeGoogleMapsApiRequest('place/nearbysearch/json', {
        location: `${lat},${lng}`,
        radius: radius.toString(),
        keyword: 'EV charging station',
        type: 'charging_station'
      });
      
      if (data.results && data.results.length > 0) {
        return data.results.map(place => ({
          name: place.name,
          location: [place.geometry.location.lat, place.geometry.location.lng],
          vicinity: place.vicinity || '',
          chargingSpeedKW: [30,45,60][Math.floor(Math.random() * 3)], // Random charging speed
          waitTimeMin: Math.floor(Math.random() * 26) + 5 // Random wait time between 5-30 min
        }));
      }
      
      radius += step;
    } catch (error) {
      console.error("Error finding charging stations:", error);
      return [];
    }
  }
  
  return [];
}

/**
 * Filters stations that are closer to destination than current location
 * @param {Array} stations - Array of charging stations
 * @param {[number, number]} current - Current coordinates [lat, lng]
 * @param {[number, number]} destination - Destination coordinates [lat, lng]
 * @returns {Array} Filtered stations
 */
function filterStationsTowardDestination(stations, current, destination) {
  return stations.filter(station => 
    getDistance(station.location, destination) < getDistance(current, destination)
  );
}

/**
 * Scores stations based on their proximity to destination
 * @param {Array} stations - Array of charging stations
 * @param {[number, number]} destination - Destination coordinates [lat, lng]
 * @returns {Array} Scored stations
 */
function scoreStations(stations, destination) {
  return stations
    .map(station => {
      const dist = getDistance(station.location, destination);
      return { ...station, score: 1 / (dist + 1e-5) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Plans an EV route
 * @param {[number, number]} start - Starting coordinates [lat, lng]
 * @param {[number, number]} destination - Destination coordinates [lat, lng]
 * @param {number} batteryPercentage - Initial battery percentage
 * @param {number} fullRangeKm - Maximum range in kilometers on full battery
 * @returns {Promise<Object>} Route information
 */
export async function planEvRoute(start, destination, batteryPercentage, fullRangeKm) {
  let current = start;
  const route = [start];
  let remainingBattery = batteryPercentage;
  const stationsVisited = [];
  
  let totalDriveTimeSec = 0;
  let totalChargingTimeMin = 0;
  let totalWaitTimeMin = 0;
  const batteryCapacityKWh = 60;
  
  const logs = [];
  
  function log(message) {
    console.log(message);
    logs.push(message);
  }
  
  while (getDistance(current, destination) > 0) {
    const maxRange = (remainingBattery / 100) * fullRangeKm * 0.9;
    
    log(`Current location: [${current[0].toFixed(4)}, ${current[1].toFixed(4)}]`);
    log(`Distance to destination: ${getDistance(current, destination).toFixed(2)} km`);
    log(`Battery: ${remainingBattery.toFixed(2)}%, Estimated range: ${maxRange.toFixed(2)} km (with 10% reserve)`);
    
    if (getDistance(current, destination) <= maxRange) {
      log("Destination is within range. Driving directly.");
      const { path, duration } = await getRoadPathAndTimeWithTraffic(current, destination);
      totalDriveTimeSec += duration;
      route.push(destination);
      break;
    }
    
    const { path: routePoints } = await getRoadPathAndTimeWithTraffic(current, destination);
    
    if (!routePoints || routePoints.length === 0) {
      log("No route found.");
      break;
    }
    
    const idealPoint = getPointAlongRoute(routePoints, maxRange);
    log(`Targeting a point ${maxRange.toFixed(2)} km away: [${idealPoint[0].toFixed(4)}, ${idealPoint[1].toFixed(4)}]`);
    
    const nearbyStations = await searchNearbyEvStations(idealPoint);
    
    if (!nearbyStations || nearbyStations.length === 0) {
      log("No EV stations found near this segment.");
      break;
    }
    
    const filtered = filterStationsTowardDestination(nearbyStations, current, destination);
    
    if (!filtered || filtered.length === 0) {
      log("No suitable charging stations on the way.");
      break;
    }
    
    log(`Found ${filtered.length} stations after filtering:`);
    filtered.forEach(station => {
      log(`- ${station.name} at [${station.location[0].toFixed(4)}, ${station.location[1].toFixed(4)}] (${station.vicinity})`);
    });
    
    const scoredStations = scoreStations(filtered, destination);
    const reachableStations = [];
    
    for (const station of scoredStations) {
      const distanceToStation = getDistance(current, station.location);
      const batteryRequired = (distanceToStation / fullRangeKm) * 100;
      
      if (batteryRequired <= remainingBattery) {
        reachableStations.push({
          ...station,
          batteryUsed: batteryRequired,
          distance: distanceToStation
        });
      }
    }
    
    if (!reachableStations || reachableStations.length === 0) {
      log("No reachable stations found.");
      break;
    }
    
    const best = reachableStations[0];
    log(`Travelling to: ${best.name} (${best.vicinity}) | Distance: ${best.distance.toFixed(2)} km | Battery used: ${best.batteryUsed.toFixed(2)}%`);
    
    const { path, duration } = await getRoadPathAndTimeWithTraffic(current, best.location);
    totalDriveTimeSec += duration;
    
    remainingBattery -= best.batteryUsed;
    
    const batteryToCharge = (100 - remainingBattery) / 100;
    const energyNeededKWh = batteryToCharge * batteryCapacityKWh;
    const chargingTimeHr = energyNeededKWh / best.chargingSpeedKW;
    const chargingTimeMin = chargingTimeHr * 60;
    
    totalChargingTimeMin += chargingTimeMin;
    totalWaitTimeMin += best.waitTimeMin;
    
    log(`Charging at ${best.name} | Charging time: ${chargingTimeMin.toFixed(1)} min | Wait: ${best.waitTimeMin} min`);
    
    current = best.location;
    remainingBattery = 100;
    stationsVisited.push(best);
    route.push(current);
  }
  
  // Final leg to destination if needed
  if (route[route.length - 1][0] !== destination[0] || route[route.length - 1][1] !== destination[1]) {
    const { path, duration } = await getRoadPathAndTimeWithTraffic(current, destination);
    totalDriveTimeSec += duration;
    route.push(destination);
  }
  
  const totalDriveTimeHr = totalDriveTimeSec / 3600;
  const totalChargingTimeHr = totalChargingTimeMin / 60;
  const totalWaitTimeHr = totalWaitTimeMin / 60;
  const totalTripTimeHr = totalDriveTimeHr + totalChargingTimeHr + totalWaitTimeHr;
  
  log("Trip Summary:");
  log(`Total Driving Time: ${totalDriveTimeHr.toFixed(2)} hrs`);
  log(`Total Charging Time: ${totalChargingTimeHr.toFixed(2)} hrs`);
  log(`Total Wait Time: ${totalWaitTimeHr.toFixed(2)} hrs`);
  log(`Total Trip Time: ${totalTripTimeHr.toFixed(2)} hrs`);
  
  return {
    route,
    chargingStops: stationsVisited,
    summary: {
      drivingTime: totalDriveTimeHr,
      chargingTime: totalChargingTimeHr,
      waitTime: totalWaitTimeHr,
      totalTime: totalTripTimeHr
    },
    logs
  };
}

// Re-export the server function for client use
export const planEvRoute = serverPlanEvRoute; 