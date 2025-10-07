import mongoose from 'mongoose';

const SavedRideSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  batteryPercentage: {
    type: Number,
    required: true
  },
  batteryRange: {
    type: Number,
    required: true
  },
  routeSummary: {
    drivingTime: Number,
    chargingTime: Number,
    waitTime: Number,
    totalTime: Number
  },
  route: [{ lat: Number, lng: Number }],
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
  success: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.SavedRide || mongoose.model('SavedRide', SavedRideSchema);
