import { NextResponse } from 'next/server';
import planEvRoute from '../route-planner/planRoute';

export async function POST(request) {
  try {
    // Check if we're on Vercel or in production - always use JS implementation
    const useJsImplementation = process.env.USE_JAVASCRIPT_IMPLEMENTATION === 'true' || 
                                process.env.VERCEL === '1' ||
                                process.env.NODE_ENV === 'production';
    
    // Parse the request body
    const requestData = await request.json();
    
    // Expected format: { script: 'ev3.py', args: ['26.836164', '75.79507', '28.554737', '77.095866', '90', '300'] }
    const { script, args } = requestData;
    
    // If script is ev3.py or evscheduling.py, use JavaScript implementation
    if (useJsImplementation || script === 'ev3.py' || script === 'evscheduling.py') {
      console.log('Using JavaScript implementation instead of Python script');
      
      // Extract parameters from args
      if (!args || args.length < 6) {
        return NextResponse.json({
          error: "Missing arguments. Usage: source_lat source_lng dest_lat dest_lng battery_percentage battery_range"
        }, { status: 400 });
      }
      
      const [source_lat, source_lng, dest_lat, dest_lng, battery_percentage, battery_range] = args.map(Number);
      
      if (isNaN(source_lat) || isNaN(source_lng) || isNaN(dest_lat) || 
          isNaN(dest_lng) || isNaN(battery_percentage) || isNaN(battery_range)) {
        return NextResponse.json({
          error: "Invalid arguments. All arguments must be numbers."
        }, { status: 400 });
      }
      
      // Call JavaScript implementation
      const source = { lat: source_lat, lng: source_lng };
      const destination = { lat: dest_lat, lng: dest_lng };
      
      // Route planning using JavaScript implementation
      const route = await planEvRoute(source, destination, battery_percentage, battery_range);
      
      return NextResponse.json(route);
    }
    
    // If we somehow reach this point in Vercel/production, return an error
    return NextResponse.json({
      error: "Python execution is not supported in this environment"
    }, { status: 500 });
    
  } catch (error) {
    console.error('Error executing script:', error);
    return NextResponse.json({
      error: `Failed to execute script: ${error.message}`
    }, { status: 500 });
  }
} 