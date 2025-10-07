import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    searchParams.delete('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    let url = `https://maps.googleapis.com/maps/api/${endpoint}?${searchParams.toString()}`;
    if (!url.includes('key=')) {
      url += `&key=${apiKey}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying Google Maps API request:', error);
    return NextResponse.json(
      { error: 'Failed to proxy Google Maps API request', details: error.message },
      { status: 500 }
    );
  }
} 