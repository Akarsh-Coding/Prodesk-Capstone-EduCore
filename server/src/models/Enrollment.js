const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    // The owner. Always set from the verified JWT (req.user), never from the request body.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course is required'],
    },
    // Progress lives here: the ids of the lessons this student has completed.
    // ($addToSet keeps it free of duplicates.) The Lesson model does not exist yet.
    completedLessons: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
      default: [],
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// One enrollment per student per course. This index (not a check-then-insert) is what
// guarantees no duplicates, even when two requests arrive at the same moment.
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1 }); // enrollment counts per course (instructor dashboard, cascade delete)

module.exports = mongoose.model('Enrollment', enrollmentSchema);
