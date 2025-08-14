const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CodeSchema = new Schema({
    Code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    codeType: {
        type: String,
        required: true,
        enum: ['Chapter', 'Video', 'Quiz', 'PDF', 'Exam', 'GeneralChapter', 'GeneralVideo', 'GeneralQuiz'],
        default: 'Chapter'
    },
    // For general codes - allows access to any content of specified type within the grade
    isGeneralCode: {
        type: Boolean,
        default: false
    },
    codeGrade: {
        type: String,
        required: true,
        enum: ['Grade1', 'Grade2', 'Grade3', 'AllGrades'], // Add AllGrades option
    },
    // Flag to indicate if code works for all grades
    isAllGrades: {
        type: Boolean,
        default: false
    },
    chapterName: {
        type: String,
        required: function() {
            return (this.codeType === 'Chapter' || this.codeType === 'Video') && !this.isGeneralCode;
        }
    },
    chapterId: {
        type: Schema.Types.ObjectId,
        ref: 'Chapter',
        required: function() {
            return (this.codeType === 'Chapter' || this.codeType === 'Video') && !this.isGeneralCode;
        }
    },
    // For specific content (video, quiz, pdf)
    contentId: {
        type: Schema.Types.ObjectId,
        required: function() {
            return (this.codeType === 'Video' || this.codeType === 'Quiz' || this.codeType === 'PDF') && !this.isGeneralCode;
        }
    },
    contentName: {
        type: String,
        required: function() {
            return (this.codeType === 'Video' || this.codeType === 'Quiz' || this.codeType === 'PDF') && !this.isGeneralCode;
        }
    },
    isUsed: {
        type: Boolean,
        default: false,
        required: true
    },
    usedBy: {
        type: Number, // User code
        default: null
    },
    usedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    usedIn: {
        type: String,
        default: null
    },
    usageDate: {
        type: Date,
        default: null
    },
    codeValue: {
        type: Number, // Price or value
        default: 0
    },
    expiryDate: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Track which grades can use this code
    allowedGrades: [{
        type: String,
        enum: ['Grade1', 'Grade2', 'Grade3']
    }],
    // Track usage limits
    usageLimit: {
        type: Number,
        default: 1 // How many times this code can be used
    },
    usageCount: {
        type: Number,
        default: 0 // How many times it has been used
    },
    // Creator information
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User' // Teacher who created the code
    },
    createdForBatch: {
        type: String, // For batch creation tracking
        default: null
    }
}, { timestamps: true });

// Instance methods
CodeSchema.methods.canBeUsedBy = function(user) {
    // Check if code is active and not expired
    if (!this.isActive || (this.expiryDate && this.expiryDate < new Date())) {
        return { valid: false, reason: 'Code is expired or inactive' };
    }
    
    // Check if code has been used
    if (this.isUsed && this.usageCount >= this.usageLimit) {
        return { valid: false, reason: 'Code has already been used' };
    }
    
    // Check grade compatibility
    if (this.codeGrade && this.codeGrade !== 'AllGrades' && !this.isAllGrades && user.Grade !== this.codeGrade) {
        return { valid: false, reason: `This code is for ${this.codeGrade} only` };
    }
    
    // Check if user already owns this content (only for specific codes, not general codes)
    if (!this.isGeneralCode) {
        if (this.codeType === 'Chapter' && user.hasChapterAccess(this.chapterId)) {
            return { valid: false, reason: 'You already have access to this chapter' };
        }
        
        if (this.codeType === 'Video' && user.hasVideoAccess(this.contentId)) {
            return { valid: false, reason: 'You already have access to this video' };
        }
        
        if (this.codeType === 'Quiz' && user.examsPaid && user.examsPaid.includes(this.contentId.toString())) {
            return { valid: false, reason: 'You already have access to this quiz' };
        }
    }
    
    return { valid: true, reason: 'Code is valid' };
};

CodeSchema.methods.markAsUsed = function(user) {
    this.isUsed = this.usageCount + 1 >= this.usageLimit;
    this.usedBy = user.Code;
    this.usedByUserId = user._id;
    this.usageDate = new Date();
    this.usageCount += 1;
    
    return this.save();
};

// Static methods for code generation
CodeSchema.statics.generateCodeForChapter = function(chapterData, count = 1, grade = null) {
    const codes = [];
    const prefix = chapterData.ARorEN === 'AR' ? 'AR' : 'EN';
    const year = new Date().getFullYear();
    
    for (let i = 1; i <= count; i++) {
        const codeNumber = String(i).padStart(3, '0');
        const code = `${prefix}${year}${codeNumber}`;
        
        codes.push({
            Code: code,
            codeType: 'Chapter',
            codeGrade: grade || chapterData.chapterGrade,
            chapterName: chapterData.chapterName,
            chapterId: chapterData._id,
            codeValue: chapterData.chapterPrice,
            allowedGrades: [grade || chapterData.chapterGrade]
        });
    }
    
    return this.insertMany(codes);
};

CodeSchema.statics.generateCodeForVideo = function(videoData, chapterData, count = 1) {
    const codes = [];
    const prefix = 'VID';
    const year = new Date().getFullYear();
    
    for (let i = 1; i <= count; i++) {
        const codeNumber = String(i).padStart(3, '0');
        const code = `${prefix}${year}${codeNumber}`;
        
        codes.push({
            Code: code,
            codeType: 'Video',
            codeGrade: chapterData.chapterGrade,
            chapterName: chapterData.chapterName,
            chapterId: chapterData._id,
            contentId: videoData._id,
            contentName: videoData.videoName || videoData.lectureName,
            codeValue: videoData.lecturePrice || videoData.price || 0,
            allowedGrades: [chapterData.chapterGrade]
        });
    }
    
    return this.insertMany(codes);
};

// Indexes for better performance
CodeSchema.index({ Code: 1 }, { unique: true });
CodeSchema.index({ codeType: 1, codeGrade: 1 });
CodeSchema.index({ isUsed: 1, isActive: 1 });
CodeSchema.index({ chapterId: 1 });
CodeSchema.index({ contentId: 1 });

const Code = mongoose.model('Code', CodeSchema);

module.exports = Code;