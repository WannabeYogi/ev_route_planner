import googlemaps
from geopy.distance import geodesic
import folium
import time
import math
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

def search_nearby_ev_stations(current,location,max_range, initial_radius=50000, max_radius=150000, step=25000):
    radius = initial_radius
    while radius <= max_radius :
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
            loca=loc["lat"], loc["lng"] 
            if geodesic(current, loca).km<=max_range:
                 stations.append({
                "name": place["name"],
                "location": (loc["lat"], loc["lng"]),
                "vicinity": place.get("vicinity", ""),
                "charging_speed_kW": random.choice([30,45,60]),
                "wait_time_min": random.randint(5, 30)
                })
        if stations:
            return stations
        radius += step
    return []

def calculate_max_distance(start_percent, min_end_percent, battery_capacity_kwh, range_km,
                           base_discharge_efficiency=0.95):
    """Calculate maximum possible distance with given battery constraints"""
    if start_percent <= min_end_percent:
        return 0
        
    soc_discharge_efficiency=0

    if start_percent > 80:
        soc_discharge_efficiency=0.95
    elif start_percent < 20:
        soc_discharge_efficiency=0.90
    else:
        soc_discharge_efficiency=1

    eff = base_discharge_efficiency * soc_discharge_efficiency
    usable_energy = ((start_percent - min_end_percent) / 100) * battery_capacity_kwh * eff
    energy_per_km = battery_capacity_kwh / range_km
    max_distance = usable_energy / energy_per_km
    return max_distance


def filter_stations_toward_destination(stations, current, destination):
    return [s for s in stations if geodesic(s["location"], destination).km < geodesic(current, destination).km]

def ev_charging_time(current_percent, target_percent, charger_power_kw, battery_capacity_kwh=60,
                     charging_efficiency=0.9, k=1.6):
    """Calculate charging time using a modified logistic model, handling edge cases"""
    if not (0 <= current_percent <= 100 and 0 <= target_percent <= 100):
        raise ValueError("Percentages must be between 0 and 100")
    
    # Special cases to avoid math errors
    if current_percent >= target_percent:
        return 0.0
    if current_percent == 0:
        current_percent = 0.1  # Avoid division by zero
    if target_percent == 100:
        target_percent = 99.9  # Avoid division by zero

    try:
        unit_time = (1 / k) * math.log(
            (target_percent * (100 - current_percent)) /
            (current_percent * (100 - target_percent))
        )
    except (ZeroDivisionError, ValueError):
        # Fallback to linear approximation if mathematical errors occur
        linear_full_charge_time = battery_capacity_kwh / (charger_power_kw * charging_efficiency)
        return linear_full_charge_time * (target_percent - current_percent) / 100

    linear_full_charge_time = battery_capacity_kwh / (charger_power_kw * charging_efficiency)
    logistic_scale = linear_full_charge_time / 7.43
    return unit_time * logistic_scale


def plan_ev_route(start, destination, battery_percentage, full_range_km):
    reserve_percentage = 10  # internally defined
    current = start
    route = [start]
    remaining_battery = battery_percentage
    stations_visited = []

    total_drive_time_sec = 0
    total_charging_time_min = 0
    total_wait_time_min = 0
    battery_capacity_kWh = 60

    success = False

    while True:
        distance_to_dest = geodesic(current, destination).km #direct distance

        usable_battery_percentage = remaining_battery - reserve_percentage
        # max_range = ((usable_battery_percentage / 100) * full_range_km) 

        max_range = calculate_max_distance(
    remaining_battery,        # start_percent
    10,                       # min_end_percent
    battery_capacity_kWh,     # battery_capacity_kwh
    full_range_km,            # range_km
    0.95                      # base_discharge_efficiency
)
        traffic_factor = random.uniform(0.95,1.00)
        max_range=max_range*traffic_factor

        print(f"\n📍 Current location: {current}")
        print(f"🎯 Distance to destination: {distance_to_dest:.2f} km")
        print(f"🔋 Battery: {remaining_battery:.2f}% | Usable: {usable_battery_percentage:.2f}% | Max range: {max_range:.2f} km")

        battery_needed_for_dest = (distance_to_dest / full_range_km) * 100
        if usable_battery_percentage >= battery_needed_for_dest and remaining_battery - battery_needed_for_dest >= 20:
            print("✅ Destination is within range with 20% buffer. Driving directly.")
            path_segment, segment_time = get_road_path_and_time_with_traffic(current, destination)
            total_drive_time_sec += segment_time
            route.append(destination)
            success = True
            break

        route_points, _ = get_road_path_and_time_with_traffic(current, destination)
        if not route_points:
            print("❌ Could not get directions to destination.")
            break

        ideal_point = get_point_along_route(route_points, max_range)
        print(f"📌 Ideal point along route (~{max_range:.2f} km): {ideal_point}")

        nearby_stations = search_nearby_ev_stations(current,ideal_point,max_range)
        if not nearby_stations:
            print("⚠️ No EV stations found near ideal point.")
            break

        filtered = filter_stations_toward_destination(nearby_stations, current, destination)
        if not filtered:
            print("⚠️ No stations found in direction of destination.")
            break

        print(f"🔎 {len(filtered)} filtered stations toward destination:")
        for s in filtered:
            print(f"- {s['name']} ({s['vicinity']})")

        for station in filtered:
            distance_to_station = geodesic(current, station["location"]).km
            battery_required = (distance_to_station / (full_range_km * 0.9)) * 100

            if battery_required > usable_battery_percentage:
                station["score"] = None
                continue

            station["battery_used"] = battery_required
            station["distance_to_station"] = distance_to_station
            station["distance_to_dest"] = geodesic(station["location"], destination).km

            station["score"] = 1 / (station["distance_to_dest"] + 1e-5)

        reachable = [s for s in filtered if s.get("score") is not None]
        if not reachable:
            print("❌ No reachable stations found (battery constraint).")
            break

        best = max(reachable, key=lambda x: x["score"])
        print(f"\n🚘 Going to charge at: {best['name']} ({best['vicinity']})")
        print(f"➡️  Distance: {best['distance_to_station']:.2f} km | Battery used: {best['battery_used']:.2f}%")
        print(f"⚡ Speed: {best['charging_speed_kW']} kW | Wait: {best['wait_time_min']} min")

        path_segment, segment_time = get_road_path_and_time_with_traffic(current, best["location"])
        total_drive_time_sec += segment_time

        remaining_battery -= best["battery_used"]

        distance_to_dest_from_station = geodesic(best["location"], destination).km
        battery_needed_for_dest = (distance_to_dest_from_station / full_range_km) * 100
        target_battery = battery_needed_for_dest + reserve_percentage + 20

        if target_battery < 100:
            print(f"🛠 Partial charge to {target_battery:.1f}% (enough to reach destination + reserve)")
        else:
            target_battery = 100
            print("🔋 Full charge to 100%")

        charging_time_hr = ev_charging_time(
    remaining_battery,  # current_percent
    target_battery,     # target_percent 
    best["charging_speed_kW"],  # charger_power_kw
    battery_capacity_kWh  # battery_capacity_kwh
)

        charging_time_min = charging_time_hr * 60

        total_charging_time_min += charging_time_min
        total_wait_time_min += best["wait_time_min"]
        remaining_battery = target_battery


        print(f"🔌 Charging Time: {charging_time_min:.1f} min | Battery after charge: {target_battery}%")

        current = best["location"]
        route.append(current)
        stations_visited.append(best)
        time.sleep(1)

    if not success:
        print("\n❌ Trip could not be completed. Ending route planning.")
        return {
            "route": route,
            "charging_stops": stations_visited,
            "success": False
        }

    total_drive_time_hr = total_drive_time_sec / 3600
    total_charging_time_hr = total_charging_time_min / 60
    total_wait_time_hr = total_wait_time_min / 60
    total_trip_time_hr = total_drive_time_hr + total_charging_time_hr + total_wait_time_hr

    print("\n📋 Trip Summary")
    print(f"🚘 Drive Time: {total_drive_time_hr:.2f} hrs")
    print(f"🔌 Charging Time: {total_charging_time_hr:.2f} hrs")
    print(f"⏱️  Wait Time: {total_wait_time_hr:.2f} hrs")
    print(f"🕒 Total Trip Time: {total_trip_time_hr:.2f} hrs")

    return {
        "route": route,
        "charging_stops": stations_visited,
        "success": True
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
    start = (26.937037952704895, 75.92346698104654)
    destination = (28.6345016899985, 77.21906801317974)
    battery_percentage = 80
    full_range_km = 150

    result = plan_ev_route(start, destination, battery_percentage, full_range_km)

    print("\nPlanned Route:")
    for point in result["route"]:
        print(point)

    print("\nCharging Stops:")
    for stop in result["charging_stops"]:
        print(f"{stop['name']} at {stop['location']} ({stop['vicinity']})")

    generate_map(result)
