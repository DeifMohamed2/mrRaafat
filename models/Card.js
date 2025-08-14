const mongoose = require('mongoose')
const { required } = require('nodemon/lib/config');
const { ref } = require('pdfkit');
const Schema = mongoose.Schema


const cardSchema = new Schema({

    cardId: {
        type: String, 
        required: true, 
    },
    userCode:{
        type: String,
        required: true,
    },
    
    userId:{
        type : String,
        ref : 'User',
        required: true,
    },
    cardHistory:{
        type: Array,
        default: [],
        required: false,
    },




},{timestamps:true});

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;