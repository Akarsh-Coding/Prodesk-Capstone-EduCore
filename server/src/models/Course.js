const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description must be at most 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [50, 'Category must be at most 50 characters'],
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    published: {
      type: Boolean,
      default: false,
    },
    // The owner. Always set from the verified JWT (req.user), never from the request body.
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

courseSchema.index({ published: 1, createdAt: -1 }); // public listing
courseSchema.index({ authorId: 1, createdAt: -1 }); // "my courses" and ownership lookups

module.exports = mongoose.model('Course', courseSchema);
