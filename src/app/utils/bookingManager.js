import Station from '@/app/models/Station';
import Booking from '@/app/models/Booking';
import connectToDatabase from '@/app/utils/mongodb';

export async function updateCompletedBookings() {
  try {
    await connectToDatabase();
    
    const now = new Date();
    
    const bookings = await Booking.find({
      endTime: { $lt: now },
      isCompleted: false
    });
    
    let updatedCount = 0;
    
    const bookingsByStation = {};
    
    for (const booking of bookings) {
      booking.isCompleted = true;
      await booking.save();
      updatedCount++;
      
      if (!bookingsByStation[booking.stationId]) {
        bookingsByStation[booking.stationId] = [];
      }
      bookingsByStation[booking.stationId].push(booking._id);
    }
    
    for (const stationId in bookingsByStation) {
      const bookingIds = bookingsByStation[stationId];
      
      await Station.updateMany(
        { 
          _id: stationId,
          'bookings._id': { $in: bookingIds }
        },
        {
          $set: {
            'bookings.$[elem].isCompleted': true
          }
        },
        {
          arrayFilters: [{ 'elem._id': { $in: bookingIds } }]
        }
      );
    }
    
    console.log(`Updated ${updatedCount} completed bookings`);
    return updatedCount;
  } catch (error) {
    console.error('Error updating completed bookings:', error);
    throw error;
  }
}
