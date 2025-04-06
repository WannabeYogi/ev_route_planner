const ChargingStationsPanel = ({ stations }) => {
  if (!stations || stations.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm max-h-[500px] overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4">Charging Stations</h3>
      <div className="space-y-4">
        {stations.map((station) => (
          <div key={station.id} className="border-b pb-3">
            <h4 className="font-medium">{station.name}</h4>
            <p className="text-sm text-gray-600">{station.vicinity}</p>
            {station.rating && (
              <div className="flex items-center mt-1">
                <span className="text-yellow-400">★</span>
                <span className="text-sm text-gray-600 ml-1">{station.rating}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChargingStationsPanel; 