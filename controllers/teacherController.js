const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Chapter = require('../models/Chapter');
const Code = require('../models/Code');
const Card = require('../models/Card');
const Attendance = require('../models/Attendance'); 
const PDFs = require('../models/PDFs');
const mongoose = require('mongoose');

const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWTSECRET;

const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const stream = require('stream');

const { v4: uuidv4 } = require('uuid');

// ==================  Dashboard  ====================== //

const dash_get = async (req, res) => {
  try {
    // Use Promise.all for parallel execution and optimize queries
    const [
      studentStats,
      totalChapters,
      totalQuizzes,
      totalPDFs,
      videoStats,
      recentStudents,
      gradeStats,
      topPerformers,
      codeStats
    ] = await Promise.all([
      // Get student statistics in one query
      User.aggregate([
        { $match: { isTeacher: false } },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            activeStudents: { $sum: { $cond: [{ $eq: ['$subscribe', true] }, 1, 0] } },
            pendingStudents: { $sum: { $cond: [{ $eq: ['$subscribe', false] }, 1, 0] } }
          }
        }
      ]),
      
      // Basic counts
      Chapter.countDocuments({ isActive: true }),
      Quiz.countDocuments({ isQuizActive: true }),
      PDFs.countDocuments({}),
      
      // Get video count efficiently
      Chapter.aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            totalVideos: {
              $add: [
                { $size: { $ifNull: ['$chapterLectures', []] } },
                { $size: { $ifNull: ['$chapterSummaries', []] } },
                { $size: { $ifNull: ['$chapterSolvings', []] } }
              ]
            }
          }
        },
        { $group: { _id: null, totalVideos: { $sum: '$totalVideos' } } }
      ]),
      
      // Recent students
      User.find({ isTeacher: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('Username Code Grade createdAt subscribe')
        .lean(),
      
      // Grade distribution
      User.aggregate([
        { $match: { isTeacher: false } },
        { $group: { _id: '$Grade', count: { $sum: 1 } } }
      ]),
      
      // Top performers
      User.find({ 
        isTeacher: false, 
        totalScore: { $gt: 0 } 
      })
      .sort({ totalScore: -1 })
      .limit(5)
      .select('Username Code totalScore totalQuestions Grade')
      .lean(),
      
      // Code statistics
      Code.aggregate([
        {
          $group: {
            _id: null,
            totalCodes: { $sum: 1 },
            usedCodes: { $sum: { $cond: [{ $eq: ['$isUsed', true] }, 1, 0] } }
          }
        }
      ])
    ]);

    // Extract results
    const stats = studentStats[0] || { totalStudents: 0, activeStudents: 0, pendingStudents: 0 };
    const totalVideos = videoStats[0]?.totalVideos || 0;
    const codes = codeStats[0] || { totalCodes: 0, usedCodes: 0 };
    const activeCodes = codes.totalCodes - codes.usedCodes;
    
    // Simple monthly stats (last 3 months only for performance)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const monthlyStats = await User.aggregate([
          {
            $match: {
          isTeacher: false, 
          createdAt: { $gte: threeMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 6 } // Limit results
    ]);
    
    res.render('teacher/dash', {
      title: 'لوحة التحكم',
              path: req.path,
      teacherData: req.userData || req.teacherData,
      stats: {
        totalStudents: stats.totalStudents,
        activeStudents: stats.activeStudents,
        pendingStudents: stats.pendingStudents,
        totalChapters,
        totalVideos,
        totalQuizzes,
        totalPDFs,
        totalCodes: codes.totalCodes,
        usedCodes: codes.usedCodes,
        activeCodes
      },
      recentStudents: recentStudents || [],
      gradeStats: gradeStats || [],
      topPerformers: topPerformers || [],
      monthlyStats: monthlyStats || [],
      success: req.query.success,
      error: req.query.error
      });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ==================  Chapter Management  ====================== //

const chapters_get = async (req, res) => {
  try {
    const { grade, search, page = 1 } = req.query;
    const perPage = 12;
    
    let query = { isActive: true };
    if (grade) query.chapterGrade = grade;
    if (search) {
      query.chapterName = { $regex: search, $options: 'i' };
    }
    
    const chapters = await Chapter.find(query)
      .sort({ createdAt: -1 })
      .limit(perPage * page)
      .skip((page - 1) * perPage);
    
    const totalChapters = await Chapter.countDocuments(query);
    
    // Add statistics to each chapter
    const chaptersWithStats = chapters.map(chapter => {
      const chapterData = chapter.toObject();
      
      // Count content
      const lecturesCount = chapterData.chapterLectures?.length || 0;
      const summariesCount = chapterData.chapterSummaries?.length || 0;
      const solvingsCount = chapterData.chapterSolvings?.length || 0;
      const totalVideos = lecturesCount + summariesCount + solvingsCount;
      
      chapterData.stats = {
        totalVideos,
        lecturesCount,
        summariesCount,
        solvingsCount
      };
      
      return chapterData;
    });
    
    res.render('teacher/chapters', {
      title: 'إدارة الفصول',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      chapters: chaptersWithStats,
      totalChapters,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalChapters / perPage),
      filters: { grade, search }
    });
  } catch (error) {
    console.error('Chapters error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const chapter_create_get = async (req, res) => {
  try {
    res.render('teacher/chapter-create', {
      title: 'إنشاء فصل جديد',
          path: req.path,
      teacherData: req.teacherData,
      error: req.query.error
      });
  } catch (error) {
    console.error('Chapter create get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const chapter_create_post = async (req, res) => {
  try {
    const {
      chapterName,
      chapterGrade,
      chapterAccessibility,
      chapterPrice,
      chapterIMG,
      chapterDescription,
      ARorEN
    } = req.body;
    
    // Validation
    if (!chapterName || !chapterGrade || !chapterAccessibility || !ARorEN) {
      return res.redirect('/teacher/chapters/create?error=missing_fields');
    }
    
    const chapter = new Chapter({
      chapterName,
      chapterGrade,
      chapterAccessibility,
      chapterPrice: chapterPrice || 0,
      chapterIMG: chapterIMG || '/images/default-chapter.jpg',
      chapterDescription: chapterDescription || '',
      ARorEN,
      chapterLectures: [],
      chapterSummaries: [],
      chapterSolvings: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await chapter.save();
    
    res.redirect('/teacher/chapters?success=chapter_created');
  } catch (error) {
    console.error('Chapter create error:', error);
    res.redirect('/teacher/chapters/create?error=creation_failed');
  }
};

const chapter_detail_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }
    
    // Get all videos in chapter
    const allVideos = [
      ...(chapter.chapterLectures || []),
      ...(chapter.chapterSummaries || []),
      ...(chapter.chapterSolvings || [])
    ];
    
    // Get quizzes for this chapter
    const quizzes = await Quiz.find({ chapterId: chapterId });
    
    // Get PDFs for this chapter
    const pdfs = await PDFs.find({ chapterId: chapterId });
    
    // Get students who have access to this chapter
    const studentsWithAccess = await User.find({
      isTeacher: false,
      chaptersPaid: chapterId
    }).select('Username Code Grade');
    
    res.render('teacher/chapter-detail', {
      title: `${chapter.chapterName} - تفاصيل الفصل`,
      path: req.path,
      teacherData: req.teacherData,
      chapter,
      allVideos,
      quizzes,
      pdfs,
      studentsWithAccess,
      stats: {
        totalVideos: allVideos.length,
        totalQuizzes: quizzes.length,
        totalPDFs: pdfs.length,
        studentsCount: studentsWithAccess.length
      }
    });
  } catch (error) {
    console.error('Chapter detail error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const chapter_edit_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }
    
    res.render('teacher/chapter-edit', {
      title: `تعديل ${chapter.chapterName}`,
        path: req.path,
      teacherData: req.teacherData,
      chapter,
      error: req.query.error
    });
  } catch (error) {
    console.error('Chapter edit get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const chapter_edit_post = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const {
      chapterName,
      chapterGrade,
      chapterAccessibility,
      chapterPrice,
      chapterIMG,
      chapterDescription,
      ARorEN,
      isActive
    } = req.body;
    
    const updateData = {
      chapterName,
      chapterGrade,
      chapterAccessibility,
      chapterPrice: chapterPrice || 0,
      chapterIMG,
      chapterDescription,
      ARorEN,
      isActive: isActive === 'true',
      updatedAt: new Date()
    };
    
    await Chapter.findByIdAndUpdate(chapterId, updateData);
    
    res.redirect(`/teacher/chapters/${chapterId}?success=chapter_updated`);
  } catch (error) {
    console.error('Chapter edit error:', error);
    res.redirect(`/teacher/chapters/${req.params.chapterId}/edit?error=update_failed`);
  }
};

const chapter_delete = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    
    // Soft delete - just set isActive to false
    await Chapter.findByIdAndUpdate(chapterId, { 
      isActive: false,
      updatedAt: new Date()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Chapter delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================  Video Management  ====================== //

const videos_get = async (req, res) => {
  try {
    const { chapter, type, search, page = 1 } = req.query;
    const perPage = 12;
    
    // Get all chapters for filter
    const chapters = await Chapter.find({ isActive: true }, 'chapterName chapterGrade');
    
    let allVideos = [];
    
    if (chapter) {
      const chapterData = await Chapter.findById(chapter);
      if (chapterData) {
        if (!type || type === 'lectures') {
          allVideos.push(...(chapterData.chapterLectures || []).map(v => ({ ...v, type: 'lecture', chapterName: chapterData.chapterName })));
        }
        if (!type || type === 'summaries') {
          allVideos.push(...(chapterData.chapterSummaries || []).map(v => ({ ...v, type: 'summary', chapterName: chapterData.chapterName })));
        }
        if (!type || type === 'solvings') {
          allVideos.push(...(chapterData.chapterSolvings || []).map(v => ({ ...v, type: 'solving', chapterName: chapterData.chapterName })));
        }
      }
    } else {
      // Get videos from all chapters
      const allChapters = await Chapter.find({ isActive: true });
      allChapters.forEach(chapterData => {
        if (!type || type === 'lectures') {
          allVideos.push(...(chapterData.chapterLectures || []).map(v => ({ ...v, type: 'lecture', chapterName: chapterData.chapterName, chapterId: chapterData._id })));
        }
        if (!type || type === 'summaries') {
          allVideos.push(...(chapterData.chapterSummaries || []).map(v => ({ ...v, type: 'summary', chapterName: chapterData.chapterName, chapterId: chapterData._id })));
        }
        if (!type || type === 'solvings') {
          allVideos.push(...(chapterData.chapterSolvings || []).map(v => ({ ...v, type: 'solving', chapterName: chapterData.chapterName, chapterId: chapterData._id })));
        }
      });
    }
    
    // Apply search filter
    if (search) {
      allVideos = allVideos.filter(video => 
        video.videoTitle?.toLowerCase().includes(search.toLowerCase()) ||
        video.lectureName?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Pagination
    const totalVideos = allVideos.length;
    const paginatedVideos = allVideos.slice((page - 1) * perPage, page * perPage);
    
    res.render('teacher/videos', {
      title: 'إدارة الفيديوهات',
    path: req.path,
      teacherData: req.teacherData,
      videos: paginatedVideos,
      chapters,
      totalVideos,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalVideos / perPage),
      filters: { chapter, type, search }
    });
  } catch (error) {
    console.error('Videos error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const video_create_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }
    
    res.render('teacher/video-create', {
      title: `إضافة فيديو جديد - ${chapter.chapterName}`,
    path: req.path,
      teacherData: req.teacherData,
      chapter,
      error: req.query.error
    });
  } catch (error) {
    console.error('Video create get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const video_create_post = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    console.log('Received form submission for video creation');
    console.log('Request body keys:', Object.keys(req.body));
    
    const {
      videoType,
      videoTitle,
      paymentStatus,
      prerequisites,
      permissionToShow,
      AccessibleAfterViewing,
      videoAllowedAttemps,
      videoPrice,
      imgURL,
      videoURL,
      scheduledTime,
      PDFURL,
      videoDescription
    } = req.body;
    
    // Validation
    if (!videoType || !videoTitle || !paymentStatus || !imgURL || !videoURL) {
      console.log('Missing required fields:', {
        videoType: !videoType ? 'missing' : 'present',
        videoTitle: !videoTitle ? 'missing' : 'present',
        paymentStatus: !paymentStatus ? 'missing' : 'present',
        imgURL: !imgURL ? 'missing' : 'present',
        videoURL: !videoURL ? 'missing' : 'present'
      });
      
      return res.redirect(`/teacher/chapters/${chapterId}/videos/create?error=missing_fields`);
    }
    
    try {
      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        console.log('Chapter not found with ID:', chapterId);
        return res.status(404).send('Chapter not found');
      }
      
      // Generate unique ID for video using MongoDB ObjectId instead of UUID
      const videoId = new mongoose.Types.ObjectId();
      const currentDate = new Date();
      


      
      const videoObject = {
        _id: videoId,
        videoTitle: videoTitle || '',
        lectureName: videoTitle || '', // For compatibility
        paymentStatus: paymentStatus || '',
        prerequisites: prerequisites || '',
        permissionToShow: permissionToShow === 'true',
        AccessibleAfterViewing: AccessibleAfterViewing || '',
        videoAllowedAttemps: parseInt(videoAllowedAttemps) || 3,
        videoPrice: parseFloat(videoPrice) || 0,
        videoURL: videoURL || '',
        imgURL: imgURL || '',
        PDFURL: PDFURL || '',
        scheduledTime: scheduledTime || '',
        videoDescription: videoDescription || '',
        views: 0,
        createdAt: currentDate,
        updatedAt: currentDate
      };
      
      console.log('Video object to save:', videoObject);
      
      // Add video to appropriate array
      if (videoType === 'lecture') {
        if (!chapter.chapterLectures) chapter.chapterLectures = [];
        chapter.chapterLectures.push(videoObject);
        console.log('Added to chapterLectures array');
      } else if (videoType === 'summary') {
        if (!chapter.chapterSummaries) chapter.chapterSummaries = [];
        chapter.chapterSummaries.push(videoObject);
        console.log('Added to chapterSummaries array');
      } else if (videoType === 'solving') {
        if (!chapter.chapterSolvings) chapter.chapterSolvings = [];
        chapter.chapterSolvings.push(videoObject);
        console.log('Added to chapterSolvings array');
      }
      
      chapter.updatedAt = currentDate;
      await chapter.save();
      console.log('Chapter saved successfully with new video');
      
      // Update all users with this video info - using ObjectId for _id
      const videosInfo = {
        _id: videoId, // This is now a MongoDB ObjectId
        videoName: videoTitle,
        chapterId: chapter._id,
        videoType: videoType,
        fristWatch: null,
        lastWatch: null,
        numberOfWatches: 0,
        videoAllowedAttemps: parseInt(videoAllowedAttemps) || 3,
        videoPurchaseStatus: paymentStatus === 'Free' ? true : false,
        purchaseDate: null,
        purchaseCode: null,
        isUserEnterQuiz: false,
        isHWIsUploaded: false,
        isUserUploadPerviousHWAndApproved: false,
        prerequisites: prerequisites || 'none',
        accessibleAfterViewing: null
      };
      
      // First, add video info to all students of the same grade
      await User.updateMany(
        { isTeacher: false, Grade: chapter.chapterGrade },
        { $push: { videosInfo: videosInfo } }
      );
      
      // Then, grant access to students who have already purchased this chapter
      // This ensures that new videos are automatically accessible to chapter owners
      await User.updateMany(
        { 
          isTeacher: false, 
          chaptersPaid: chapter._id 
        },
        { 
          $set: { 
            "videosInfo.$[video].videoPurchaseStatus": true,
            "videosInfo.$[video].purchaseDate": new Date()
          }
        },
        {
          arrayFilters: [{ "video._id": videoId }]
        }
      );
      
      // Also add the video to videosPaid array for chapter owners
      await User.updateMany(
        { 
          isTeacher: false, 
          chaptersPaid: chapter._id 
        },
        { 
          $addToSet: { videosPaid: videoId }
        }
      );
      
      console.log('User records updated successfully');
      
      return res.redirect(`/teacher/chapters/${chapterId}?success=video_created`);
    } catch (error) {
      console.error('Error saving video:', error);
      return res.redirect(`/teacher/chapters/${chapterId}/videos/create?error=creation_failed&message=${encodeURIComponent(error.message)}`);
    }
  } catch (error) {
    console.error('Video create error:', error);
    return res.redirect(`/teacher/chapters/${req.params.chapterId}/videos/create?error=creation_failed&message=${encodeURIComponent(error.message)}`);
  }
};

const video_detail_get = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    
    // Find the video in all chapters
    let video = null;
    let chapter = null;
    let videoType = '';
    
    const chapters = await Chapter.find({ isActive: true });
    
    for (const chapterData of chapters) {
      // Check lectures
      const lecture = chapterData.chapterLectures?.find(v => v._id.toString() === videoId);
      if (lecture) {
        video = lecture;
        chapter = chapterData;
        videoType = 'lecture';
        break;
      }
      
      // Check summaries
      const summary = chapterData.chapterSummaries?.find(v => v._id.toString() === videoId);
      if (summary) {
        video = summary;
        chapter = chapterData;
        videoType = 'summary';
        break;
      }
      
      // Check solvings
      const solving = chapterData.chapterSolvings?.find(v => v._id.toString() === videoId);
      if (solving) {
        video = solving;
        chapter = chapterData;
        videoType = 'solving';
        break;
      }
    }
    
    if (!video || !chapter) {
      return res.status(404).send('Video not found');
    }
    
    // Get all students in the chapter's grade
    const allStudents = await User.find({
      isTeacher: false,
      Grade: chapter.chapterGrade
    }, {
      Username: 1,
      Code: 1,
      Grade: 1,
      phone: 1,
      parentPhone: 1,
      videosInfo: { $elemMatch: { _id: new mongoose.Types.ObjectId(videoId) } }
    });
    
    // Prepare student stats
    const studentsStats = allStudents.map(student => {
      const videoInfo = student.videosInfo && student.videosInfo[0];
      
      return {
        studentId: student._id,
        studentName: student.Username,
        studentCode: student.Code,
        grade: student.Grade,
        phone: student.phone || 'غير متوفر',
        parentPhone: student.parentPhone || 'غير متوفر',
        numberOfWatches: videoInfo ? videoInfo.numberOfWatches || 0 : 0,
        videoAllowedAttemps: videoInfo ? videoInfo.videoAllowedAttemps || 3 : 3,
        fristWatch: videoInfo ? videoInfo.fristWatch : null,
        lastWatch: videoInfo ? videoInfo.lastWatch : null,
        purchaseStatus: videoInfo ? videoInfo.videoPurchaseStatus : false
      };
    });
    
    // Calculate statistics
    const totalWatches = studentsStats.reduce((sum, s) => sum + s.numberOfWatches, 0);
    const uniqueViewers = studentsStats.filter(s => s.numberOfWatches > 0).length;
    const unwatchedCount = studentsStats.filter(s => s.numberOfWatches === 0).length;
    
    res.render('teacher/video-detail', {
      title: `${video.videoTitle || video.lectureName} - تفاصيل الفيديو`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      video,
      chapter,
      videoType,
      studentsStats,
      totalWatches,
      uniqueViewers,
      unwatchedCount
    });
  } catch (error) {
    console.error('Video detail error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const video_edit_get = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    
    // Find the video in all chapters
    let video = null;
    let chapter = null;
    let videoType = '';
    
    const chapters = await Chapter.find({ isActive: true });
    
    for (const chapterData of chapters) {
      // Check lectures
      const lecture = chapterData.chapterLectures?.find(v => v._id.toString() === videoId);
      if (lecture) {
        video = lecture;
        chapter = chapterData;
        videoType = 'lecture';
        break;
      }
      
      // Check summaries
      const summary = chapterData.chapterSummaries?.find(v => v._id.toString() === videoId);
      if (summary) {
        video = summary;
        chapter = chapterData;
        videoType = 'summary';
        break;
      }
      
      // Check solvings
      const solving = chapterData.chapterSolvings?.find(v => v._id.toString() === videoId);
      if (solving) {
        video = solving;
        chapter = chapterData;
        videoType = 'solving';
        break;
      }
    }
    
    if (!video || !chapter) {
      return res.status(404).send('Video not found');
    }
    
    res.render('teacher/video-edit', {
      title: `تعديل ${video.videoTitle || video.lectureName}`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      video,
      chapter,
      videoType,
      error: req.query.error
    });
  } catch (error) {
    console.error('Video edit get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const video_edit_post = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const {
      chapterId,
      videoType,
      videoTitle,
      paymentStatus,
      prerequisites,
      permissionToShow,
      AccessibleAfterViewing,
      videoAllowedAttemps,
      videoPrice,
      imgURL,
      videoURL,
      scheduledTime,
      PDFURL,
      videoDescription
    } = req.body;
    
    // Validation
    if (!videoTitle || !paymentStatus || !imgURL || !videoURL) {
      return res.redirect(`/teacher/videos/${videoId}/edit?error=missing_fields`);
    }
    
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }
    
    // Update the video based on its type
    let videoArray;
    if (videoType === 'lecture') {
      videoArray = chapter.chapterLectures;
    } else if (videoType === 'summary') {
      videoArray = chapter.chapterSummaries;
    } else if (videoType === 'solving') {
      videoArray = chapter.chapterSolvings;
    } else {
      return res.redirect(`/teacher/videos/${videoId}/edit?error=invalid_video_type`);
    }
    
    // Find the video in the array
    const videoIndex = videoArray.findIndex(v => v._id.toString() === videoId);
    if (videoIndex === -1) {
      return res.status(404).send('Video not found in chapter');
    }
    
    // Update video properties
    videoArray[videoIndex].videoTitle = videoTitle;
    videoArray[videoIndex].lectureName = videoTitle; // For compatibility
    videoArray[videoIndex].paymentStatus = paymentStatus;
    videoArray[videoIndex].prerequisites = prerequisites || '';
    videoArray[videoIndex].permissionToShow = permissionToShow === 'true';
    videoArray[videoIndex].AccessibleAfterViewing = AccessibleAfterViewing || '';
    videoArray[videoIndex].videoAllowedAttemps = parseInt(videoAllowedAttemps) || 3;
    videoArray[videoIndex].videoPrice = parseFloat(videoPrice) || 0;
    videoArray[videoIndex].videoURL = videoURL;
    videoArray[videoIndex].imgURL = imgURL;
    videoArray[videoIndex].PDFURL = PDFURL || '';
    videoArray[videoIndex].scheduledTime = scheduledTime || '';
    videoArray[videoIndex].videoDescription = videoDescription || '';
    videoArray[videoIndex].updatedAt = new Date();
    
    // Save the chapter with updated video
    chapter.updatedAt = new Date();
    await chapter.save();
    
    res.redirect(`/teacher/videos/${videoId}?success=video_updated`);
  } catch (error) {
    console.error('Video edit error:', error);
    res.redirect(`/teacher/videos/${req.params.videoId}/edit?error=update_failed`);
  }
};

const video_delete = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    
    // Find the video in all chapters
    let chapter = null;
    let videoType = '';
    let videoIndex = -1;
    
    const chapters = await Chapter.find({ isActive: true });
    
    for (const chapterData of chapters) {
      // Check lectures
      const lectureIndex = chapterData.chapterLectures?.findIndex(v => v._id.toString() === videoId);
      if (lectureIndex !== -1) {
        chapter = chapterData;
        videoType = 'lecture';
        videoIndex = lectureIndex;
        break;
      }
      
      // Check summaries
      const summaryIndex = chapterData.chapterSummaries?.findIndex(v => v._id.toString() === videoId);
      if (summaryIndex !== -1) {
        chapter = chapterData;
        videoType = 'summary';
        videoIndex = summaryIndex;
        break;
      }
      
      // Check solvings
      const solvingIndex = chapterData.chapterSolvings?.findIndex(v => v._id.toString() === videoId);
      if (solvingIndex !== -1) {
        chapter = chapterData;
        videoType = 'solving';
        videoIndex = solvingIndex;
        break;
      }
    }
    
    if (!chapter || videoIndex === -1) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    
    // Remove the video from the appropriate array
    if (videoType === 'lecture') {
      chapter.chapterLectures.splice(videoIndex, 1);
    } else if (videoType === 'summary') {
      chapter.chapterSummaries.splice(videoIndex, 1);
    } else if (videoType === 'solving') {
      chapter.chapterSolvings.splice(videoIndex, 1);
    }
    
    // Save the chapter with the video removed
    chapter.updatedAt = new Date();
    await chapter.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Video delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const video_analytics = (req, res) => res.send('Feature coming soon');
const pdfs_get = (req, res) => res.send('Feature coming soon');
const pdf_create_get = (req, res) => res.send('Feature coming soon');
const pdf_create_post = (req, res) => res.send('Feature coming soon');
const pdf_edit_get = (req, res) => res.send('Feature coming soon');
const pdf_edit_post = (req, res) => res.send('Feature coming soon');
const pdf_delete = (req, res) => res.send('Feature coming soon');
const chapter_pdf_create_get = (req, res) => res.send('Feature coming soon');
const chapter_pdf_create_post = (req, res) => res.send('Feature coming soon');
const attendance_get = (req, res) => res.send('Feature coming soon');
const attendance_create_get = (req, res) => res.send('Feature coming soon');
const attendance_create_post = (req, res) => res.send('Feature coming soon');
const attendance_manage_get = (req, res) => res.send('Feature coming soon');
const attendance_mark = (req, res) => res.send('Feature coming soon');
const attendance_delete = (req, res) => res.send('Feature coming soon');
const attendance_export = (req, res) => res.send('Feature coming soon');
const analytics_get = (req, res) => res.send('Feature coming soon');
const analytics_students = (req, res) => res.send('Feature coming soon');
const analytics_videos = (req, res) => res.send('Feature coming soon');
const analytics_quizzes = (req, res) => res.send('Feature coming soon');
const analytics_revenue = (req, res) => res.send('Feature coming soon');
const communication_get = (req, res) => res.send('Feature coming soon');
const whatsapp_get = (req, res) => res.send('Feature coming soon');
const whatsapp_send = (req, res) => res.send('Feature coming soon');
const send_grades = (req, res) => res.send('Feature coming soon');
const settings_get = (req, res) => res.send('Feature coming soon');
const settings_post = (req, res) => res.send('Feature coming soon');
const api_chapters_get = (req, res) => res.send('Feature coming soon');
const api_videos_get = async (req, res) => {
  try {
    const { chapterId } = req.query;
    
    if (!chapterId) {
      return res.status(400).json({ success: false, message: 'Chapter ID is required' });
    }
    
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    
    // Collect all videos from the chapter
    const videos = [];
    
    if (chapter.chapterLectures && chapter.chapterLectures.length > 0) {
      videos.push(...chapter.chapterLectures.map(video => ({
        ...video.toObject(),
        type: 'lecture'
      })));
    }
    
    if (chapter.chapterSummaries && chapter.chapterSummaries.length > 0) {
      videos.push(...chapter.chapterSummaries.map(video => ({
        ...video.toObject(),
        type: 'summary'
      })));
    }
    
    if (chapter.chapterSolvings && chapter.chapterSolvings.length > 0) {
      videos.push(...chapter.chapterSolvings.map(video => ({
        ...video.toObject(),
        type: 'solving'
      })));
    }
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('API videos error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const api_students_by_grade = (req, res) => res.send('Feature coming soon');
const api_dashboard_analytics = (req, res) => res.send('Feature coming soon');

// ==================  Quiz Management  ====================== //

const quizzes_get = async (req, res) => {
  try {
    const { grade, chapter, search, page = 1 } = req.query;
    const perPage = 10;
    
    let query = {};
    if (grade) query.Grade = grade;
    if (chapter) query.chapterId = chapter;
    if (search) {
      query.quizName = { $regex: search, $options: 'i' };
    }
    
    const quizzes = await Quiz.find(query)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage);
    
    const totalQuizzes = await Quiz.countDocuments(query);
    
    // Get chapters for filter
    const chapters = await Chapter.find({ isActive: true }, 'chapterName chapterGrade');
    
    // Add statistics to each quiz
    const quizzesWithStats = await Promise.all(
      quizzes.map(async (quiz) => {
        const students = await User.find({
          isTeacher: false,
          'quizesInfo._id': quiz._id
        });
        
        const attemptedStudents = students.filter(student => 
          student.quizesInfo.some(quizInfo => 
            quizInfo._id.toString() === quiz._id.toString() && quizInfo.isEnterd
          )
        );
        
        const averageScore = attemptedStudents.length > 0 
          ? attemptedStudents.reduce((sum, student) => {
              const quizInfo = student.quizesInfo.find(q => q._id.toString() === quiz._id.toString());
              return sum + (quizInfo?.Score || 0);
            }, 0) / attemptedStudents.length 
          : 0;
        
        const questionsShown = quiz.questionsToShow || quiz.questionsCount;
        return {
          ...quiz.toObject(),
          stats: {
            totalAttempts: attemptedStudents.length,
            averageScore: Math.round(averageScore * 100) / 100,
            averageScoreDisplay: `${Math.round(averageScore)}/${questionsShown}`
          }
        };
      })
    );
    
    res.render('teacher/quizzes', {
      title: 'إدارة الاختبارات',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      quizzes: quizzesWithStats,
      chapters,
      totalQuizzes,
      activeQuizzes: quizzesWithStats.length,
      totalAttempts: quizzesWithStats.reduce((sum, q) => sum + q.stats.totalAttempts, 0),
      averageScore: quizzesWithStats.length > 0 
        ? quizzesWithStats.reduce((sum, q) => sum + q.stats.averageScore, 0) / quizzesWithStats.length 
        : 0,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalQuizzes / perPage),
      filters: { grade, chapter, search }
    });
  } catch (error) {
    console.error('Quizzes error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const quiz_create_get = async (req, res) => {
  try {
    const chapters = await Chapter.find({ isActive: true }, 'chapterName chapterGrade');
    
    // Get videos for the "video will be opened" dropdown
    let videos = [];
    if (chapters.length > 0) {
      for (const chapter of chapters) {
        // Collect all videos from this chapter
        const chapterVideos = [
          ...(chapter.chapterLectures || []).map(v => ({ 
            _id: v._id, 
            videoTitle: v.videoTitle || v.lectureName,
            chapterName: chapter.chapterName,
            type: 'lecture'
          })),
          ...(chapter.chapterSummaries || []).map(v => ({ 
            _id: v._id, 
            videoTitle: v.videoTitle || v.lectureName,
            chapterName: chapter.chapterName,
            type: 'summary'
          })),
          ...(chapter.chapterSolvings || []).map(v => ({ 
            _id: v._id, 
            videoTitle: v.videoTitle || v.lectureName,
            chapterName: chapter.chapterName,
            type: 'solving'
          }))
        ];
        videos = [...videos, ...chapterVideos];
      }
    }
    
    res.render('teacher/quiz-create', {
      title: 'إنشاء اختبار جديد',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      chapters,
      videos,
      error: req.query.error
    });
  } catch (error) {
    console.error('Quiz create get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const quiz_create_post = async (req, res) => {
  try {
    const {
      quizName,
      Grade,
      chapterId,
      timeOfQuiz,
      prepaidStatus,
      quizPrice,
      videoWillbeOpen,
      questionsToShow,
      isQuizActive,
      permissionToShow,
      showAnswersAfterQuiz,
      questions
    } = req.body;
    
    // Parse questions if it's a string
    let parsedQuestions = questions;
    if (typeof questions === 'string') {
      try {
        parsedQuestions = JSON.parse(questions);
      } catch (e) {
        console.error('Error parsing questions JSON:', e);
        return res.redirect('/teacher/quizzes/create?error=invalid_questions_format');
      }
    }
    
    // Normalize question field names for consistency
    if (Array.isArray(parsedQuestions)) {
      parsedQuestions = parsedQuestions.map((question, index) => {
        // Generate unique ID for each question
        const questionId = question.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        // Convert from frontend format to Quiz schema format
        const normalizedQuestion = {
          id: questionId,
          title: question.question || question.title || question.questionText || '',
          questionPhoto: question.image || question.questionPhoto || '',
          answer1: question.answers && question.answers[0] ? question.answers[0] : (question.answer1 || ''),
          answer2: question.answers && question.answers[1] ? question.answers[1] : (question.answer2 || ''),
          answer3: question.answers && question.answers[2] ? question.answers[2] : (question.answer3 || ''),
          answer4: question.answers && question.answers[3] ? question.answers[3] : (question.answer4 || ''),
          ranswer: (question.correctAnswer !== undefined ? question.correctAnswer + 1 : (question.ranswer || 1))
        };
        
        // Ensure both image and questionPhoto fields exist for backward compatibility
        if (normalizedQuestion.questionPhoto && !normalizedQuestion.image) {
          normalizedQuestion.image = normalizedQuestion.questionPhoto;
        }
        if (normalizedQuestion.image && !normalizedQuestion.questionPhoto) {
          normalizedQuestion.questionPhoto = normalizedQuestion.image;
        }
        
        return normalizedQuestion;
      });
    }
    
    // Validation
    if (!quizName || !Grade || !timeOfQuiz || !parsedQuestions || parsedQuestions.length === 0) {
      return res.redirect('/teacher/quizzes/create?error=missing_fields');
    }
    
    // Ensure questionsToShow is not greater than the number of questions
    const questionCount = parsedQuestions.length;
    const showCount = parseInt(questionsToShow) || questionCount;
    if (showCount > questionCount) {
      return res.redirect('/teacher/quizzes/create?error=too_many_questions_to_show');
    }
    
    const quiz = new Quiz({
      quizName,
      Grade,
      chapterId: chapterId || null,
      questionsCount: questionCount,
      questionsToShow: showCount, // Store how many questions to show to students
      timeOfQuiz: parseInt(timeOfQuiz),
      prepaidStatus: prepaidStatus === 'true',
      quizPrice: parseFloat(quizPrice) || 0,
      isQuizActive: isQuizActive === 'true',
      permissionToShow: permissionToShow === 'true',
      showAnswersAfterQuiz: showAnswersAfterQuiz === 'true',
      Questions: parsedQuestions,
      videoWillbeOpen: videoWillbeOpen || null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await quiz.save();
    
    // Add quiz info to all students of the same grade
    const quizInfo = {
      _id: quiz._id,
      quizName: quiz.quizName,
      chapterId: quiz.chapterId,
      isEnterd: false,
      inProgress: false,
      Score: 0,
      answers: [],
      endTime: null,
      quizPurchaseStatus: !quiz.prepaidStatus
    };
    
    await User.updateMany(
      { isTeacher: false, Grade: Grade },
      { $push: { quizesInfo: quizInfo } }
    );
    
    // Redirect based on where the quiz was created from
    if (chapterId) {
      res.redirect(`/teacher/chapters/${chapterId}?success=quiz_created`);
    } else {
    res.redirect('/teacher/quizzes?success=quiz_created');
    }
  } catch (error) {
    console.error('Quiz create error:', error);
    const redirectUrl = req.body.chapterId 
      ? `/teacher/chapters/${req.body.chapterId}/quizzes/create?error=creation_failed` 
      : '/teacher/quizzes/create?error=creation_failed';
    res.redirect(redirectUrl);
  }
};

// ==================  Student Management  ====================== //

const students_get = async (req, res) => {
  try {
    const { grade, status, search, page = 1 } = req.query;
    const perPage = 20;
    
    let query = { isTeacher: false };
    if (grade) query.Grade = grade;
    if (status === 'active') query.subscribe = true;
    if (status === 'pending') query.subscribe = false;
    if (search) {
      query.$or = [
        { Username: { $regex: search, $options: 'i' } },
        { Code: isNaN(search) ? undefined : parseInt(search) }
      ].filter(Boolean);
    }
    
    const students = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage)
      .select('Username Code Grade gov phone parentPhone subscribe totalScore examsEnterd createdAt');
    
    const totalStudents = await User.countDocuments(query);
    
    res.render('teacher/students', {
      title: 'إدارة الطلاب',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      students,
      totalStudents,
      activeStudents: students.filter(s => s.subscribe).length,
      pendingRequests: students.filter(s => !s.subscribe).length,
      averageProgress: students.length > 0 
        ? students.reduce((sum, s) => sum + (s.totalScore || 0), 0) / students.length 
        : 0,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalStudents / perPage),
      filters: { grade, status, search }
    });
  } catch (error) {
    console.error('Students error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const student_requests_get = async (req, res) => {
  try {
    const { grade, search, page = 1 } = req.query;
    const perPage = 20;
    
    let query = { isTeacher: false, subscribe: false };
    if (grade) query.Grade = grade;
    if (search) {
      query.$or = [
        { Username: { $regex: search, $options: 'i' } },
        { Code: isNaN(search) ? undefined : parseInt(search) }
      ].filter(Boolean);
    }
    
    const students = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage)
      .select('Username Code Grade gov phone parentPhone createdAt');
    
    const totalStudents = await User.countDocuments(query);
    
    res.render('teacher/student-requests', {
      title: 'طلبات الطلاب',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      students,
      totalStudents,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalStudents / perPage),
      filters: { grade, search }
    });
  } catch (error) {
    console.error('Student requests error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const student_detail_get = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const student = await User.findById(studentId);
    
    if (!student || student.isTeacher) {
      return res.status(404).send('Student not found');
    }
    
    // Get chapters this student has access to
    const chapters = await Chapter.find({
      _id: { $in: student.chaptersPaid || [] }
    }, 'chapterName chapterGrade');
    
    // Get quizzes this student has taken
    const takenQuizzes = student.quizesInfo
      .filter(quiz => quiz.isEnterd)
      .map(quiz => ({
        quizId: quiz._id,
        quizName: quiz.quizName,
        score: quiz.Score,
        endTime: quiz.endTime
      }));
    
    // Get videos this student has watched
    const watchedVideos = student.videosInfo
      .filter(video => video.numberOfWatches > 0)
      .map(video => ({
        videoId: video._id,
        videoName: video.videoName,
        numberOfWatches: video.numberOfWatches,
        lastWatch: video.lastWatch
      }));
    
    res.render('teacher/student-detail', {
      title: `${student.Username} - تفاصيل الطالب`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      student,
      chapters,
      takenQuizzes,
      watchedVideos
    });
  } catch (error) {
    console.error('Student detail error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const student_approve = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    const student = await User.findById(studentId);
    if (!student || student.isTeacher) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    student.subscribe = true;
    await student.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Student approve error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const student_reject = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    const student = await User.findById(studentId);
    if (!student || student.isTeacher) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Instead of deleting, we can mark as rejected
    student.subscribe = false;
    student.isRejected = true;
    await student.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Student reject error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const student_edit = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const {
      Username,
      Grade,
      gov,
      Markez,
      phone,
      parentPhone,
      place,
      gender,
      ARorEN,
      subscribe
    } = req.body;
    
    const updateData = {
      Username,
      Grade,
      gov,
      Markez,
      phone,
      parentPhone,
      place,
      gender,
      ARorEN,
      subscribe: subscribe === 'true'
    };
    
    await User.findByIdAndUpdate(studentId, updateData);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Student edit error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const student_delete = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Delete the student from the database
    await User.findByIdAndDelete(studentId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Student delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const student_remove_chapter = async (req, res) => {
  try {
    const { studentId, chapterId } = req.params;
    
    // Find the student
    const student = await User.findById(studentId);
    if (!student || student.isTeacher) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Remove the chapter from the student's chaptersPaid array
    if (student.chaptersPaid && student.chaptersPaid.includes(chapterId)) {
      student.chaptersPaid = student.chaptersPaid.filter(id => id.toString() !== chapterId);
      await student.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Student remove chapter error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const students_search = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ success: false, message: 'Search query too short' });
    }
    
    const students = await User.find({
      isTeacher: false,
      $or: [
        { Username: { $regex: query, $options: 'i' } },
        { Code: isNaN(query) ? undefined : parseInt(query) }
      ].filter(Boolean)
    })
    .limit(10)
    .select('Username Code Grade subscribe');
    
    res.json({ success: true, students });
  } catch (error) {
    console.error('Students search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const students_export = async (req, res) => {
  try {
    const { grade, status } = req.query;
    
    let query = { isTeacher: false };
    if (grade) query.Grade = grade;
    if (status === 'active') query.subscribe = true;
    if (status === 'pending') query.subscribe = false;
    
    const students = await User.find(query)
      .sort({ createdAt: -1 })
      .select('Username Code Grade gov phone parentPhone subscribe totalScore createdAt');
    
    // Create Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Students');
    
    // Add headers
    worksheet.columns = [
      { header: 'اسم الطالب', key: 'name', width: 30 },
      { header: 'كود الطالب', key: 'code', width: 15 },
      { header: 'الصف', key: 'grade', width: 15 },
      { header: 'المحافظة', key: 'gov', width: 20 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 },
      { header: 'رقم ولي الأمر', key: 'parentPhone', width: 20 },
      { header: 'حالة الاشتراك', key: 'status', width: 15 },
      { header: 'الدرجة الكلية', key: 'score', width: 15 },
      { header: 'تاريخ التسجيل', key: 'date', width: 20 }
    ];
    
    // Add data rows
    students.forEach(student => {
      worksheet.addRow({
        name: student.Username,
        code: student.Code,
        grade: student.Grade,
        gov: student.gov,
        phone: student.phone,
        parentPhone: student.parentPhone,
        status: student.subscribe ? 'مشترك' : 'غير مشترك',
        score: student.totalScore || 0,
        date: student.createdAt ? student.createdAt.toLocaleDateString() : ''
      });
    });
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Students export error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ==================  Code Management  ====================== //

const codes_get = async (req, res) => {
  try {
    const { search, type, status, grade, page = 1 } = req.query;
    const perPage = 20;
    
    // Build query
    let query = {};
    
    if (search) {
      // Check if search is a number (for usedBy field)
      const searchNumber = parseInt(search);
      if (!isNaN(searchNumber)) {
        // If search is a number, search in usedBy field
        query.usedBy = searchNumber;
      } else {
        // If search is not a number, search in Code field only
        query.Code = { $regex: search, $options: 'i' };
      }
    }
    
    if (type) {
      query.codeType = type;
    }
    
    if (status === 'used') {
      query.isUsed = true;
    } else if (status === 'unused') {
      query.isUsed = false;
    }
    
    if (grade) {
      query.codeGrade = grade;
    }
    
    // Get statistics for codes
    const codeStats = await Code.aggregate([
      {
        $group: {
          _id: null,
          totalCodes: { $sum: 1 },
          usedCodes: { $sum: { $cond: [{ $eq: ['$isUsed', true] }, 1, 0] } },
          chapterCodes: { $sum: { $cond: [{ $eq: ['$codeType', 'Chapter'] }, 1, 0] } },
          videoCodes: { $sum: { $cond: [{ $eq: ['$codeType', 'Video'] }, 1, 0] } },
          quizCodes: { $sum: { $cond: [{ $eq: ['$codeType', 'Quiz'] }, 1, 0] } },
          pdfCodes: { $sum: { $cond: [{ $eq: ['$codeType', 'PDF'] }, 1, 0] } },
          generalCodes: { $sum: { $cond: [{ $eq: ['$isGeneralCode', true] }, 1, 0] } }
        }
      }
    ]);
    
    // Get chapters for code generation
    const chapters = await Chapter.find({ isActive: true }).select('chapterName chapterGrade');
    
    // Get quizzes for code generation
    const quizzes = await Quiz.find({ isQuizActive: true }).select('quizName Grade');
    
    // Get codes with pagination
    const codes = await Code.find(query)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage);
    
    const totalCodes = await Code.countDocuments(query);
    
    const stats = codeStats[0] || { 
      totalCodes: 0, 
      usedCodes: 0, 
      chapterCodes: 0, 
      videoCodes: 0, 
      quizCodes: 0, 
      pdfCodes: 0, 
      generalCodes: 0 
    };
    
    res.render('teacher/Codes', {
      title: 'إدارة الأكواد',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      stats: {
        totalCodes: stats.totalCodes,
        usedCodes: stats.usedCodes,
        availableCodes: stats.totalCodes - stats.usedCodes,
        chapterCodes: stats.chapterCodes,
        videoCodes: stats.videoCodes,
        quizCodes: stats.quizCodes,
        pdfCodes: stats.pdfCodes,
        generalCodes: stats.generalCodes
      },
      chapters,
      quizzes,
      codes,
      totalCodes,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCodes / perPage),
      filters: { search, type, status, grade },
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Codes error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const codes_create_get = async (req, res) => {
  try {
    // Get chapters for code generation
    const chapters = await Chapter.find({ isActive: true }).select('chapterName chapterGrade');
    
    // Get quizzes for code generation
    const quizzes = await Quiz.find({ isQuizActive: true }).select('quizName Grade');
    
    res.render('teacher/codes-create', {
      title: 'إنشاء أكواد',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      chapters,
      quizzes,
      generatedCodes: [],
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Codes create get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const codes_create_post = async (req, res) => {
  try {
    const {
      codeType,
      count,
      grade,
      isGeneral,
      chapterId,
      contentId
    } = req.body;

    // Validation
    if (!codeType || !count || !grade) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول المطلوبة'
      });
    }

    const codesCount = parseInt(count);
    if (codesCount < 1 || codesCount > 100) {
      return res.status(400).json({
        success: false,
        message: 'عدد الأكواد يجب أن يكون بين 1 و 100'
      });
    }

    // Generate numeric-only codes (12 digits)
    const generatedCodes = [];
    const usedCodes = new Set();

    for (let i = 0; i < codesCount; i++) {
      let code;
      do {
        // Generate 12-digit numeric code
        code = Math.floor(Math.random() * 900000000000) + 100000000000; // 12 digits
        code = code.toString();
      } while (usedCodes.has(code));

      usedCodes.add(code);

      // Determine content details based on code type
      let contentName = 'عام';
      let chapterName = '';

      if (!isGeneral || isGeneral === 'false') {
        if (chapterId) {
          const chapter = await Chapter.findById(chapterId);
          if (chapter) {
            chapterName = chapter.chapterName;
          }
        }

        if (contentId) {
          if (codeType === 'Video') {
            const video = await Video.findById(contentId);
            if (video) {
              contentName = video.videoTitle || video.lectureName;
            }
          } else if (codeType === 'Quiz') {
            const quiz = await Quiz.findById(contentId);
            if (quiz) {
              contentName = quiz.quizName;
            }
          } else if (codeType === 'PDF') {
            const pdf = await PDFs.findById(contentId);
            if (pdf) {
              contentName = pdf.pdfName;
            }
          }
        }
      }

      // Create code object
      const codeObj = {
        Code: code,
        codeType: codeType,
        codeGrade: grade,
        isGeneral: isGeneral === 'true',
        isAllGrades: grade === 'AllGrades', // Add flag for all grades
        chapterId: chapterId || null,
        contentId: contentId || null,
        contentName: contentName,
        chapterName: chapterName,
        usedBy: null,
        createdAt: new Date()
      };

      generatedCodes.push(codeObj);
    }

    // Save codes to database
    const savedCodes = await Code.insertMany(generatedCodes);

    // Return JSON response for AJAX
    return res.json({
      success: true,
      message: `تم إنشاء ${codesCount} كود بنجاح`,
      codes: savedCodes
    });

  } catch (error) {
    console.error('Code creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الأكواد'
    });
  }
};

const codes_upload_excel = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { codeType, grade, isGeneral, chapterId, contentId } = req.body;
    
    // Check if file was uploaded
    if (!req.files || !req.files.excelFile) {
      return res.status(400).json({
        success: false,
        message: 'يرجى رفع ملف Excel'
      });
    }

    const excelFile = req.files.excelFile;
    
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(excelFile.mimetype) && !excelFile.name.match(/\.(xlsx|xls)$/)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى رفع ملف Excel صحيح (.xlsx أو .xls)'
      });
    }

    // Validation
    if (!codeType || !grade) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول المطلوبة'
      });
    }

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelFile.data);
    
    const worksheet = workbook.getWorksheet(1); // Get first worksheet
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم العثور على بيانات في ملف Excel'
      });
    }

    // Find the code column
    let codeColumnIndex = -1;
    const headerRow = worksheet.getRow(1);
    
    // Look for code column headers (Arabic or English)
    const possibleHeaders = ['الكود', 'Code', 'كود', 'code', 'الكود', 'الرمز'];
    
    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.value ? cell.value.toString().trim() : '';
      if (possibleHeaders.includes(cellValue)) {
        codeColumnIndex = colNumber;
      }
    });

    if (codeColumnIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم العثور على عمود "الكود" أو "Code" في ملف Excel'
      });
    }

    // Extract codes from Excel
    const extractedCodes = [];
    const usedCodes = new Set();
    
    // Get existing codes from database to avoid duplicates
    const existingCodes = await Code.find({}, 'Code');
    existingCodes.forEach(code => usedCodes.add(code.Code));

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      const codeCell = row.getCell(codeColumnIndex);
      const codeValue = codeCell.value;
      
      if (codeValue) {
        const code = codeValue.toString().trim();
        
        // Validate code format (should be numeric and 12 digits)
        if (code && /^\d{12}$/.test(code)) {
          // Check if code already exists
          if (!usedCodes.has(code)) {
            usedCodes.add(code);
            extractedCodes.push(code);
          }
        }
      }
    });

    if (extractedCodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم العثور على أكواد صحيحة في ملف Excel'
      });
    }

    // Determine content details based on code type
    let contentName = 'عام';
    let chapterName = '';

    if (!isGeneral || isGeneral === 'false') {
      if (chapterId) {
        const chapter = await Chapter.findById(chapterId);
        if (chapter) {
          chapterName = chapter.chapterName;
        }
      }

      if (contentId) {
        if (codeType === 'Video') {
          const video = await Video.findById(contentId);
          if (video) {
            contentName = video.videoTitle || video.lectureName;
          }
        } else if (codeType === 'Quiz') {
          const quiz = await Quiz.findById(contentId);
          if (quiz) {
            contentName = quiz.quizName;
          }
        } else if (codeType === 'PDF') {
          const pdf = await PDFs.findById(contentId);
          if (pdf) {
            contentName = pdf.pdfName;
          }
        }
      }
    }

    // Create code objects
    const codesToSave = extractedCodes.map(code => ({
      Code: code,
      codeType: codeType,
      codeGrade: grade,
      isGeneral: isGeneral === 'true',
      isAllGrades: grade === 'AllGrades',
      chapterId: chapterId || null,
      contentId: contentId || null,
      contentName: contentName,
      chapterName: chapterName,
      usedBy: null,
      createdAt: new Date()
    }));

    // Save codes to database
    const savedCodes = await Code.insertMany(codesToSave);

    return res.json({
      success: true,
      message: `تم رفع ${savedCodes.length} كود بنجاح`,
      codes: savedCodes
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء رفع ملف Excel'
    });
  }
};

const codes_manage_get = async (req, res) => {
  try {
    const { type, status, grade, search, page = 1 } = req.query;
    const perPage = 50;
    
    let query = {};
    
    if (type) {
      query.codeType = type;
    }
    
    if (status === 'used') {
      query.isUsed = true;
    } else if (status === 'unused') {
      query.isUsed = false;
    }
    
    if (grade) {
      query.codeGrade = grade;
    }
    
    if (search) {
      // Check if search is a number (for usedBy field)
      const searchNumber = parseInt(search);
      if (!isNaN(searchNumber)) {
        // If search is a number, search in usedBy field
        query.usedBy = searchNumber;
      } else {
        // If search is not a number, search in Code field only
        query.Code = { $regex: search, $options: 'i' };
      }
    }
    
    const codes = await Code.find(query)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((page - 1) * perPage);
    
    const totalCodes = await Code.countDocuments(query);
    
    res.render('teacher/codes-manage', {
      title: 'إدارة الأكواد',
      path: req.path,
      teacherData: req.userData || req.teacherData,
      codes,
      totalCodes,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCodes / perPage),
      filters: { type, status, grade, search }
    });
  } catch (error) {
    console.error('Codes manage error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const codes_search = async (req, res) => {
  try {
    const { search, type, status, grade } = req.query;
    
    let query = {};
    
    if (search) {
      // Check if search is a number (for usedBy field)
      const searchNumber = parseInt(search);
      if (!isNaN(searchNumber)) {
        // If search is a number, search in usedBy field
        query.usedBy = searchNumber;
      } else {
        // If search is not a number, search in Code field only
        query.Code = { $regex: search, $options: 'i' };
      }
    }
    
    if (type) {
      query.codeType = type;
    }
    
    if (status === 'used') {
      query.isUsed = true;
    } else if (status === 'unused') {
      query.isUsed = false;
    }
    
    if (grade) {
      query.codeGrade = grade;
    }
    
    const codes = await Code.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ success: true, codes });
  } catch (error) {
    console.error('Codes search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const codes_export = async (req, res) => {
  try {
    const { search, type, status, grade } = req.query;
    
    let query = {};
    
    if (search) {
      // Check if search is a number (for usedBy field)
      const searchNumber = parseInt(search);
      if (!isNaN(searchNumber)) {
        // If search is a number, search in usedBy field
        query.usedBy = searchNumber;
      } else {
        // If search is not a number, search in Code field only
        query.Code = { $regex: search, $options: 'i' };
      }
    }
    
    if (type) {
      query.codeType = type;
    }
    
    if (status === 'used') {
      query.isUsed = true;
    } else if (status === 'unused') {
      query.isUsed = false;
    }
    
    if (grade) {
      query.codeGrade = grade;
    }
    
    const codes = await Code.find(query)
      .sort({ createdAt: -1 });
    
    // Create CSV content
    let csvContent = 'الكود,النوع,الصف,المحتوى المرتبط,الحالة,مستخدم بواسطة,تاريخ الإنشاء,تاريخ الاستخدام\n';
    
    codes.forEach(code => {
      const codeType = code.codeType === 'Chapter' ? 'فصل' : 
                      code.codeType === 'Video' ? 'فيديو' : 
                      code.codeType === 'Quiz' ? 'اختبار' : 
                      code.codeType === 'PDF' ? 'PDF' : code.codeType;
      
      const status = code.isUsed ? 'مستخدم' : 'متاح';
      const usedBy = code.usedBy || 'غير مستخدم';
      const createdAt = new Date(code.createdAt).toLocaleString('ar-EG');
      const usageDate = code.usageDate ? new Date(code.usageDate).toLocaleString('ar-EG') : 'غير مستخدم';
      const content = code.contentName || code.chapterName || 'غير محدد';
      
      csvContent += `"${code.Code}","${codeType}","${code.codeGrade || 'غير محدد'}","${content}","${status}","${usedBy}","${createdAt}","${usageDate}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="codes-export.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Codes export error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// ==================  Code Management Functions  ====================== //

const code_delete = async (req, res) => {
  try {
    const codeId = req.params.codeId;
    
    await Code.findByIdAndDelete(codeId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Code delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const generate_chapter_codes = async (req, res) => {
  try {
    const { chapterId, codesCount = 10, grade } = req.body;
    
    // Validate chapter exists
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    
    const codeGrade = grade || chapter.chapterGrade;
    const codes = [];
    
    // Generate codes
    for (let i = 0; i < codesCount; i++) {
      const codeString = generateUniqueCode();
      
      const code = new Code({
        Code: codeString,
        codeType: 'Chapter',
        codeGrade: codeGrade,
        chapterName: chapter.chapterName,
        chapterId: chapter._id,
        isUsed: false,
        createdAt: new Date()
      });
      
      await code.save();
      codes.push(code);
    }
    
    res.redirect('/teacher/codes?success=codes_generated');
  } catch (error) {
    console.error('Generate chapter codes error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const generate_video_codes = async (req, res) => {
  try {
    const { videoId, chapterId, codesCount = 10 } = req.body;
    
    // Validate chapter exists
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
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
      return res.status(404).json({ success: false, message: 'Video not found' });
    }
    
    const codes = [];
    
    // Generate codes
    for (let i = 0; i < codesCount; i++) {
      const codeString = generateUniqueCode();
      
      const code = new Code({
        Code: codeString,
        codeType: 'Video',
        codeGrade: chapter.chapterGrade,
        chapterName: chapter.chapterName,
        chapterId: chapter._id,
        contentId: videoId,
        contentName: video.videoTitle || video.lectureName,
        isUsed: false,
        createdAt: new Date()
      });
      
      await code.save();
      codes.push(code);
    }
    
    res.redirect(`/teacher/videos/${videoId}?success=codes_generated`);
  } catch (error) {
    console.error('Generate video codes error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const generate_quiz_codes = async (req, res) => {
  try {
    const { quizId, codesCount = 10 } = req.body;
    
    // Validate quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    
    const codes = [];
    
    // Generate codes
    for (let i = 0; i < codesCount; i++) {
      const codeString = generateUniqueCode();
      
      const code = new Code({
        Code: codeString,
        codeType: 'Quiz',
        codeGrade: quiz.Grade,
        contentId: quiz._id,
        contentName: quiz.quizName,
        chapterId: quiz.chapterId,
        isUsed: false,
        createdAt: new Date()
      });
      
      await code.save();
      codes.push(code);
    }
    
    res.redirect('/teacher/quizzes?success=codes_generated');
  } catch (error) {
    console.error('Generate quiz codes error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const generate_general_codes = async (req, res) => {
  try {
    const { codeType, grade, codesCount = 10 } = req.body;
    
    if (!codeType || !grade || !['GeneralChapter', 'GeneralVideo', 'GeneralQuiz'].includes(codeType)) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }
    
    const codes = [];
    
    // Generate codes
    for (let i = 0; i < codesCount; i++) {
      const codeString = generateUniqueCode();
      
      const code = new Code({
        Code: codeString,
        codeType: codeType,
        codeGrade: grade,
        isGeneralCode: true,
        isUsed: false,
        createdAt: new Date()
      });
      
      await code.save();
      codes.push(code);
    }
    
    res.redirect('/teacher/codes?success=general_codes_generated');
  } catch (error) {
    console.error('Generate general codes error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Helper function to generate unique code
function generateUniqueCode() {
  // Generate a random string of 8 characters
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// ==================  Chapter Quiz Management  ====================== //

const chapter_quiz_create_get = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapter = await Chapter.findById(chapterId);
    
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }
    
    // Get videos from this chapter for the "video will be opened" dropdown
    const videos = [
      ...(chapter.chapterLectures || []).map(v => ({ 
        _id: v._id, 
        videoTitle: v.videoTitle || v.lectureName,
        chapterName: chapter.chapterName,
        type: 'lecture'
      })),
      ...(chapter.chapterSummaries || []).map(v => ({ 
        _id: v._id, 
        videoTitle: v.videoTitle || v.lectureName,
        chapterName: chapter.chapterName,
        type: 'summary'
      })),
      ...(chapter.chapterSolvings || []).map(v => ({ 
        _id: v._id, 
        videoTitle: v.videoTitle || v.lectureName,
        chapterName: chapter.chapterName,
        type: 'solving'
      }))
    ];
    
    // Get existing quizzes for this chapter
    const existingQuizzes = await Quiz.find({ chapterId: chapterId })
      .select('quizName questionsCount questionsToShow timeOfQuiz prepaidStatus')
      .sort({ createdAt: -1 });
    
    res.render('teacher/quiz-create', {
      title: `إنشاء اختبار جديد - ${chapter.chapterName}`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      chapter,
      videos,
      existingQuizzes,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Chapter quiz create get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const chapter_quiz_create_post = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const {
      quizName,
      timeOfQuiz,
      prepaidStatus,
      quizPrice,
      videoWillbeOpen,
      questionsToShow,
      isQuizActive,
      permissionToShow,
      showAnswersAfterQuiz,
      questions
    } = req.body;
    
    // Validate chapter exists
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).send('Chapter not found');
    }
    
    // Parse questions if it's a string
    let parsedQuestions = questions;
    if (typeof questions === 'string') {
      try {
        parsedQuestions = JSON.parse(questions);
      } catch (e) {
        console.error('Error parsing questions JSON:', e);
        return res.redirect(`/teacher/chapters/${chapterId}/quizzes/create?error=invalid_questions_format`);
      }
    }
    
    // Normalize question field names for consistency
    if (Array.isArray(parsedQuestions)) {
      parsedQuestions = parsedQuestions.map(question => {
        const normalizedQuestion = { ...question };
        // Ensure both image and questionPhoto fields exist for backward compatibility
        if (normalizedQuestion.questionPhoto && !normalizedQuestion.image) {
          normalizedQuestion.image = normalizedQuestion.questionPhoto;
        }
        if (normalizedQuestion.image && !normalizedQuestion.questionPhoto) {
          normalizedQuestion.questionPhoto = normalizedQuestion.image;
        }
        return normalizedQuestion;
      });
    }
    
    // Validation
    if (!quizName || !timeOfQuiz || !parsedQuestions || parsedQuestions.length === 0) {
      return res.redirect(`/teacher/chapters/${chapterId}/quizzes/create?error=missing_fields`);
    }
    
    // Ensure questionsToShow is not greater than the number of questions
    const questionCount = parsedQuestions.length;
    const showCount = parseInt(questionsToShow) || questionCount;
    if (showCount > questionCount) {
      return res.redirect(`/teacher/chapters/${chapterId}/quizzes/create?error=too_many_questions_to_show`);
    }
    
    const quiz = new Quiz({
      quizName,
      Grade: chapter.chapterGrade,
      chapterId: chapterId,
      questionsCount: questionCount,
      questionsToShow: showCount, // Store how many questions to show to students
      timeOfQuiz: parseInt(timeOfQuiz),
      prepaidStatus: prepaidStatus === 'true',
      quizPrice: parseFloat(quizPrice) || 0,
      isQuizActive: isQuizActive === 'true',
      permissionToShow: permissionToShow === 'true',
      showAnswersAfterQuiz: showAnswersAfterQuiz === 'true',
      Questions: parsedQuestions,
      videoWillbeOpen: videoWillbeOpen || null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await quiz.save();
    
    // Add quiz info to all students of the same grade
    const quizInfo = {
      _id: quiz._id,
      quizName: quiz.quizName,
      chapterId: quiz.chapterId,
      isEnterd: false,
      inProgress: false,
      Score: 0,
      answers: [],
      endTime: null,
      quizPurchaseStatus: !quiz.prepaidStatus
    };
    
    await User.updateMany(
      { isTeacher: false, Grade: chapter.chapterGrade },
      { $push: { quizesInfo: quizInfo } }
    );
    
    res.redirect(`/teacher/chapters/${chapterId}?success=quiz_created`);
  } catch (error) {
    console.error('Chapter quiz create error:', error);
    res.redirect(`/teacher/chapters/${req.params.chapterId}/quizzes/create?error=creation_failed`);
  }
};

// ==================  Logout  ====================== //

const logout = async (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
};

const increase_student_watches = async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const studentId = req.params.studentId;
    const { additionalWatches } = req.body;
    
    // Validate input
    if (!additionalWatches || isNaN(additionalWatches) || additionalWatches <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'يرجى تحديد عدد المشاهدات الإضافية بشكل صحيح'
      });
    }
    
    // Find the student
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: 'لم يتم العثور على الطالب'
      });
    }
    
    // Find the video info in the student's videosInfo array
    const videoInfoIndex = student.videosInfo.findIndex(
      v => v._id.toString() === videoId.toString()
    );
    
    if (videoInfoIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'لم يتم العثور على معلومات الفيديو للطالب'
      });
    }
    
    // Increase the videoAllowedAttemps
    const currentAllowedAttempts = student.videosInfo[videoInfoIndex].videoAllowedAttemps || 3;
    student.videosInfo[videoInfoIndex].videoAllowedAttemps = currentAllowedAttempts + parseInt(additionalWatches);
    
    // Save the updated student record
    await student.save();
    
    return res.json({
      success: true,
      message: `تم زيادة عدد المشاهدات المسموح بها للطالب بنجاح (+${additionalWatches})`,
      newAllowedAttempts: student.videosInfo[videoInfoIndex].videoAllowedAttemps
    });
  } catch (error) {
    console.error('Increase student watches error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ أثناء زيادة عدد المشاهدات المسموح بها'
    });
  }
};

const quiz_detail_get = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const page = parseInt(req.query.page) || 1;
    const limit = 100; // Limit to 100 students per page
    const skip = (page - 1) * limit;
    
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).send('Quiz not found');
    }
    
    // Get chapter info if quiz is associated with a chapter
    let chapter = null;
    if (quiz.chapterId) {
      chapter = await Chapter.findById(quiz.chapterId).select('chapterName chapterGrade');
    }
    
    // Get total count of students who have this quiz in their quizesInfo
    const totalStudents = await User.countDocuments({
      isTeacher: false,
      'quizesInfo._id': quiz._id
    });
    
    // Get students with pagination
    const students = await User.find({
      isTeacher: false,
      'quizesInfo._id': quiz._id
    }).select('Username Code Grade totalScore quizesInfo phone parentPhone')
      .skip(skip)
      .limit(limit);
    
    // Process student data
    const studentsWithQuizInfo = students.map(student => {
      const quizInfo = student.quizesInfo.find(q => q._id.toString() === quiz._id.toString());
      const actualScore = quizInfo ? quizInfo.Score : 0;
      const questionsShown = quiz.questionsToShow || quiz.questionsCount;
      return {
        studentId: student._id,
        studentName: student.Username,
        studentCode: student.Code,
        grade: student.Grade,
        phoneNumber: student.phone,
        parentPhoneNumber: student.parentPhone,
        totalScore: student.totalScore || 0,
        quizAttempted: quizInfo ? quizInfo.isEnterd : false,
        quizScore: actualScore,
        quizScoreDisplay: `${actualScore}/${questionsShown}`,
        quizInProgress: quizInfo ? quizInfo.inProgress : false,
        quizEndTime: quizInfo ? quizInfo.endTime : null,
        quizPurchaseStatus: quizInfo ? quizInfo.quizPurchaseStatus : false
      };
    }).filter(result => !result.quizInProgress); // Only show completed quizzes
    
    // Calculate statistics
    const totalStudentsCount = studentsWithQuizInfo.length;
    const attemptedStudents = studentsWithQuizInfo.filter(s => s.quizAttempted);
    const completedStudents = attemptedStudents.filter(s => !s.quizInProgress);
    const inProgressStudents = studentsWithQuizInfo.filter(s => s.quizInProgress);
    const notAttemptedStudents = studentsWithQuizInfo.filter(s => !s.quizAttempted);
    
    // Calculate average score (actual score, not percentage)
    const averageScore = completedStudents.length > 0 
      ? completedStudents.reduce((sum, s) => sum + s.quizScore, 0) / completedStudents.length 
      : 0;
    
    // Get top 3 performers
    const topPerformers = completedStudents
      .sort((a, b) => b.quizScore - a.quizScore)
      .slice(0, 3);
    
    // Get score distribution based on percentage of questions shown
    const questionsShown = quiz.questionsToShow || quiz.questionsCount;
    const scoreDistribution = {
      excellent: completedStudents.filter(s => (s.quizScore / questionsShown) >= 0.9).length,
      good: completedStudents.filter(s => (s.quizScore / questionsShown) >= 0.8 && (s.quizScore / questionsShown) < 0.9).length,
      average: completedStudents.filter(s => (s.quizScore / questionsShown) >= 0.7 && (s.quizScore / questionsShown) < 0.8).length,
      belowAverage: completedStudents.filter(s => (s.quizScore / questionsShown) >= 0.6 && (s.quizScore / questionsShown) < 0.7).length,
      failed: completedStudents.filter(s => (s.quizScore / questionsShown) < 0.6).length
    };
    
    // Pagination info
    const totalPages = Math.ceil(totalStudents / limit);
    
    res.render('teacher/quiz-detail', {
      title: `${quiz.quizName} - تفاصيل الاختبار`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      quiz,
      chapter,
      students: studentsWithQuizInfo,
      stats: {
        totalStudents: totalStudentsCount,
        attemptedStudents: attemptedStudents.length,
        completedStudents: completedStudents.length,
        inProgressStudents: inProgressStudents.length,
        notAttemptedStudents: notAttemptedStudents.length,
        averageScore: Math.round(averageScore * 100) / 100,
        averageScoreDisplay: `${Math.round(averageScore)}/${quiz.questionsToShow || quiz.questionsCount}`,
        completionRate: totalStudentsCount > 0 ? Math.round((completedStudents.length / totalStudentsCount) * 100) : 0,
        questionsShown: quiz.questionsToShow || quiz.questionsCount
      },
      topPerformers,
      scoreDistribution,
      currentPage: page,
      totalPages,
      totalStudents,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Quiz detail error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const quiz_edit_get = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).send('Quiz not found');
    }
    
    // Get chapters for dropdown
    const chapters = await Chapter.find({ isActive: true }).select('chapterName chapterGrade');
    
    // Get videos for the "video will be opened" dropdown
    let videos = [];
    if (chapters.length > 0) {
      for (const chapter of chapters) {
        // Collect all videos from this chapter
        const chapterVideos = [
          ...(chapter.chapterLectures || []).map(v => ({ 
            _id: v._id, 
            videoTitle: v.videoTitle || v.lectureName,
            chapterName: chapter.chapterName,
            type: 'lecture'
          })),
          ...(chapter.chapterSummaries || []).map(v => ({ 
            _id: v._id, 
            videoTitle: v.videoTitle || v.lectureName,
            chapterName: chapter.chapterName,
            type: 'summary'
          })),
          ...(chapter.chapterSolvings || []).map(v => ({ 
            _id: v._id, 
            videoTitle: v.videoTitle || v.lectureName,
            chapterName: chapter.chapterName,
            type: 'solving'
          }))
        ];
        videos = [...videos, ...chapterVideos];
      }
    }
    
    res.render('teacher/quiz-edit', {
      title: `تعديل ${quiz.quizName}`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      quiz,
      chapters,
      videos,
      error: req.query.error
    });
  } catch (error) {
    console.error('Quiz edit get error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const quiz_edit_post = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const {
      quizName,
      Grade,
      chapterId,
      timeOfQuiz,
      prepaidStatus,
      quizPrice,
      videoWillbeOpen,
      questionsToShow,
      isQuizActive,
      permissionToShow,
      showAnswersAfterQuiz,
      questions
    } = req.body;
    
    // Parse questions if it's a string
    let parsedQuestions = questions;
    if (typeof questions === 'string') {
      try {
        parsedQuestions = JSON.parse(questions);
      } catch (e) {
        console.error('Error parsing questions JSON:', e);
        return res.redirect(`/teacher/quizzes/${quizId}/edit?error=invalid_questions_format`);
      }
    }
    
    // Validation
    if (!quizName || !Grade || !timeOfQuiz || !parsedQuestions || parsedQuestions.length === 0) {
      return res.redirect(`/teacher/quizzes/${quizId}/edit?error=missing_fields`);
    }
    
    // Ensure questionsToShow is not greater than the number of questions
    const questionCount = parsedQuestions.length;
    const showCount = parseInt(questionsToShow) || questionCount;
    if (showCount > questionCount) {
      return res.redirect(`/teacher/quizzes/${quizId}/edit?error=too_many_questions_to_show`);
    }
    
    // Normalize question field names for consistency
    if (Array.isArray(parsedQuestions)) {
      parsedQuestions = parsedQuestions.map((question, index) => {
        // Generate unique ID for each question
        const questionId = question.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        // Convert from frontend format to Quiz schema format
        const normalizedQuestion = {
          id: questionId,
          title: question.question || question.title || question.questionText || '',
          questionPhoto: question.image || question.questionPhoto || '',
          answer1: question.answers && question.answers[0] ? question.answers[0] : (question.answer1 || ''),
          answer2: question.answers && question.answers[1] ? question.answers[1] : (question.answer2 || ''),
          answer3: question.answers && question.answers[2] ? question.answers[2] : (question.answer3 || ''),
          answer4: question.answers && question.answers[3] ? question.answers[3] : (question.answer4 || ''),
          ranswer: (question.correctAnswer !== undefined ? question.correctAnswer + 1 : (question.ranswer || 1))
        };
        
        // Ensure both image and questionPhoto fields exist for backward compatibility
        if (normalizedQuestion.questionPhoto && !normalizedQuestion.image) {
          normalizedQuestion.image = normalizedQuestion.questionPhoto;
        }
        if (normalizedQuestion.image && !normalizedQuestion.questionPhoto) {
          normalizedQuestion.questionPhoto = normalizedQuestion.image;
        }
        
        return normalizedQuestion;
      });
    }
    
    const updateData = {
      quizName,
      Grade,
      chapterId: chapterId || null,
      questionsCount: questionCount,
      questionsToShow: showCount,
      timeOfQuiz: parseInt(timeOfQuiz),
      prepaidStatus: prepaidStatus === 'true',
      quizPrice: parseFloat(quizPrice) || 0,
      isQuizActive: isQuizActive === 'true',
      permissionToShow: permissionToShow === 'true',
      showAnswersAfterQuiz: showAnswersAfterQuiz === 'true',
      Questions: parsedQuestions,
      videoWillbeOpen: videoWillbeOpen || null,
      updatedAt: new Date()
    };
    
    await Quiz.findByIdAndUpdate(quizId, updateData);
    
    res.redirect(`/teacher/quizzes/${quizId}?success=quiz_updated`);
  } catch (error) {
    console.error('Quiz edit error:', error);
    res.redirect(`/teacher/quizzes/${req.params.quizId}/edit?error=update_failed`);
  }
};

const quiz_delete = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    
    // Delete the quiz
    await Quiz.findByIdAndDelete(quizId);
    
    // Remove quiz info from all students
    await User.updateMany(
      { 'quizesInfo._id': quizId },
      { $pull: { quizesInfo: { _id: quizId } } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Quiz delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const quiz_results_get = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).send('Quiz not found');
    }
    
    // Get chapter info if quiz is associated with a chapter
    let chapter = null;
    if (quiz.chapterId) {
      chapter = await Chapter.findById(quiz.chapterId).select('chapterName chapterGrade');
    }
    
    // Get all students who have attempted this quiz
    const students = await User.find({
      isTeacher: false,
      'quizesInfo._id': quiz._id,
      'quizesInfo.isEnterd': true
    }).select('Username Code Grade totalScore quizesInfo');
    
    // Process student results
    const questionsShown = quiz.questionsToShow || quiz.questionsCount;
    const studentResults = students.map(student => {
      const quizInfo = student.quizesInfo.find(q => q._id.toString() === quiz._id.toString());
      const actualScore = quizInfo ? quizInfo.Score : 0;
      return {
        studentId: student._id,
        studentName: student.Username,
        studentCode: student.Code,
        grade: student.Grade,
        totalScore: student.totalScore || 0,
        quizScore: actualScore,
        quizScoreDisplay: `${actualScore}/${questionsShown}`,
        quizEndTime: quizInfo ? quizInfo.endTime : null,
        quizAnswers: quizInfo ? quizInfo.answers : [],
        quizInProgress: quizInfo ? quizInfo.inProgress : false
      };
    }).filter(result => !result.quizInProgress); // Only show completed quizzes
    
    // Sort by score (highest first)
    studentResults.sort((a, b) => b.quizScore - a.quizScore);
    
    // Calculate statistics
    const totalAttempts = studentResults.length;
    const averageScore = totalAttempts > 0 
      ? studentResults.reduce((sum, s) => sum + s.quizScore, 0) / totalAttempts 
      : 0;
    
    const highestScore = totalAttempts > 0 ? Math.max(...studentResults.map(s => s.quizScore)) : 0;
    const lowestScore = totalAttempts > 0 ? Math.min(...studentResults.map(s => s.quizScore)) : 0;
    
    // Calculate pass rate (students with 60% or higher)
    const passingStudents = studentResults.filter(s => (s.quizScore / questionsShown) >= 0.6).length;
    const passRate = totalAttempts > 0 ? Math.round((passingStudents / totalAttempts) * 100) : 0;
    
    // Get score distribution based on percentage of questions shown
    const scoreDistribution = {
      excellent: studentResults.filter(s => (s.quizScore / questionsShown) >= 0.9).length,
      good: studentResults.filter(s => (s.quizScore / questionsShown) >= 0.8 && (s.quizScore / questionsShown) < 0.9).length,
      average: studentResults.filter(s => (s.quizScore / questionsShown) >= 0.7 && (s.quizScore / questionsShown) < 0.8).length,
      belowAverage: studentResults.filter(s => (s.quizScore / questionsShown) >= 0.6 && (s.quizScore / questionsShown) < 0.7).length,
      failed: studentResults.filter(s => (s.quizScore / questionsShown) < 0.6).length
    };
    
    // Get top 10 performers
    const topPerformers = studentResults.slice(0, 10);
    
    // Calculate question analysis
    const questionAnalysis = [];
    if (quiz.Questions && quiz.Questions.length > 0) {
      for (let i = 0; i < quiz.Questions.length; i++) {
        const question = quiz.Questions[i];
        let correctAnswers = 0;
        let totalAnswers = 0;
        
        studentResults.forEach(student => {
          if (student.quizAnswers && student.quizAnswers[i] !== undefined) {
            totalAnswers++;
            if (student.quizAnswers[i] === question.correctAnswer) {
              correctAnswers++;
            }
          }
        });
        
        questionAnalysis.push({
          questionNumber: i + 1,
          questionText: question.questionText || question.question,
          correctAnswers,
          totalAnswers,
          successRate: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0
        });
      }
    }
    
    res.render('teacher/quiz-results', {
      title: `${quiz.quizName} - نتائج الاختبار`,
      path: req.path,
      teacherData: req.userData || req.teacherData,
      quiz,
      chapter,
      studentResults,
      stats: {
        totalAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        averageScoreDisplay: `${Math.round(averageScore)}/${questionsShown}`,
        highestScore,
        highestScoreDisplay: `${highestScore}/${questionsShown}`,
        lowestScore,
        lowestScoreDisplay: `${lowestScore}/${questionsShown}`,
        completionRate: totalAttempts > 0 ? Math.round((totalAttempts / totalAttempts) * 100) : 0,
        passRate,
        questionsShown
      },
      scoreDistribution,
      topPerformers,
      questionAnalysis,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Quiz results error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const quiz_export = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).send('Quiz not found');
    }
    
    // Get all students who have attempted this quiz
    const students = await User.find({
      isTeacher: false,
      'quizesInfo._id': quiz._id,
      'quizesInfo.isEnterd': true
    }).select('Username Code Grade totalScore quizesInfo phone parentPhone');
    
    // Process student results
    const questionsShown = quiz.questionsToShow || quiz.questionsCount;
    const studentResults = students.map(student => {
      const quizInfo = student.quizesInfo.find(q => q._id.toString() === quiz._id.toString());
      const actualScore = quizInfo ? quizInfo.Score : 0;
      return {
        studentName: student.Username,
        studentCode: student.Code,
        grade: student.Grade,
        phoneNumber: student.phone || '',
        parentPhoneNumber: student.parentPhone || '',
        totalScore: student.totalScore || 0,
        quizScore: actualScore,
        quizScoreDisplay: `${actualScore}/${questionsShown}`,
        quizEndTime: quizInfo ? quizInfo.endTime : null,
        quizInProgress: quizInfo ? quizInfo.inProgress : false
      };
    }).filter(result => !result.quizInProgress);
    
    // Sort by score (highest first)
    studentResults.sort((a, b) => b.quizScore - a.quizScore);
    
    // Create Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Quiz Results');
    
    // Add headers
    worksheet.columns = [
      { header: 'الترتيب', key: 'rank', width: 10 },
      { header: 'اسم الطالب', key: 'name', width: 30 },
      { header: 'كود الطالب', key: 'code', width: 15 },
      { header: 'الصف', key: 'grade', width: 15 },
      { header: 'رقم الهاتف', key: 'phoneNumber', width: 15 },
      { header: 'هاتف الوالد', key: 'parentPhoneNumber', width: 15 },
      { header: `درجة الاختبار (من ${questionsShown})`, key: 'quizScore', width: 20 },
      { header: 'الدرجة الكلية', key: 'totalScore', width: 15 },
      { header: 'وقت الانتهاء', key: 'endTime', width: 20 }
    ];
    
    // Add data rows
    studentResults.forEach((student, index) => {
      worksheet.addRow({
        rank: index + 1,
        name: student.studentName,
        code: student.studentCode,
        grade: student.grade,
        phoneNumber: student.phoneNumber,
        parentPhoneNumber: student.parentPhoneNumber,
        quizScore: student.quizScore,
        totalScore: student.totalScore,
        endTime: student.quizEndTime ? student.quizEndTime.toLocaleString() : ''
      });
    });
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=quiz-results-${quiz.quizName}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Quiz export error:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Delete unused codes
const deleteUnusedCodes = async (req, res) => {
  try {
    const result = await Code.deleteMany({ isUsed: false });
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `تم حذف ${result.deletedCount} كود غير مستخدم`
    });
  } catch (error) {
    console.error('Delete unused codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// API routes for dynamic content loading
const api_videos_by_chapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    
    const videos = [];
    
    // Get videos from chapter lectures
    if (chapter.chapterLectures) {
      chapter.chapterLectures.forEach(lecture => {
        videos.push({
          _id: lecture._id,
          title: lecture.videoTitle || lecture.lectureName,
          type: 'lecture'
        });
      });
    }
    
    // Get videos from chapter summaries
    if (chapter.chapterSummaries) {
      chapter.chapterSummaries.forEach(summary => {
        videos.push({
          _id: summary._id,
          title: summary.videoTitle || summary.lectureName,
          type: 'summary'
        });
      });
    }
    
    // Get videos from chapter solvings
    if (chapter.chapterSolvings) {
      chapter.chapterSolvings.forEach(solving => {
        videos.push({
          _id: solving._id,
          title: solving.videoTitle || solving.lectureName,
          type: 'solving'
        });
      });
    }
    
    res.json({ success: true, videos });
  } catch (error) {
    console.error('API videos by chapter error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const api_quizzes_by_grade = async (req, res) => {
  try {
    const { grade } = req.params;
    
    const quizzes = await Quiz.find({ 
      Grade: grade, 
      isQuizActive: true 
    }).select('quizName _id');
    
    res.json({ success: true, quizzes });
  } catch (error) {
    console.error('API quizzes by grade error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Utility function to sync video access for chapter owners
const sync_video_access_for_chapter_owners = async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    
    // Find the chapter
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    
    // Get all videos in the chapter
    const allVideos = [
      ...(chapter.chapterLectures || []),
      ...(chapter.chapterSummaries || []),
      ...(chapter.chapterSolvings || [])
    ];
    
    // Find all students who have purchased this chapter
    const chapterOwners = await User.find({
      isTeacher: false,
      chaptersPaid: chapterId
    });
    
    let updatedCount = 0;
    
    // For each video, ensure chapter owners have access
    for (const video of allVideos) {
      for (const student of chapterOwners) {
        // Check if student already has access to this video
        const hasAccess = student.hasVideoAccess(video._id);
        
        if (!hasAccess) {
          // Grant access to the video
          await student.grantVideoAccessToChapterOwners(video._id, chapterId);
          updatedCount++;
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} video access records for ${chapterOwners.length} chapter owners`,
      chapterOwners: chapterOwners.length,
      videosCount: allVideos.length,
      updatedCount: updatedCount
    });
  } catch (error) {
    console.error('Sync video access error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  // Dashboard
  dash_get,
  
  // Chapter Management
  chapters_get,
  chapter_create_get,
  chapter_create_post,
  chapter_detail_get,
  chapter_edit_get,
  chapter_edit_post,
  chapter_delete,
  
  // Video Management
  videos_get,
  video_create_get,
  video_create_post,
  video_detail_get,
  video_edit_get,
  video_edit_post,
  video_delete,
  video_analytics,
  
  // Quiz Management
  quizzes_get,
  quiz_create_get,
  quiz_create_post,
  quiz_detail_get,
  quiz_edit_get,
  quiz_edit_post,
  quiz_delete,
  quiz_results_get,
  quiz_export,
  chapter_quiz_create_get,
  chapter_quiz_create_post,
  
  // PDF Management
  pdfs_get,
  pdf_create_get,
  pdf_create_post,
  pdf_edit_get,
  pdf_edit_post,
  pdf_delete,
  chapter_pdf_create_get,
  chapter_pdf_create_post,
  
  // Student Management
  students_get,
  student_requests_get,
  student_detail_get,
  student_approve,
  student_reject,
  student_edit,
  student_delete,
  student_remove_chapter,
  students_search,
  students_export,
  
  // Code Management
  codes_get,
  codes_create_get,
  codes_create_post,
  codes_upload_excel,
  codes_manage_get,
  codes_search,
  codes_export,
  code_delete,
  generate_chapter_codes,
  generate_video_codes,
  generate_quiz_codes,
  generate_general_codes,
  
  // Attendance Management
  attendance_get,
  attendance_create_get,
  attendance_create_post,
  attendance_manage_get,
  attendance_mark,
  attendance_delete,
  attendance_export,
  
  // Analytics
  analytics_get,
  analytics_students,
  analytics_videos,
  analytics_quizzes,
  analytics_revenue,
  
  // Communication
  communication_get,
  whatsapp_get,
  whatsapp_send,
  send_grades,
  
  // Settings
  settings_get,
  settings_post,
  
  // API
  api_chapters_get,
  api_videos_get,
  api_students_by_grade,
  api_dashboard_analytics,
  
  // Auth
  logout,
  increase_student_watches,
  
  // Delete unused codes
  deleteUnusedCodes,
  
  // API routes for dynamic content loading
  api_videos_by_chapter,
  api_quizzes_by_grade,
  
  // Utility functions
  sync_video_access_for_chapter_owners
};
