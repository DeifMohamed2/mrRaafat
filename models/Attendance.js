const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config');
const { ref } = require('pdfkit');
const Schema = mongoose.Schema


const attendanceSchema = new Schema({

    Grade: {
        type: String, 
        required: true, 
    },
    CenterName:{
        type: String,
        required: true,
    },
    Date:{
        type: String,
        required: true,
    },
    GroupTime:{
        type: String,
        required: true,
    },
    Students:{
        type:Array,
        ref:'User',
        default:[],
    },
    





},{timestamps:true});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;