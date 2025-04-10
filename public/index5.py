import googlemaps
import folium
from typing import List, Tuple, Dict

# -----------------------------
# 1. Setup
# -----------------------------
API_KEY = "AIzaSyA8FXr0bT_nN_oTae0S2f_cNPZj-zNQRlQ"  # Replace with your actual API key
gmaps = googlemaps.Client(key=API_KEY)

# -----------------------------
# 2. Google API Utilities
# -----------------------------
def get_distance_duration(start: Tuple[float, float], end: Tuple[float, float]) -> Tuple[float, float]:
    result = gmaps.distance_matrix(origins=[start], destinations=[end], mode="driving")
    element = result['rows'][0]['elements'][0]

    if element['status'] != 'OK':
        raise Exception(f"Google API Error: {element['status']}")

    distance_km = element['distance']['value'] / 1000
    duration_min = element['duration']['value'] / 60
    return distance_km, duration_min

def get_nearby_charging_stations(location: Tuple[float, float], radius: int = 50000) -> List[Dict]:
    response = gmaps.places_nearby(location=location, radius=radius, keyword="EV charging station")
    stations = []
    for place in response.get("results", []):
        loc = place["geometry"]["location"]
        stations.append({
            "lat": loc["lat"],
            "lon": loc["lng"],
            "name": place.get("name", "Unnamed Station"),
            "speed_km_per_min": 5  # Assume fixed charge speed
        })
    return stations

# -----------------------------
# 3. Greedy Pathfinding Logic
# -----------------------------
def find_best_path_greedy(
    source: Tuple[float, float],
    destination: Tuple[float, float],
    battery_percent: float,
    max_range_km: float,
) -> List[Dict]:
    current_pos = source
    current_range = (battery_percent / 100) * max_range_km
    route = []

    while True:
        try:
            dist_to_dest, time_to_dest = get_distance_duration(current_pos, destination)
        except Exception as e:
            return [{"error": f"API error getting destination info: {e}"}]

        if current_range >= dist_to_dest:
            route.append({
                "type": "drive",
                "from": current_pos,
                "to": destination,
                "distance_km": dist_to_dest,
                "drive_time_min": time_to_dest,
                "note": "Reached destination"
            })
            break

        stations = get_nearby_charging_stations(current_pos)
        reachable = []

        for station in stations:
            station_coord = (station['lat'], station['lon'])
            try:
                dist, drive_time = get_distance_duration(current_pos, station_coord)
                dist_from_station_to_dest, _ = get_distance_duration(station_coord, destination)
                dist_from_current_to_dest, _ = get_distance_duration(current_pos, destination)
            except:
                continue

            if dist <= current_range and dist_from_station_to_dest < dist_from_current_to_dest:
                charge_time = (max_range_km - dist) / station['speed_km_per_min']
                try:
                    _, time_after_charge = get_distance_duration(station_coord, destination)
                except:
                    time_after_charge = 9999
                total_time = drive_time + charge_time + time_after_charge

                reachable.append({
                    "station": station,
                    "station_coord": station_coord,
                    "dist": dist,
                    "drive_time": drive_time,
                    "charge_time": charge_time,
                    "total_time": total_time
                })

        if not reachable:
            return [{"error": "No reachable charging stations within current range"}]

        best = min(reachable, key=lambda x: x['total_time'])
        best_station = best['station_coord']

        route.append({
            "type": "charge",
            "at": best_station,
            "from": current_pos,
            "charge_time_min": best['charge_time'],
            "station_info": best['station'],
            "note": "Charging stop"
        })

        current_pos = best_station
        current_range = max_range_km  # Fully charged now

    return route

# -----------------------------
# 4. Map Visualization (Folium)
# -----------------------------
def plot_route_on_map(route: List[Dict], source: Tuple[float, float], destination: Tuple[float, float]):
    m = folium.Map(location=source, zoom_start=7)
    folium.Marker(location=source, popup="Start", icon=folium.Icon(color="green")).add_to(m)
    folium.Marker(location=destination, popup="Destination", icon=folium.Icon(color="red")).add_to(m)

    points = [source]

    for step in route:
        if step["type"] == "charge":
            coord = step["at"]
            name = step["station_info"]["name"]
            folium.Marker(location=coord, popup=f"Charging: {name}", icon=folium.Icon(color="blue")).add_to(m)
            points.append(coord)
        elif step["type"] == "drive":
            points.append(step["to"])

    folium.PolyLine(points, color="blue", weight=3, opacity=0.8).add_to(m)
    m.save("ev_route_map.html")
    print("🗺️ Map saved as ev_route_map.html — open it in your browser.")

# -----------------------------
# 5. Run the Program
# -----------------------------
if __name__ == "__main__":
    source = (19.0760, 72.8777)      # Mumbai
    destination = (28.7041, 77.1025) # Delhi

    battery_percent = 100
    max_range_km = 150


    final_route = find_best_path_greedy(source, destination, battery_percent, max_range_km)

    print("\n🛣️ Final Route Summary:")
    for step in final_route:
        print(step)

    plot_route_on_map(final_route, source, destination)
