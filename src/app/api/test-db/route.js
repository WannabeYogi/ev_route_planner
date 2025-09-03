import { NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';

export async function GET() {
  try {
    // Test database connection
    await connectToDatabase();
    
    return NextResponse.json(
      { success: true, message: 'Database connection successful' }
    );
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { error: 'Database connection failed', details: error.message },
      { status: 500 }
    );
  }
}
