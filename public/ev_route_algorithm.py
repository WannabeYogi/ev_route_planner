import googlemaps
from geopy.distance import geodesic
import folium
import time
import random
import datetime
from googlemaps.convert import decode_polyline

gmaps = googlemaps.Client(key="AIzaSyA8FXr0bT_nN_oTae0S2f_cNPZj-zNQRlQ")

def get_road_path_and_time_with_traffic(start, end):
    directions = gmaps.directions(start, end, mode='driving')
    if not directions:
        return [], 0

    path = []
    total_duration = 0

    for leg in directions[0]['legs']:
        total_duration += leg['duration']['value']
        for step in leg['steps']:
            polyline = step['polyline']['points']
            path.extend(decode_polyline(polyline))

    return [(point['lat'], point['lng']) for point in path], total_duration

def get_point_along_route(route_points, distance_km):
    total_distance = 0
    for i in range(1, len(route_points)):
        seg_distance = geodesic(route_points[i - 1], route_points[i]).km
        total_distance += seg_distance
        if total_distance >= distance_km:
            return route_points[i]
    return route_points[-1]

def search_nearby_ev_stations(location, initial_radius=50000, max_radius=150000, step=25000):
    radius = initial_radius
    while radius <= max_radius:
        print(f"🔍 Searching EV stations near {location} within {radius} meters...")
        lat, lng = location
        places_result = gmaps.places_nearby(
            location=(lat, lng),
            radius=radius,
            keyword="EV charging station",
            type="charging_station"
        )
        stations = []
        for place in places_result.get("results", []):
            loc = place["geometry"]["location"]
            stations.append({
                "name": place["name"],
                "location": (loc["lat"], loc["lng"]),
                "vicinity": place.get("vicinity", ""),
                "charging_speed_kW": random.choice([40, 50, 150]),
                "wait_time_min": random.randint(5, 30)
            })
        if stations:
            return stations
        radius += step
    return []

def filter_stations_toward_destination(stations, current, destination):
    return [s for s in stations if geodesic(s["location"], destination).km < geodesic(current, destination).km]

def score_stations(stations, destination):
    for station in stations:
        dist = geodesic(station["location"], destination).km
        station["score"] = 1 / (dist + 1e-5)
    return sorted(stations, key=lambda x: x["score"], reverse=True)

def plan_ev_route(start, destination, battery_percentage, full_range_km):
    current = start
    route = [start]
    remaining_battery = battery_percentage
    stations_visited = []

    total_drive_time_sec = 0
    total_charging_time_min = 0
    total_wait_time_min = 0
    battery_capacity_kWh = 60

    while geodesic(current, destination).km > 20:
        max_range = (remaining_battery / 100) * full_range_km * 0.9

        print(f"\n📍 Current location: {current}")
        print(f"🎯 Distance to destination: {geodesic(current, destination).km:.2f} km")
        print(f"🔋 Battery: {remaining_battery:.2f}%, Estimated range: {max_range:.2f} km (with 10% reserve)")

        if geodesic(current, destination).km <= max_range:
            print(f"✅ Destination is within range. Driving directly.")
            path_segment, segment_time = get_road_path_and_time_with_traffic(current, destination)
            total_drive_time_sec += segment_time
            route.append(destination)
            break

        # Only get route for finding the ideal point — no need to add segment_time here
        route_points, _ = get_road_path_and_time_with_traffic(current, destination)
        if not route_points:
            print("❌ No route found.")
            break

        ideal_point = get_point_along_route(route_points, max_range)
        print(f"➡️ Targeting a point {max_range:.2f} km away: {ideal_point}")

        nearby_stations = search_nearby_ev_stations(ideal_point)
        if not nearby_stations:
            print("⚠️  No EV stations found near this segment.")
            break

        filtered = filter_stations_toward_destination(nearby_stations, current, destination)
        if not filtered:
            print("⚠️  No suitable charging stations on the way.")
            break

        print(f"🧭 Found {len(filtered)} stations after filtering:")
        for station in filtered:
            print(f"- {station['name']} at {station['location']} ({station['vicinity']})")

        scored_stations = score_stations(filtered, destination)
        reachable_stations = []
        for station in scored_stations:
            distance_to_station = geodesic(current, station["location"]).km
            battery_required = (distance_to_station / full_range_km) * 100
            if battery_required <= remaining_battery:
                station["battery_used"] = battery_required
                station["distance"] = distance_to_station
                reachable_stations.append(station)

        if not reachable_stations:
            print("❌ No reachable stations found.")
            break

        best = reachable_stations[0]
        print(f"🔋 Travelling to: {best['name']} ({best['vicinity']}) | Distance: {best['distance']:.2f} km | Battery used: {best['battery_used']:.2f}%")

        # Actually drive to the selected charging station now
        path_segment, segment_time = get_road_path_and_time_with_traffic(current, best["location"])
        total_drive_time_sec += segment_time

        remaining_battery -= best["battery_used"]

        battery_to_charge = (100 - remaining_battery) / 100
        energy_needed_kWh = battery_to_charge * battery_capacity_kWh
        charging_time_hr = energy_needed_kWh / best["charging_speed_kW"]
        charging_time_min = charging_time_hr * 60

        total_charging_time_min += charging_time_min
        total_wait_time_min += best["wait_time_min"]

        print(f"⚡ Charging at {best['name']} | Charging time: {charging_time_min:.1f} min | Wait: {best['wait_time_min']} min")

        current = best["location"]
        remaining_battery = 100
        stations_visited.append(best)
        route.append(current)

        time.sleep(1)

    # Final leg to destination if needed
    if route[-1] != destination:
        path_segment, segment_time = get_road_path_and_time_with_traffic(current, destination)
        total_drive_time_sec += segment_time
        route.append(destination)

    total_drive_time_hr = total_drive_time_sec / 3600
    total_charging_time_hr = total_charging_time_min / 60
    total_wait_time_hr = total_wait_time_min / 60
    total_trip_time_hr = total_drive_time_hr + total_charging_time_hr + total_wait_time_hr

    print("\n🧾 Trip Summary:")
    print(f"🚘 Total Driving Time: {total_drive_time_hr:.2f} hrs")
    print(f"🔋 Total Charging Time: {total_charging_time_hr:.2f} hrs")
    print(f"⏱️  Total Wait Time: {total_wait_time_hr:.2f} hrs")
    print(f"🕒 Total Trip Time: {total_trip_time_hr:.2f} hrs")

    return {
        "route": route,
        "charging_stops": stations_visited
    }


def generate_map(route_info):
    m = folium.Map(location=route_info["route"][0], zoom_start=7)

    folium.Marker(route_info["route"][0], tooltip="Start", icon=folium.Icon(color='green')).add_to(m)
    folium.Marker(route_info["route"][-1], tooltip="Destination", icon=folium.Icon(color='red')).add_to(m)

    for stop in route_info["charging_stops"]:
        folium.Marker(stop["location"], tooltip=f"{stop['name']}\nSpeed: {stop['charging_speed_kW']}kW", icon=folium.Icon(color='orange')).add_to(m)

    for i in range(len(route_info["route"]) - 1):
        segment_path, _ = get_road_path_and_time_with_traffic(route_info["route"][i], route_info["route"][i+1])
        folium.PolyLine(segment_path, color="blue", weight=4).add_to(m)

    m.save("ev_route_map.html")
    print("\n✅ Map saved as 'ev_route_map.html'. Open it in a browser.")

if __name__ == "__main__":
    start = (19.09076083476796, 72.86272114897756)
    destination = (28.557960485893343, 77.1000928375823)
    battery_percentage = 95
    full_range_km = 300

    result = plan_ev_route(start, destination, battery_percentage, full_range_km)

    print("\nPlanned Route:")
    for point in result["route"]:
        print(point)

    print("\nCharging Stops:")
    for stop in result["charging_stops"]:
        print(f"{stop['name']} at {stop['location']} ({stop['vicinity']})")

    generate_map(result)
