import { NextResponse } from 'next/server';
import SavedRide from '@/app/models/SavedRide';
import User from '@/app/models/User';
import connectToDatabase from '@/app/utils/mongodb';

// Helper function to get user from request
// Note: This is a placeholder. You'll replace this with proper auth logic later.
async function getUserFromRequest(request) {
  // For now, we'll use a query parameter userId for testing
  // Later, you'll replace this with JWT token verification
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  if (!userId) {
    return null;
  }
  
  await connectToDatabase();
  return await User.findOne({ userId: parseInt(userId) });
}

// GET - Fetch user's saved rides
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized or user not found' },
        { status: 401 }
      );
    }
    
    await connectToDatabase();
    
    const rides = await SavedRide.find({ user: user._id })
      .sort({ createdAt: -1 });
    
    return NextResponse.json(rides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rides' },
      { status: 500 }
    );
  }
}

// POST - Save a new ride
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized or user not found' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const {
      sourceLocation,
      destinationLocation,
      batteryPercentage,
      batteryRange,
      routeData
    } = body;
    
    // Basic validation
    if (!sourceLocation || !destinationLocation || !batteryPercentage || !batteryRange || !routeData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Create the saved ride
    const savedRide = await SavedRide.create({
      user: user._id,
      sourceLocation: {
        name: sourceLocation.name || 'Unknown',
        lat: sourceLocation.lat,
        lng: sourceLocation.lng
      },
      destinationLocation: {
        name: destinationLocation.name || 'Unknown',
        lat: destinationLocation.lat,
        lng: destinationLocation.lng
      },
      batteryPercentage,
      batteryRange,
      routeSummary: {
        drivingTime: routeData.summary.drivingTime,
        chargingTime: routeData.summary.chargingTime,
        waitTime: routeData.summary.waitTime,
        totalTime: routeData.summary.totalTime
      },
      route: routeData.route.map(point => ({ lat: point[0], lng: point[1] })),
      chargingStops: routeData.chargingStops,
      success: routeData.success
    });
    
    // Update user's savedRides array
    await User.findByIdAndUpdate(
      user._id,
      { $push: { savedRides: savedRide._id } }
    );
    
    return NextResponse.json(
      { success: true, ride: savedRide },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving ride:', error);
    return NextResponse.json(
      { error: 'Failed to save ride' },
      { status: 500 }
    );
  }
}
