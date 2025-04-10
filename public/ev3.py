import googlemaps
from haversine import haversine
import folium
import time
import sys
import json
import traceback
import math

# Enable debug mode for troubleshooting
DEBUG = True

def debug_print(msg):
    """Print debug message to stderr"""
    if DEBUG:
        print(f"DEBUG: {msg}", file=sys.stderr)

# Initialize Google Maps API
API_KEY = "AIzaSyA8FXr0bT_nN_oTae0S2f_cNPZj-zNQRlQ"
try:
    gmaps = googlemaps.Client(key=API_KEY)
    debug_print("Google Maps client initialized successfully")
except Exception as e:
    debug_print(f"Error initializing Google Maps client: {str(e)}")
    # Continue with a dummy client as we'll use haversine as fallback

# Constants
MIN_ARRIVAL_BATTERY = 10  # Minimum battery percentage on arrival
SEARCH_RADIUS_KM = 50     # Initial search radius - smaller for more precise results
CHARGING_SPEED_KW = 60    # Charging speed in kW
BATTERY_CAPACITY_KWH = 50 # Battery capacity in kWh
MAX_BATTERY_USAGE = 0.9   # Maximum battery percentage to use before requiring a charge (keeping 10% reserve)

def get_distance_km(origin, destination):
    try:
        result = gmaps.distance_matrix(origins=[origin], destinations=[destination], mode='driving')
        distance = result['rows'][0]['elements'][0]['distance']['value'] / 1000  # meters to km
        return distance
    except Exception as e:
        debug_print(f"Error getting distance from API: {str(e)}")
        # Fallback to haversine
        try:
            dist = haversine(origin, destination)
            debug_print(f"Using haversine fallback: {dist} km")
            return dist
        except Exception as e2:
            debug_print(f"Error in haversine fallback: {str(e2)}")
            # As last resort, return a simple approximation based on coordinates
            lat_diff = abs(origin[0] - destination[0])
            lng_diff = abs(origin[1] - destination[1])
            return (lat_diff + lng_diff) * 111  # Rough approximation (1 degree ≈ 111 km)

def get_ev_stations(location, radius_km, max_results=5):
    debug_print(f"Searching for stations near {location} with radius {radius_km} km")
    radius_m = int(radius_km * 1000)
    try:
        results = gmaps.places_nearby(
            location=location, 
            radius=radius_m, 
            keyword='EV charging station'
        )
        
        stations = []
        for res in results.get('results', [])[:max_results]:
            name = res.get('name', 'Unknown Charging Station')
            lat = res['geometry']['location']['lat']
            lng = res['geometry']['location']['lng']
            vicinity = res.get('vicinity', 'Unknown location')
            
            # Clean up name
            if 'charging station' not in name.lower() and 'charger' not in name.lower():
                name = f"{name} Charging Station"
            
            stations.append((name, lat, lng, vicinity))
            debug_print(f"Found station: {name} at {lat}, {lng}")
        
        if not stations:
            debug_print("No stations found, trying with EV station keyword")
            # Try with just "EV" keyword if no results
            results = gmaps.places_nearby(
                location=location, 
                radius=radius_m, 
                keyword='EV station'
            )
            
            for res in results.get('results', [])[:max_results]:
                name = res.get('name', 'Unknown Charging Station')
                lat = res['geometry']['location']['lat']
                lng = res['geometry']['location']['lng']
                vicinity = res.get('vicinity', 'Unknown location')
                
                # Add to list if not already there
                if not any(s[1] == lat and s[2] == lng for s in stations):
                    stations.append((name, lat, lng, vicinity))
                    debug_print(f"Found additional station: {name} at {lat}, {lng}")
        
        # If still no stations, create dummy ones
        if not stations:
            debug_print("No stations found with any keywords, creating dummy stations")
            # Create 2 dummy stations
            stations.append(("Dummy Charging Station 1", location[0] + 0.05, location[1] + 0.05, "Near current location"))
            stations.append(("Dummy Charging Station 2", location[0] - 0.05, location[1] - 0.05, "Near current location"))
        
        return stations
    except Exception as e:
        debug_print(f"Error getting stations: {str(e)}")
        # Return dummy stations in case of error
        return [
            ("Fallback Charging Station 1", location[0] + 0.05, location[1] + 0.05, "Estimated location"),
            ("Fallback Charging Station 2", location[0] - 0.05, location[1] - 0.05, "Estimated location")
        ]

def is_forward(current, candidate, destination):
    """Check if candidate is generally in the direction of destination from current"""
    try:
        current_to_dest = haversine(current, destination)
        candidate_to_dest = haversine(candidate, destination)
        return candidate_to_dest < current_to_dest
    except Exception as e:
        debug_print(f"Error in is_forward: {str(e)}")
        # Simplified fallback calculation
        current_dist = abs(current[0] - destination[0]) + abs(current[1] - destination[1])
        candidate_dist = abs(candidate[0] - destination[0]) + abs(candidate[1] - destination[1])
        return candidate_dist < current_dist

def find_best_station(current, destination, usable_range):
    debug_print(f"Finding best station from {current} with usable range {usable_range}")
    
    # Calculate maximum safe distance based on battery usage policy
    safe_distance = usable_range * MAX_BATTERY_USAGE
    debug_print(f"Safe distance with {MAX_BATTERY_USAGE*100}% battery usage: {safe_distance} km")
    
    # Limit searches to avoid hanging
    max_search_attempts = 3
    
    # First try to find stations within safe range
    for attempt in range(max_search_attempts):
        debug_print(f"Search attempt {attempt+1}")
        # For first attempt, try with safe distance
        # For subsequent attempts, increase radius but still prefer close stations
        search_radius = min(safe_distance * (1 + attempt * 0.2), SEARCH_RADIUS_KM * (attempt + 1))
        debug_print(f"Search radius: {search_radius} km")
        
        stations = get_ev_stations(current, search_radius)
        
        # Filter for stations that are in the general direction of the destination
        forward_stations = []
        for station in stations:
            station_coords = (station[1], station[2])
            if is_forward((current[0], current[1]), station_coords, destination):
                # Calculate distance to this station
                dist = get_distance_km((current[0], current[1]), station_coords)
                # Also calculate distance from station to destination
                dist_to_dest = get_distance_km(station_coords, destination)
                
                debug_print(f"Station {station[0]} is forward, distance: {dist} km, to destination: {dist_to_dest} km")
                
                # Check if within range (prioritize stations within safe range)
                is_within_safe_range = dist <= safe_distance
                
                if dist <= usable_range * 0.9:  # 90% of range for better margin
                    # Lower score is better - prioritize stations within safe range
                    # and those that make more progress toward destination
                    score = dist_to_dest + dist/2
                    if not is_within_safe_range:
                        score += 1000  # Penalize stations beyond safe range
                    
                    forward_stations.append((station, dist, score, is_within_safe_range))
                    debug_print(f"Added to forward stations with score {score}, within safe range: {is_within_safe_range}")
        
        if forward_stations:
            # First try stations within safe range
            safe_stations = [s for s in forward_stations if s[3]]
            if safe_stations:
                # Sort by score (lower is better)
                safe_stations.sort(key=lambda x: x[2])
                debug_print(f"Selected safe station: {safe_stations[0][0][0]}")
                return safe_stations[0][0]  # Return the best safe station
            
            # If no safe stations, use any available station
            # Sort by score (lower is better)
            forward_stations.sort(key=lambda x: x[2])
            debug_print(f"No safe stations available, selected best station: {forward_stations[0][0][0]}")
            return forward_stations[0][0]  # Return the best station
    
    debug_print("No suitable stations found, creating fallback station")
    # If no stations found, create a fallback station in the direction of destination
    # Calculate midpoint as fallback
    mid_lat = (current[0] + destination[0]) / 2
    mid_lng = (current[1] + destination[1]) / 2
    
    return ("Fallback Charging Station", mid_lat, mid_lng, "Estimated location")

def get_bearing(start_point, end_point):
    import math
    
    lat1, lon1 = math.radians(start_point[0]), math.radians(start_point[1])
    lat2, lon2 = math.radians(end_point[0]), math.radians(end_point[1])
    
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    
    bearing = math.atan2(y, x)
    bearing = math.degrees(bearing)
    bearing = (bearing + 360) % 360
    
    return bearing

def get_point_at_distance(start_point, distance_km, bearing):
    import math
    
    R = 6371  # Earth's radius in km
    
    lat1 = math.radians(start_point[0])
    lon1 = math.radians(start_point[1])
    bearing_rad = math.radians(bearing)
    
    lat2 = math.asin(math.sin(lat1) * math.cos(distance_km/R) + 
                     math.cos(lat1) * math.sin(distance_km/R) * math.cos(bearing_rad))
    
    lon2 = lon1 + math.atan2(math.sin(bearing_rad) * math.sin(distance_km/R) * math.cos(lat1), 
                             math.cos(distance_km/R) - math.sin(lat1) * math.sin(lat2))
    
    return (math.degrees(lat2), math.degrees(lon2))

def get_place_details(lat, lng):
    """Get more detailed address information for a location"""
    try:
        reverse_geocode = gmaps.reverse_geocode((lat, lng))
        if reverse_geocode and len(reverse_geocode) > 0:
            return reverse_geocode[0].get('formatted_address', 'Unknown location')
        return 'Unknown location'
    except Exception as e:
        debug_print(f"Error getting place details: {str(e)}")
        return 'Location details unavailable'

def plan_ev_route(source_lat, source_lng, dest_lat, dest_lng, initial_battery_percent, battery_capacity):
    """Main route planning function"""
    debug_print(f"Planning route from ({source_lat}, {source_lng}) to ({dest_lat}, {dest_lng})")
    debug_print(f"Battery: {initial_battery_percent}%, Capacity: {battery_capacity} km")
    
    source = (source_lat, source_lng)
    destination = (dest_lat, dest_lng)
    
    # Initialize result
    result = {
        "path": [],
        "stations": [],
        "total_distance": 0,
        "total_time": 0,
        "battery_info": {
            "initial": initial_battery_percent,
            "arrival": 0,
            "capacity": battery_capacity,
        }
    }
    
    # Add source and destination to stations list
    source_address = get_place_details(source_lat, source_lng)
    dest_address = get_place_details(dest_lat, dest_lng)
    
    result["stations"].append({
        "name": "Starting Point",
        "id": "Source",
        "type": "source",
        "location": {"lat": source_lat, "lng": source_lng},
        "address": source_address
    })
    
    result["stations"].append({
        "name": "Destination",
        "id": "Destination",
        "type": "destination",
        "location": {"lat": dest_lat, "lng": dest_lng},
        "address": dest_address
    })
    
    # Check if direct route is possible
    direct_distance = get_distance_km(source, destination)
    debug_print(f"Direct distance: {direct_distance} km")
    
    # Calculate effective range based on initial battery
    usable_range = (initial_battery_percent / 100) * battery_capacity
    debug_print(f"Usable range: {usable_range} km")
    
    # Verify if direct route is possible while maintaining minimum battery
    direct_discharge = (direct_distance / battery_capacity) * 100
    remaining_battery = initial_battery_percent - direct_discharge
    
    if direct_distance <= usable_range and remaining_battery >= MIN_ARRIVAL_BATTERY:
        debug_print("Direct route is possible, no charging needed")
        
        # Directly reachable
        result["path"].append({
            "from": "Source",
            "to": "Destination",
            "charge_at_from": initial_battery_percent,
            "distance": direct_distance,
            "from_coords": {"lat": source_lat, "lng": source_lng},
            "to_coords": {"lat": dest_lat, "lng": dest_lng},
            "station_name": "Starting Point"
        })
        
        result["total_distance"] = direct_distance
        result["total_time"] = direct_distance / 60 * 60  # Assuming 60 km/h average speed
        result["battery_info"]["arrival"] = remaining_battery
        result["total_charging_time"] = 0  # No charging needed for direct route
        
        debug_print("Returning direct route result")
        return result

    # Need to find charging stations
    debug_print("Finding charging stations for the route")
    
    # Calculate ideal stopping points based on battery capacity
    # We want to stop when battery reaches approximately 10%
    ideal_distance_per_segment = (battery_capacity * (initial_battery_percent - MIN_ARRIVAL_BATTERY)) / 100
    debug_print(f"Ideal distance per segment: {ideal_distance_per_segment} km (stopping at {MIN_ARRIVAL_BATTERY}% battery)")
    
    # Variables for the journey
    current = source
    current_id = "Source"
    current_station_name = "Starting Point"
    current_battery = initial_battery_percent
    
    total_distance = 0
    station_counter = 0
    
    # Limit to prevent infinite loops
    max_stations = 10  # Increased to handle long routes
    
    while station_counter < max_stations:
        debug_print(f"Finding station #{station_counter+1}")
        
        # Calculate remaining range with current battery
        current_range = (current_battery / 100) * battery_capacity
        debug_print(f"Current battery: {current_battery}%, range: {current_range} km")
        
        # Calculate distance to destination
        distance_to_dest = get_distance_km(current, destination)
        debug_print(f"Distance to destination: {distance_to_dest} km")
        
        # Check if destination can be reached with current battery
        discharge_to_dest = (distance_to_dest / battery_capacity) * 100
        arrival_battery = current_battery - discharge_to_dest
        debug_print(f"Arrival battery if direct: {arrival_battery}%")
        
        if distance_to_dest <= current_range and arrival_battery >= MIN_ARRIVAL_BATTERY:
            debug_print("Destination is reachable from current location")
            
            # We can reach destination directly
            result["path"].append({
                "from": current_id,
                "to": "Destination",
                "charge_at_from": current_battery,
                "distance": distance_to_dest,
                "from_coords": {"lat": current[0], "lng": current[1]},
                "to_coords": {"lat": dest_lat, "lng": dest_lng},
                "station_name": current_station_name
            })
            
            total_distance += distance_to_dest
            result["total_distance"] = total_distance
            result["total_time"] = total_distance / 60 * 60  # Assuming 60 km/h average speed
            result["battery_info"]["arrival"] = arrival_battery
            
            # Calculate charging time
            charging_time_per_stop = (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60)  # Time in minutes for 100% charge
            result["total_charging_time"] = station_counter * charging_time_per_stop
            
            debug_print("Route planning completed successfully")
            return result
        
        # Calculate desired next charging point - target 10% battery remaining
        desired_travel_distance = current_range - (MIN_ARRIVAL_BATTERY / 100 * battery_capacity)
        # Add a small buffer to avoid cutting it too close
        desired_travel_distance *= 0.97  # 3% buffer
        debug_print(f"Desired travel distance to next stop: {desired_travel_distance} km")
        
        # Calculate distance along path toward destination
        bearing_to_dest = get_bearing(current, destination)
        ideal_next_point = get_point_at_distance(current, min(desired_travel_distance, distance_to_dest * 0.7), bearing_to_dest)
        debug_print(f"Ideal next point: {ideal_next_point}")
        
        # Find charging stations near the ideal point with a reasonable radius
        search_radius = min(50, desired_travel_distance * 0.2)  # Limit search radius
        stations = get_ev_stations(ideal_next_point, search_radius)
        
        if not stations:
            debug_print("No stations found near ideal point, widening search")
            # Try a wider search if no stations found
            search_radius = min(80, desired_travel_distance * 0.3)
            stations = get_ev_stations(ideal_next_point, search_radius * 1.5)
        
        # Find best station balancing distance from ideal point and path adherence
        best_station = None
        best_score = float('inf')
        
        for station in stations:
            station_coords = (station[1], station[2])
            
            # Distance from current to station
            dist_to_station = get_distance_km(current, station_coords)
            
            # Only consider if station is reachable and provides meaningful progress
            if dist_to_station <= current_range * 0.99 and dist_to_station >= desired_travel_distance * 0.5:
                # Distance from station to destination
                dist_station_to_dest = get_distance_km(station_coords, destination)
                
                # Score based on:
                # 1. How close it is to ideal distance (lower deviation is better)
                # 2. How well it adheres to the path to destination (closer to direct line is better)
                distance_deviation = abs(dist_to_station - desired_travel_distance)
                
                # Path adherence - roughly estimate as deviation from straight line path
                direct_path_deviation = (dist_to_station + dist_station_to_dest) - distance_to_dest
                
                # Calculate score - lower is better
                score = distance_deviation + direct_path_deviation * 0.5
                
                debug_print(f"Station {station[0]}: dist={dist_to_station}, deviation={distance_deviation}, path_dev={direct_path_deviation}, score={score}")
                
                if score < best_score:
                    best_score = score
                    best_station = station
        
        # If no suitable station found, use a fallback
        if not best_station:
            debug_print("No suitable station found, creating fallback")
            fallback_point = get_point_at_distance(current, desired_travel_distance * 0.9, bearing_to_dest)
            best_station = ("Fallback Charging Station", fallback_point[0], fallback_point[1], "Estimated location")
        
        # Process the selected station
        station_name, station_lat, station_lng, vicinity = best_station
        station_id = f"S{station_counter}"
        debug_print(f"Selected station: {station_name} at {station_lat}, {station_lng}")
        
        # Calculate distance to station
        distance_to_station = get_distance_km(current, (station_lat, station_lng))
        debug_print(f"Distance to station: {distance_to_station} km")
        
        # Calculate battery discharge
        discharge = (distance_to_station / battery_capacity) * 100
        next_battery = current_battery - discharge
        debug_print(f"Battery after travel: {next_battery}%")
        
        # Add station to list
        station_address = get_place_details(station_lat, station_lng)
        charging_time = (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60)  # Time in minutes for full charge
        
        result["stations"].append({
            "name": station_name,
            "id": station_id,
            "type": "station",
            "vicinity": vicinity,
            "location": {"lat": station_lat, "lng": station_lng},
            "address": station_address,
            "charging_time_minutes": charging_time,
            "remaining_battery": next_battery
        })
        
        # Add to path
        result["path"].append({
            "from": current_id,
            "to": station_id,
            "charge_at_from": current_battery,
            "distance": distance_to_station,
            "from_coords": {"lat": current[0], "lng": current[1]},
            "to_coords": {"lat": station_lat, "lng": station_lng},
            "station_name": current_station_name,
            "from_address": get_place_details(current[0], current[1]),
            "to_address": station_address,
            "charging_time_minutes": charging_time,
            "driving_time_minutes": distance_to_station / 60 * 60,  # Assuming 60 km/h average speed
            "arrival_battery": next_battery
        })
        
        # Update totals
        total_distance += distance_to_station
        
        # Move to next station
        current = (station_lat, station_lng)
        current_id = station_id
        current_station_name = station_name
        
        # Charge to 100%
        current_battery = 100
        debug_print(f"Charged to {current_battery}%")
        
        station_counter += 1
    
    # If we get here, we've hit the maximum stations limit
    debug_print(f"Reached maximum stations ({max_stations}) without completing route")
    
    # Calculate remaining part of the journey
    remaining_distance = get_distance_km(current, destination)
    remaining_discharge = (remaining_distance / battery_capacity) * 100
    arrival_battery = current_battery - remaining_discharge
    
    # Complete the route with our best effort
    result["path"].append({
        "from": current_id,
        "to": "Destination",
        "charge_at_from": current_battery,
        "distance": remaining_distance,
        "from_coords": {"lat": current[0], "lng": current[1]},
        "to_coords": {"lat": dest_lat, "lng": dest_lng},
        "station_name": current_station_name,
        "arrival_battery": arrival_battery
    })
    
    # Calculate final values
    total_distance += remaining_distance
    result["total_distance"] = total_distance
    result["total_time"] = total_distance / 60 * 60  # Assuming 60 km/h average speed
    result["battery_info"]["arrival"] = arrival_battery
    
    # Calculate charging time
    charging_time_per_stop = (BATTERY_CAPACITY_KWH / CHARGING_SPEED_KW * 60)  # Time in minutes for full charge
    result["total_charging_time"] = station_counter * charging_time_per_stop
    
    # Add warning if arrival battery is low
    if arrival_battery < MIN_ARRIVAL_BATTERY:
        result["warning"] = f"Warning: This journey may not be feasible with the current parameters. Final arrival battery would be {arrival_battery:.1f}%, which is below the minimum threshold of {MIN_ARRIVAL_BATTERY}%."
    else:
        result["warning"] = f"This journey requires approximately {station_counter} charging stops. The route is about {total_distance:.1f} km with an estimated total charging time of {result['total_charging_time']:.0f} minutes."
    
    debug_print("Returning best available route")
    return result

def main():
    """Main entry point for command-line execution"""
    debug_print("Starting EV route planner")
    try:
        # Get command line arguments
        if len(sys.argv) < 7:
            debug_print("Missing arguments")
            result = {
                "error": "Missing arguments. Usage: python ev3.py source_lat source_lng dest_lat dest_lng battery_percentage battery_range"
            }
            print(json.dumps(result))
            return
        
        try:
            source_lat = float(sys.argv[1])
            source_lng = float(sys.argv[2])
            dest_lat = float(sys.argv[3])
            dest_lng = float(sys.argv[4])
            initial_charge = float(sys.argv[5])
            battery_capacity = float(sys.argv[6])
            
            debug_print(f"Arguments parsed: {source_lat}, {source_lng}, {dest_lat}, {dest_lng}, {initial_charge}, {battery_capacity}")
        except ValueError as e:
            debug_print(f"Invalid argument format: {str(e)}")
            result = {"error": f"Invalid argument: {str(e)}"}
            print(json.dumps(result))
            return
        
        # Execute route planning
        result = plan_ev_route(source_lat, source_lng, dest_lat, dest_lng, initial_charge, battery_capacity)
        
        # Ensure the result is JSON serializable
        debug_print("Serializing result to JSON")
        output = json.dumps(result)
        
        # Output the final JSON result
        debug_print("Returning final result")
        print(output)
        
    except Exception as e:
        debug_print(f"Unhandled exception: {str(e)}")
        debug_print(traceback.format_exc())
        result = {
            "error": f"An error occurred: {str(e)}",
            "status": "error"
        }
        print(json.dumps(result))

if __name__ == "__main__":
    main()
