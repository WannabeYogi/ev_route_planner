import { NextResponse } from 'next/server';
import Station from '@/app/models/Station';
import connectToDatabase from '@/app/utils/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = searchParams.get('radius') || 50; // in km
    
    await connectToDatabase();
    
    let query = {};
    
    if (lat && lng) {
      // Find stations within radius (using MongoDB geospatial query)
      query = {
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: parseFloat(radius) * 1000 // convert km to meters
          }
        }
      };
    }
    
    const stations = await Station.find(query).select('-bookings');
    
    return NextResponse.json(stations);
  } catch (error) {
    console.error('Error retrieving stations:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve stations' },
      { status: 500 }
    );
  }
}
