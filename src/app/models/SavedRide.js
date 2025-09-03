import mongoose from 'mongoose';

const SavedRideSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Source and destination information
  sourceLocation: {
    name: String,
    lat: Number,
    lng: Number
  },
  destinationLocation: {
    name: String,
    lat: Number,
    lng: Number
  },
  // Vehicle information
  batteryPercentage: {
    type: Number,
    required: true
  },
  batteryRange: {
    type: Number,
    required: true
  },
  // Route summary
  routeSummary: {
    drivingTime: Number, // in hours
    chargingTime: Number, // in hours
    waitTime: Number, // in hours
    totalTime: Number // in hours
  },
  // Full route data
  route: [{ lat: Number, lng: Number }], // Array of coordinates
  chargingStops: [{
    name: String,
    location: [Number], // [lat, lng]
    vicinity: String,
    chargingSpeedKW: Number,
    waitTimeMin: Number,
    chargingTimeMin: Number,
    batteryBefore: Number,
    batteryAfter: Number
  }],
  // Success status
  success: {
    type: Boolean,
    default: true
  },
  // Creation timestamp
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.SavedRide || mongoose.model('SavedRide', SavedRideSchema);
