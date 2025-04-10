import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Helper function to extract JSON from a mixed string output
function extractJsonFromString(str) {
  // Look for JSON-like content (starts with { and ends with })
  const jsonMatch = str.match(/(\{.*\})/s);
  if (jsonMatch && jsonMatch[0]) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Extracted content isn't valid JSON:", jsonMatch[0]);
      return null;
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { source, destination, batteryPercentage, batteryRange } = body;
    
    if (!source || !destination || !source.lat || !source.lng || !destination.lat || !destination.lng) {
      console.error('Missing required location data:', { source, destination });
      return NextResponse.json({ 
        error: 'Missing required location data. Both source and destination must have lat and lng coordinates.' 
      }, { status: 400 });
    }
    
    if (batteryPercentage === undefined || batteryRange === undefined) {
      console.error('Missing battery data:', { batteryPercentage, batteryRange });
      return NextResponse.json({ 
        error: 'Battery percentage and range are required.' 
      }, { status: 400 });
    }

    // Extract coordinates
    const sourceLat = source.lat;
    const sourceLng = source.lng;
    const destLat = destination.lat;
    const destLng = destination.lng;
    
    // Log what we're about to execute
    const command = `python public/ev3.py ${sourceLat} ${sourceLng} ${destLat} ${destLng} ${batteryPercentage} ${batteryRange}`;
    console.log('Executing command:', command);
    
    try {
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        console.error('Python script stderr (debug info):', stderr);
        // Don't fail just because of stderr - it contains debug info
      }
      
      // Log what we received from the script
      console.log('Python script output length:', stdout.length);
      if (stdout.length === 0) {
        return NextResponse.json({ 
          error: 'No output from route planning script. Please try again or adjust parameters.' 
        }, { status: 500 });
      }
      
      // Try to parse output directly first
      try {
        const result = JSON.parse(stdout);
        
        // Check for error response from script
        if (result.error) {
          console.error('Python script returned error:', result.error);
          return NextResponse.json({ 
            error: result.error,
            // Pass additional info if available
            distance: result.distance,
            estimated_stops: result.estimated_stops,
            charging_time_minutes: result.charging_time_minutes
          }, { status: 400 });
        }
        
        // Validate the minimum expected structure
        if (!result.path || !result.stations) {
          console.error('Invalid result structure from Python script:', result);
          
          return NextResponse.json({ 
            error: 'Invalid result structure from Python script' 
          }, { status: 500 });
        }
        
        // Check for warnings but don't fail the request
        if (result.warning) {
          console.warn('Python script returned warning:', result.warning);
          // Keep the warning in the result but continue
        }
        
        return NextResponse.json(result);
      } catch (parseError) {
        console.error('Error parsing complete output as JSON. Trying to extract JSON portion...');
        
        // Try to extract JSON from mixed output
        const extractedJson = extractJsonFromString(stdout);
        if (extractedJson) {
          console.log('Successfully extracted JSON from mixed output');
          
          // Validate the extracted JSON
          if (!extractedJson.path || !extractedJson.stations) {
            console.error('Invalid structure in extracted JSON:', extractedJson);
            return NextResponse.json({ 
              error: 'Found JSON in output but it has invalid structure' 
            }, { status: 500 });
          }
          
          return NextResponse.json(extractedJson);
        }
        
        // If we can't extract JSON, return the error
        console.error('Could not extract valid JSON from output. Raw output:', stdout);
        return NextResponse.json({ 
          error: 'Could not parse Python script output as JSON' 
        }, { status: 500 });
      }
    } catch (execError) {
      console.error('Error executing Python script:', execError);
      
      // Check if it's a Python not found error
      if (execError.message.includes('python: command not found')) {
        return NextResponse.json({ 
          error: 'Python is not installed or not in the PATH. Make sure Python is installed and accessible.',
          details: execError.message
        }, { status: 500 });
      }
      
      // Check for common Python errors
      if (execError.message.includes('ModuleNotFoundError')) {
        return NextResponse.json({ 
          error: 'Missing Python module. Make sure all required packages are installed (requests, folium, pulp).',
          details: execError.message
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Error executing Python script',
        details: execError.message
      }, { status: 500 });
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 