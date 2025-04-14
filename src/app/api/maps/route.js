import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Extract Google Maps API endpoint and parameters from the request
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    
    // Remove the endpoint param and keep the rest for forwarding
    searchParams.delete('endpoint');
    
    // Validate the endpoint
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }
    
    // Create the Google Maps API URL with the API key
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    // Forward the request to Google Maps API
    let url = `https://maps.googleapis.com/maps/api/${endpoint}?${searchParams.toString()}`;
    if (!url.includes('key=')) {
      url += `&key=${apiKey}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Return the response
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying Google Maps API request:', error);
    return NextResponse.json(
      { error: 'Failed to proxy Google Maps API request', details: error.message },
      { status: 500 }
    );
  }
} 