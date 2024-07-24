const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config')
const Schema = mongoose.Schema


const Chapterschema = new Schema({


    chapterName: {
        type: String, 
        required: true, 
    },
    chapterGrade :{
        type: String, 
        required: true,  
    },
    chapterAccessibility :{
        type: String, 
        required: true,  
    },
    chapterPrice: {
        type: Number, 
        required: true, 
    },
    chapterLectures :{
        type:Array
    },
    chapterSummaries :{
        type:Array
    },
    ARorEN:{
        type:String
    },
    chapterSolvings:{
        type:Array
    },


},{timestamps:true});

const Chapter = mongoose.model('Chapter',Chapterschema)

module.exports=Chapter;