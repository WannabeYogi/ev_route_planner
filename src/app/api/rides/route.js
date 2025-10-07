import { NextResponse } from 'next/server';
import SavedRide from '@/app/models/SavedRide';
import User from '@/app/models/User';
import { authOptions } from '../auth/[...nextauth]/route';
import connectToDatabase from '@/app/utils/mongodb';
import { getServerSession } from 'next-auth/next';

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
    
    const user = await User.findById(session.user.id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
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
    const {
      sourceLocation,
      destinationLocation,
      batteryPercentage,
      batteryRange,
      routeData
    } = body;
    
    if (!sourceLocation || !destinationLocation || !batteryPercentage || !batteryRange || !routeData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    const user = await User.findById(session.user.id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const existingRide = await SavedRide.findOne({
      user: user._id,
      'sourceLocation.lat': sourceLocation.lat,
      'sourceLocation.lng': sourceLocation.lng,
      'destinationLocation.lat': destinationLocation.lat,
      'destinationLocation.lng': destinationLocation.lng,
      batteryPercentage: batteryPercentage,
      batteryRange: batteryRange
    });
    
    if (existingRide) {
      return NextResponse.json(
        { error: 'This ride has already been saved', existingRideId: existingRide._id },
        { status: 409 }
      );
    }
    
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