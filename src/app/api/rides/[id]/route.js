import { NextResponse } from 'next/server';
import SavedRide from '@/app/models/SavedRide';
import User from '@/app/models/User';
import connectToDatabase from '@/app/utils/mongodb';

// Helper function to get user from request (placeholder)
async function getUserFromRequest(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  if (!userId) {
    return null;
  }
  
  await connectToDatabase();
  return await User.findOne({ userId: parseInt(userId) });
}

// GET - Fetch a specific ride by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized or user not found' },
        { status: 401 }
      );
    }
    
    await connectToDatabase();
    
    const ride = await SavedRide.findById(id);
    
    if (!ride) {
      return NextResponse.json(
        { error: 'Ride not found' },
        { status: 404 }
      );
    }
    
    // Check if the ride belongs to the user
    if (ride.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized to access this ride' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(ride);
  } catch (error) {
    console.error('Error fetching ride:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ride' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific ride
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized or user not found' },
        { status: 401 }
      );
    }
    
    await connectToDatabase();
    
    const ride = await SavedRide.findById(id);
    
    if (!ride) {
      return NextResponse.json(
        { error: 'Ride not found' },
        { status: 404 }
      );
    }
    
    // Check if the ride belongs to the user
    if (ride.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this ride' },
        { status: 403 }
      );
    }
    
    // Remove the ride from the user's savedRides array
    await User.findByIdAndUpdate(
      user._id,
      { $pull: { savedRides: id } }
    );
    
    // Delete the ride
    await SavedRide.findByIdAndDelete(id);
    
    return NextResponse.json(
      { success: true, message: 'Ride deleted successfully' }
    );
  } catch (error) {
    console.error('Error deleting ride:', error);
    return NextResponse.json(
      { error: 'Failed to delete ride' },
      { status: 500 }
    );
  }
}
