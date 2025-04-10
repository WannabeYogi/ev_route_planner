import requests
import folium
from pulp import LpMinimize, LpProblem, LpVariable, lpSum, LpStatus
import sys
import json
import os
import traceback
import math

# Redirect PuLP/CBC output to null to avoid it appearing in our stdout
if sys.platform.startswith('win'):
    os.environ['CBC_MSG_PREFIX'] = 'null'  # Windows
else:
    os.environ['CBC_MSG_PREFIX'] = '/dev/null'  # Unix-like

# -------------------------------
# Google Maps API Key
# -------------------------------
GOOGLE_API_KEY = "AIzaSyA8FXr0bT_nN_oTae0S2f_cNPZj-zNQRlQ"

# Minimum arrival battery percentage
MIN_ARRIVAL_BATTERY = 10

# Helper to log errors without affecting JSON output
def log_error(message):
    with open("python_error.log", "a") as f:
        f.write(f"{message}\n")

# Calculate distance using Haversine formula (more accurate)
def haversine_distance(lat1, lon1, lat2, lon2):
    # Convert latitude and longitude from degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of Earth in kilometers
    return c * r

# -------------------------------
# Find EV Charging Stations using Google Places API
# -------------------------------
def get_charging_stations_google(lat, lon, radius_m=50000, max_results=3):
    try:
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lon}",
            "radius": radius_m,
            "keyword": "EV charging station",
            "key": GOOGLE_API_KEY
        }
        res = requests.get(url, params=params)
        results = res.json().get("results", [])
        
        if not results:
            log_error(f"No charging stations found near {lat},{lon}")
            # Use dummy station if no stations found
            return [("Dummy Charging Station", lat + 0.01, lon + 0.01)]
        
        stations = []
        for r in results[:max_results]:
            name = r.get("name", "Unknown Charging Station")
            location = r["geometry"]["location"]
            stations.append((name, location["lat"], location["lng"]))
        return stations
    except Exception as e:
        log_error(f"Error getting charging stations: {str(e)}")
        # Use dummy station in case of error
        return [("Dummy Charging Station", lat + 0.01, lon + 0.01)]

# -------------------------------
# Distance Matrix using Google Maps API
# -------------------------------
def get_distance_matrix(coords):
    try:
        origins = "|".join(f"{lat},{lon}" for lat, lon in coords)
        destinations = origins
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": origins,
            "destinations": destinations,
            "mode": "driving",
            "key": GOOGLE_API_KEY
        }

        res = requests.get(url, params=params)
        data = res.json()
        
        # Log the response for debugging
        log_error(f"Distance Matrix API Response: {json.dumps(data)}")

        if data.get("status") != "OK":
            error_msg = f"Distance Matrix API error: {data.get('error_message')}"
            log_error(error_msg)
            raise Exception(error_msg)

        # Build 2D matrix of distances in meters
        matrix = []
        for row in data["rows"]:
            row_distances = []
            for elem in row["elements"]:
                if elem["status"] == "OK":
                    row_distances.append(elem["distance"]["value"])
                else:
                    # If the API can't find a route, use haversine distance as fallback
                    i = len(matrix)
                    j = len(row_distances)
                    if i < len(coords) and j < len(coords):
                        lat1, lon1 = coords[i]
                        lat2, lon2 = coords[j]
                        haversine_dist = haversine_distance(lat1, lon1, lat2, lon2) * 1000  # Convert km to meters
                        log_error(f"Using haversine fallback for {i}->{j}: {haversine_dist}m")
                        row_distances.append(haversine_dist)
                    else:
                        row_distances.append(float('inf'))
            matrix.append(row_distances)
        
        return matrix
    except Exception as e:
        log_error(f"Error getting distance matrix: {str(e)}")
        # In case of error, create a distance matrix based on haversine distance
        n = len(coords)
        matrix = []
        for i in range(n):
            row = []
            for j in range(n):
                if i == j:
                    row.append(0)  # Distance to self is 0
                else:
                    # Calculate haversine distance in meters
                    lat1, lon1 = coords[i]
                    lat2, lon2 = coords[j]
                    dist = haversine_distance(lat1, lon1, lat2, lon2) * 1000  # Convert km to meters
                    row.append(dist)
            matrix.append(row)
        return matrix

def main():
    try:
        # Get command line arguments
        if len(sys.argv) < 7:
            print(json.dumps({
                "error": "Missing arguments. Usage: python evscheduling.py source_lat source_lng dest_lat dest_lng battery_percentage battery_range"
            }))
            sys.exit(1)
        
        try:
            source_lat = float(sys.argv[1])
            source_lng = float(sys.argv[2])
            dest_lat = float(sys.argv[3])
            dest_lng = float(sys.argv[4])
            initial_charge = float(sys.argv[5])
            battery_capacity = float(sys.argv[6])
        except ValueError as e:
            print(json.dumps({"error": f"Invalid argument: {str(e)}"}))
            sys.exit(1)
        
        # -------------------------------
        # Coordinates & Charging Stations
        # -------------------------------
        source_coords = (source_lat, source_lng)
        destination_coords = (dest_lat, dest_lng)

        # Calculate direct distance using haversine formula
        direct_distance_km = haversine_distance(source_lat, source_lng, dest_lat, dest_lng)
        log_error(f"Direct distance: {direct_distance_km} km from {source_coords} to {destination_coords}")
        
        # Calculate effective battery range in km
        effective_range_km = (battery_capacity * initial_charge / 100)
        log_error(f"Effective range: {effective_range_km} km (battery: {battery_capacity} km at {initial_charge}%)")
        
        # Find charging stations near source and destination
        source_stations = get_charging_stations_google(*source_coords)
        log_error(f"Source stations: {source_stations}")
        
        destination_stations = get_charging_stations_google(*destination_coords)
        log_error(f"Destination stations: {destination_stations}")

        # Create a station list with original names
        station_name_mapping = {}  # Map from station ID to original name
        station_list = [("Source", *source_coords)]
        
        for i, (name, lat, lon) in enumerate(source_stations + destination_stations):
            station_id = f"S{i}"
            station_list.append((station_id, lat, lon))
            station_name_mapping[station_id] = name
            
        station_list.append(("Destination", *destination_coords))
        station_name_mapping["Source"] = "Starting Point"
        station_name_mapping["Destination"] = "Destination"

        station_names = [name for name, _, _ in station_list]
        coords = [(lat, lon) for _, lat, lon in station_list]

        # -------------------------------
        # Get Distance Matrix
        # -------------------------------
        log_error(f"Getting distance matrix for {len(coords)} locations")
        dist_matrix = get_distance_matrix(coords)
        
        # Log the distance matrix
        log_error(f"Distance matrix: {dist_matrix}")
        
        distances = {
            (station_names[i], station_names[j]): dist_matrix[i][j]
            for i in range(len(station_names))
            for j in range(len(station_names)) if i != j
        }

        # Check if direct route is possible with at least MIN_ARRIVAL_BATTERY remaining
        direct_discharge_percent = (direct_distance_km / battery_capacity) * 100
        remaining_charge = initial_charge - direct_discharge_percent
        
        if direct_distance_km <= effective_range_km and remaining_charge >= MIN_ARRIVAL_BATTERY:
            log_error(f"Direct route is possible ({direct_distance_km} km <= {effective_range_km} km)")
            # If we can reach destination directly with current charge and have enough remaining charge
            result = {
                "path": [
                    {
                        "from": "Source",
                        "to": "Destination",
                        "charge_at_from": initial_charge,
                        "from_coords": {"lat": source_lat, "lng": source_lng},
                        "to_coords": {"lat": dest_lat, "lng": dest_lng},
                        "station_name": "Starting Point"
                    }
                ],
                "stations": [
                    {
                        "name": "Starting Point",
                        "type": "source",
                        "location": {"lat": source_lat, "lng": source_lng}
                    },
                    {
                        "name": "Destination",
                        "type": "destination",
                        "location": {"lat": dest_lat, "lng": dest_lng}
                    }
                ],
                "total_distance": direct_distance_km,
                "total_time": direct_distance_km / 60,  # Assuming 60 km/h average speed
                "battery_info": {
                    "initial": initial_charge,
                    "capacity": battery_capacity,
                    "arrival": remaining_charge
                }
            }
            print(json.dumps(result))
            return

        # -------------------------------
        # MILP Optimization Model (PuLP)
        # -------------------------------
        model = LpProblem("EV_Charging_Optimization", LpMinimize)

        x = { (i, j): LpVariable(f"x_{i}_{j}", cat="Binary") for (i, j) in distances }
        charge = { i: LpVariable(f"charge_{i}", lowBound=0, upBound=battery_capacity) for i in station_names }

        penalty_per_charge = 10
        charging_time_per_unit = 1

        model += lpSum(distances[i, j] * x[i, j] for (i, j) in distances) + \
                lpSum(charging_time_per_unit * charge[i] for i in station_names) + \
                lpSum(penalty_per_charge * x[i, j] for (i, j) in distances)

        model += lpSum(x["Source", j] for j in station_names if ("Source", j) in distances) == 1
        model += lpSum(x[i, "Destination"] for i in station_names if (i, "Destination") in distances) == 1
        model += charge["Source"] == initial_charge

        # Battery discharge constraint with minimum arrival percentage
        for (i, j) in distances:
            # Convert distance to battery percentage (simple linear model)
            # Assuming battery_capacity km = 100% battery
            discharge_rate = 100 / battery_capacity  # % per km
            discharge = distances[i, j] / 1000 * discharge_rate  # discharge in %
            
            # Ensure we have enough charge to reach the next station
            model += charge[i] - discharge * x[i, j] >= 0
            
            # Set the charge at destination based on charge at source minus discharge
            model += charge[j] <= charge[i] - discharge * x[i, j] + battery_capacity * (1 - x[i, j])
            
            # Ensure minimum battery at destination
            if j == "Destination":
                model += charge[i] - discharge * x[i, j] >= MIN_ARRIVAL_BATTERY * x[i, j]

        for node in station_names:
            if node not in ["Source", "Destination"]:
                model += lpSum(x[i, node] for i in station_names if (i, node) in distances) <= 1
                model += lpSum(x[node, j] for j in station_names if (node, j) in distances) <= 1

        # Silence CBC solver output
        import io
        from contextlib import redirect_stdout, redirect_stderr

        # Solve the model with output suppressed
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            model.solve()

        # Check if the model was solved optimally
        if LpStatus[model.status] != "Optimal":
            log_error(f"Solver status: {LpStatus[model.status]}")
            print(json.dumps({
                "error": "Could not find a feasible route with the given battery constraints. Try increasing battery range or adjusting locations."
            }))
            return

        # -------------------------------
        # Results as JSON
        # -------------------------------
        path = []
        for (i, j) in distances:
            if x[i, j].varValue == 1:
                i_coords = next((lat, lon) for name, lat, lon in station_list if name == i)
                j_coords = next((lat, lon) for name, lat, lon in station_list if name == j)
                
                path.append({
                    "from": i,
                    "to": j,
                    "charge_at_from": charge[i].varValue,
                    "from_coords": {"lat": i_coords[0], "lng": i_coords[1]},
                    "to_coords": {"lat": j_coords[0], "lng": j_coords[1]},
                    "station_name": station_name_mapping.get(i, i)
                })
        
        # Validate and fix path connectivity
        if path:
            # Sort path to ensure it's continuous
            sorted_path = []
            current = "Source"
            visited = set()
            
            # Attempt to find a continuous path
            while current != "Destination" and len(sorted_path) < len(path):
                next_segment = None
                for segment in path:
                    if segment["from"] == current and segment["from"] not in visited:
                        next_segment = segment
                        break
                
                if next_segment:
                    sorted_path.append(next_segment)
                    visited.add(current)
                    current = next_segment["to"]
                else:
                    # If we can't find the next segment, log error and break
                    log_error(f"Path discontinuity found at {current}")
                    break
            
            # If we have discontinuities, log error
            if current != "Destination" and sorted_path:
                log_error(f"Failed to create continuous path: ended at {current} instead of Destination")
                log_error(f"Original path segments: {path}")
                log_error(f"Sorted path segments: {sorted_path}")
                
                # Create intermediate segments to connect discontinuities
                if len(path) >= 2:
                    # Try to find a path between the segments
                    missing_from = sorted_path[-1]["to"] if sorted_path else "Source"
                    missing_to = None
                    
                    for p in path:
                        if p["from"] not in visited and p["from"] != missing_from:
                            missing_to = p["from"]
                            break
                    
                    if missing_to:
                        # Create a direct segment
                        from_coords = next((lat, lon) for name, lat, lon in station_list if name == missing_from)
                        to_coords = next((lat, lon) for name, lat, lon in station_list if name == missing_to)
                        
                        # Add connection segment
                        connection_segment = {
                            "from": missing_from,
                            "to": missing_to,
                            "charge_at_from": sorted_path[-1]["charge_at_from"] if sorted_path else initial_charge,
                            "from_coords": {"lat": from_coords[0], "lng": from_coords[1]},
                            "to_coords": {"lat": to_coords[0], "lng": to_coords[1]},
                            "station_name": station_name_mapping.get(missing_from, missing_from)
                        }
                        path.append(connection_segment)
                        log_error(f"Added connection segment: {connection_segment}")
                    
                # Recalculate path
                sorted_path = []
                current = "Source"
                visited = set()
                
                while current != "Destination" and len(sorted_path) < len(path):
                    next_segment = None
                    for segment in path:
                        if segment["from"] == current and segment["from"] not in visited:
                            next_segment = segment
                            break
                    
                    if next_segment:
                        sorted_path.append(next_segment)
                        visited.add(current)
                        current = next_segment["to"]
                    else:
                        break
                
                if current != "Destination":
                    # If still can't create a continuous path, use the direct distance
                    log_error("Still can't create a continuous path, falling back to haversine distance")
                    total_distance_km = direct_distance_km
                    total_time_minutes = direct_distance_km / 60 * 60  # Convert hours to minutes
                else:
                    # Successfully created a continuous path
                    path = sorted_path
                    log_error(f"Successfully created a continuous path: {path}")
                    
                    # Calculate total distance and time
                    path_distance_meters = sum(distances.get((p["from"], p["to"]), 0) for p in path)
                    total_distance_km = path_distance_meters / 1000
                    total_time_minutes = total_distance_km / 60 * 60  # Convert hours to minutes
            else:
                # Calculate distance based on the sorted_path if it exists, otherwise the original path
                path_to_use = sorted_path if sorted_path else path
                
                # Calculate total distance and time
                total_distance_meters = sum(distances.get((p["from"], p["to"]), 0) for p in path_to_use)
                total_distance_km = total_distance_meters / 1000
                total_time_minutes = total_distance_km / 60 * 60  # Convert hours to minutes
                
                # Use the sorted path if it's complete
                if sorted_path and sorted_path[-1]["to"] == "Destination":
                    path = sorted_path
        else:
            # If no path found, create a fallback path
            log_error("No path found in solution, using fallback")
            
            # Calculate if direct route is possible with intermediate charging
            if direct_distance_km > effective_range_km:
                print(json.dumps({
                    "error": "Could not find a viable route with the given battery constraints. Try increasing battery range or adjusting locations."
                }))
                return
            else:
                # Fall back to direct route with just source and destination
                path = [{
                    "from": "Source",
                    "to": "Destination",
                    "charge_at_from": initial_charge,
                    "from_coords": {"lat": source_lat, "lng": source_lng},
                    "to_coords": {"lat": dest_lat, "lng": dest_lng},
                    "station_name": "Starting Point"
                }]
                total_distance_km = direct_distance_km
                total_time_minutes = direct_distance_km / 60 * 60  # Convert hours to minutes
        
        # Calculate arrival battery percentage
        arrival_battery = None
        if path and path[-1]["to"] == "Destination":
            last_segment = path[-1]
            discharge_rate = 100 / battery_capacity  # % per km
            distance_km = distances.get((last_segment["from"], last_segment["to"]), 0) / 1000
            discharge = distance_km * discharge_rate  # discharge in %
            arrival_battery = max(last_segment["charge_at_from"] - discharge, MIN_ARRIVAL_BATTERY)
        
        # Create a list of all stations with their coordinates and original names
        stations = []
        for station_id, lat, lon in station_list:
            original_name = station_name_mapping.get(station_id, station_id)
            stations.append({
                "name": original_name,
                "id": station_id,
                "type": "source" if station_id == "Source" else "destination" if station_id == "Destination" else "station",
                "location": {"lat": lat, "lng": lon}
            })
        
        # Log final path and distance
        log_error(f"Final path: {path}")
        log_error(f"Total distance: {total_distance_km} km")
        
        result = {
            "path": path,
            "stations": stations,
            "total_distance": total_distance_km,
            "total_time": total_time_minutes,
            "battery_info": {
                "initial": initial_charge,
                "capacity": battery_capacity,
                "arrival": arrival_battery if arrival_battery is not None else MIN_ARRIVAL_BATTERY
            }
        }
        
        # Only output the JSON result, nothing else
        print(json.dumps(result))
    except Exception as e:
        error_traceback = traceback.format_exc()
        log_error(f"Unhandled exception: {str(e)}\n{error_traceback}")
        print(json.dumps({
            "error": f"An error occurred: {str(e)}",
            "status": "error"
        }))

if __name__ == "__main__":
    main()
