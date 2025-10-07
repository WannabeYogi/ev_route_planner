import { NextResponse } from 'next/server';
import SavedRide from '@/app/models/SavedRide';
import User from '@/app/models/User';
import { authOptions } from '../../auth/[...nextauth]/route';
import connectToDatabase from '@/app/utils/mongodb';
import { getServerSession } from 'next-auth/next';

export async function GET(request, context) {
  try {
    const { id } = await context.params;
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
    
    const ride = await SavedRide.findById(id);
    
    if (!ride) {
      return NextResponse.json(
        { error: 'Ride not found' },
        { status: 404 }
      );
    }
    
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

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
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
    
    const ride = await SavedRide.findById(id);
    
    if (!ride) {
      return NextResponse.json(
        { error: 'Ride not found' },
        { status: 404 }
      );
    }
    
    if (ride.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this ride' },
        { status: 403 }
      );
    }
    
    await User.findByIdAndUpdate(
      user._id,
      { $pull: { savedRides: id } }
    );
    
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