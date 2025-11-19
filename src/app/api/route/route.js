import { NextResponse } from 'next/server';
import { planEvRoute } from '@/app/utils/serverEvRouteAlgorithm';
import User from '@/app/models/User';
import { authOptions } from '../auth/[...nextauth]/route';
import connectToDatabase from '@/app/utils/mongodb';
import { getServerSession } from 'next-auth/next';

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
    const { sourceLocation, destinationLocation, batteryPercentage, startTime } = body;
    
    if (!sourceLocation || !destinationLocation || !batteryPercentage) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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
    
    if (!user.car || !user.car.model) {
      return NextResponse.json(
        { error: 'Please set up your vehicle in your profile first' },
        { status: 400 }
      );
    }
    
    const { batteryCapacityKWh, rangeKm } = user.car;

    const result = await planEvRoute(
      [sourceLocation.lat, sourceLocation.lng],
      [destinationLocation.lat, destinationLocation.lng],
      parseFloat(batteryPercentage),
      parseFloat(rangeKm),
      parseFloat(batteryCapacityKWh),
      startTime ? new Date(startTime) : new Date()
    );
    
    // Add car information to the result for saving rides
    result.carInfo = {
      manufacturer: user.car.manufacturer,
      model: user.car.model,
      batteryCapacityKWh: user.car.batteryCapacityKWh,
      rangeKm: user.car.rangeKm
    };
    
    // Add booking information to each charging stop
    result.chargingStops = result.chargingStops.map(stop => {
      return {
        ...stop,
        canBook: true
      };
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error planning route:', error);
    return NextResponse.json(
      { error: 'Failed to plan route', details: error.message },
      { status: 500 }
    );
  }
} 