import { NextResponse } from 'next/server';
import User from '@/app/models/User';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
    
    return NextResponse.json({
      userId: user.userId,
      name: user.name,
      email: user.email,
      car: user.car || null
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    await connectToDatabase();
    
    const user = await User.findById(session.user.id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update user data
    if (body.car) {
      user.car = {
        manufacturer: body.car.manufacturer,
        model: body.car.model,
        batteryCapacityKWh: body.car.batteryCapacityKWh,
        rangeKm: body.car.rangeKm
      };
    }
    
    await user.save();
    
    return NextResponse.json({
      userId: user.userId,
      name: user.name,
      email: user.email,
      car: user.car
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
