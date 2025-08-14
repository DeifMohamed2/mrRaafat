const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticateTeacher } = require('../controllers/homeController');

// ================== Teacher Authentication Middleware ====================== //

const authenticateTeacherRoute = async (req, res, next) => {
  try {
    // Use the existing authenticateTeacher middleware
    await authenticateTeacher(req, res, next);
  } catch (error) {
    console.error('Teacher authentication error:', error);
    res.status(401).redirect('/login');
  }
};

// ================== Dashboard Routes ====================== //
router.get("/dash", authenticateTeacherRoute, teacherController.dash_get);
router.get("/analytics", authenticateTeacherRoute, teacherController.analytics_get);

// ================== Chapter Management Routes ====================== //
router.get("/chapters", authenticateTeacherRoute, teacherController.chapters_get);
router.get("/chapters/create", authenticateTeacherRoute, teacherController.chapter_create_get);
router.post("/chapters/create", authenticateTeacherRoute, teacherController.chapter_create_post);
router.get("/chapters/:chapterId", authenticateTeacherRoute, teacherController.chapter_detail_get);
router.get("/chapters/:chapterId/edit", authenticateTeacherRoute, teacherController.chapter_edit_get);
router.post("/chapters/:chapterId/edit", authenticateTeacherRoute, teacherController.chapter_edit_post);
router.delete("/chapters/:chapterId", authenticateTeacherRoute, teacherController.chapter_delete);

// ================== Video Management Routes ====================== //
router.get("/videos", authenticateTeacherRoute, teacherController.videos_get);
router.get("/chapters/:chapterId/videos/create", authenticateTeacherRoute, teacherController.video_create_get);
router.post("/chapters/:chapterId/videos/create", authenticateTeacherRoute, teacherController.video_create_post);
router.get("/videos/:videoId", authenticateTeacherRoute, teacherController.video_detail_get);
router.get("/videos/:videoId/edit", authenticateTeacherRoute, teacherController.video_edit_get);
router.post("/videos/:videoId/edit", authenticateTeacherRoute, teacherController.video_edit_post);
router.delete("/videos/:videoId", authenticateTeacherRoute, teacherController.video_delete);
router.get("/videos/:videoId/analytics", authenticateTeacherRoute, teacherController.video_analytics);
router.post("/videos/:videoId/increase-watches/:studentId", authenticateTeacherRoute, teacherController.increase_student_watches);

// ================== Quiz Management Routes ====================== //
router.get("/quizzes", authenticateTeacherRoute, teacherController.quizzes_get);
router.get("/quizzes/create", authenticateTeacherRoute, teacherController.quiz_create_get);
router.post("/quizzes/create", authenticateTeacherRoute, teacherController.quiz_create_post);
router.get("/quizzes/:quizId", authenticateTeacherRoute, teacherController.quiz_detail_get);
router.get("/quizzes/:quizId/edit", authenticateTeacherRoute, teacherController.quiz_edit_get);
router.post("/quizzes/:quizId/edit", authenticateTeacherRoute, teacherController.quiz_edit_post);
router.delete("/quizzes/:quizId", authenticateTeacherRoute, teacherController.quiz_delete);
router.get("/quizzes/:quizId/results", authenticateTeacherRoute, teacherController.quiz_results_get);
router.get("/quizzes/:quizId/export", authenticateTeacherRoute, teacherController.quiz_export);

// Chapter-specific quiz routes
router.get("/chapters/:chapterId/quizzes/create", authenticateTeacherRoute, teacherController.chapter_quiz_create_get);
router.post("/chapters/:chapterId/quizzes/create", authenticateTeacherRoute, teacherController.chapter_quiz_create_post);

// ================== PDF Management Routes ====================== //
router.get("/pdfs", authenticateTeacherRoute, teacherController.pdfs_get);
router.get("/pdfs/create", authenticateTeacherRoute, teacherController.pdf_create_get);
router.post("/pdfs/create", authenticateTeacherRoute, teacherController.pdf_create_post);
router.get("/pdfs/:pdfId/edit", authenticateTeacherRoute, teacherController.pdf_edit_get);
router.post("/pdfs/:pdfId/edit", authenticateTeacherRoute, teacherController.pdf_edit_post);
router.delete("/pdfs/:pdfId", authenticateTeacherRoute, teacherController.pdf_delete);

// Chapter-specific PDF routes
router.get("/chapters/:chapterId/pdfs/create", authenticateTeacherRoute, teacherController.chapter_pdf_create_get);
router.post("/chapters/:chapterId/pdfs/create", authenticateTeacherRoute, teacherController.chapter_pdf_create_post);

// ================== Student Management Routes ====================== //
router.get("/students", authenticateTeacherRoute, teacherController.students_get);
router.get("/students/requests", authenticateTeacherRoute, teacherController.student_requests_get);
router.get("/students/:studentId", authenticateTeacherRoute, teacherController.student_detail_get);
router.post("/students/:studentId/approve", authenticateTeacherRoute, teacherController.student_approve);
router.post("/students/:studentId/reject", authenticateTeacherRoute, teacherController.student_reject);
router.post("/students/:studentId/edit", authenticateTeacherRoute, teacherController.student_edit);
router.post("/students/:studentId/delete", authenticateTeacherRoute, teacherController.student_delete);
router.post("/students/:studentId/chapters/:chapterId/remove", authenticateTeacherRoute, teacherController.student_remove_chapter);
router.get("/students/search", authenticateTeacherRoute, teacherController.students_search);
router.get("/students/export", authenticateTeacherRoute, teacherController.students_export);

// ================== Code Management Routes ====================== //
router.get("/codes", authenticateTeacherRoute, teacherController.codes_get);
router.get("/codes/create", authenticateTeacherRoute, teacherController.codes_create_get);
router.post("/codes/create", authenticateTeacherRoute, teacherController.codes_create_post);
router.post("/codes/upload-excel", authenticateTeacherRoute, teacherController.codes_upload_excel);
router.get("/codes/manage", authenticateTeacherRoute, teacherController.codes_manage_get);
router.get("/codes/search", authenticateTeacherRoute, teacherController.codes_search);
router.get("/codes/export", authenticateTeacherRoute, teacherController.codes_export);
router.delete("/codes/:codeId", authenticateTeacherRoute, teacherController.code_delete);
router.delete("/codes/delete-unused", authenticateTeacherRoute, teacherController.deleteUnusedCodes);

// Code generation routes
router.post("/codes/generate/chapter", authenticateTeacherRoute, teacherController.generate_chapter_codes);
router.post("/codes/generate/video", authenticateTeacherRoute, teacherController.generate_video_codes);
router.post("/codes/generate/quiz", authenticateTeacherRoute, teacherController.generate_quiz_codes);
router.post("/codes/generate/general", authenticateTeacherRoute, teacherController.generate_general_codes);

// ================== Attendance Management Routes ====================== //
router.get("/attendance", authenticateTeacherRoute, teacherController.attendance_get);
router.get("/attendance/create", authenticateTeacherRoute, teacherController.attendance_create_get);
router.post("/attendance/create", authenticateTeacherRoute, teacherController.attendance_create_post);
router.get("/attendance/manage", authenticateTeacherRoute, teacherController.attendance_manage_get);
router.post("/attendance/:sessionId/mark", authenticateTeacherRoute, teacherController.attendance_mark);
router.delete("/attendance/:sessionId", authenticateTeacherRoute, teacherController.attendance_delete);
router.get("/attendance/export", authenticateTeacherRoute, teacherController.attendance_export);

// ================== Analytics Routes ====================== //
router.get("/analytics/students", authenticateTeacherRoute, teacherController.analytics_students);
router.get("/analytics/videos", authenticateTeacherRoute, teacherController.analytics_videos);
router.get("/analytics/quizzes", authenticateTeacherRoute, teacherController.analytics_quizzes);
router.get("/analytics/revenue", authenticateTeacherRoute, teacherController.analytics_revenue);

// ================== Communication Routes ====================== //
router.get("/communication", authenticateTeacherRoute, teacherController.communication_get);
router.get("/whatsapp", authenticateTeacherRoute, teacherController.whatsapp_get);
router.post("/whatsapp/send", authenticateTeacherRoute, teacherController.whatsapp_send);
router.post("/grades/send", authenticateTeacherRoute, teacherController.send_grades);

// ================== Settings Routes ====================== //
router.get("/settings", authenticateTeacherRoute, teacherController.settings_get);
router.post("/settings", authenticateTeacherRoute, teacherController.settings_post);

// ================== API Routes ====================== //
router.get("/api/chapters", authenticateTeacherRoute, teacherController.api_chapters_get);
router.get("/api/videos", authenticateTeacherRoute, teacherController.api_videos_get);
router.get("/api/students/by-grade", authenticateTeacherRoute, teacherController.api_students_by_grade);
router.get("/api/dashboard/analytics", authenticateTeacherRoute, teacherController.api_dashboard_analytics);

// API routes for dynamic content loading
router.get("/api/videos/chapter/:chapterId", authenticateTeacherRoute, teacherController.api_videos_by_chapter);
router.get("/api/quizzes/grade/:grade", authenticateTeacherRoute, teacherController.api_quizzes_by_grade);

// Utility routes
router.post("/chapters/:chapterId/sync-video-access", authenticateTeacherRoute, teacherController.sync_video_access_for_chapter_owners);

// ================== Auth Routes ====================== //
router.get("/logout", teacherController.logout);

// Legacy routes for backward compatibility
router.get("/addVideo", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/videos/create'));
router.get("/handleVideos", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/videos'));
router.get("/addQuiz", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/quizzes/create'));
router.get("/myStudent", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/students'));
router.get("/homeWork", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/students'));
router.get("/handelCodes", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/codes/manage'));
router.get("/Codes", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/codes'));
router.get("/studentsRequests", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/students/requests'));
router.get("/logOut", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/logout'));
router.get("/PDFPost", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/pdfs/create'));
router.get("/addCard", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/attendance/create'));
router.get("/handelAttendance", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/attendance'));
router.get("/whatsApp", authenticateTeacherRoute, (req, res) => res.redirect('/teacher/whatsapp'));

module.exports = router;
