import { NextResponse } from 'next/server';
import { updateCompletedBookings } from '@/app/utils/bookingManager';

export async function POST(request) {
  try {
    const updatedCount = await updateCompletedBookings();
    
    return NextResponse.json({
      success: true,
      updatedCount
    });
  } catch (error) {
    console.error('Error updating completed bookings:', error);
    return NextResponse.json(
      { error: 'Failed to update completed bookings' },
      { status: 500 }
    );
  }
}
