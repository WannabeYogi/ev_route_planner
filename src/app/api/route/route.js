import { NextResponse } from 'next/server';
import { planEvRoute } from '@/app/utils/serverEvRouteAlgorithm';

export async function POST(request) {
  try {
    const body = await request.json();
    const { sourceLocation, destinationLocation, batteryPercentage, batteryRange } = body;
    
    if (!sourceLocation || !destinationLocation || !batteryPercentage || !batteryRange) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await planEvRoute(
      [sourceLocation.lat, sourceLocation.lng],
      [destinationLocation.lat, destinationLocation.lng],
      parseFloat(batteryPercentage),
      parseFloat(batteryRange)
    );
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error planning route:', error);
    return NextResponse.json(
      { error: 'Failed to plan route', details: error.message },
      { status: 500 }
    );
  }
} 