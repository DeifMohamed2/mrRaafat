const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config')
const Schema = mongoose.Schema

// Content item schema for embedded resources
const ContentItemSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['video', 'quiz', 'pdf', 'file', 'assignment'],
    required: true
  },
  url: {
    type: String,
    required: function() {
      return this.type === 'video' || this.type === 'pdf' || this.type === 'file';
    }
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  duration: {
    type: Number, // in minutes for videos
    default: 0
  },
  fileSize: {
    type: Number, // in bytes
    default: 0
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFree: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0
  },
  accessCode: {
    type: String,
    default: ''
  },
  prerequisites: {
    type: String,
    enum: ['none', 'WithExam', 'WithHw', 'WithExamaAndHw', 'WithPreviousContent'],
    default: 'none'
  },
  accessibleAfter: {
    type: Schema.Types.ObjectId,
    ref: 'ContentItem'
  },
  tags: [{
    type: String
  }],
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  // Quiz specific fields
  timeLimit: {
    type: Number, // in minutes
    default: 0
  },
  questionsCount: {
    type: Number,
    default: 0
  },
  questions: [{
    type: Schema.Types.Mixed
  }],
  // Video specific fields
  videoProvider: {
    type: String,
    enum: ['vimeo', 'youtube', 'local'],
    default: 'vimeo'
  },
  videoId: {
    type: String,
    default: ''
  },
  allowedViews: {
    type: Number,
    default: -1 // -1 means unlimited
  }
}, { timestamps: true });

// Section schema for organizing content
const SectionSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  content: [ContentItemSchema]
}, { timestamps: true });

const ChapterSchema = new Schema({
  chapterName: {
    type: String, 
    required: true, 
  },
  chapterGrade: {
    type: String, 
    required: true,  
  },
  chapterIMG: {
    type: String,
    required: true,
  },
  chapterDescription: {
    type: String,
    required: true,
  },
  chapterAccessibility: {
    type: String, 
    required: true,  
  },
  chapterPrice: {
    type: Number, 
    required: true, 
  },
  
  // New organized structure
  sections: [SectionSchema],
  
  // Legacy fields (keeping for backward compatibility)
  chapterLectures: {
    type: Array,
    default: []
  },
  chapterSummaries: {
    type: Array,
    default: []
  },
  chapterSolvings: {
    type: Array,
    default: []
  },
  
  // Enhanced fields
  ARorEN: {
    type: String,
    default: 'AR'
  },
  ischapterNew: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  estimatedDuration: {
    type: Number, // in hours
    default: 0
  },
  tags: [{
    type: String
  }],
  prerequisites: [{
    type: Schema.Types.ObjectId,
    ref: 'Chapter'
  }],
  
  // Statistics
  enrolledStudents: {
    type: Number,
    default: 0
  },
  totalContent: {
    type: Number,
    default: 0
  },
  completionRate: {
    type: Number,
    default: 0
  },
  
  // SEO and metadata
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  metaDescription: {
    type: String,
    default: ''
  },
  keywords: [{
    type: String
  }]
}, { timestamps: true });

// Pre-save middleware to calculate total content
ChapterSchema.pre('save', function(next) {
  if (this.sections && this.sections.length > 0) {
    this.totalContent = this.sections.reduce((total, section) => {
      return total + (section.content ? section.content.length : 0);
    }, 0);
  }
  
  // Generate slug from chapter name if not provided
  if (!this.slug && this.chapterName) {
    this.slug = this.chapterName
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  next();
});

// Methods
ChapterSchema.methods.getActiveContent = function() {
  return this.sections
    .filter(section => section.isActive)
    .map(section => ({
      ...section.toObject(),
      content: section.content.filter(item => item.isActive)
    }));
};

ChapterSchema.methods.getContentByType = function(type) {
  const allContent = [];
  this.sections.forEach(section => {
    if (section.isActive) {
      const typeContent = section.content.filter(item => 
        item.isActive && item.type === type
      );
      allContent.push(...typeContent);
    }
  });
  return allContent.sort((a, b) => a.order - b.order);
};

ChapterSchema.methods.getFreeContent = function() {
  const freeContent = [];
  this.sections.forEach(section => {
    if (section.isActive) {
      const free = section.content.filter(item => 
        item.isActive && item.isFree
      );
      freeContent.push(...free);
    }
  });
  return freeContent;
};

const Chapter = mongoose.model('Chapter', ChapterSchema);

module.exports = Chapter;