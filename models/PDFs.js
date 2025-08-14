const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config')
const Schema = mongoose.Schema


const pdfSchema = new Schema({

    pdfName: {
        type: String, 
        required: true, 
    },

    pdfLink:{
        type:String,
        required: true,
    },
    pdfPhoto:{
        type : String,
        required: false,
    },
    pdfStatus:{
        type:String,
        required: true,
    },
    pdfPrice:{
        type:String,
        required: false,
    },
    pdfGrade:{
        type:String,
        required: true,
    },

    

},{timestamps:true});

const PDF = mongoose.model('PDF',pdfSchema)

module.exports=PDF;