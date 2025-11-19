import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  batteryStart: Number,
  batteryEnd: Number,
  isCompleted: {
    type: Boolean,
    default: false
  }
});

const StationSchema = new mongoose.Schema({
  googlePlaceId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  location: {
    type: [Number],
    required: true
  },
  vicinity: String,
  chargingSpeedKW: {
    type: Number,
    required: true
  },
  bookings: [BookingSchema]
}, { timestamps: true });

export default mongoose.models.Station || mongoose.model('Station', StationSchema);
