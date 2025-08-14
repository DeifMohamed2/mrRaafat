const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Chapter = require('../models/Chapter');
const Code = require('../models/Code');
const PDFs = require('../models/PDFs');
const mongoose = require('mongoose');

const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWTSECRET;

const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const stream = require('stream');

const { v4: uuidv4 } = require('uuid');

// ==================  Dash  ====================== //

const dash_get = async (req, res) => {
  try {
    const userGrade = req.userData.Grade;
    
    // Get user's chapters with proper filtering
    const userChapters = await Chapter.find({
      chapterGrade: userGrade,
      ARorEN: req.userData.ARorEN,
      isActive: true
    }).select('chapterName _id');

    // Get user's quizzes
    const userQuizzes = await Quiz.find({
      Grade: userGrade,
      isQuizActive: true
    }).select('quizName _id');

    // Get top ranked users for the podium
    const rankedUsers = await User.find({
      Grade: userGrade,
      isTeacher: false,
      totalScore: { $gt: 0 }
    })
    .sort({ totalScore: -1 })
    .limit(10)
    .select('Username totalScore totalQuestions');

    // Calculate user statistics
    const totalVideosWatched = req.userData.videosInfo ? 
      req.userData.videosInfo.filter(video => video.numberOfWatches > 0).length : 0;
    
    const totalQuizzesTaken = req.userData.quizesInfo ? 
      req.userData.quizesInfo.filter(quiz => quiz.isEnterd).length : 0;

    const averageScore = req.userData.totalQuestions > 0 ? 
      Math.round((req.userData.totalScore / req.userData.totalQuestions) * 100) : 0;

    // Get recent activities
    const recentActivities = [];
    
    // Add recent video watches
    if (req.userData.videosInfo) {
      req.userData.videosInfo
        .filter(video => video.lastWatch)
        .sort((a, b) => new Date(b.lastWatch) - new Date(a.lastWatch))
        .slice(0, 3)
        .forEach(video => {
          recentActivities.push({
            type: 'video',
            title: video.videoName,
            date: video.lastWatch,
            icon: 'play_circle'
          });
        });
    }

    // Add recent quiz attempts
    if (req.userData.quizesInfo) {
      req.userData.quizesInfo
        .filter(quiz => quiz.isEnterd)
        .slice(0, 2)
        .forEach(quiz => {
          recentActivities.push({
            type: 'quiz',
            title: 'اختبار',
            score: quiz.Score,
            icon: 'quiz'
          });
        });
    }

    // Sort activities by date
    recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render('student/dash', {
      title: 'Dashboard',
      path: req.path,
      userData: req.userData,
      stats: {
        totalVideosWatched,
        totalQuizzesTaken,
        averageScore,
        chaptersOwned: req.userData.chaptersPaid.length,
        videosOwned: req.userData.videosPaid.length
      },
      userChapters,
      userQuizzes,
      rankedUsers,
      recentActivities
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ==================  END Dash  ====================== //

// Devices Management removed from student controller (no student control)

// ==================  Chapter  ====================== //

const chapters_get = async (req, res) => {
  try {
    const chapters = await Chapter.find({
      chapterGrade: req.userData.Grade,
      ARorEN: req.userData.ARorEN,
      isActive: true
    }).sort({ createdAt: 1 });
    
    const paidChapters = chapters.map((chapter) => {
      const isPaid = req.userData.hasChapterAccess(chapter._id);
      
      // Calculate chapter statistics
      const chapterData = chapter.toObject();
      chapterData.isPaid = isPaid;
      
      // Count content
      chapterData.stats = {
        videos: (chapterData.chapterLectures?.length || 0) + 
                (chapterData.chapterSummaries?.length || 0) + 
                (chapterData.chapterSolvings?.length || 0),
        totalContent: (chapterData.chapterLectures?.length || 0) + 
                     (chapterData.chapterSummaries?.length || 0) + 
                     (chapterData.chapterSolvings?.length || 0)
      };
      
      return chapterData;
    });

    res.render('student/chapters', {
      title: 'Chapters',
      path: req.path,
      chapters: paidChapters,
      userData: req.userData,
      error: req.query.error
    });
  } catch (error) {
    console.error('Chapters error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const buyChapter = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const code = req.body.code;
    
    // Validate chapter exists and user can access it
    const chapterData = await Chapter.findById(chapterId);
    if (!chapterData) {
      return res.redirect('/student/chapters?error=chapter_not_found');
    }

    // Check if user can purchase content for this grade
    if (!req.userData.canPurchaseContent(chapterData.chapterGrade)) {
      return res.redirect('/student/chapters?error=grade_mismatch');
    }

    // Check if user already has access
    if (req.userData.hasChapterAccess(chapterId)) {
      return res.redirect('/student/chapter/' + chapterId);
    }

    // Find and validate code (specific chapter code or general chapter code)
    const codeData = await Code.findOne({
      Code: code.toUpperCase(),
      isUsed: false,
      $or: [
        { codeType: 'Chapter' },
        { codeType: 'GeneralChapter'}
      ],
      isActive: true
    });

    if (!codeData) {
      return res.redirect('/student/chapters?error=invalid_code');
    }

    // Validate code can be used by this user
    const codeValidation = codeData.canBeUsedBy(req.userData);
    if (!codeValidation.valid) {
      return res.redirect('/student/chapters?error=' + encodeURIComponent(codeValidation.reason));
    }

    // Check if code is for this specific chapter (only for non-general codes)
    if (!codeData.isGeneralCode && codeData.chapterId && codeData.chapterId.toString() !== chapterId) {
      return res.redirect('/student/chapters?error=code_chapter_mismatch');
    }

    // Additional check for grade compatibility (unless code works for all grades)
    if (!codeData.isAllGrades && !req.userData.canPurchaseContent(chapterData.chapterGrade)) {
      return res.redirect('/student/chapters?error=grade_mismatch');
    }

    // Process purchase
    if (codeData.isGeneralCode && codeData.codeType === 'GeneralChapter') {
      // Grant general chapter access for user's grade
      await req.userData.grantGeneralChapterAccess(code);
    } else {
      // Grant specific chapter access
      await req.userData.addChapterPurchase(chapterData, code);
    }
    await codeData.markAsUsed(req.userData);

    // Grant access to all videos in chapter
    const allVideos = [
      ...(chapterData.chapterLectures || []),
      ...(chapterData.chapterSummaries || []),
      ...(chapterData.chapterSolvings || [])
    ];

    // Update user's video access
    for (const video of allVideos) {
      const videoInfo = req.userData.videosInfo.find(v => v._id.toString() === video._id.toString());
      if (videoInfo && !videoInfo.videoPurchaseStatus) {
        videoInfo.videoPurchaseStatus = true;
        videoInfo.purchaseDate = new Date();
        videoInfo.purchaseCode = code;
        
        if (!req.userData.videosPaid.includes(video._id)) {
          req.userData.videosPaid.push(video._id);
        }
      }
    }

    await req.userData.save();

    res.redirect('/student/chapter/' + chapterId + '?success=chapter_purchased');
  } catch (error) {
    console.error('Buy chapter error:', error);
    res.redirect('/student/chapters?error=purchase_failed');
  }
};

// ================== End Chapter  ====================== //

// ==================  Lecture  ====================== //

const lecture_get = async (req, res) => {
  try {
    const cahpterId = req.params.cahpterId;
    const chapter = await Chapter.findById(cahpterId, {
      chapterLectures: 1,
      chapterAccessibility: 1,
    });
    const isPaid = req.userData.hasChapterAccess(cahpterId);
    const paidVideos = chapter.chapterLectures.map((lecture) => {
      const isPaidVideo = req.userData.hasVideoAccess(lecture._id);
      const videoUser = req.userData.videosInfo.find(
        (video) => video._id == lecture._id
      );
      let videoPrerequisitesName;
      let isUserCanEnter = true;

      if (
        lecture.prerequisites == 'WithExamaAndHw' ||
        lecture.prerequisites == 'WithExam' ||
        lecture.prerequisites == 'WithHw'
      ) {
        const video = req.userData.videosInfo.find(
          (video) => video._id == lecture.AccessibleAfterViewing
        );
        videoPrerequisitesName = video ? video.videoName : null;
        if (lecture.prerequisites == 'WithExamaAndHw') {
          isUserCanEnter = videoUser?.isUserEnterQuiz && videoUser?.isUserUploadPerviousHWAndApproved;
        } else if (lecture.prerequisites == 'WithExam') {
          isUserCanEnter = videoUser?.isUserEnterQuiz;
        } else if (lecture.prerequisites == 'WithHw') {
          isUserCanEnter = videoUser?.isUserUploadPerviousHWAndApproved;
        }
      }

      return {
        ...lecture,
        isPaid: isPaidVideo,
        Attemps: videoUser?.videoAllowedAttemps ?? 0,
        videoPrerequisitesName: videoPrerequisitesName || null,
        isUserCanEnter: isUserCanEnter,
      };
    });

    if (chapter.chapterAccessibility === 'EnterInFree' || isPaid) {
      res.render('student/videos', {
        title: 'Lecture',
        path: req.path,
        chapterLectures: paidVideos,
        userData: req.userData,
        chapterId: cahpterId,
      });
    } else {
      res.redirect('/student/chapters');
    }
  } catch (error) {
    console.error('Lecture error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const sum_get = async (req, res) => {
  try {
    const cahpterId = req.params.cahpterId;
    const chapter = await Chapter.findById(cahpterId, {
      chapterSummaries: 1,
      chapterAccessibility: 1,
    });
    const isPaid = req.userData.hasChapterAccess(cahpterId);
    const paidVideos = chapter.chapterSummaries.map((lecture) => {
      const isPaidVideo = req.userData.hasVideoAccess(lecture._id);
      const videoUser = req.userData.videosInfo.find(
        (video) => video._id == lecture._id
      );
      let videoPrerequisitesName;
      let isUserCanEnter = true;

      if (
        lecture.prerequisites == 'WithExamaAndHw' ||
        lecture.prerequisites == 'WithExam' ||
        lecture.prerequisites == 'WithHw'
      ) {
        const video = req.userData.videosInfo.find(
          (video) => video._id == lecture.AccessibleAfterViewing
        );
        videoPrerequisitesName = video ? video.videoName : null;
        if (lecture.prerequisites == 'WithExamaAndHw') {
          isUserCanEnter = videoUser?.isUserEnterQuiz && videoUser?.isUserUploadPerviousHWAndApproved;
        } else if (lecture.prerequisites == 'WithExam') {
          isUserCanEnter = videoUser?.isUserEnterQuiz;
        } else if (lecture.prerequisites == 'WithHw') {
          isUserCanEnter = videoUser?.isUserUploadPerviousHWAndApproved;
        }
      }

      return {
        ...lecture,
        isPaid: isPaidVideo,
        Attemps: videoUser?.videoAllowedAttemps ?? 0,
        videoPrerequisitesName: videoPrerequisitesName || null,
        isUserCanEnter: isUserCanEnter,
      };
    });

    if (chapter.chapterAccessibility === 'EnterInFree' || isPaid) {
      res.render('student/videos', {
        title: 'Summary',
        path: req.path,
        chapterLectures: paidVideos,
        userData: req.userData,
        chapterId: cahpterId,
      });
    } else {
      res.redirect('/student/chapters');
    }
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const solv_get = async (req, res) => {
  try {
    const cahpterId = req.params.cahpterId;
    const chapter = await Chapter.findById(cahpterId, {
      chapterSolvings: 1,
      chapterAccessibility: 1,
    });
    const isPaid = req.userData.hasChapterAccess(cahpterId);
    const paidVideos = chapter.chapterSolvings.map((lecture) => {
      const isPaidVideo = req.userData.hasVideoAccess(lecture._id);
      const videoUser = req.userData.videosInfo.find(
        (video) => video._id == lecture._id
      );
      let videoPrerequisitesName;
      let isUserCanEnter = true;

      if (
        lecture.prerequisites == 'WithExamaAndHw' ||
        lecture.prerequisites == 'WithExam' ||
        lecture.prerequisites == 'WithHw'
      ) {
        const video = req.userData.videosInfo.find(
          (video) => video._id == lecture.AccessibleAfterViewing
        );
        videoPrerequisitesName = video ? video.videoName : null;
        if (lecture.prerequisites == 'WithExamaAndHw') {
          isUserCanEnter = videoUser?.isUserEnterQuiz && videoUser?.isUserUploadPerviousHWAndApproved;
        } else if (lecture.prerequisites == 'WithExam') {
          isUserCanEnter = videoUser?.isUserEnterQuiz;
        } else if (lecture.prerequisites == 'WithHw') {
          isUserCanEnter = videoUser?.isUserUploadPerviousHWAndApproved;
        }
      }

      return {
        ...lecture,
        isPaid: isPaidVideo,
        Attemps: videoUser?.videoAllowedAttemps ?? 0,
        videoPrerequisitesName: videoPrerequisitesName || null,
        isUserCanEnter: isUserCanEnter,
      };
    });

    if (chapter.chapterAccessibility === 'EnterInFree' || isPaid) {
      res.render('student/videos', {
        title: 'Solving',
        path: req.path,
        chapterLectures: paidVideos,
        userData: req.userData,
        chapterId: cahpterId,
      });
    } else {
      res.redirect('/student/chapters');
    }
  } catch (error) {
    console.error('Solving error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ================== End Lecture  ====================== //

// ==================  Watch  ====================== //
async function updateWatchInUser(req, res, videoId, chapterID) {
  const videoInfo = req.userData.videosInfo.find(
    (video) => video._id.toString() === videoId.toString()
  );
  
  if (!videoInfo || videoInfo.videoAllowedAttemps <= 0) {
    return res.redirect('/student/chapter/' + chapterID);
  }
  
  const updateFields = {
    'videosInfo.$.lastWatch': Date.now(),
    ...(videoInfo.fristWatch ? {} : { 'videosInfo.$.fristWatch': Date.now() })
  };
  
  const incFields = {
    'videosInfo.$.numberOfWatches': 1,
    'videosInfo.$.videoAllowedAttemps': -1
  };

  await User.findOneAndUpdate(
    { _id: req.userData._id, 'videosInfo._id': videoId },
    {
      $set: updateFields,
      $inc: incFields
    }
  );
}

const getVideoWatch = async (req, res) => {
  const videoType = req.params.videoType;
  const chapterID = req.params.chapterID;
  const VideoId = req.params.VideoId;

  const chapter = await Chapter.findById(chapterID, {
    chapterLectures: 1,
    chapterSummaries: 1,
    chapterSolvings: 1,
  });
  
  let video = null;
  if (videoType == 'lecture') {
    video = chapter.chapterLectures.find((video) => video._id == VideoId);
  } else if (videoType == 'sum') {
    video = chapter.chapterSummaries.find((video) => video._id == VideoId);
  } else if (videoType == 'solv') {
    video = chapter.chapterSolvings.find((video) => video._id == VideoId);
  }

  if (!video) {
    return res.status(404).send('Video not found');
  }

  const hasChapterAccess = req.userData.hasChapterAccess(chapterID);
  const hasVideoAccess = req.userData.hasVideoAccess(VideoId);
  
  if (video.paymentStatus == 'Pay') {
    if (hasVideoAccess || hasChapterAccess) {
      await updateWatchInUser(req, res, VideoId, chapterID);
      res.render('student/watch', {
        title: 'Watch',
        path: req.path,
        video: video,
        userData: req.userData,
      });
    } else {
      res.redirect('/student/chapter/' + chapterID);
    }
  } else {
    await updateWatchInUser(req, res, VideoId, chapterID);
    res.render('student/watch', {
      title: 'Watch',
      path: req.path,
      video: video,
      userData: req.userData,
    });
  }
}

const watch_get = async (req, res) => {
  try {
    await getVideoWatch(req, res);
  } catch (error) {
    console.error('Watch error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const uploadHW = async (req, res) => {
  try {
    const VideoId = req.params.VideoId;
    const userId = req.userData._id;

    // Update the specific video's isHWIsUploaded field
    await User.findOneAndUpdate(
      { _id: userId, 'videosInfo._id': VideoId },
      { $set: { 'videosInfo.$.isHWIsUploaded': true } }
    );

    // Optionally, you can call getVideoWatch after updating the field
    await getVideoWatch(req, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// ================== END Watch  ====================== //

// ================== Ranking  ====================== //

const ranking_get = async (req, res) => {
  try {
    const { searchInput } = req.query;
    let perPage = 20;
    let page = req.query.page || 1;

    if (searchInput) {
      // Find the student with the given Code
      const student = await User.findOne({ Code: searchInput }).exec();

      // Find all students and sort them by totalScore
      const allStudents = await User.find(
        {},
        { Username: 1, Code: 1, totalScore: 1 }
      ).sort({ totalScore: -1 });

      // Find the index of the student in the sorted array
      const userRank =
        allStudents.findIndex((s) => s.Code === +searchInput) + 1;
      console.log(userRank);
      const paginatedStudents = await User.find(
        { Code: searchInput },
        { Username: 1, Code: 1, totalScore: 1 }
      ).sort({ totalScore: -1 });

      const count = await User.countDocuments({});

      const nextPage = parseInt(page) + 1;
      const hasNextPage = nextPage <= Math.ceil(count / perPage);
      const hasPreviousPage = page > 1;

      res.render('student/ranking', {
        title: 'Ranking',
        path: req.path,
        isSearching: true,
        userData: req.userData,
        rankedUsers: paginatedStudents,
        nextPage: hasNextPage ? nextPage : null,
        previousPage: hasPreviousPage ? page - 1 : null,
        userRank: userRank, // Include user's rank in the response
      });

      return;
    } else {
      await User.find(
        { Grade: req.userData.Grade },
        { Username: 1, Code: 1, totalScore: 1 }
      )
        .sort({ totalScore: -1 })
        .then(async (result) => {
          const count = await Code.countDocuments({});
          const nextPage = parseInt(page) + 1;
          const hasNextPage = nextPage <= Math.ceil(count / perPage);
          const hasPreviousPage = page > 1;

          res.render('student/ranking', {
            title: 'Ranking',
            path: req.path,
            userData: req.userData,
            rankedUsers: result,
            nextPage: hasNextPage ? nextPage : null,
            previousPage: hasPreviousPage ? page - 1 : null,
            userRank: null,
            isSearching: false,
          });
        })
        .catch((err) => {
          console.log(err);
        });
      return;
    }
  } catch (error) {
    console.log();
  }
};

// ================== END Ranking  ====================== //

// ================== Exams  ====================== //

// ================== Exams  ====================== //
const exams_get = async (req, res) => {
  try {
    // Get the top 3 ranked users by total score
    const rankedUsers = await User.find(
      { Grade: req.userData.Grade },
      { Username: 1, userPhoto: 1 }
    )
      .sort({ totalScore: -1 })
      .limit(3);

    // Get all active and visible exams for the user's grade
    const exams = await Quiz.find({ 
      Grade: req.userData.Grade,
      isQuizActive: true, // Only show active quizzes
      permissionToShow: true // Only show quizzes that are set to be visible
    }).sort({
      createdAt: 1,
    });

    // Map through the exams and add additional information
    const paidExams = await Promise.all(
      exams.map(async (exam) => {
        const isPaid = req.userData.examsPaid.includes(exam._id);
        const quizUser = req.userData.quizesInfo.find(
          (quiz) => quiz._id.toString() === exam._id.toString()
        );

        // Get all user scores for the current quiz
        const users = await User.find({
          Grade: req.userData.Grade,
          'quizesInfo._id': exam._id,
        }).select('quizesInfo.$');

        // Extract and sort the scores
        const userScores = users
          .map((user) => ({
            userId: user._id,
            score: user.quizesInfo[0].Score,
          }))
          .sort((a, b) => b.score - a.score);

        // Find the rank of the current user
        const userRank =
          userScores.findIndex(
            (result) => result.userId.toString() === req.userData._id.toString()
          ) + 1;

        const quizInfo = quizUser
          ? {
              isEnterd: quizUser.isEnterd,
              inProgress: quizUser.inProgress,
              Score: quizUser.Score,
              answers: quizUser.answers,
              rank: userRank, // Add user rank here
              lengthOfUsersTakesQuiz: userScores.length, // Add total number of users who took the quiz
              // Add other properties you want to include
            }
          : null;

        return { ...exam.toObject(), isPaid, quizUser: quizInfo };
      })
    );

    res.render('student/exams', {
      title: 'Exams',
      path: req.path,
      userData: req.userData,
      rankedUsers,
      exams: paidExams,
    });
  } catch (error) {
    res.send(error.message);
  }
};

const buyQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const chapterId = req.params.chapterId;
    const code = req.body.code;
    
    // For legacy route support (if no chapterId)
    const redirectBase = chapterId ? `/student/chapter/${chapterId}/quizzes` : '/student/exams';
    
    // Validate quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ 
        success: false, 
        message: 'Quiz not found',
        redirect: `${redirectBase}?error=quiz_not_found`
      });
    }

    // Check grade compatibility
    if (!req.userData.canPurchaseContent(quiz.Grade)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Grade mismatch',
        redirect: `${redirectBase}?error=grade_mismatch`
      });
    }

    // Check if user already has access
    const hasGeneralAccess = req.userData.hasGeneralQuizAccess();
    const hasSpecificAccess = req.userData.examsPaid && req.userData.examsPaid.includes(quizId);
    
    if (hasGeneralAccess || hasSpecificAccess) {
      const targetUrl = chapterId ? `/student/chapter/${chapterId}/quiz/${quizId}` : `/student/quiz/${quizId}`;
      return res.status(200).json({ 
        success: true, 
        message: 'Already have access',
        redirect: targetUrl
      });
    }

    // Find and validate code (specific quiz code or general quiz code)
    const codeData = await Code.findOne({
      Code: code.toUpperCase(),
      isUsed: false,
      $or: [
        { codeType: 'Quiz' },
        { codeType: 'GeneralQuiz'}
      ],
      isActive: true
    });

    if (!codeData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or used code',
        redirect: `${redirectBase}?error=invalid_code`
      });
    }

    // Check if code is for this specific quiz (only for non-general codes)
    if (!codeData.isGeneralCode && codeData.contentId && codeData.contentId.toString() !== quizId.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code is not for this quiz',
        redirect: `${redirectBase}?error=code_quiz_mismatch`
      });
    }

    // Validate code can be used by this user
    const codeValidation = codeData.canBeUsedBy(req.userData);
    if (!codeValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: codeValidation.reason,
        redirect: `${redirectBase}?error=${encodeURIComponent(codeValidation.reason)}`
      });
    }

    // Additional check for grade compatibility (unless code works for all grades)
    if (!codeData.isAllGrades && !req.userData.canPurchaseContent(quiz.Grade)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Grade mismatch',
        redirect: `${redirectBase}?error=grade_mismatch`
      });
    }

    // Process quiz purchase
    if (codeData.isGeneralCode && codeData.codeType === 'GeneralQuiz') {
      // Grant general quiz access for user's grade
      await req.userData.grantGeneralQuizAccess(code);
    } else {
      // Grant specific quiz access
      if (!req.userData.examsPaid) {
        req.userData.examsPaid = [];
      }
      req.userData.examsPaid.push(quizId);
      
      // Update quiz info if exists
      const quizInfo = req.userData.quizesInfo.find(q => q._id.toString() === quizId);
      if (quizInfo) {
        quizInfo.quizPurchaseStatus = true;
      }
      
      await req.userData.save();
    }
    await codeData.markAsUsed(req.userData);

    // Return success response with redirect
    const successUrl = chapterId ? `/student/chapter/${chapterId}/quiz/${quizId}?success=quiz_purchased` : `/student/quiz/${quizId}?success=quiz_purchased`;
    return res.status(200).json({ 
      success: true, 
      message: 'Quiz purchased successfully',
      redirect: successUrl
    });

  } catch (error) {
    console.error('Buy quiz error:', error);
    const errorUrl = req.params.chapterId ? `/student/chapter/${req.params.chapterId}/quizzes?error=purchase_failed` : '/student/exams?error=purchase_failed';
    return res.status(500).json({ 
      success: false, 
      message: 'Purchase failed',
      redirect: errorUrl
    });
  }
};
// ================== END Exams  ====================== //

// ================== quiz  ====================== //
const quiz_get = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    console.log('Quiz found:', quiz ? quiz.quizName : 'Not found');
    if (!quiz) {
      return res.redirect('/student/exams');
    }

    // Check if quiz is active and visible
    if (!quiz.permissionToShow || !quiz.isQuizActive) {
      console.log('Quiz not active or not visible');
      return res.redirect('/student/exams');
    }

    // Check quiz access (free, paid, or general access)
    const hasGeneralQuizAccess = req.userData.hasGeneralQuizAccess();
    const hasSpecificQuizAccess = req.userData.examsPaid && req.userData.examsPaid.includes(quizId);
    const isFreeQuiz = !quiz.prepaidStatus || quiz.quizPrice === 0;
    
    console.log('Quiz access check:', {
      isFreeQuiz,
      hasGeneralQuizAccess,
      hasSpecificQuizAccess,
      prepaidStatus: quiz.prepaidStatus,
      quizPrice: quiz.quizPrice
    });

    // Allow access if: free quiz, general access, or specific access
    if (!isFreeQuiz && !hasGeneralQuizAccess && !hasSpecificQuizAccess) {
      console.log('No access to paid quiz');
      return res.redirect('/student/exams');
    }

    // Check if user already completed this quiz
    const quizUser = req.userData.quizesInfo && req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );
    
    if (quizUser && quizUser.isEnterd && !quizUser.inProgress) {
      console.log('Quiz already completed');
      return res.redirect('/student/exams');
    }

    console.log('Rendering quiz preparation page');
    res.render('student/quiz-preparation', {
      title: 'Quiz',
      path: req.path,
      quiz: quiz,
      userData: req.userData,
      question: null,
    });
  } catch (error) {
    console.error('Quiz get error:', error);
    res.send(error.message);
  }
};

const quizWillStart = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Check quiz access (free, paid, or general access)
    const hasGeneralQuizAccess = req.userData.hasGeneralQuizAccess();
    const hasSpecificQuizAccess = req.userData.examsPaid && req.userData.examsPaid.includes(quizId);
    const isFreeQuiz = !quiz.prepaidStatus || quiz.quizPrice === 0;

    // Allow access if: free quiz, general access, or specific access
    if (!isFreeQuiz && !hasGeneralQuizAccess && !hasSpecificQuizAccess) {
      return res.status(403).json({ success: false, message: 'No access to this quiz' });
    }

    // Find or create quiz user info
    let quizUser = req.userData.quizesInfo && req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );

    // Check if user already completed this quiz
    if (quizUser && quizUser.isEnterd && !quizUser.inProgress) {
      return res.status(400).json({ success: false, message: 'Quiz already completed' });
    }

    const durationInMinutes = quiz.timeOfQuiz;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);
    
    console.log('Starting quiz:', quiz.quizName);
    console.log('Quiz user exists:', !!quizUser);
    console.log('Start time:', startTime);
    console.log('End time:', endTime);

    if (!quizUser) {
      // Create new quiz info for user
      console.log('Creating new quiz info for user');
      const newQuizInfo = {
        _id: quiz._id,
        quizName: quiz.quizName,
        chapterId: quiz.chapterId || null,
        isEnterd: false,
        inProgress: true,
        Score: 0,
        answers: [],
        randomQuestionIndices: [],
        startTime: startTime,
        endTime: endTime,
        quizPurchaseStatus: !quiz.prepaidStatus || isFreeQuiz || hasGeneralQuizAccess || hasSpecificQuizAccess
      };

      await User.findByIdAndUpdate(
        req.userData._id,
        {
          $push: { quizesInfo: newQuizInfo }
        }
      );
      
      return res.json({ success: true, message: 'Quiz started successfully' });
    } else if (!quizUser.endTime || !quizUser.inProgress) {
      // Update existing quiz info with start time
      console.log('Updating existing quiz info with start time');
      await User.findOneAndUpdate(
        { _id: req.userData._id, 'quizesInfo._id': quiz._id },
        {
          $set: {
            'quizesInfo.$.startTime': startTime,
            'quizesInfo.$.endTime': endTime,
            'quizesInfo.$.inProgress': true,
            'quizesInfo.$.isEnterd': false,
            'quizesInfo.$.answers': [],
            'quizesInfo.$.Score': 0,
            'quizesInfo.$.randomQuestionIndices': []
          },
        }
      );
      
      return res.json({ success: true, message: 'Quiz timer updated successfully' });
    } else {
      // Check if existing quiz time is still valid
      const currentTime = new Date().getTime();
      const existingEndTime = new Date(quizUser.endTime).getTime();
      
      if (currentTime >= existingEndTime) {
        return res.status(400).json({ success: false, message: 'Quiz time has expired' });
      }
      
      // Quiz already started and still valid, continue
      console.log('Quiz already started, continuing');
      return res.json({ success: true, message: 'Quiz already in progress' });
    }
  } catch (error) {
    console.error('Quiz will start error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const escapeSpecialCharacters = (text) => {
  try {
    // Attempt to parse the JSON string
    const parsedText = JSON.parse(text);
    // If parsing succeeds, stringify it back and escape special characters
    const escapedText = JSON.stringify(parsedText, (key, value) => {
      if (typeof value === 'string') {
        return value.replace(/["\\]/g, '\\$&');
      }
      return value;
    });
    return escapedText;
  } catch (error) {
    // If parsing fails, return the original text
    return text;
  }
};

const quiz_start = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    console.log('=== QUIZ START DEBUG ===');
    console.log('Quiz ID:', quizId);
    console.log('Quiz found:', quiz ? quiz.quizName : 'NOT FOUND');
    console.log('User quizesInfo count:', req.userData.quizesInfo ? req.userData.quizesInfo.length : 0);
    
    const userQuizInfo = req.userData.quizesInfo && req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );
    
    console.log('UserQuizInfo found:', !!userQuizInfo);
    if (userQuizInfo) {
      console.log('UserQuizInfo details:', {
        isEnterd: userQuizInfo.isEnterd,
        inProgress: userQuizInfo.inProgress,
        hasEndTime: !!userQuizInfo.endTime,
        randomQuestionIndices: userQuizInfo.randomQuestionIndices
      });
    }

    // Redirect if quiz not found
    if (!quiz || !quiz.permissionToShow || !quiz.isQuizActive) {
      return res.redirect('/student/exams');
    }

    // Check quiz access (free, paid, or general access)
    const hasGeneralQuizAccess = req.userData.hasGeneralQuizAccess();
    const hasSpecificQuizAccess = req.userData.examsPaid && req.userData.examsPaid.includes(quizId);
    const isFreeQuiz = !quiz.prepaidStatus || quiz.quizPrice === 0;

    // Allow access if: free quiz, general access, or specific access
    if (!isFreeQuiz && !hasGeneralQuizAccess && !hasSpecificQuizAccess) {
      return res.redirect('/student/exams');
    }

    // Redirect if user completed quiz
    if (userQuizInfo && userQuizInfo.isEnterd && !userQuizInfo.inProgress) {
      return res.redirect('/student/exams');
    }

    // Redirect if quiz is not yet started
    if (!userQuizInfo || !userQuizInfo.endTime) {
      return res.redirect('/student/exams');
    }

    // Check if quiz time has expired
    const currentTime = new Date().getTime();
    const endTime = new Date(userQuizInfo.endTime).getTime();
    
    if (currentTime >= endTime) {
      console.log('Quiz time expired, auto-finishing quiz');
      // Auto-finish the quiz if time is up
      await User.findOneAndUpdate(
        { _id: req.userData._id, 'quizesInfo._id': quiz._id },
        {
          $set: {
            'quizesInfo.$.inProgress': false,
            'quizesInfo.$.isEnterd': true,
            'quizesInfo.$.solvedAt': new Date(),
            'quizesInfo.$.endTime': 0,
          }
        }
      );
      return res.redirect('/student/exams?message=quiz_time_expired');
    }

    // Check if we need to generate random questions for this user
    console.log('Current userQuizInfo.randomQuestionIndices:', userQuizInfo.randomQuestionIndices);
    console.log('Type of randomQuestionIndices:', typeof userQuizInfo.randomQuestionIndices);
    console.log('Is array?', Array.isArray(userQuizInfo.randomQuestionIndices));
    console.log('Length:', userQuizInfo.randomQuestionIndices ? userQuizInfo.randomQuestionIndices.length : 'undefined');
    
    if (!userQuizInfo.randomQuestionIndices || userQuizInfo.randomQuestionIndices.length === 0) {
      // Determine how many questions to show
      const questionsToShow = quiz.questionsToShow || quiz.questionsCount;
      
      // Generate random question indices if needed
      if (questionsToShow < quiz.Questions.length) {
        // Create an array of all question indices
        const allIndices = Array.from({ length: quiz.Questions.length }, (_, i) => i);
        
        // Shuffle the array using Fisher-Yates algorithm
        for (let i = allIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
        }
        
        // Take the first 'questionsToShow' indices
        const randomIndices = allIndices.slice(0, questionsToShow);
        
        // Save these indices to the user's quiz info
        console.log('Saving random indices to database:', randomIndices);
        const updateResult = await User.findOneAndUpdate(
          { _id: req.userData._id, 'quizesInfo._id': quiz._id },
          { $set: { 'quizesInfo.$.randomQuestionIndices': randomIndices } },
          { new: true }
        );
        
        console.log('Database update result:', updateResult ? 'SUCCESS' : 'FAILED');
        
        // Update local userQuizInfo
        userQuizInfo.randomQuestionIndices = randomIndices;
        console.log('Updated local userQuizInfo.randomQuestionIndices:', userQuizInfo.randomQuestionIndices);
      } else {
        // If showing all questions, just use sequential indices
        const sequentialIndices = Array.from({ length: quiz.Questions.length }, (_, i) => i);
        
        console.log('Using sequential indices:', sequentialIndices);
        const updateResult = await User.findOneAndUpdate(
          { _id: req.userData._id, 'quizesInfo._id': quiz._id },
          { $set: { 'quizesInfo.$.randomQuestionIndices': sequentialIndices } },
          { new: true }
        );
        
        console.log('Database update result (sequential):', updateResult ? 'SUCCESS' : 'FAILED');
        
        // Update local userQuizInfo
        userQuizInfo.randomQuestionIndices = sequentialIndices;
        console.log('Updated local userQuizInfo.randomQuestionIndices (sequential):', userQuizInfo.randomQuestionIndices);
      }
    }

    // Final safety check for randomQuestionIndices
    if (!userQuizInfo.randomQuestionIndices || userQuizInfo.randomQuestionIndices.length === 0) {
      console.log('CRITICAL ERROR: randomQuestionIndices still empty after generation!');
      console.log('Falling back to sequential indices');
      userQuizInfo.randomQuestionIndices = Array.from({ length: quiz.questionsCount }, (_, i) => i);
    }
    
    console.log('Final randomQuestionIndices before rendering:', userQuizInfo.randomQuestionIndices);
    
    // Parse query parameter for question number (1-based for UI)
    let questionNumber = parseInt(req.query.qNumber) || 1;
    
    // Ensure question number is within bounds
    const maxQuestions = userQuizInfo.randomQuestionIndices.length;
    console.log('Max questions available:', maxQuestions);
    console.log('Requested question number:', questionNumber);
    
    if (questionNumber > maxQuestions) {
      questionNumber = maxQuestions;
    }
    
    // Get the actual question index from the randomized indices (0-based)
    const actualQuestionIndex = userQuizInfo.randomQuestionIndices[questionNumber - 1];
    console.log('Actual question index for question', questionNumber, ':', actualQuestionIndex);
    
    // Find the current question using the randomized index
    const question = quiz.Questions[actualQuestionIndex];
    
    if (!question) {
      console.log('Question not found at index', actualQuestionIndex);
      console.log('Total questions in quiz:', quiz.Questions.length);
      console.log('Question not found, redirecting to exams');
      return res.redirect('/student/exams');
    }
    
    // Normalize image field names for backward compatibility
    if (question.questionPhoto && !question.image) {
      question.image = question.questionPhoto;
    }
    
    console.log('Successfully found question:', question.title || question.question);
    console.log('Question fields:', Object.keys(question));
    console.log('Question image field:', question.image);
    console.log('Question questionPhoto field:', question.questionPhoto);
    console.log('Question has image?', !!(question.image || question.questionPhoto));
    
    // Add the question number and total questions to the question object
    question.qNumber = questionNumber;
    question.totalQuestions = maxQuestions;
    question.actualIndex = actualQuestionIndex; // Store the actual index for answer tracking

    // Escape special characters in question text
    if (question.title) {
      question.title = escapeSpecialCharacters(question.title);
    }
    if (question.question) {
      question.question = escapeSpecialCharacters(question.question);
    }
    if (question.answer1) {
      question.answer1 = escapeSpecialCharacters(question.answer1);
    }
    if (question.answer2) {
      question.answer2 = escapeSpecialCharacters(question.answer2);
    }
    if (question.answer3) {
      question.answer3 = escapeSpecialCharacters(question.answer3);
    }
    if (question.answer4) {
      question.answer4 = escapeSpecialCharacters(question.answer4);
    }

    res.render('student/quiz-taking', {
      title: 'Quiz',
      path: req.path,
      quiz,
      userData: req.userData,
      question,
      userQuizInfo,
      maxQuestions
    });
  } catch (error) {
    console.error('Quiz start error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const quizFinish = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quizObjId = new mongoose.Types.ObjectId(quizId);

    const quiz = await Quiz.findById(quizId);
    const userQuizInfo = req.userData.quizesInfo && req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );
    
    console.log('Finishing quiz:', quiz ? quiz.quizName : 'Not found');
    console.log('Quiz data received:', req.body);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (!userQuizInfo) {
      return res.status(400).json({ success: false, message: 'Quiz not started' });
    }

    if (userQuizInfo.isEnterd && !userQuizInfo.inProgress) {
      return res.status(400).json({ success: false, message: 'Quiz already completed' });
    }

    const quizData = req.body;
    let clientAnswers = quizData.answers || [];
    
    // Get the number of questions shown to the student
    const questionsShown = userQuizInfo.randomQuestionIndices ? userQuizInfo.randomQuestionIndices.length : quiz.questionsCount;
    
    console.log('Server-side score calculation starting...');
    console.log('Client answers received:', clientAnswers);
    console.log('Questions shown count:', questionsShown);
    console.log('User stored answers:', userQuizInfo.answers);
    
    // Convert client answers to new format and merge with existing answers
    const finalAnswers = [];
    
    if (userQuizInfo.randomQuestionIndices) {
      userQuizInfo.randomQuestionIndices.forEach((questionIndex, i) => {
        const question = quiz.Questions[questionIndex];
        const questionId = question._id ? question._id.toString() : `q_${questionIndex}`;
        
        // Look for existing answer first
        let existingAnswer = userQuizInfo.answers.find(a => 
          a.questionIndex === i || a.questionId === questionId
        );
        
        // If no existing answer, check client answers
        if (!existingAnswer && clientAnswers[i]) {
          existingAnswer = {
            questionId: questionId,
            questionIndex: i,
            selectedAnswer: clientAnswers[i],
            answeredAt: new Date()
          };
        }
        
        if (existingAnswer) {
          finalAnswers.push(existingAnswer);
        }
      });
    }
    
    console.log('Final answers array:', finalAnswers);
    
    // Calculate the actual score based on correct answers (server-side calculation for security)
    let calculatedScore = 0;
    
    if (userQuizInfo.randomQuestionIndices) {
      console.log('Using randomQuestionIndices:', userQuizInfo.randomQuestionIndices);
      userQuizInfo.randomQuestionIndices.forEach((questionIndex, i) => {
        const question = quiz.Questions[questionIndex];
        const questionId = question._id ? question._id.toString() : `q_${questionIndex}`;
        
        // Find the answer for this question
        const userAnswerObj = finalAnswers.find(a => 
          a.questionIndex === i || a.questionId === questionId
        );
        
        console.log(`\n--- Question ${i + 1} (Pool Index ${questionIndex}) ---`);
        console.log('Question ID:', questionId);
        console.log('Question object:', question ? 'Found' : 'NOT FOUND');
        console.log('User answer object:', userAnswerObj);
        
        if (userAnswerObj && question) {
          const selectedAnswer = userAnswerObj.selectedAnswer;
          const answerIndex = parseInt(selectedAnswer.replace('answer', ''));
          console.log(`Selected answer: ${selectedAnswer}`);
          console.log(`Parsed answerIndex: ${answerIndex}`);
          console.log(`Correct answer (ranswer): ${question.ranswer}`);
          console.log(`Comparison: ${answerIndex} === ${question.ranswer} = ${answerIndex === question.ranswer}`);
          
          if (question.ranswer === answerIndex) {
            calculatedScore += 1; // Each correct answer is worth 1 point
            console.log(`✓ CORRECT! Score incremented to ${calculatedScore}`);
          } else {
            console.log(`✗ INCORRECT - Expected ${question.ranswer}, got ${answerIndex}`);
          }
        } else {
          console.log('Skipping - no answer or question not found');
        }
      });
    } else {
      console.log('WARNING: No randomQuestionIndices found, cannot calculate score properly');
    }
    
    console.log(`Final calculated score: ${calculatedScore} out of ${questionsShown}`);
    
    const finalScore = calculatedScore; // Use server-calculated score for security

    // Update user's quiz info
    const updateResult = await User.findOneAndUpdate(
      { _id: req.userData._id, 'quizesInfo._id': quizObjId },
      {
        $set: {
          'quizesInfo.$.answers': finalAnswers,
          'quizesInfo.$.Score': finalScore,
          'quizesInfo.$.inProgress': false,
          'quizesInfo.$.isEnterd': true,
          'quizesInfo.$.solvedAt': Date.now(),
          'quizesInfo.$.endTime': 0,
        },
        $inc: { 
          totalScore: finalScore, 
          totalQuestions: questionsShown, // Total possible points for questions shown (1 point each)
          examsEnterd: 1
        },
      },
      { new: true }
    );

    if (updateResult) {
      // Check if there's a corresponding video for the quiz in user's videosInfo
      if (quiz.videoWillbeOpen) {
        const videoInfo = req.userData.videosInfo && req.userData.videosInfo.find(
          (video) => video._id.toString() === quiz.videoWillbeOpen.toString()
        );
        
        if (videoInfo && !videoInfo.isUserEnterQuiz) {
          // Update the video's entry to mark it as entered by the user
          await User.findOneAndUpdate(
            { _id: req.userData._id, 'videosInfo._id': videoInfo._id },
            { $set: { 'videosInfo.$.isUserEnterQuiz': true } }
          );
        }
      }

      console.log('Quiz finish response:', {
        finalScore,
        questionsShown,
        questionsPool: quiz.Questions.length,
        maxScore: questionsShown
      });
      
      return res.json({ 
        success: true, 
        message: 'Quiz completed successfully',
        score: finalScore,
        totalQuestions: questionsShown,
        questionsPool: quiz.Questions.length, // Total questions in the pool
        maxScore: questionsShown // Maximum possible score for questions shown (1 point each)
      });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to save quiz results' });
    }
  } catch (error) {
    console.error('Quiz finish error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================== Quiz Review ====================== //
const quiz_review = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    console.log('=== QUIZ REVIEW DEBUG START ===');
    console.log('Quiz ID:', quizId);
    console.log('Quiz found:', quiz ? quiz.quizName : 'NOT FOUND');
    
    if (!quiz) {
      console.log('Quiz not found, redirecting to exams');
      return res.redirect('/student/exams');
    }

    // Find user's quiz info
    const userQuizInfo = req.userData.quizesInfo && req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );

    console.log('User quiz info found:', !!userQuizInfo);
    console.log('Quiz completed (isEnterd):', userQuizInfo ? userQuizInfo.isEnterd : 'N/A');

    // Check if user has completed this quiz
    if (!userQuizInfo || !userQuizInfo.isEnterd) {
      console.log('Quiz not completed or user info missing, redirecting to exams');
      return res.redirect('/student/exams');
    }

    // Get the questions that were actually shown to the user
    let userQuestions = [];
    let questionsShown = 0;
    
    if (userQuizInfo.randomQuestionIndices && userQuizInfo.randomQuestionIndices.length > 0) {
      // Use the saved random indices
      console.log('Using saved randomQuestionIndices:', userQuizInfo.randomQuestionIndices);
      userQuestions = userQuizInfo.randomQuestionIndices.map(index => {
        const question = quiz.Questions[index];
        if (question) {
          // Normalize image field names for backward compatibility
          const normalizedQuestion = { ...question };
          if (normalizedQuestion.questionPhoto && !normalizedQuestion.image) {
            normalizedQuestion.image = normalizedQuestion.questionPhoto;
          }
          return {
            ...normalizedQuestion,
            originalIndex: index
          };
        }
        return null;
      }).filter(q => q !== null);
      questionsShown = userQuestions.length;
    } else {
      // Fallback: use sequential questions based on questionsToShow
      const questionsToShow = quiz.questionsToShow || quiz.questionsCount;
      console.log('No randomQuestionIndices found, using fallback with questionsToShow:', questionsToShow);
      
      userQuestions = quiz.Questions.slice(0, questionsToShow).map((question, index) => {
        // Normalize image field names for backward compatibility
        const normalizedQuestion = { ...question };
        if (normalizedQuestion.questionPhoto && !normalizedQuestion.image) {
          normalizedQuestion.image = normalizedQuestion.questionPhoto;
        }
        return {
          ...normalizedQuestion,
          originalIndex: index
        };
      });
      questionsShown = userQuestions.length;
    }

    console.log('Total questions in pool:', quiz.Questions.length);
    console.log('Questions shown to user:', questionsShown);
    console.log('User answers array length:', userQuizInfo.answers ? userQuizInfo.answers.length : 0);

    // Calculate statistics based on the questions the user actually saw
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let unansweredQuestions = 0;

    userQuestions.forEach((question, index) => {
      const questionId = question._id ? question._id.toString() : `q_${question.originalIndex}`;
      
      // Find the user's answer for this specific question
      let userAnswerObj = null;
      if (userQuizInfo.answers && Array.isArray(userQuizInfo.answers)) {
        // New format: array of objects
        userAnswerObj = userQuizInfo.answers.find(a => 
          a.questionId === questionId || 
          a.questionIndex === index ||
          (a.questionIndex === question.originalIndex)
        );
      } else if (userQuizInfo.answers && userQuizInfo.answers[index]) {
        // Legacy format: simple array
        userAnswerObj = {
          selectedAnswer: userQuizInfo.answers[index]
        };
      }
      
      console.log(`Question ${index + 1} (ID: ${questionId}): userAnswerObj=${JSON.stringify(userAnswerObj)}, correctAnswer=${question.ranswer}`);
      
      if (!userAnswerObj || !userAnswerObj.selectedAnswer) {
        unansweredQuestions++;
        console.log(`Question ${index + 1}: UNANSWERED`);
      } else {
        const selectedAnswer = userAnswerObj.selectedAnswer;
        const answerIndex = parseInt(selectedAnswer.replace('answer', ''));
        if (question.ranswer === answerIndex) {
          correctAnswers++;
          console.log(`Question ${index + 1}: CORRECT (chose ${selectedAnswer})`);
        } else {
          incorrectAnswers++;
          console.log(`Question ${index + 1}: INCORRECT (chose ${selectedAnswer}, correct was answer${question.ranswer})`);
        }
      }
    });

    console.log('Final stats:', { 
      correctAnswers, 
      incorrectAnswers, 
      unansweredQuestions,
      totalShown: questionsShown,
      userScore: userQuizInfo.Score
    });
    console.log('=== QUIZ REVIEW DEBUG END ===');

    // Check if answers should be shown after quiz
    const shouldShowAnswers = quiz.showAnswersAfterQuiz !== false; // Default to true if not set

    // If answers shouldn't be shown, redirect to exams page
    if (!shouldShowAnswers) {
      return res.redirect('/student/exams?message=answers_hidden');
    }

    res.render('student/quiz-review', {
      title: 'مراجعة الامتحان',
      path: req.path,
      quiz: quiz,
      userData: req.userData,
      userQuizInfo: userQuizInfo,
      userQuestions: userQuestions,
      questionsShown: questionsShown,
      totalQuestionsPool: quiz.Questions.length,
      correctAnswers: correctAnswers,
      incorrectAnswers: incorrectAnswers,
      unansweredQuestions: unansweredQuestions,
      shouldShowAnswers: shouldShowAnswers // Pass this to the view
    });
  } catch (error) {
    console.error('Quiz review error:', error);
    res.redirect('/student/exams');
  }
};

// Save quiz answer to server
const saveQuizAnswer = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const { questionIndex, answer, questionId } = req.body;
    
    console.log('Saving answer:', { quizId, questionIndex, answer, questionId });
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Find user's quiz info
    const userQuizInfo = req.userData.quizesInfo && req.userData.quizesInfo.find(
      (q) => q._id.toString() === quiz._id.toString()
    );

    if (!userQuizInfo) {
      return res.status(400).json({ success: false, message: 'Quiz not started' });
    }

    // Create or update answer object
    const answerObj = {
      questionId: questionId || `q_${questionIndex}`,
      questionIndex: questionIndex,
      selectedAnswer: answer,
      answeredAt: new Date()
    };

    // Remove existing answer for this question if any
    await User.findOneAndUpdate(
      { _id: req.userData._id, 'quizesInfo._id': quiz._id },
      { $pull: { 'quizesInfo.$.answers': { questionIndex: questionIndex } } }
    );

    // Add new answer
    await User.findOneAndUpdate(
      { _id: req.userData._id, 'quizesInfo._id': quiz._id },
      { $push: { 'quizesInfo.$.answers': answerObj } }
    );

    console.log('Answer saved successfully:', answerObj);
    res.json({ success: true, message: 'Answer saved successfully' });
  } catch (error) {
    console.error('Error saving quiz answer:', error);
    res.status(500).json({ success: false, message: 'Failed to save answer' });
  }
};

// ================== END quiz  ====================== //

const settings_get = async (req, res) => {
  try {
    // Ensure userData is available
    if (!req.userData) {
      return res.status(401).redirect('/login');
    }

    res.render('student/settings', {
      title: 'Settings',
      path: req.path,
      userData: req.userData,
    });
  } catch (error) {
    console.error('Error in settings_get:', error);
    res.status(500).send(error.message);
  }
};

const settings_post = async (req, res) => {
  try {
    const { Username, gov, userPhoto } = req.body;
    console.log(Username, gov);
    const user = await User.findByIdAndUpdate(req.userData._id, {
      Username: Username,
      gov: gov,
      userPhoto: userPhoto,
    });

    res.redirect('/student/settings');
  } catch (error) {
    res.send(error.message);
  }
};



// end OF SETTINGS




// ==================  PDFs  ====================== //

const PDFs_get = async (req, res) => {
  try {
    const PDFdata = await PDFs.find({ "pdfGrade": req.userData.Grade }).sort({ createdAt: 1 })
    console.log(PDFdata);

    const PaidPDFs = PDFdata.map(PDF => {
      const isPaid = req.userData.videosPaid.includes(PDF._id);
      return { ...PDF.toObject(), isPaid };
    });
    res.render("student/PDFs", { title: "PDFs", path: req.path, PDFs: PaidPDFs, userData: req.userData });

  } catch (error) {
    res.send(error.message);
  }
}

const getPDF = async (req, res) => {
  try {
    const pdfId = req.params.PDFID;
    const pdf = await PDFs.findById(pdfId);
// Check if pdfsPaid is defined and is an array
  console.log(pdfId);
// Alternatively, you can use a more explicit check
const isPaid = req.userData.videosPaid.includes(pdfId);
console.log(isPaid);
    if (pdf.pdfStatus == "Paid") {
      if (isPaid) {
        res.render("student/ViewPDF", { title: "View PDF", path: req.path, pdf: pdf, userData: req.userData });
      } else {
        res.redirect('/student/PDFs');
      }
    } else {
      res.render("student/ViewPDF", { title: "View PDF", path: req.path, pdf: pdf, userData: req.userData });
    }
  } catch (error) {
    res.send(error.message);
  }
}

const buyPDF = async (req, res) => {
  try {
    const pdfId = req.params.PDFID;
    const code = req.body.code;
   const CodeData =  await Code.findOneAndUpdate({ "Code": code , "isUsed": false , "codeType":"PDF"  }, 
   { "isUsed": true, "usedBy": req.userData.Code }, { new: true });
   if (CodeData) {
    const user=  await User.findByIdAndUpdate(req.userData._id, { $push: { videosPaid: pdfId } });
    console.log(user  )
    res.redirect('/student/PDFs');
   }else{
    res.redirect('/student/PDFs?error=true');
     }
   
   console.log(CodeData);
  } catch (error) {
    res.send(error.message);
  }
};
// ================== END PDFs  ====================== //

// Enhanced video purchase with proper redirect
const buyVideo = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const chapterId = req.params.chapterId;
    const code = req.body.code;
    
    console.log('Buy video request:', { videoId, chapterId, code });

    // Validate chapter and video exist
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chapter not found',
        redirect: '/student/chapters?error=chapter_not_found'
      });
    }

    // Find video in chapter
    let video = null;
    if (chapter.chapterLectures) {
      video = chapter.chapterLectures.find(lecture => lecture._id.toString() === videoId);
    }
    if (!video && chapter.chapterSummaries) {
      video = chapter.chapterSummaries.find(summary => summary._id.toString() === videoId);
    }
    if (!video && chapter.chapterSolvings) {
      video = chapter.chapterSolvings.find(solving => solving._id.toString() === videoId);
    }

    if (!video) {
      return res.status(404).json({ 
        success: false, 
        message: 'Video not found',
        redirect: `/student/chapter/${chapterId}?error=video_not_found`
      });
    }

    // Check grade compatibility
    if (!req.userData.canPurchaseContent(chapter.chapterGrade)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Grade mismatch',
        redirect: `/student/chapter/${chapterId}?error=grade_mismatch`
      });
    }

    // Check if user already has access
    if (req.userData.hasVideoAccess(videoId)) {
      return res.status(200).json({ 
        success: true, 
        message: 'Already have access',
        redirect: `/student/chapter/${chapterId}/video/${videoId}`
      });
    }

    // Find and validate code (specific video code or general video code)
    const codeData = await Code.findOne({
      Code: code,
      isUsed: false,
      $or: [
        { codeType: 'Video' },
        { codeType: 'GeneralVideo'}
      ],
      isActive: true
    });

    if (!codeData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or used code',
        redirect: `/student/chapter/${chapterId}?error=invalid_code`
      });
    }

    // Check if code is for this specific video (if contentId is specified)
    if (codeData.contentId && codeData.contentId.toString() !== videoId.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code is not for this video',
        redirect: `/student/chapter/${chapterId}?error=code_video_mismatch`
      });
    }

    // Validate code can be used by this user (including all grades check)
    const codeValidation = codeData.canBeUsedBy(req.userData);
    if (!codeValidation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: codeValidation.reason,
        redirect: `/student/chapter/${chapterId}?error=${encodeURIComponent(codeValidation.reason)}`
      });
    }

    // Additional check for grade compatibility (unless code works for all grades)
    if (!codeData.isAllGrades && !req.userData.canPurchaseContent(chapter.chapterGrade)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Grade mismatch',
        redirect: `/student/chapter/${chapterId}?error=grade_mismatch`
      });
    }

    // Process video purchase
    if (codeData.isGeneralCode && codeData.codeType === 'GeneralVideo') {
      // Grant general video access for user's grade
      await req.userData.grantGeneralVideoAccess(code);
    } else {
      // Grant specific video access
      await req.userData.addVideoPurchase(videoId, video.videoName || video.lectureName, chapterId, code);
    }
    await codeData.markAsUsed(req.userData);

    console.log('Video purchase successful');

    // Return success response with redirect
    return res.status(200).json({ 
      success: true, 
      message: 'Video purchased successfully',
      redirect: `/student/chapter/${chapterId}/video/${videoId}?success=video_purchased`
    });

  } catch (error) {
    console.error('Buy video error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Purchase failed',
      redirect: `/student/chapter/${req.params.chapterId}?error=purchase_failed`
    });
  }
};

// Legacy video purchase route (for backward compatibility)
const buyVideoLegacy = async (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Please use the new video purchase format: /chapter/:chapterId/video/:videoId/buy'
  });
};

// ================== End Video Purchase  ====================== //

// ================== LogOut  ====================== //

const logOut = async (req, res) => {
  // Clearing the token cookie
  res.clearCookie('token');
  // Redirecting to the login page or any other desired page
  res.redirect('../login');
};

// ================== END LogOut  ====================== //

// ==================  Chapter Content (Unified View)  ====================== //

const chapter_content_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }

    // Check if user can access this chapter's grade
    if (!req.userData.canPurchaseContent(chapter.chapterGrade)) {
      return res.redirect('/student/chapters?error=grade_mismatch');
    }

    // Get all quizzes for this chapter
    const quizzes = await Quiz.find({ 
      chapterId: chapterId,
      Grade: req.userData.Grade 
    });

    // Get all PDFs for this chapter
    const chapterPDFs = await PDFs.find({ 
      chapterId: chapterId,
      pdfGrade: req.userData.Grade 
    });

    // Check user access to chapter and content
    const hasChapterAccess = req.userData.hasChapterAccess(chapterId);
    
    // Calculate chapter progress statistics
    const allVideos = [
      ...(chapter.chapterLectures || []),
      ...(chapter.chapterSummaries || []),
      ...(chapter.chapterSolvings || [])
    ];
    
    const totalVideos = allVideos.length;
    const totalQuizzes = quizzes.length;
    const totalContent = totalVideos + totalQuizzes;
    
    // Calculate completed videos (videos that have been watched at least once)
    const watchedVideos = req.userData.videosInfo ? 
      req.userData.videosInfo.filter(videoInfo => 
        allVideos.some(video => video._id.toString() === videoInfo._id.toString()) &&
        videoInfo.numberOfWatches > 0
      ).length : 0;
    
    // Calculate completed quizzes
    const completedQuizzes = req.userData.quizesInfo ?
      req.userData.quizesInfo.filter(quizInfo =>
        quizzes.some(quiz => quiz._id.toString() === quizInfo._id.toString()) &&
        quizInfo.isEnterd
      ).length : 0;
    
    const completedContent = watchedVideos + completedQuizzes;
    const progressPercentage = totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0;

    res.render('student/chapter-content', {
      title: chapter.chapterName,
      path: req.path,
      chapter: chapter,
      quizzes: quizzes,
      chapterPDFs: chapterPDFs,
      userData: req.userData,
      hasChapterAccess: hasChapterAccess,
      totalVideos: totalVideos,
      totalQuizzes: totalQuizzes,
      totalContent: totalContent,
      watchedVideos: watchedVideos,
      completedQuizzes: completedQuizzes,
      completedContent: completedContent,
      progressPercentage: progressPercentage,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Chapter content error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ==================  Chapter Videos  ====================== //

const chapter_videos_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }

    const hasChapterAccess = req.userData.chaptersPaid && req.userData.chaptersPaid.includes(chapterId);
    
    res.render('student/chapter-videos', {
      title: `${chapter.chapterName} - الفيديوهات`,
      path: req.path,
      userData: req.userData,
      chapter: chapter,
      hasChapterAccess: hasChapterAccess,
      chapterId: chapterId
    });
  } catch (error) {
    console.error('Error in chapter_videos_get:', error);
    res.status(500).send('Server error');
  }
};

// ==================  Video Watch (Enhanced)  ====================== //

const video_watch_get = async (req, res) => {
  try {
    const { chapterId, videoId } = req.params;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }

    let video = null;
    let videoType = '';
    
    // Find video in chapter lectures, summaries, or solvings (using legacy structure)
    if (chapter.chapterLectures && chapter.chapterLectures.length > 0) {
      video = chapter.chapterLectures.find(lecture => lecture._id.toString() === videoId);
      if (video) videoType = 'lecture';
    }
    if (!video && chapter.chapterSummaries && chapter.chapterSummaries.length > 0) {
      video = chapter.chapterSummaries.find(summary => summary._id.toString() === videoId);
      if (video) videoType = 'summary';
    }
    if (!video && chapter.chapterSolvings && chapter.chapterSolvings.length > 0) {
      video = chapter.chapterSolvings.find(solving => solving._id.toString() === videoId);
      if (video) videoType = 'solving';
    }

    if (!video) {
      return res.status(404).send('Video not found');
    }

    const hasChapterAccess = req.userData.chaptersPaid && req.userData.chaptersPaid.includes(chapterId);
    const hasVideoAccess = req.userData.videosPaid && req.userData.videosPaid.includes(videoId);
    
    // Get user video info
    const userVideoInfo = req.userData.videosInfo && req.userData.videosInfo.find(v => v._id.toString() === videoId.toString()) || null;
    
    console.log('Looking for videoId:', videoId);
    console.log('User videosInfo count:', req.userData.videosInfo ? req.userData.videosInfo.length : 0);
    console.log('Found userVideoInfo:', userVideoInfo ? 'Yes' : 'No');
    if (userVideoInfo) {
      console.log('UserVideoInfo ID:', userVideoInfo._id);
      console.log('UserVideoInfo attempts:', userVideoInfo.videoAllowedAttemps);
    }
    
    // Check access permissions
    if (video.paymentStatus === 'Pay' && !hasVideoAccess) {
      return res.redirect(`/student/chapter/${chapterId}`);
    }
    
    // Check if user has remaining attempts
    if (userVideoInfo && userVideoInfo.videoAllowedAttemps <= 0) {
      return res.redirect(`/student/chapter/${chapterId}?error=no_attempts`);
    }
    
    // Track video entry and decrement attempts
    if (userVideoInfo) {
      console.log('Before update - videoAllowedAttemps:', userVideoInfo.videoAllowedAttemps);
      console.log('Before update - numberOfWatches:', userVideoInfo.numberOfWatches);
      
      const updateFields = {
        'videosInfo.$.lastWatch': Date.now(),
        ...(userVideoInfo.fristWatch ? {} : { 'videosInfo.$.fristWatch': Date.now() })
      };
      
      const incFields = {
        'videosInfo.$.numberOfWatches': 1
      };
      
      // Only decrement attempts if user has attempts left
      if (userVideoInfo.videoAllowedAttemps > 0) {
        incFields['videosInfo.$.videoAllowedAttemps'] = -1;
        console.log('Decrementing attempts by 1');
      } else {
        console.log('No attempts left to decrement');
      }

      // Convert videoId to ObjectId for proper matching
      const videoObjectId = new mongoose.Types.ObjectId(videoId);

      
      const updateResult = await User.findOneAndUpdate(
        { _id: req.userData._id, 'videosInfo._id': videoObjectId },
        {
          $set: updateFields,
          $inc: incFields
        },
        { new: true }
      );
      
      console.log('Update result:', updateResult ? 'Success' : 'Failed');
      
      // Update the userVideoInfo for the view
      userVideoInfo.videoAllowedAttemps = Math.max(0, userVideoInfo.videoAllowedAttemps - 1);
      userVideoInfo.numberOfWatches = (userVideoInfo.numberOfWatches || 0) + 1;
      
      console.log('After update - videoAllowedAttemps:', userVideoInfo.videoAllowedAttemps);
      console.log('After update - numberOfWatches:', userVideoInfo.numberOfWatches);
      
    }
    
    // Calculate watch progress based on actual viewing
    const watchProgress = userVideoInfo ? 
      Math.min((userVideoInfo.numberOfWatches / 2) * 100, 100) : 0;
    
    // Get related videos from the same chapter (using legacy structure)
    const relatedVideos = [];
    if (chapter.chapterLectures) relatedVideos.push(...chapter.chapterLectures);
    if (chapter.chapterSummaries) relatedVideos.push(...chapter.chapterSummaries);
    if (chapter.chapterSolvings) relatedVideos.push(...chapter.chapterSolvings);
    
    res.render('student/video-watch', {
      title: `${video.lectureName || video.videoName || video.name} - مشاهدة الفيديو`,
      path: req.path,
      userData: req.userData,
      chapter: chapter,
      chapterName: chapter.chapterName,
      video: video,
      videoType: videoType,
      userVideoInfo: userVideoInfo,
      hasChapterAccess: hasChapterAccess,
      hasVideoAccess: hasVideoAccess,
      relatedVideos: relatedVideos.filter(v => v._id.toString() !== videoId),
      chapterId: chapterId,
      videoId: videoId,
      watchProgress: watchProgress,
      videoViewsCount: video.views || 0
    });
  } catch (error) {
    console.error('Error in video_watch_get:', error);
    res.status(500).send('Server error');
  }
};

// ==================  Chapter Quizzes  ====================== //

const chapter_quizzes_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }

    const quizzes = await Quiz.find({ 
      chapterId: chapterId,
      Grade: req.userData.Grade,
      isQuizActive: true, // Only show active quizzes
      permissionToShow: true // Only show quizzes that are set to be visible
    });

    const hasChapterAccess = req.userData.chaptersPaid && req.userData.chaptersPaid.includes(chapterId);
    
    res.render('student/chapter-quizzes', {
      title: `${chapter.chapterName} - الاختبارات`,
      path: req.path,
      userData: req.userData,
      chapter: chapter,
      quizzes: quizzes,
      hasChapterAccess: hasChapterAccess,
      chapterId: chapterId
    });
  } catch (error) {
    console.error('Error in chapter_quizzes_get:', error);
    res.status(500).send('Server error');
  }
};

// ==================  Chapter PDFs  ====================== //

const chapter_pdfs_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }

    // Get PDFs related to this chapter
    const pdfs = await PDFs.find({ 
      chapterId: chapterId,
      pdfGrade: req.userData.Grade 
    });

    const hasChapterAccess = req.userData.chaptersPaid && req.userData.chaptersPaid.includes(chapterId);
    
    res.render('student/chapter-pdfs', {
      title: `${chapter.chapterName} - المذكرات والملفات`,
      path: req.path,
      userData: req.userData,
      chapter: chapter,
      pdfs: pdfs,
      hasChapterAccess: hasChapterAccess,
      chapterId: chapterId
    });
  } catch (error) {
    console.error('Error in chapter_pdfs_get:', error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  dash_get,

  chapters_get,
  buyChapter,
  
  // New chapter-based functions
  chapter_content_get,
  chapter_videos_get,
  chapter_quizzes_get,
  chapter_pdfs_get,
  video_watch_get,
  
  // Legacy functions (to be phased out)
  lecture_get,
  sum_get,
  solv_get,
  buyVideo,
  buyVideoLegacy,

  // Watch functions
  watch_get,
  getVideoWatch,
  uploadHW,

  ranking_get,

  exams_get,
  buyQuiz,

  quiz_get,
  quizWillStart,
  quiz_start,
  quiz_review,
  quizFinish,
  saveQuizAnswer,

  PDFs_get,
  getPDF,
  buyPDF,

  settings_get,
  settings_post,

  logOut,
};

