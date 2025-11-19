import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    required: true
  },
  stationName: {
    type: String,
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
  chargingTimeMin: Number,
  isCompleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

BookingSchema.index({ userId: 1 });
BookingSchema.index({ stationId: 1 });
BookingSchema.index({ startTime: 1 });
BookingSchema.index({ isCompleted: 1 });

export default mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
