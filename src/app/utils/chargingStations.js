'use client';

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Function to find charging stations near a route
export function findNearbyChargingStations(routeCoordinates, stations, maxDistance = 1) {
  if (!routeCoordinates || !stations) return [];
  
  const nearbyStations = new Set();

  routeCoordinates.forEach(routePoint => {
    stations.forEach(station => {
      if (!station.lattitude || !station.longitude) return;
      
      const distance = calculateDistance(
        routePoint[1], // latitude
        routePoint[0], // longitude
        parseFloat(station.lattitude),
        parseFloat(station.longitude)
      );

      if (distance <= maxDistance) {
        nearbyStations.add(station);
      }
    });
  });

  return Array.from(nearbyStations);
}

// Function to parse CSV data
export async function loadChargingStations() {
  try {
    const response = await fetch('/ev-charging-stations-india.csv');
    const csvText = await response.text();
    
    // Skip header row and parse CSV
    const rows = csvText.split('\n').slice(1);
    return rows
      .filter(row => row.trim()) // Remove empty rows
      .map(row => {
        const [name = '', state = '', city = '', address = '', lattitude = '', longitude = '', type = ''] = row.split(',').map(val => val?.trim());
        
        return {
          name: name || 'Unknown Station',
          state: state || 'N/A',
          city: city || 'N/A',
          address: address || 'N/A',
          lattitude: parseFloat(lattitude) || 0,
          longitude: parseFloat(longitude) || 0,
          type: parseInt(type) || 1
        };
      })
      .filter(station => !isNaN(station.lattitude) && !isNaN(station.longitude));
  } catch (error) {
    console.error('Error loading charging stations:', error);
    return [];
  }
}

// Function to get charging station details for popup
export function getStationPopupContent(station) {
  if (!station) return '';
  
  const {
    name = 'Unknown Station',
    address = 'N/A',
    city = 'N/A',
    state = 'N/A',
    type = 1
  } = station;

  return `
    <div class="station-popup">
      <h3>${name}</h3>
      <p>${address}</p>
      <p><strong>City:</strong> ${city}</p>
      <p><strong>State:</strong> ${state}</p>
      <p><strong>Type:</strong> ${type === 12 ? 'DC Fast Charging' : 'AC Charging'}</p>
    </div>
  `;
} 