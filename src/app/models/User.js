import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

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
  password: String,
  googleId: String,
  savedRides: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SavedRide'
  }]
}, { timestamps: true });

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

export default mongoose.models.User || mongoose.model('User', UserSchema);
