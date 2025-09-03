import mongoose from 'mongoose';

// Create a schema for the counter
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

// Create a model for the counter if it doesn't exist
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

// Create the User schema
const UserSchema = new mongoose.Schema({
  userId: {
    type: Number,
    unique: true
  },
  name: String,
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: String, // Will be hashed
  googleId: String, // For Google OAuth
  savedRides: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SavedRide'
  }]
}, { timestamps: true });

// Pre-save hook to auto-increment userId
UserSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'userId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.userId = counter.seq;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Export the model
export default mongoose.models.User || mongoose.model('User', UserSchema);
