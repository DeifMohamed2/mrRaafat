const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config')
const Schema = mongoose.Schema

const quizSchema = new Schema({
    quizName: {
        type: String, 
        required: true, 
    },
    timeOfQuiz: {
        type: Number,
        required: true, 
    },
    questionsCount: {
        type: Number, 
        required: true, 
    },
    questionsToShow: {
        type: Number,
        default: function() {
            return this.questionsCount; // Default to showing all questions
        }
    },
    Questions: {
        type: Array,
        required: true, 
    },
    isQuizActive: {
        type: Boolean,
        required: true,
    },
    permissionToShow: {
        type: Boolean,
        required: true,
    },
    videoWillbeOpen: {
        type: String,
    },
    Grade: {
        type: String, 
        required: true,  
    },
    chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        default: null
    },
    prepaidStatus: {
        type: Boolean,
        required: true
    },
    quizPrice: {
        type: Number,
        default: 0
    },
    showAnswersAfterQuiz: {
        type: Boolean,
        default: true
    }
}, {timestamps: true});

const Quiz = mongoose.model('Quiz',quizSchema)

module.exports=Quiz;