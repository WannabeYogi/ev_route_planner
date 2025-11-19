'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CarSelector from '@/app/components/CarSelector';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data = await response.json();
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setMessage({ type: 'error', text: 'Failed to load user data' });
    }
  };

  const handleCarSelect = async (carData) => {
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          car: {
            manufacturer: carData.manufacturer,
            model: carData.model,
            batteryCapacityKWh: carData.batteryCapacityKWh,
            rangeKm: carData.rangeKm
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setUserData(data);
      setMessage({ type: 'success', text: 'Vehicle information updated successfully' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update vehicle information' });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Profile</h1>
            
            {message.text && (
              <div className={`mb-6 p-4 rounded-md ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message.text}
              </div>
            )}
            
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Account Information</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <span className="ml-2 font-medium">{session?.user?.name || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 font-medium">{session?.user?.email}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Vehicle</h2>
                
                {userData?.car?.model ? (
                  <div className="mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-900">{userData.car.manufacturer} {userData.car.model}</h3>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <span className="text-gray-600">Battery Capacity:</span>
                          <span className="ml-1 font-medium">{userData.car.batteryCapacityKWh} kWh</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Range:</span>
                          <span className="ml-1 font-medium">{userData.car.rangeKm} km</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mb-4 text-amber-600">You haven't selected a vehicle yet. Please select one below.</p>
                )}
                
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-800 mb-4">
                    {userData?.car?.model ? 'Change Vehicle' : 'Select Your Vehicle'}
                  </h3>
                  <CarSelector onCarSelect={handleCarSelect} />
                  
                  <button
                    onClick={() => handleCarSelect(userData?.car || {})}
                    disabled={isLoading || !userData?.car?.model}
                    className={`mt-4 w-full py-2 px-4 rounded-md ${
                      userData?.car?.model
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Updating...
                      </div>
                    ) : (
                      'Save Vehicle'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
