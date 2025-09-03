'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import DeleteConfirmDialog from '@/app/components/DeleteConfirmDialog';
import Footer from '@/app/components/Footer';
import GoogleMap from '@/app/components/GoogleMap';
import Link from 'next/link';
import Navbar from '@/app/components/Navbar';
import { useSession } from 'next-auth/react';

export default function RideDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const rideId = params.id;
  
  const [ride, setRide] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/my-rides/' + rideId);
      return;
    }

    // Fetch ride details if authenticated
    if (status === 'authenticated' && rideId) {
      fetchRideDetails();
    }
  }, [status, router, rideId]);

  const fetchRideDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/rides/${rideId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch ride details');
      }
      
      const data = await response.json();
      setRide(data);
    } catch (err) {
      console.error('Error fetching ride details:', err);
      setError(err.message || 'Failed to load ride details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRide = async () => {
    setShowDeleteDialog(true);
  };
  
  const confirmDelete = async () => {
    try {
      const response = await fetch(`/api/rides/${rideId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete ride');
      }
      
      // Redirect back to my-rides page
      router.push('/my-rides');
    } catch (err) {
      console.error('Error deleting ride:', err);
      alert('Failed to delete ride: ' + (err.message || 'Unknown error'));
    } finally {
      setShowDeleteDialog(false);
    }
  };
  
  const cancelDelete = () => {
    setShowDeleteDialog(false);
  };

  // Helper function to format time in hours and minutes
  const formatTime = (timeInHours) => {
    if (timeInHours === undefined || timeInHours === null) return 'N/A';
    
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

  // Function to open Google Maps with the route
  const openInGoogleMaps = () => {
    if (!ride || !ride.route || ride.route.length < 2) return;
    
    // Get start and destination coordinates
    const start = ride.route[0];
    const destination = ride.route[ride.route.length - 1];
    
    // Format waypoints from charging stops
    const waypoints = ride.chargingStops
      .map(stop => `${stop.location[0]},${stop.location[1]}`)
      .join('|');
    
    // Construct Google Maps URL
    let mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${destination.lat},${destination.lng}`;
    
    // Add waypoints if available
    if (waypoints) {
      mapUrl += `&waypoints=${waypoints}&travelmode=driving`;
    }
    
    // Open in new tab
    window.open(mapUrl, '_blank');
  };

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              <p className="ml-2 text-gray-600">Loading ride details...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
              <p className="text-red-700">{error}</p>
              <div className="mt-4 flex space-x-4">
                <button 
                  onClick={fetchRideDetails} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try again
                </button>
                <Link 
                  href="/my-rides"
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to My Rides
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6">
              <p className="text-yellow-700">Ride not found</p>
              <Link 
                href="/my-rides"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to My Rides
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Format the routeData for the GoogleMap component
  const routeData = {
    route: ride.route.map(point => [point.lat, point.lng]),
    chargingStops: ride.chargingStops,
    success: true
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Custom Delete Dialog Component */}
      <DeleteConfirmDialog 
        isOpen={showDeleteDialog}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Saved Ride"
        message="Are you sure you want to delete this saved ride? This action cannot be undone."
      />
      
      <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Link 
              href="/my-rides"
              className="text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Ride Details
            </h1>
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            Saved on {new Date(ride.createdAt).toLocaleDateString()} at {new Date(ride.createdAt).toLocaleTimeString()}
          </p>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div className="w-full md:w-3/4">
              {/* Source location box - styled like main page */}
              <div className="relative mb-3">
                <div className="absolute left-4 top-1/2 -mt-1 w-2 h-2 bg-black rounded-full"></div>
                <div className="input-field pl-8 pr-4 w-full py-2.5 flex items-center">
                  <div className="truncate">{ride.sourceLocation.name}</div>
                </div>
              </div>
              
              {/* Destination location box - styled like main page */}
              <div className="relative mb-4">
                <div className="absolute left-4 top-1/2 -mt-1 w-2 h-2 bg-gray-600 rounded-full"></div>
                <div className="input-field pl-8 pr-4 w-full py-2.5 flex items-center">
                  <div className="truncate">{ride.destinationLocation.name}</div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={openInGoogleMaps}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Navigate
              </button>
              
              <button
                onClick={handleDeleteRide}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Delete
              </button>
            </div>
          </div>
          
          {/* Map */}
          <div className="h-[50vh] rounded-lg overflow-hidden shadow-lg mb-6">
            <GoogleMap 
              startLocation={{lat: ride.sourceLocation.lat, lng: ride.sourceLocation.lng}}
              destinationLocation={{lat: ride.destinationLocation.lat, lng: ride.destinationLocation.lng}}
              routeData={routeData}
            />
          </div>
          
          {/* Trip Summary */}
          <div className="bg-white rounded-lg shadow-md p-5 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Trip Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">Total Trip Time</p>
                <p className="text-2xl font-bold text-blue-900">{formatTime(ride.routeSummary.totalTime)}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800 font-medium">Driving Time</p>
                <p className="text-2xl font-bold text-green-900">{formatTime(ride.routeSummary.drivingTime)}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-800 font-medium">Charging Time</p>
                <p className="text-2xl font-bold text-purple-900">{formatTime(ride.routeSummary.chargingTime)}</p>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-lg">
                <p className="text-sm text-amber-800 font-medium">Wait Time</p>
                <p className="text-2xl font-bold text-amber-900">{formatTime(ride.routeSummary.waitTime)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 font-medium">Vehicle Battery</p>
                <div className="flex items-center mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="bg-green-600 h-4 rounded-full" 
                      style={{ width: `${ride.batteryPercentage}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 font-bold">{ride.batteryPercentage}%</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Full range: {ride.batteryRange} km
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg flex items-center">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Route Distance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {/* Calculate approximate distance based on driving time and average speed */}
                    {Math.round(ride.routeSummary.drivingTime * 60)} km
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Charging Stops */}
          {ride.chargingStops.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-5 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Charging Stops</h2>
              <div className="space-y-3">
                {ride.chargingStops.map((stop, index) => (
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
                        <p className="text-sm text-gray-600">
                          {(stop.distanceToStation || stop.distance || 0).toFixed(1)} km {index === 0 ? 'from source' : `from previous stop`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="bg-purple-50 p-2 rounded text-center">
                          <p className="text-xs text-purple-800">Charging Time</p>
                          <p className="text-sm font-medium">
                            {stop.chargingTimeMin ? `${Math.round(stop.chargingTimeMin)} min` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-amber-50 p-2 rounded text-center">
                          <p className="text-xs text-amber-800">Wait Time</p>
                          <p className="text-sm font-medium">
                            {stop.waitTimeMin ? `${Math.round(stop.waitTimeMin)} min` : '0 min'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Battery status with tooltip */}
                      <div className="flex items-center justify-between bg-gray-50 p-2 rounded relative group">
                        <div className="text-xs text-gray-700">
                          Battery: {stop.batteryBefore !== undefined ? `${Math.round(stop.batteryBefore)}%` : 'N/A'} → {stop.batteryAfter !== undefined ? `${Math.round(stop.batteryAfter)}%` : 'N/A'}
                        </div>
                        <div className="w-1/2 bg-gray-200 rounded-full h-2 cursor-help">
                          <div className="flex h-full">
                            <div 
                              className="bg-red-500 h-full rounded-l-full" 
                              style={{ width: `${stop.batteryBefore || 0}%` }}
                              title="Battery level before charging"
                            ></div>
                            <div 
                              className="bg-green-500 h-full rounded-r-full" 
                              style={{ width: `${(stop.batteryAfter || 0) - (stop.batteryBefore || 0)}%` }}
                              title="Added battery charge"
                            ></div>
                          </div>
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-48 z-10">
                          <div className="font-semibold mb-1">Battery Indicator:</div>
                          <div className="flex items-center mb-1">
                            <div className="w-3 h-3 bg-red-500 rounded-sm mr-2"></div>
                            <span>Red: Battery level before charging</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded-sm mr-2"></div>
                            <span>Green: Added battery charge</span>
                          </div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
