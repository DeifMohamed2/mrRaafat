const express = require("express");
const User = require("../models/User");



const teacherController = require('../controllers/teacherController')
const router = express.Router();
const jwt = require('jsonwebtoken')
const  jwtSecret = process.env.JWTSECRET


// ================== authMiddleware====================== //

const authMiddleware =async (req,res,next)=>{
    const token = req.cookies.token ; 
  
    if (!token) {
      res.status(401).redirect('../login')
    }
  
    try {
      const decode = jwt.verify(token,jwtSecret)
      req.userId = decode.userId
 
      await User.findOne({'_id':decode.userId}).then((result)=>{
        if (result.isTeacher) {
          
          next();
        }else{
          res.clearCookie('token');
          res.status(301).redirect('../login')
        }
     
      })

    } catch (error) {
      res.status(401).redirect('../login')
  
    }
}

// ================== END authMiddleware====================== //


// ================== All get Pages Route  ====================== //


router.get("/dash",authMiddleware, teacherController.dash_get);

router.get("/addVideo",authMiddleware, teacherController.addVideo_get);

router.get("/handleVideos",authMiddleware, teacherController.handleVideos_get);

router.get("/addQuiz", authMiddleware,teacherController.addQuiz_get);


router.get("/myStudent", authMiddleware,teacherController.myStudent_get);

router.get("/homeWork", authMiddleware,teacherController.homeWork_get);

router.get("/handelCodes", authMiddleware,teacherController.handelCodes_get);

router.get("/Codes", authMiddleware,teacherController.Codes_get);

router.get("/studentsRequests", authMiddleware,teacherController.studentsRequests_get);

router.get("/logOut", authMiddleware,teacherController.logOut);


// ================== END All get Pages Route  ====================== //




// ================== Add Video ====================== //


router.post("/addChapter"  , teacherController.chapter_post);

router.post("/getAllChapters"  , teacherController.getAllChapters);

router.post("/addVideo" , teacherController.addVideo_post);

// router.post("/uploadVideo", authMiddleware,teacherController.uploadVideo);

// ================== End Add Video ====================== //



// ==================  Student Requests  ================= //



router.get("/studentsRequests/:studentID", authMiddleware,teacherController.getSingleUserAllData);

router.get("/studentsRequests/delete/:studentID", authMiddleware,teacherController.confirmDeleteStudent);

router.post("/studentsRequests/delete/:studentID", authMiddleware,teacherController.DeleteStudent);

router.post("/converStudentRequestsToExcel", authMiddleware,teacherController.converStudentRequestsToExcel);

router.post("/searchForUser", authMiddleware,teacherController.searchForUser);

router.post("/updateUserData/:studentID", authMiddleware,teacherController.updateUserData);


// ==================  END Student Requests  ================= //

// ==================   myStudent  ================= //


router.get("/searchToGetOneUserAllData", authMiddleware,teacherController.searchToGetOneUserAllData);

router.post("/myStudent/convertToExcelAllUserData/:studetCode", authMiddleware,teacherController.convertToExcelAllUserData);

// router.post("/myStudent/convertToPDFAllUserData/:studetCode", authMiddleware,teacherController.convertToPDFAllUserData);


// ==================   END myStudent  ================= //



// ================ Add quiz===============//

router.post("/QuizSubmit",authMiddleware, teacherController.quizSubmit);

router.post("/addQuestion", authMiddleware,teacherController.addQuestion);

router.get("/deleteQuiz/:quizID", authMiddleware,teacherController.deleteQuiz);

router.post("/updateQuiz/:quizID", authMiddleware,teacherController.updateQuiz);

router.get("/getQuizAlldata", authMiddleware,teacherController.getQuizAlldata);

router.get("/deleteQuestion/:code", authMiddleware,teacherController.deleteQuestion);

router.post("/updateQuestion/:code", authMiddleware,teacherController.updateQuestion);


// ================ End Add Quiz ===================//


// ================ handle Quizzes ===============//

router.get("/handleQuizzes",authMiddleware, teacherController.handleQuizzes);

router.get("/getQuizzesNames",authMiddleware, teacherController.getQuizzesNames);

router.get("/getStudentsDataOfQuiz",authMiddleware, teacherController.getStudentsDataOfQuiz);

router.get("/handleQuizzes/searchForUser",authMiddleware, teacherController.searchForUserInQuiz);

router.post("/convertToExcelQuiz/:QuizID",authMiddleware, teacherController.convertToExcelQuiz);

router.post("/changeEnterToQuiz/:quizID", authMiddleware,teacherController.changeEnterToQuiz);




// ================ End handle Quizzes ===================//



// ================ Codes  ===================//

router.get("/getChptersOrVideosData",authMiddleware, teacherController.getChptersOrVideosData);

router.post("/createSpecificCodes",authMiddleware, teacherController.createSpecificCodes);

router.post("/createGeneralCodes",authMiddleware, teacherController.createGeneralCodes);

// ================ END Codes  ===================//


// ================ Handel Codes  ===================//
router.get("/searchToGetCode",authMiddleware, teacherController.searchToGetCode);




// ================ END Handel Codes  ===================//





// ================== Handle Videos ====================== //


router.post("/getAllChaptersInHandle",authMiddleware, teacherController.getAllChaptersInHandle);

router.post("/getChapterDataToEdit",authMiddleware, teacherController.getChapterDataToEdit);

router.post("/editChapterData",authMiddleware, teacherController.editChapterData);

router.post("/updateVideo",authMiddleware, teacherController.updateVideoData);

router.post("/addViewsToStudent/:VideoID",authMiddleware, teacherController.addViewsToStudent);

router.post("/convertToExcel/:VideoID",authMiddleware, teacherController.convertToExcel);

router.post("/handleVideo/:videoCode",authMiddleware, teacherController.getSingleVideoAllData);

router.get("/handleVideo/:videoCode",authMiddleware, teacherController.getSingleVideoAllData);




// ================== End Handle Videos ================= //









module.exports = router;
