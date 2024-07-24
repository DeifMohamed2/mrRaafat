const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config')
const Schema = mongoose.Schema

const VideoSchema = new Schema({

    

    videoName: {
        type: String, 
        required: true, 
    },
    Grade :{
        type: String, 
        required: true,  
    },
    typeOfVideo :{
        type: String, 
        required: true,  
    },
    statusOfVideo:{
        type: Boolean,
        required: true, 
    },
    priceOfVideo: {
        type: Number, 
        required: true, 
    },
    permissionToshow :{
        type: String, 
        required: true,  
    },
    Prerequirement :{
        type: String, 
        required: true, 
    },
    imgUrl: {
        type: String,
        required: true, 
    },
    VideoUrl :{
        type: String, 
        required: true,  
    }, 
    VideoParts :{
        type: [Object], 
        required: false,  
    },





},{timestamps:true});

const Video = mongoose.model('Video',VideoSchema)

module.exports=Video;