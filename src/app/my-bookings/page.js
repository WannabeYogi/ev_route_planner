'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';

export default function MyBookingsPage() {
  const { data: session, status } = useSession();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active'); // active, completed, all
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchBookings();
    }
  }, [status, filter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      let url = `/api/stations/booking?userId=${session.user.id}`;
      
      if (filter !== 'all') {
        url += `&isCompleted=${filter === 'completed'}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      
      const data = await response.json();
      setBookings(data.bookings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId, startTime) => {
    try {
      // Check if the booking has already started
      const now = new Date();
      const bookingStartTime = new Date(startTime);
      
      if (now >= bookingStartTime) {
        alert('Cannot cancel a booking that has already started.');
        return;
      }
      
      // Confirm cancellation
      if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
      }
      
      setCancellingId(bookingId);
      
      const response = await fetch(`/api/stations/booking?bookingId=${bookingId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }
      
      // Refresh bookings after successful cancellation
      fetchBookings();
      alert('Booking cancelled successfully!');
    } catch (err) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 bg-red-50 rounded-lg max-w-md">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
            <p className="text-gray-700">You need to be logged in to access this page.</p>
            <a href="/login" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md">
              Go to Login
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">My Bookings</h1>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-md ${
                filter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-md ${
                filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              All
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600">You don't have any {filter !== 'all' ? filter : ''} bookings.</p>
            <a href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md">
              Plan a Route
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-lg">{booking.stationName}</h3>
                  <p className="text-gray-600 text-sm">{booking.stationId}</p>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Start Time</p>
                      <p className="font-medium">{formatInTimeZone(new Date(booking.startTime), 'Asia/Kolkata', 'MMM d, h:mm a')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">End Time</p>
                      <p className="font-medium">{formatInTimeZone(new Date(booking.endTime), 'Asia/Kolkata', 'MMM d, h:mm a')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="font-medium">{Math.round(booking.duration)} min</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className={`font-medium ${booking.isCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                        {booking.isCompleted ? 'Completed' : 'Active'}
                      </p>
                    </div>
                  </div>
                  
                  {!booking.isCompleted && (
                    <button
                      onClick={() => cancelBooking(booking.id, booking.startTime)}
                      disabled={cancellingId === booking.id}
                      className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-red-400"
                    >
                      {cancellingId === booking.id ? (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Cancelling...
                        </div>
                      ) : (
                        'Cancel Booking'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}
