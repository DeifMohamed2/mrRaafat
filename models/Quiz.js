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
    Questions:{
        type:Array,
        required: true, 
    },
    isQuizActive:{
        type:Boolean,
        required:true,
    },
    permissionToShow:{
        type:Boolean,
        required:true,
    },
    videoWillbeOpen:{
        type:String,
    },
    Grade :{
        type: String, 
        required: true,  
    },
    prepaidStatus:{
        type:Boolean,
        required:true
    }




},{timestamps:true});

const Quiz = mongoose.model('Quiz',quizSchema)

module.exports=Quiz;