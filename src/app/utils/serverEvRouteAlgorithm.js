// Server-side only version of the EV route algorithm

import { decode } from '@googlemaps/polyline-codec';

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
 * Calculate maximum possible distance with given battery constraints
 * @param {number} startPercent - Current battery percentage
 * @param {number} minEndPercent - Minimum battery percentage to maintain
 * @param {number} batteryCapacityKwh - Battery capacity in kWh
 * @param {number} rangeKm - Maximum range in kilometers on full battery
 * @param {number} baseDischargeEfficiency - Base discharge efficiency factor
 * @returns {number} Maximum distance in kilometers
 */
function calculateMaxDistance(startPercent, minEndPercent, batteryCapacityKwh, rangeKm, baseDischargeEfficiency = 0.95) {
  if (startPercent <= minEndPercent) {
    return 0;
  }
  
  let socDischargeEfficiency = 0;
  
  if (startPercent > 80) {
    socDischargeEfficiency = 0.95;
  } else if (startPercent < 20) {
    socDischargeEfficiency = 0.90;
  } else {
    socDischargeEfficiency = 1;
  }
  
  const eff = baseDischargeEfficiency * socDischargeEfficiency;
  const usableEnergy = ((startPercent - minEndPercent) / 100) * batteryCapacityKwh * eff;
  const energyPerKm = batteryCapacityKwh / rangeKm;
  const maxDistance = usableEnergy / energyPerKm;
  
  return maxDistance;
}

/**
 * Calculate charging time using a modified logistic model
 * @param {number} currentPercent - Current battery percentage
 * @param {number} targetPercent - Target battery percentage
 * @param {number} chargerPowerKw - Charger power in kW
 * @param {number} batteryCapacityKwh - Battery capacity in kWh
 * @param {number} chargingEfficiency - Charging efficiency factor
 * @param {number} k - Logistic curve parameter
 * @returns {number} Charging time in hours
 */
function evChargingTime(currentPercent, targetPercent, chargerPowerKw, batteryCapacityKwh = 60, chargingEfficiency = 0.9, k = 1.6) {
  if (!(0 <= currentPercent && currentPercent <= 100 && 0 <= targetPercent && targetPercent <= 100)) {
    throw new Error("Percentages must be between 0 and 100");
  }
  
  // Special cases to avoid math errors
  if (currentPercent >= targetPercent) {
    return 0.0;
  }
  if (currentPercent === 0) {
    currentPercent = 0.1; // Avoid division by zero
  }
  if (targetPercent === 100) {
    targetPercent = 99.9; // Avoid division by zero
  }
  
  try {
    const unitTime = (1 / k) * Math.log(
      (targetPercent * (100 - currentPercent)) /
      (currentPercent * (100 - targetPercent))
    );
    
    const linearFullChargeTime = batteryCapacityKwh / (chargerPowerKw * chargingEfficiency);
    const logisticScale = linearFullChargeTime / 7.43;
    return unitTime * logisticScale;
  } catch (error) {
    // Fallback to linear approximation if mathematical errors occur
    const linearFullChargeTime = batteryCapacityKwh / (chargerPowerKw * chargingEfficiency);
    return linearFullChargeTime * (targetPercent - currentPercent) / 100;
  }
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
    
    // Server-side direct fetch
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&mode=driving&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
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
 * @param {[number, number]} current - Current location coordinates [lat, lng]
 * @param {[number, number]} location - Search location coordinates [lat, lng]
 * @param {number} maxRange - Maximum range in kilometers
 * @param {number} initialRadius - Initial search radius in meters
 * @param {number} maxRadius - Maximum search radius in meters
 * @param {number} step - Step size for increasing radius in meters
 * @returns {Promise<Array>} Array of charging stations
 */
async function searchNearbyEvStations(current, location, maxRange, initialRadius = 50000, maxRadius = 150000, step = 25000) {
  const [lat, lng] = location;
  let radius = initialRadius;
  
  while (radius <= maxRadius) {
    console.log(`Searching EV stations near [${lat}, ${lng}] within ${radius} meters...`);
    
    try {
      // Server-side direct fetch
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=EV%20charging%20station&type=charging_station&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const stations = [];
        
        for (const place of data.results) {
          const stationLocation = [place.geometry.location.lat, place.geometry.location.lng];
          // Only include stations that are within the maximum range
          if (getDistance(current, stationLocation) <= maxRange) {
            stations.push({
              name: place.name,
              location: stationLocation,
              vicinity: place.vicinity || '',
              chargingSpeedKW: [30, 45, 60][Math.floor(Math.random() * 3)], // Random charging speed
              waitTimeMin: Math.floor(Math.random() * 26) + 5 // Random wait time between 5-30 min
            });
          }
        }
        
        if (stations.length > 0) {
          return stations;
        }
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
 * Gets the road distance between two points using Google Maps API
 * @param {[number, number]} start - Starting coordinates [lat, lng]
 * @param {[number, number]} end - Ending coordinates [lat, lng]
 * @returns {Promise<number>} Distance in kilometers
 */
async function getRoadDistance(start, end) {
  try {
    const [startLat, startLng] = start;
    const [endLat, endLng] = end;
    
    // Server-side direct fetch
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&mode=driving&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0 || !data.routes[0].legs || !data.routes[0].legs[0].distance) {
      console.log("No route found or missing distance information, falling back to Haversine distance");
      return getDistance(start, end);
    }
    
    // Distance in meters, convert to kilometers
    return data.routes[0].legs[0].distance.value / 1000;
  } catch (error) {
    console.error("Error getting road distance:", error);
    // Fallback to Haversine formula
    return getDistance(start, end);
  }
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
  const reservePercentage = 10; // internally defined
  let current = start;
  const route = [start];
  let remainingBattery = batteryPercentage;
  const stationsVisited = [];
  
  let totalDriveTimeSec = 0;
  let totalChargingTimeMin = 0;
  let totalWaitTimeMin = 0;
  const batteryCapacityKWh = 60;
  
  const logs = [];
  let success = false;
  
  function log(message) {
    console.log(message);
    logs.push(message);
  }
  
  while (true) {
    // Use Google Maps API for the first distance calculation
    let distanceToDest;
      // For the first calculation (source to destination), use Google Maps API
      distanceToDest = await getRoadDistance(current, destination);
    
    const usableBatteryPercentage = remainingBattery - reservePercentage;
    
    // Calculate max range using the new algorithm
    const maxRange = calculateMaxDistance(
      remainingBattery,       // startPercent
      10,                     // minEndPercent
      batteryCapacityKWh,     // batteryCapacityKwh
      fullRangeKm,            // rangeKm
      0.95                    // baseDischargeEfficiency
    );
    
    // Apply traffic factor
    const trafficFactor = 0.95 + (Math.random() * 0.05); // Random between 0.95 and 1.00
    const adjustedMaxRange = maxRange * trafficFactor;
    
    log(`Current location: [${current[0].toFixed(4)}, ${current[1].toFixed(4)}]`);
    log(`Distance to destination: ${distanceToDest.toFixed(2)} km`);
    log(`Battery: ${remainingBattery.toFixed(2)}% | Usable: ${usableBatteryPercentage.toFixed(2)}% | Max range: ${adjustedMaxRange.toFixed(2)} km`);
    
    // Check if we can reach destination directly with buffer
    const batteryNeededForDest = (distanceToDest / fullRangeKm) * 100;
    if (usableBatteryPercentage >= batteryNeededForDest && remainingBattery - batteryNeededForDest >= 20) {
      log("Destination is within range with 20% buffer. Driving directly.");
      const { path, duration } = await getRoadPathAndTimeWithTraffic(current, destination);
      totalDriveTimeSec += duration;
      route.push(destination);
      success = true;
      break;
    }
    
    const { path: routePoints } = await getRoadPathAndTimeWithTraffic(current, destination);
    
    if (!routePoints || routePoints.length === 0) {
      log("Could not get directions to destination.");
      break;
    }
    
    const idealPoint = getPointAlongRoute(routePoints, adjustedMaxRange);
    log(`Targeting a point ${adjustedMaxRange.toFixed(2)} km away: [${idealPoint[0].toFixed(4)}, ${idealPoint[1].toFixed(4)}]`);
    
    const nearbyStations = await searchNearbyEvStations(current, idealPoint, adjustedMaxRange);
    
    if (!nearbyStations || nearbyStations.length === 0) {
      log("No EV stations found near ideal point.");
      break;
    }
    
    const filtered = filterStationsTowardDestination(nearbyStations, current, destination);
    
    if (!filtered || filtered.length === 0) {
      log("No stations found in direction of destination.");
      break;
    }
    
    log(`Found ${filtered.length} filtered stations toward destination:`);
    filtered.forEach(station => {
      log(`- ${station.name} at [${station.location[0].toFixed(4)}, ${station.location[1].toFixed(4)}] (${station.vicinity})`);
    });
    
    // Score and filter for reachable stations
    const scoredStations = [];
    
    for (const station of filtered) {
      const distanceToStation = getDistance(current, station.location);
      const batteryRequired = (distanceToStation / (fullRangeKm * 0.9)) * 100;
      
      if (batteryRequired > usableBatteryPercentage) {
        continue; // Skip station that requires too much battery
      }
      
      // Add additional properties to the station
      station.batteryUsed = batteryRequired;
      station.distanceToStation = distanceToStation;
      station.distanceToDest = getDistance(station.location, destination);
      station.score = 1 / (station.distanceToDest + 1e-5);
      
      scoredStations.push(station);
    }
    
    if (scoredStations.length === 0) {
      log("No reachable stations found (battery constraint).");
      break;
    }
    
    // Select the best station by score
    const best = scoredStations.reduce((prev, current) => 
      (current.score > prev.score) ? current : prev
    );
    
    log(`Going to charge at: ${best.name} (${best.vicinity})`);
    log(`Distance: ${best.distanceToStation.toFixed(2)} km | Battery used: ${best.batteryUsed.toFixed(2)}%`);
    log(`Speed: ${best.chargingSpeedKW} kW | Wait: ${best.waitTimeMin} min`);
    
    const { path, duration } = await getRoadPathAndTimeWithTraffic(current, best.location);
    totalDriveTimeSec += duration;
    
    remainingBattery -= best.batteryUsed;
    
    // Calculate optimal charge target based on distance to destination
    const distanceToDestFromStation = getDistance(best.location, destination);
    const batteryNeededFromStation = (distanceToDestFromStation / fullRangeKm) * 100;
    let targetBattery = batteryNeededFromStation + reservePercentage + 20; // Add 20% buffer
    
    if (targetBattery < 100) {
      log(`Partial charge to ${targetBattery.toFixed(1)}% (enough to reach destination + reserve)`);
    } else {
      targetBattery = 100;
      log("Full charge to 100%");
    }
    
    // Calculate charging time using the new algorithm
    const chargingTimeHr = evChargingTime(
      remainingBattery,      // currentPercent
      targetBattery,         // targetPercent
      best.chargingSpeedKW,  // chargerPowerKw
      batteryCapacityKWh     // batteryCapacityKwh
    );
    
    const chargingTimeMin = chargingTimeHr * 60;
    
    totalChargingTimeMin += chargingTimeMin;
    totalWaitTimeMin += best.waitTimeMin;
    remainingBattery = targetBattery;
    
    log(`Charging Time: ${chargingTimeMin.toFixed(1)} min | Battery after charge: ${targetBattery.toFixed(1)}%`);
    
    current = best.location;
    route.push(current);
    stationsVisited.push(best);
  }
  
  if (!success) {
    log("Trip could not be completed. Ending route planning.");
    return {
      route,
      chargingStops: stationsVisited,
      success: false,
      summary: {
        drivingTime: 0,
        chargingTime: 0,
        waitTime: 0,
        totalTime: 0
      },
      logs
    };
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
    success: true,
    summary: {
      drivingTime: totalDriveTimeHr,
      chargingTime: totalChargingTimeHr,
      waitTime: totalWaitTimeHr,
      totalTime: totalTripTimeHr
    },
    logs
  };
} 