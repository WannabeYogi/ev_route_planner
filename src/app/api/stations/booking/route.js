import Booking from '@/app/models/Booking';
import { NextResponse } from 'next/server';
import Station from '@/app/models/Station';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from '@/app/utils/mongodb';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { stationId, startTime, chargingTimeMin, batteryStart, batteryEnd } = body;
    
    if (!stationId || !startTime || !chargingTimeMin) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Find the station
    const station = await Station.findById(stationId);
    
    if (!station) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }
    
    // Calculate booking times
    const parsedStartTime = new Date(startTime);
    const endTime = new Date(parsedStartTime.getTime() + chargingTimeMin * 60 * 1000);
    
    // Check for booking conflicts with active bookings
    const hasConflict = station.bookings.some(booking => {
      // Only consider non-completed bookings
      if (booking.isCompleted) return false;
      
      // Check for time overlap
      return (parsedStartTime < booking.endTime && endTime > booking.startTime);
    });
    
    if (hasConflict) {
      return NextResponse.json(
        { error: 'Booking time conflicts with existing booking' },
        { status: 409 }
      );
    }
    
    // Create a new booking in the separate Booking collection
    const booking = new Booking({
      userId: session.user.id,
      stationId: station._id,
      stationName: station.name,
      startTime: parsedStartTime,
      endTime,
      batteryStart,
      batteryEnd,
      chargingTimeMin,
      isCompleted: false
    });
    
    await booking.save();
    
    // Also add the booking reference to the station for quick conflict checking
    station.bookings.push({
      _id: booking._id,
      userId: session.user.id,
      startTime: parsedStartTime,
      endTime,
      batteryStart,
      batteryEnd,
      isCompleted: false
    });
    
    await station.save();
    
    // Schedule a job to mark the booking as completed when it ends
    // This will be implemented with a separate system
    
    return NextResponse.json({
      success: true,
      booking: {
        id: booking._id,
        stationId: station._id,
        stationName: station.name,
        startTime: parsedStartTime,
        endTime,
        chargingTimeMin
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve station bookings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('stationId');
    const userId = searchParams.get('userId');
    
    await connectToDatabase();
    
    let query = {};
    
    if (stationId) {
      query.stationId = stationId;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    // If no parameters provided, return an error
    if (!stationId && !userId) {
      return NextResponse.json(
        { error: 'Either stationId or userId is required' },
        { status: 400 }
      );
    }
    
    // Get bookings from the Booking collection
    const bookings = await Booking.find({
      ...query,
      isCompleted: false // Only get active bookings
    }).sort({ startTime: 1 });
    
    // If stationId is provided, also get station details
    let stationDetails = null;
    if (stationId) {
      const station = await Station.findById(stationId);
      if (station) {
        stationDetails = {
          id: station._id,
          name: station.name,
          location: station.location,
          chargingSpeedKW: station.chargingSpeedKW,
        };
      }
    }
    
    return NextResponse.json({
      station: stationDetails,
      bookings: bookings.map(b => ({
        id: b._id,
        userId: b.userId,
        stationId: b.stationId,
        stationName: b.stationName,
        startTime: b.startTime,
        endTime: b.endTime,
        batteryStart: b.batteryStart,
        batteryEnd: b.batteryEnd,
        chargingTimeMin: b.chargingTimeMin,
        duration: (b.endTime - b.startTime) / (60 * 1000),
        isCompleted: b.isCompleted
      }))
    });
  } catch (error) {
    console.error('Error retrieving bookings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve bookings' },
      { status: 500 }
    );
  }
}

// PUT endpoint to mark a booking as completed
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { bookingId, isCompleted } = body;
    
    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Update the booking in the Booking collection
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { isCompleted },
      { new: true }
    );
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Also update the booking in the Station collection for consistency
    await Station.updateOne(
      { 
        _id: booking.stationId,
        'bookings._id': bookingId
      },
      {
        $set: {
          'bookings.$.isCompleted': isCompleted
        }
      }
    );
    
    return NextResponse.json({
      success: true,
      message: 'Booking updated successfully',
      booking: {
        id: booking._id,
        stationId: booking.stationId,
        stationName: booking.stationName,
        isCompleted: booking.isCompleted
      }
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to cancel a booking
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    
    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Find the booking first to check if it can be cancelled
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Check if the booking belongs to the current user
    if (booking.userId.toString() !== session.user.id) {
      return NextResponse.json(
        { error: 'You are not authorized to cancel this booking' },
        { status: 403 }
      );
    }
    
    // Check if the booking has already started
    const now = new Date();
    if (now >= booking.startTime) {
      return NextResponse.json(
        { error: 'Cannot cancel a booking that has already started' },
        { status: 400 }
      );
    }
    
    // Remove the booking from the Station collection
    await Station.updateOne(
      { _id: booking.stationId },
      { $pull: { bookings: { _id: booking._id } } }
    );
    
    // Delete the booking from the Booking collection
    await Booking.findByIdAndDelete(bookingId);
    
    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
