const express = require("express");
const User = require("../models/User");





const studentController = require('../controllers/studentController')
const router = express.Router();

const jwt = require('jsonwebtoken')
const  jwtSecret = process.env.JWTSECRET


// ================== authMiddleware====================== //

async function authenticateUser(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).redirect('../login');
  }

  try {
    const decode = jwt.verify(token, jwtSecret);
    req.userId = decode.userId;

    const user = await User.findOne({'_id': decode.userId});
    req.userData = user; // Attach user data to request object
    next(); // Move to the next middleware
  } catch (error) {
    return res.status(401).redirect('../login');
  }
}

// ================== END authMiddleware====================== //


// ================== All get Pages Route  ====================== //


router.get("/dash",authenticateUser, studentController.dash_get);




// ================== END All get Pages Route  ====================== //


// ================== Videos ====================== //
router.get("/chapters",authenticateUser, studentController.chapters_get);

router.post("/buyChapter/:cahpterId",authenticateUser, studentController.buyChapter);

router.get("/videos/lecture/:cahpterId",authenticateUser, studentController.lecture_get);

router.get("/videos/summaries/:cahpterId",authenticateUser, studentController.sum_get);

router.get("/videos/Solving/:cahpterId",authenticateUser, studentController.solv_get);

router.post("/buyVideo/:videoId",authenticateUser, studentController.buyVideo);



// ================== End Video ====================== //



// ================== Watch ====================== //


router.get("/videos/:videoType/:chapterID/watch/:VideoId",authenticateUser, studentController.watch_get);

router.post("/videos/:videoType/:chapterID/watch/:VideoId",authenticateUser, studentController.uploadHW);

// ================== END Watch ====================== //






// ================== Ranking  ====================== //

router.get("/ranking",authenticateUser, studentController.ranking_get);

// ================== END Ranking  ====================== //



// ================== Exams  ====================== //

router.get("/exams",authenticateUser, studentController.exams_get);

router.post('/buyQuiz/:quizId',authenticateUser, studentController.buyQuiz);

// ================== END Exams  ====================== //


// ================== quiz  ====================== //
router.get("/quiz/:quizId",authenticateUser, studentController.quiz_get);

router.get("/quizStart/:quizId",authenticateUser, studentController.quiz_start);

router.get("/quizWillStart/:quizId",authenticateUser, studentController.quizWillStart);

router.post("/quizStart/:quizId",authenticateUser, studentController.quizFinish);

router.get("/reviewAnswers/:quizId",authenticateUser, studentController.review_Answers);


// ==================  end quiz  ====================== //

// ================== Profile  ====================== //

router.get("/settings",authenticateUser, studentController.settings_get);

router.post("/settings",authenticateUser, studentController.settings_post);




router.get("/logOut", studentController.logOut);





module.exports = router;
