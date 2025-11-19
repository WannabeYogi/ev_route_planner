import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import Booking from '@/app/models/Booking';
import User from '@/app/models/User';
import connectToDatabase from '@/app/utils/mongodb';

// GET endpoint to retrieve all bookings (admin only)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await connectToDatabase();
    
    // Check if user is an admin (you can implement this based on your user model)
    const user = await User.findById(session.user.id);
    
    // For now, we'll allow all authenticated users to access this endpoint
    // In production, you should implement proper admin checks
    
    const { searchParams } = new URL(request.url);
    const isCompleted = searchParams.get('isCompleted');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    let query = {};
    
    // Filter by completion status if provided
    if (isCompleted !== null) {
      query.isCompleted = isCompleted === 'true';
    }
    
    // Get bookings with pagination
    const bookings = await Booking.find(query)
      .sort({ startTime: -1 }) // Most recent first
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const totalCount = await Booking.countDocuments(query);
    
    return NextResponse.json({
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
        isCompleted: b.isCompleted,
        createdAt: b.createdAt
      })),
      pagination: {
        total: totalCount,
        limit,
        skip,
        hasMore: skip + bookings.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error retrieving bookings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve bookings' },
      { status: 500 }
    );
  }
}
