import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function BookingModal({ station, onClose, onBook }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState('');
  const [startDate, setStartDate] = useState('');
  
  useEffect(() => {
    if (station.arrivalTime) {
      const arrivalTime = new Date(station.arrivalTime);
      setStartDate(formatInTimeZone(arrivalTime, 'Asia/Kolkata', 'yyyy-MM-dd'));
      setStartTime(formatInTimeZone(arrivalTime, 'Asia/Kolkata', 'HH:mm'));
    } else {
      const now = new Date();
      setStartDate(formatInTimeZone(now, 'Asia/Kolkata', 'yyyy-MM-dd'));
      setStartTime(formatInTimeZone(now, 'Asia/Kolkata', 'HH:mm'));
    }
  }, [station]);
  
  const handleBooking = async () => {
    setIsLoading(true);
    setError(null);
    
    if (!startDate || !startTime) {
      setError('Please select a start date and time');
      setIsLoading(false);
      return;
    }
    
    try {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      
      const response = await fetch('/api/stations/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stationId: station._id,
          startTime: startDateTime.toISOString(),
          chargingTimeMin: station.chargingTimeMin,
          batteryStart: station.batteryBefore,
          batteryEnd: station.batteryAfter
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to book station');
      }
      
      onBook(data.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getEndTime = () => {
    if (!startDate || !startTime) return '';
    
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + station.chargingTimeMin * 60 * 1000);
    
    return formatInTimeZone(endDateTime, 'Asia/Kolkata', 'MMM d, h:mm a');
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Book Charging Station</h2>
        
        <div className="mb-4">
          <h3 className="font-semibold">{station.name}</h3>
          <p className="text-gray-600">{station.vicinity}</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arrival Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border rounded-md"
            min={format(new Date(), 'yyyy-MM-dd')}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arrival Time
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full p-2 border rounded-md"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Estimated End Time</p>
            <p>{getEndTime()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Charging Speed</p>
            <p>{station.chargingSpeedKW} kW</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Charging Time</p>
            <p>{Math.round(station.chargingTimeMin)} minutes</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Battery Before</p>
            <p>{Math.round(station.batteryBefore)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Battery After</p>
            <p>{Math.round(station.batteryAfter)}%</p>
          </div>
        </div>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}
        
        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            Cancel
          </button>
          <button 
            onClick={handleBooking}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-blue-300"
          >
            {isLoading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
