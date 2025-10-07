import { NextResponse } from 'next/server';
import User from '@/app/models/User';
import bcrypt from 'bcrypt';
import connectToDatabase from '@/app/utils/mongodb';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }
    
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });
    
    const userWithoutPassword = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    };
    
    return NextResponse.json(
      { success: true, user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
