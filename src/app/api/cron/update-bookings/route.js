import { NextResponse } from 'next/server';
import { updateCompletedBookings } from '@/app/utils/bookingManager';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const updatedCount = await updateCompletedBookings();
    
    return NextResponse.json({
      success: true,
      updatedCount
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json(
      { error: 'Failed to update completed bookings' },
      { status: 500 }
    );
  }
}
