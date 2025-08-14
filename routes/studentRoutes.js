const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateUser } = require('../controllers/homeController');

// ================== Dashboard Routes ====================== //
router.get("/dash", authenticateUser, studentController.dash_get);

// ================== Chapter Routes ====================== //
router.get("/chapters", authenticateUser, studentController.chapters_get);

// Chapter overview and purchase
router.get("/chapter/:chapterId", authenticateUser, studentController.chapter_content_get);
router.post("/chapters/:chapterId/buy", authenticateUser, studentController.buyChapter);

// Chapter content views
router.get("/chapter/:chapterId/videos", authenticateUser, studentController.chapter_videos_get);
router.get("/chapter/:chapterId/quizzes", authenticateUser, studentController.chapter_quizzes_get);
router.get("/chapter/:chapterId/pdfs", authenticateUser, studentController.chapter_pdfs_get);

// Video purchase and viewing (Enhanced with chapter context)
router.post("/chapter/:chapterId/video/:videoId/buy", authenticateUser, studentController.buyVideo);
router.get("/chapter/:chapterId/video/:videoId", authenticateUser, studentController.video_watch_get);

// Quiz purchase and viewing (Enhanced with chapter context)
router.post("/chapter/:chapterId/quiz/:quizId/buy", authenticateUser, studentController.buyQuiz);
router.get("/chapter/:chapterId/quiz/:quizId", authenticateUser, studentController.quiz_get);

// Legacy video routes for backward compatibility
router.get("/videos/lecture/:cahpterId", authenticateUser, studentController.lecture_get);
router.get("/videos/sum/:cahpterId", authenticateUser, studentController.sum_get);
router.get("/videos/solv/:cahpterId", authenticateUser, studentController.solv_get);

// Legacy video purchase (updated to redirect to new format)
router.post("/buyVideo/:videoId", authenticateUser, (req, res) => {
  // Redirect old video purchase format to new format
  // This requires getting the chapter ID from the video
  res.status(400).json({
    success: false,
    message: 'Please use the new video purchase format: /chapter/:chapterId/video/:videoId/buy'
  });
});

// ================== Watch Routes ====================== //
router.get("/watch/:videoType/:chapterID/:VideoId", authenticateUser, studentController.getVideoWatch);
router.get("/video-watch/:chapterId/:videoId", authenticateUser, studentController.video_watch_get);

// ================== Quiz Routes ====================== //
router.get("/exams", authenticateUser, studentController.exams_get);
router.get("/quiz-preparation/:quizId", authenticateUser, studentController.quiz_get);
router.get("/quiz-taking/:quizId", authenticateUser, studentController.quiz_start);
router.get("/quiz-review/:quizId", authenticateUser, studentController.quiz_review);
router.post("/quiz-taking/:quizId", authenticateUser, studentController.quizFinish);
router.post("/quiz-save-answer/:quizId", authenticateUser, studentController.saveQuizAnswer);
router.post("/start-quiz/:quizId", authenticateUser, studentController.quizWillStart);
router.post("/quizFinish/:quizId", authenticateUser, studentController.quizFinish);
router.post("/buyQuiz/:quizId", authenticateUser, studentController.buyQuiz);

// Legacy routes for backward compatibility
router.get("/quiz/:quizId", authenticateUser, (req, res) => res.redirect(`/student/quiz-preparation/${req.params.quizId}`));
router.get("/quizWillStart/:quizId", authenticateUser, (req, res) => res.redirect(`/student/quiz-taking/${req.params.quizId}?qNumber=1`));
router.post("/quiz/:quizId", authenticateUser, studentController.quiz_start);
router.get("/quizStart/:quizId", authenticateUser, (req, res) => res.redirect(`/student/quiz-taking/${req.params.quizId}?${req.url.split('?')[1] || ''}`));

// ================== PDF Routes ====================== //
router.get("/PDFs", authenticateUser, studentController.PDFs_get);
router.get("/getPDF/:PDFID", authenticateUser, studentController.getPDF);
router.post("/buyPDF/:PDFID", authenticateUser, studentController.buyPDF);

// ================== Ranking Routes ====================== //
router.get("/ranking", authenticateUser, studentController.ranking_get);

// ================== Settings Routes ====================== //
router.get("/settings", authenticateUser, studentController.settings_get);
router.post("/settings", authenticateUser, studentController.settings_post);
// Device management endpoints removed (students cannot manage devices)

// ================== Upload Routes ====================== //
router.post("/uploadHW", authenticateUser, studentController.uploadHW);

// ================== Logout Route ====================== //
router.get("/logOut", authenticateUser, studentController.logOut);

module.exports = router;
