'use client';

import { useEffect, useState } from 'react';

export default function RouteSummary({ routeData, isLoading, error }) {
  const [expanded, setExpanded] = useState(false);
  
  // Helper function to format time in hours and minutes
  const formatTime = (timeInHours) => {
    const hours = Math.floor(timeInHours);
    const minutes = Math.round((timeInHours - hours) * 60);
    
    // Handle correct singular/plural forms
    const hourText = hours === 1 ? 'hr' : 'hrs';
    const minuteText = minutes === 1 ? 'min' : 'mins';
    
    if (hours === 0) {
      return `${minutes} ${minuteText}`;
    } else if (minutes === 0) {
      return `${hours} ${hourText}`;
    } else {
      return `${hours} ${hourText} ${minutes} ${minuteText}`;
    }
  };
  
  // Function to group log entries into logical stages
  const groupLogsIntoStages = (logs) => {
    if (!logs || logs.length === 0) return [];
    
    const stages = [];
    let currentStage = { title: 'Starting Journey', logs: [], icon: '🚗' };
    let stationSearchStarted = false;
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log === "") continue; // Skip empty lines
      
      // Start a new stage based on key phrases
      if (log.startsWith("Current location") && i > 0) {
        stages.push(currentStage);
        currentStage = { title: 'Route Analysis', logs: [], icon: '🧭' };
      } else if (log.startsWith("Targeting a point") && !stationSearchStarted) {
        stages.push(currentStage);
        currentStage = { title: 'Finding Charging Stations', logs: [], icon: '🔍' };
        stationSearchStarted = true;
      } else if (log.startsWith("Found") && log.includes("reachable charging stations")) {
        stages.push(currentStage);
        currentStage = { title: 'Station Options', logs: [], icon: '⚡' };
      } else if (log.startsWith("Going to charge at")) {
        stages.push(currentStage);
        currentStage = { title: 'Selected Station', logs: [], icon: '🔌' };
      } else if (log.startsWith("Destination is within range")) {
        stages.push(currentStage);
        currentStage = { title: 'Final Stretch', logs: [], icon: '🏁' };
      } else if (log.startsWith("Trip Summary")) {
        stages.push(currentStage);
        currentStage = { title: 'Trip Summary', logs: [], icon: '📊' };
      }
      
      currentStage.logs.push(log);
    }
    
    // Add the last stage
    if (currentStage.logs.length > 0) {
      stages.push(currentStage);
    }
    
    return stages;
  };
  
  // Function to open Google Maps with the route
  const openInGoogleMaps = () => {
    if (!routeData || !routeData.route || routeData.route.length < 2) return;
    
    // Get start and destination coordinates
    const start = routeData.route[0];
    const destination = routeData.route[routeData.route.length - 1];
    
    // Format waypoints from charging stops
    const waypoints = routeData.chargingStops
      .map(stop => `${stop.location[0]},${stop.location[1]}`)
      .join('|');
    
    // Construct Google Maps URL
    let mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${destination[0]},${destination[1]}`;
    
    // Add waypoints if available
    if (waypoints) {
      mapUrl += `&waypoints=${waypoints}&travelmode=driving`;
    }
    
    // Open in new tab
    window.open(mapUrl, '_blank');
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-5 mt-6 mb-8">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-600">Planning your optimal EV route...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-5 mt-6 mb-8 border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-600">Error Planning Route</h3>
        <p className="text-gray-600 mt-2">{error}</p>
      </div>
    );
  }
  
  if (!routeData) {
    return null;
  }
  
  const { summary, chargingStops, logs } = routeData;
  const stages = groupLogsIntoStages(logs);
  
  return (
    <div className="bg-white rounded-lg shadow-md p-5 mt-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Route Summary</h2>
        
        {/* Navigation button */}
        {routeData.route && routeData.route.length > 1 && (
          <button
            onClick={openInGoogleMaps}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Navigate
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800 font-medium">Total Trip Time</p>
          <p className="text-2xl font-bold text-blue-900">{formatTime(summary.totalTime)}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-800 font-medium">Driving Time</p>
          <p className="text-2xl font-bold text-green-900">{formatTime(summary.drivingTime)}</p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-purple-800 font-medium">Charging Time</p>
          <p className="text-2xl font-bold text-purple-900">{formatTime(summary.chargingTime)}</p>
        </div>
        
        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="text-sm text-amber-800 font-medium">Wait Time</p>
          <p className="text-2xl font-bold text-amber-900">{formatTime(summary.waitTime)}</p>
        </div>
      </div>
      
      {chargingStops.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Charging Stops</h3>
          <div className="space-y-3">
            {chargingStops.map((stop, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{stop.name}</p>
                    <p className="text-sm text-gray-600">{stop.vicinity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-purple-700">{stop.chargingSpeedKW} kW</span> charging speed
                    </p>
                    {(stop.distanceToStation || stop.distance) && (
                      <p className="text-sm text-gray-600">
                        {(stop.distanceToStation || stop.distance).toFixed(1)} km {index === 0 ? 'from source' : `from charging station ${index}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center text-blue-600 font-medium"
        >
          <span>{expanded ? 'Hide' : 'Show'} detailed log</span>
          <svg 
            className={`ml-1 w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {expanded && logs && logs.length > 0 && (
          <div className="mt-4 overflow-y-auto max-h-[600px]">
            <div className="relative">
              {/* Timeline vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300"></div>
              
              {/* Timeline stages */}
              <div className="space-y-4">
                {stages.map((stage, stageIndex) => (
                  <div key={stageIndex} className="relative pl-14 pb-4">
                    {/* Stage icon */}
                    <div className="absolute left-0 w-12 h-12 flex items-center justify-center bg-blue-100 rounded-full border-4 border-white z-10 text-2xl">
                      {stage.icon}
                    </div>
                    
                    {/* Stage card */}
                    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                      <h4 className="font-semibold text-lg text-gray-800 mb-2">{stage.title}</h4>
                      <div className="space-y-1 text-sm text-gray-700 font-mono">
                        {stage.logs.map((log, logIndex) => {
                          // Format station list items differently
                          if (log.match(/^\d+\. .+ \(.+\)$/)) {
                            return (
                              <div key={logIndex} className="font-medium text-blue-800 mt-2">{log}</div>
                            );
                          }
                          // Format station details differently
                          else if (log.startsWith('   ')) {
                            return (
                              <div key={logIndex} className="pl-4 text-gray-600">{log.trim()}</div>
                            );
                          }
                          // Format key metrics with highlighting
                          else if (log.includes('Battery:') || log.includes('Distance to destination:') || 
                                  log.includes('km |') || log.includes('Max range:')) {
                            return (
                              <div key={logIndex} className="font-medium">{log}</div>
                            );
                          }
                          // Regular log entry
                          else {
                            return <div key={logIndex}>{log}</div>;
                          }
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 