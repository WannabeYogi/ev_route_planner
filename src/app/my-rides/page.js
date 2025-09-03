'use client';

import { useEffect, useState } from 'react';

import Footer from '@/app/components/Footer';
import Link from 'next/link';
import Navbar from '@/app/components/Navbar';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function MyRidesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/my-rides');
      return;
    }

    // Fetch rides if authenticated
    if (status === 'authenticated') {
      fetchRides();
    }
  }, [status, router]);

  const fetchRides = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/rides');
      
      if (!response.ok) {
        throw new Error('Failed to fetch rides');
      }
      
      const data = await response.json();
      setRides(data);
    } catch (err) {
      console.error('Error fetching rides:', err);
      setError(err.message || 'Failed to load your saved rides');
    } finally {
      setIsLoading(false);
    }
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

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              <p className="ml-2 text-gray-600">Loading your saved rides...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Saved Rides</h1>
            <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Plan New Route
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
              <p className="text-red-700">{error}</p>
              <button 
                onClick={fetchRides} 
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-900"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && rides.length === 0 && !error && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <svg 
                className="w-16 h-16 mx-auto text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
                />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-gray-800">No saved rides yet</h2>
              <p className="mt-2 text-gray-600">Plan and save your first EV route to see it here.</p>
              <Link 
                href="/" 
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Plan Your First Route
              </Link>
            </div>
          )}

          {rides.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rides.map((ride) => (
                <div key={ride._id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-5">
                    <p className="text-sm text-gray-500 mb-3">
                      {new Date(ride.createdAt).toLocaleDateString()} at {new Date(ride.createdAt).toLocaleTimeString()}
                    </p>
                    
                    {/* Source location box - styled like main page */}
                    <div className="relative mb-3">
                      <div className="absolute left-4 top-1/2 -mt-1 w-2 h-2 bg-black rounded-full"></div>
                      <div className="input-field pl-8 pr-4 w-full py-2.5 flex items-center">
                        <div className="truncate">{ride.sourceLocation?.name || 'Unknown'}</div>
                      </div>
                    </div>
                    
                    {/* Destination location box - styled like main page */}
                    <div className="relative mb-4">
                      <div className="absolute left-4 top-1/2 -mt-1 w-2 h-2 bg-gray-600 rounded-full"></div>
                      <div className="input-field pl-8 pr-4 w-full py-2.5 flex items-center">
                        <div className="truncate">{ride.destinationLocation?.name || 'Unknown'}</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-xs text-blue-800 font-medium">Total Trip</p>
                        <p className="text-sm font-bold text-blue-900">
                          {formatTime(ride.routeSummary?.totalTime)}
                        </p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-xs text-green-800 font-medium">Driving Time</p>
                        <p className="text-sm font-bold text-green-900">
                          {formatTime(ride.routeSummary?.drivingTime)}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-2 rounded">
                        <p className="text-xs text-purple-800 font-medium">Charging Time</p>
                        <p className="text-sm font-bold text-purple-900">
                          {formatTime(ride.routeSummary?.chargingTime)}
                        </p>
                      </div>
                      <div className="bg-amber-50 p-2 rounded">
                        <p className="text-xs text-amber-800 font-medium">Charging Stops</p>
                        <p className="text-sm font-bold text-amber-900">
                          {ride.chargingStops?.length || 0}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm">
                        <span className="font-medium">Battery:</span> {ride.batteryPercentage}% / {ride.batteryRange}km
                      </div>
                      <Link 
                        href={`/my-rides/${ride._id}`}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
