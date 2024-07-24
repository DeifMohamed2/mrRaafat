// Import the necessary libraries
const express = require("express");
const homeController = require('../controllers/homeController');

const fs = require('fs');
const { json } = require("stream/consumers");

const router = express.Router();

router.get("/", homeController.home_page);
router.get("/login", homeController.public_login_get);
router.post("/login", homeController.public_login_post);
router.get("/Register", homeController.public_Register_get);
router.get("/forgetPassword", homeController.forgetPassword_get);
router.post("/forgetPassword", homeController.forgetPassword_post);
router.get("/reset-password/:id/:token", homeController.reset_password_get);
router.post("/reset-password/:id/:token", homeController.reset_password_post);
router.post("/Register", homeController.public_Register_post);








        

module.exports = router;

