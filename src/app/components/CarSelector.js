'use client';

import { useEffect, useState } from 'react';

import evData from '@/data/ev_data.json';

export default function CarSelector({ onCarSelect }) {
  const [manufacturers, setManufacturers] = useState([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [carData, setCarData] = useState(null);

  
  useEffect(() => {
    const manufacturersList = Object.keys(evData).sort();
    setManufacturers(manufacturersList);
  }, []);

  
  useEffect(() => {
    if (selectedManufacturer) {
      const modelsList = evData[selectedManufacturer] || [];
      setModels(modelsList);
      setSelectedModel(''); 
      
      setCarData(null); 
      
    } else {
      setModels([]);
      setSelectedModel('');
      setCarData(null);
    }
  }, [selectedManufacturer]);

  
  useEffect(() => {
    if (selectedManufacturer && selectedModel) {
      const selectedCarData = models.find(model => model.MODEL === selectedModel);
      setCarData(selectedCarData);
      
      if (selectedCarData && onCarSelect) {
        onCarSelect({
          manufacturer: selectedManufacturer,
          model: selectedCarData.MODEL,
          batteryCapacityKWh: selectedCarData["BATTERY-KWH"],
          rangeKm: selectedCarData["RANGE-KM"]
        });
      }
    }
  }, [selectedModel, selectedManufacturer, models]);

  const handleManufacturerChange = (e) => {
    setSelectedManufacturer(e.target.value);
  };

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-600 mb-1">
          Car Manufacturer
        </label>
        <select
          value={selectedManufacturer}
          onChange={handleManufacturerChange}
          className="input-field w-full"
          required
        >
          <option value="">Select Manufacturer</option>
          {manufacturers.map(manufacturer => (
            <option key={manufacturer} value={manufacturer}>
              {manufacturer}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">
          Car Model
        </label>
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className="input-field w-full"
          disabled={!selectedManufacturer}
          required
        >
          <option value="">Select Model</option>
          {models.map(model => (
            <option key={model.MODEL} value={model.MODEL}>
              {model.MODEL}
            </option>
          ))}
        </select>
      </div>

      {carData && (
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Battery Capacity:</span>
              <span className="ml-1 font-medium">{carData["BATTERY-KWH"]} kWh</span>
            </div>
            <div>
              <span className="text-gray-600">Range:</span>
              <span className="ml-1 font-medium">{carData["RANGE-KM"]} km</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
