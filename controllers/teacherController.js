const Quiz = require("../models/Quiz");
const User = require("../models/User");
const Chapter = require("../models/Chapter");
const Code = require("../models/Code");
const mongoose = require('mongoose');





const Excel = require('exceljs');

const { v4: uuidv4 } = require('uuid')




const dash_get = (req, res) => {
//   const idsToKeep = [
//     "65e4cfe6022bba8f9ed4a80f",
//     "65e4d024022bba8f9ed4a811",
//     "65e4d045022bba8f9ed4a813",
//     "65eb2856a76c472e4fa64fd3",
//     "65e8fd8449a3eecaa4593bd3"
// ];
//   User.deleteMany({ _id: { $nin: idsToKeep } })
//   .then(result => {
//       console.log(`${result.deletedCount} users deleted.`);
//   })
//   .catch(error => {
//       console.error("Error deleting users:", error);
//   });

  res.render("teacher/dash", { title: "DashBoard", path: req.path });
};



const myStudent_get = (req, res) => {
  res.render("teacher/myStudent", { title: "Mystudent", path: req.path, userData: null });
};

const homeWork_get = (req, res) => {
  res.render("teacher/homeWork", { title: "HomeWork", path: req.path });
};




// const studentsRequests_get = (req, res) => {
//   res.render("teacher/studentsRequests", { title: "StudentsRequests", path: req.path });
// };





// =================================================== Add Video ================================================ // 


const addVideo_get = (req, res) => {

  res.render("teacher/addVideo", { title: "AddVideo", path: req.path, chaptersData: null });
};

const chapter_post = (req, res) => {
  const {
    chapterName, chapterGrade, chapterAccessibility, chapterPrice,ARorEN
  } = req.body

  const chapter = new Chapter({
    chapterName: chapterName || "",
    chapterGrade: chapterGrade || "",
    chapterAccessibility: chapterAccessibility || " ",
    chapterPrice: chapterPrice || 0,
    ARorEN:ARorEN,
    chapterLectures: [],
    chapterSummaries: [],
    chapterSolvings: [],
  })

  if (!chapterName || !chapterGrade || !chapterAccessibility || !ARorEN) {
    return res.status(400).send('Missing required fields');
  }

  chapter.save().then((result) => {
    console.log(result._id)
    res.redirect('/teacher/addVideo')
  })
}

const getAllChapters = async (req, res) => {
  try {
    const data = []
    const { chapterGrade } = req.body
    await Chapter.find({
      chapterGrade: chapterGrade
    }).then((result) => {
      console.log(result)
      result.forEach((cahpter) => {
        data.push({
          chapterName: cahpter.chapterName,
          chapterId: cahpter._id,
          chapterLectures: cahpter.chapterLectures
        })

      })
      res.status(200).render("teacher/addVideo", { title: "AddVideo", path: req.path, chaptersData: data });


    })
  } catch (error) {
    console.log(error)
  }

}

const addVideo_post = async (req, res) => {
  try {
    const {
      ChaptersIds,
      VideoType,
      videoTitle,
      paymentStatus,
      prerequisites,
      permissionToShow,
      AccessibleAfterViewing,
      videoAllowedAttemps,
      videoPrice,
      imgURL,
      videoURL,

    } = req.body;

    // Validate input data
    if (!ChaptersIds || !VideoType || !videoTitle || !paymentStatus) {
      throw new Error('Missing required fields');
    }

    if(imgURL=="" || videoURL==""){
      throw new Error('Missing required fields');
    }
    // Generate unique ID for video object
    const videoId = uuidv4();

    const currentDate = new Date();
    // Create video object
    const VideoObject = {
      _id: videoId,
      videoTitle: videoTitle || "",
      paymentStatus: paymentStatus || "",
      prerequisites: prerequisites || "",
      permissionToShow: permissionToShow || "",
      AccessibleAfterViewing: AccessibleAfterViewing || "",
      videoAllowedAttemps: +videoAllowedAttemps || 0,
      videoPrice: videoPrice || 0,
      videoURL: videoURL || "",
      imgURL: imgURL || ""
    };

    const videosInfo = {}
    videosInfo['_id'] = videoId
    videosInfo['prerequisites'] = prerequisites
    videosInfo['createdAt'] = currentDate
    videosInfo['updatedAt'] = currentDate
    videosInfo['fristWatch'] = null
    videosInfo['lastWatch'] = null
    videosInfo['videoName'] = videoTitle


    if (paymentStatus == "Pay") {
      videosInfo['videoPurchaseStatus'] = false
      videosInfo['isVideoPrepaid'] = true
    } else {
      videosInfo['videoPurchaseStatus'] = true
      videosInfo['isVideoPrepaid'] = false
    }
    if (prerequisites == "WithHw") {
      videosInfo['isUploadedHWApproved'] = false
      videosInfo['videoAllowedAttemps'] = +videoAllowedAttemps
      videosInfo['numberOfWatches'] = 0
      videosInfo['isUserUploadPerviousHWAndApproved'] = false
      videosInfo['isHWIsUploaded'] = false
      videosInfo['isUserEnterQuiz'] = true
      videosInfo['accessibleAfterViewing'] = AccessibleAfterViewing
    } else if (prerequisites == "WithExam") {
      videosInfo['isUploadedHWApproved'] = false
      videosInfo['videoAllowedAttemps'] = +videoAllowedAttemps
      videosInfo['numberOfWatches'] = 0
      videosInfo['isUserUploadPerviousHWAndApproved'] = true
      videosInfo['isHWIsUploaded'] = false
      videosInfo['isUserEnterQuiz'] = false
      videosInfo['accessibleAfterViewing'] = ''
    } else if (prerequisites == "WithExamaAndHw") {
      videosInfo['isUploadedHWApproved'] = false
      videosInfo['videoAllowedAttemps'] = +videoAllowedAttemps
      videosInfo['numberOfWatches'] = 0
      videosInfo['isUserUploadPerviousHWAndApproved'] = false
      videosInfo['isHWIsUploaded'] = false
      videosInfo['isUserEnterQuiz'] = false
      videosInfo['accessibleAfterViewing'] = AccessibleAfterViewing
    } else {
      videosInfo['isUploadedHWApproved'] = false
      videosInfo['videoAllowedAttemps'] = +videoAllowedAttemps
      videosInfo['numberOfWatches'] = 0
      videosInfo['isUserUploadPerviousHWAndApproved'] = true
      videosInfo['isHWIsUploaded'] = false
      videosInfo['isUserEnterQuiz'] = true
      videosInfo['accessibleAfterViewing'] = ''

    }



    // Update chapter with video object
    await Chapter.findOneAndUpdate(
      { _id: ChaptersIds },
      { $push: { [`${VideoType}`]: VideoObject } }
    ).then((resultChapter) => {
      User.updateMany({ Grade: resultChapter.chapterGrade },
        {
          $push: {
            videosInfo: videosInfo
          }
        },
        {
          upsert: true
        }
      ).then((result) => {

        res.status(201).redirect('/teacher/addVideo');
      }).catch((error) => {
        res.send("error can you refresh and try again")
      })
    })


  } catch (error) {
    // Handle errors
    console.error('Error adding video:', error.message);
    res.status(500).redirect('/teacher/addVideo?error=true');
  }


}


// =================================================== END ADD Videos ================================================ // 





// =================================================== Start Handle Videos ================================================ // 


const handleVideos_get = (req, res) => {
  res.render("teacher/handleVideos", { title: "Handle Videos", path: req.path, chaptersData: null, chapterData: null, videoData: null, nextPage: null, previousPage: null });
};



const getAllChaptersInHandle = async (req, res) => {
  try {
    const data = []
    const { chapterGrade } = req.body
    await Chapter.find({
      chapterGrade: chapterGrade
    }).then((result) => {

      result.forEach((cahpter) => {
        data.push({
          chapterName: cahpter.chapterName,
          chapterId: cahpter._id,
          chapterLectures: cahpter.chapterLectures
        })

      })
      res.status(200).render("teacher/handleVideos", { title: "AddVideo", path: req.path, chaptersData: data, chapterData: null, videoData: null, nextPage: null, previousPage: null });


    })
  } catch (error) {
    console.log(error)
  }

}



let ChapterId
const getChapterDataToEdit = async (req, res) => {
  try {
    let data = Object()
    const { ChaptersIds } = req.body
    ChapterId = ChaptersIds
    await Chapter.findById(ChaptersIds).then((result) => {
      data = {
        chapterName: result.chapterName,
        chapterAccessibility: result.chapterAccessibility,
        chapterPrice: result.chapterPrice,
        chapterLectures: result.chapterLectures,
        chapterSummaries: result.chapterSummaries,
        chapterSolvings: result.chapterSolvings
      }

      res.status(200).render("teacher/handleVideos", { title: "AddVideo", path: req.path, chapterData: data, chaptersData: null, videoData: null, nextPage: null, previousPage: null });


    })
  } catch (error) {
    console.log(error)
  }

}



const editChapterData = async (req, res) => {
  try {
    const { chapterName, chapterAccessibility, chapterPrice } = req.body
    const updateData = {
      chapterName: chapterName,
      chapterAccessibility: chapterAccessibility,
      chapterPrice: chapterPrice, // Example field to update
    };
    await Chapter.findByIdAndUpdate(ChapterId, updateData, { new: true })
      .then((result) => {
        res.status(200).redirect("/teacher/handleVideos");
        ChapterId = ""

      }).catch((err) => {
        console.log(err)
      })
  } catch (error) {
    console.log(error)
  }

}

let VideoID
let videoType
const getSingleVideoAllData = async (req, res) => {
  try {
    VideoID = req.params.videoCode;
    let videoData;
    let perPage = 50;
    let page = req.query.page || 1;
    console.log(page)
    Chapter.findOne({ _id: ChapterId }, {
      chapterLectures: { $elemMatch: { _id: VideoID } },
      chapterSummaries: { $elemMatch: { _id: VideoID } },
      chapterSolvings: { $elemMatch: { _id: VideoID } },
      chapterGrade: 1
    }).then(async (result) => {
      if (!result) {
        // Handle the case where the Chapter document is not found
        console.log('Chapter not found');
        return res.status(404).send('Chapter not found');
      }

      if (result['chapterLectures'].length > 0) {
        videoData = result['chapterLectures'][0];
        videoType = 'chapterLectures';
      } else if (result['chapterSummaries'].length > 0) {
        videoData = result['chapterSummaries'][0];
        videoType = 'chapterSummaries';
      } else {
        videoData = result['chapterSolvings'][0];
        videoType = 'chapterSolvings';
      }

      const data = [];
      await Chapter.find({ chapterGrade: result.chapterGrade }).then((result) => {
        result.forEach((cahpter) => {
          data.push({
            chapterName: cahpter.chapterName,
            chapterId: cahpter._id,
            chapterLectures: cahpter.chapterLectures
          });
        });
      });

      // let totalWatches = 0;
      // User.find({videosInfo: { $elemMatch: { _id: VideoID , numberOfWatches: { $gt: 0 } }}},{Username:1,Code:1,videosInfo:1}).then((result)=>{

      //   result.forEach(user => {
      //     user.videosInfo.forEach(videoInfo => {
      //       if (videoInfo._id === VideoID) {
      //         totalWatches += videoInfo.numberOfWatches;
      //       }
      //     });
      //   });

      // })

      await User.aggregate([
        {
          $match: {
            "videosInfo": {
              $elemMatch: {
                "_id": VideoID,
                "numberOfWatches": { $gt: 0 }
              }
            }
          }
        },
        {
          $project: {
            "Username": 1,
            "Code": 1,
            "videosInfo": 1
          }
        },
        {
          $sort: {
            "createdAt": 1
          }
        }
      ])
        .skip(perPage * page - perPage)
        .limit(perPage)
        .exec()
        .then(async (result) => {
          result.forEach(user => {
            // Filter the videosInfo array for each user
            user.videosInfo = user.videosInfo.filter(videoInfo => videoInfo._id === VideoID);

          });



          // Now you can add totalWatches to your videoData object
          videoData['totalWatches'] = result.length;
          videoData['VideoID'] = VideoID;
          videoData['usersWatchedData'] = result;

          const count = await User.countDocuments({});
          const nextPage = parseInt(page) + 1;
          const hasNextPage = nextPage <= Math.ceil(count / perPage);
          const hasPreviousPage = page > 1; // Check if current page is greater than 1
          res.render("teacher/handleVideos", {
            title: "AddVideo",
            path: req.path,
            chapterData: null,
            chaptersData: data,
            videoData: videoData,

            // current: page,
            nextPage: hasNextPage ? nextPage : null,
            previousPage: hasPreviousPage ? page - 1 : null // Calculate previous page
          });
        })
        .catch(error => {
          console.error(error);
          // Handle the error here
        });


    }).catch((error) => {
      console.error(error);
    });
  } catch (error) {
    console.error(error);
  }
};


const updateVideoData = async (req, res) => {
  const {
    videoId,
    videoTitle,
    paymentStatus,
    prerequisites,
    permissionToShow,
    videoAllowedAttemps,
    AccessibleAfterViewing,
    videoPrice,
  } = req.body;

  try {

    const result = await Chapter.findOneAndUpdate(
      {
        _id: ChapterId,
        [`${videoType}._id`]: VideoID
      },
      {
        $set: {
          [`${videoType}.$.videoTitle`]: videoTitle || "",
          [`${videoType}.$.paymentStatus`]: paymentStatus || "",
          [`${videoType}.$.prerequisites`]: prerequisites || "",
          [`${videoType}.$.permissionToShow`]: permissionToShow || "",
          [`${videoType}.$.videoAllowedAttemps`]: +videoAllowedAttemps || 0,
          [`${videoType}.$.AccessibleAfterViewing`]: AccessibleAfterViewing || "",
          [`${videoType}.$.videoPrice`]: videoPrice || 0,
        }
      },
      {
        new: true
      }
    );




    User.updateMany(
      { Grade: result.chapterGrade },
      {
        $set: {
          'videosInfo.$[elem].videoPurchaseStatus': paymentStatus === "Pay" ? false : true,
          'videosInfo.$[elem].isVideoPrepaid': paymentStatus === "Pay" ? true : false,
          'videosInfo.$[elem].prerequisites': prerequisites,
          'videosInfo.$[elem].isUploadedHWApproved': prerequisites !== "WithHw" && prerequisites !== "WithExamaAndHw" ? true : false,
          'videosInfo.$[elem].videoAllowedAttemps': +videoAllowedAttemps,
          'videosInfo.$[elem].isUserUploadPerviousHWAndApproved': prerequisites !== "WithHw" && prerequisites !== "WithExamaAndHw" ? true : false,
          'videosInfo.$[elem].isHWIsUploaded': false,
          'videosInfo.$[elem].accessibleAfterViewing': AccessibleAfterViewing,
          'videosInfo.$[elem].isUserEnterQuiz': prerequisites !== "WithExam" && prerequisites !== "WithExamaAndHw" ? true : false
        }
      },
      {

        new: true,
        arrayFilters: [{ 'elem._id': VideoID }]
      }
    ).then(() => {
      res.status(201).redirect(`/teacher/handleVideo/${VideoID}`);

    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating video data");
  }
}


const addViewsToStudent = async (req, res) => {
  const videoId = req.params.VideoID;
  const userId = req.query.UserId;
  const { NumberOfWatchesWillAdded } = req.body;
  console.log(videoId)
  User.findOneAndUpdate(
    {
      _id: userId,

    },
    {

      $inc: {
        'videosInfo.$[elem].videoAllowedAttemps': +NumberOfWatchesWillAdded
      }
    },
    {
      new: true,
      arrayFilters: [{ 'elem._id': videoId }] // Match the specific videoId within the videosInfo array
    }
  )
    .then((result) => {
      console.log(result);
      res.redirect(`/teacher/handleVideo/${VideoID}`);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("Internal Server Error");
    });
}


const convertToExcel = async (req, res) => { 
  try {
    const videoId = req.params.VideoID;

    // Fetch user data
    const users = await User.aggregate([
      {
        $match: {
          "videosInfo": {
            $elemMatch: {
              "_id": videoId,
              "numberOfWatches": { $gt: 0 }
            }
          }
        }
      },
      {
        $project: {
          "Username": 1,
          "Code": 1,
          "phone": 1,
          'parentPhone': 1,
        }
      },
      {
        $sort: {
          "createdAt": 1
        }
      }
    ])
    console.log(users)
    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Users Data');

    const headerRow = worksheet.addRow(['#', 'User Name', 'Student Code', 'Student Phone', 'Parent Phone']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };

    // Add user data to the worksheet with alternating row colors
    let c = 0;
    users.forEach(user => {
      c++;
      const row = worksheet.addRow([c, user.Username, user.Code, user.phone, user.parentPhone]);
      // Apply alternating row colors
      if (c % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
      }
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users_data.xlsx');

    // Send Excel file as response
    res.send(excelBuffer)


  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).send('Error generating Excel file');
  }
};




// =================================================== END Handle Videos ================================================ // 






// =================================================== Student Requests ================================================ // 




let query
const studentsRequests_get = async (req, res) => {
  try {
    const {
      Grade,
      studentPlace,

    } = req.query
    let grade = Grade || "Grade1"
    let StudentPlace = studentPlace || "All"
    // Define the base query object
    query = { Grade: grade };

    // If studentPlace is not "All", include it in the query

    if (StudentPlace !== "All") {
      query.place = StudentPlace;
    }

    let perPage = 50;
    let page = req.query.page || 1;

    await User.find(query, { Username: 1, Code: 1, createdAt: 1, updatedAt: 1, subscribe: 1 })
      .sort({ 'subscribe': 1, 'createdAt': 1 })
      .skip(perPage * page - perPage)
      .limit(perPage)
      .exec()

      .then(async (result) => {

        const count = await User.countDocuments({});
        const nextPage = parseInt(page) + 1;
        const hasNextPage = nextPage <= Math.ceil(count / perPage);
        const hasPreviousPage = page > 1; // Check if current page is greater than 1

        res.render("teacher/studentsRequests",
          {
            title: "StudentsRequests",
            path: req.path,
            modalData: null,
            modalDelete :null,
            studentsRequests: result,
            studentPlace: StudentPlace,
            Grade: grade,
            isSearching: false,
            nextPage: hasNextPage ? nextPage : null,
            previousPage: hasPreviousPage ? page - 1 : null // Calculate previous page
          });

      })
  } catch (error) {
    console.log(error)
  }

};


const searchForUser = async (req, res) => {
  const { searchBy, searchInput } = req.body
  try {

    await User.find({ [`${searchBy}`]: searchInput }, { Username: 1, Code: 1, createdAt: 1, updatedAt: 1, subscribe: 1 })
      .then((result) => {
        res.render("teacher/studentsRequests",
          {
            title: "StudentsRequests",
            path: req.path,
            modalData: null,
            modalDelete :null,
            studentsRequests: result,
            studentPlace: 'All',
            Grade: "Grade1",
            isSearching: true,
            nextPage: null,
            previousPage: null // Calculate previous page
          });
      })
  } catch (error) {

  }

}


const converStudentRequestsToExcel = async (req, res) => {
  try {
    // Fetch user data
    const users = await User.find(query, { Username: 1, Email: 1, gov: 1, Markez: 1, gender: 1, phone: 1, WhatsApp: 1, parentPhone: 1, place: 1, Code: 1, createdAt: 1, updatedAt: 1, subscribe: 1 });

    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Users Data');

    const headerRow = worksheet.addRow(['#', 'User Name', 'Student Code', 'Student Phone',  'Parent Phone', 'Government', 'Markez', 'createdAt', 'subscribe']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };

    // Add user data to the worksheet with alternating row colors
    let c = 0;
    users.forEach(user => {
      c++;
      const row = worksheet.addRow([c, user.Username, user.Code, user.phone, user.WhatsApp, user.parentPhone, user.gov, user.Markez, user.createdAt.toLocaleDateString(), user.subscribe]);

      // Apply different fill color based on subscription status
      if (!user.subscribe) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000' } }; // Red fill for non-subscribed users
      } else if (c % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } }; // Alternate fill color for subscribed users
      }
    });


    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="UsersData.xlsx"`);

    // Send Excel file as response
    res.send(excelBuffer);

  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).send("An error occurred while generating Excel file.");
  }
}


const getSingleUserAllData = async (req, res) => {
  try {
    const studentID = req.params.studentID
    await User.findOne({ '_id': studentID }, { Username: 1, Email: 1, gov: 1, Markez: 1, gender: 1, phone: 1, WhatsApp: 1, parentPhone: 1, place: 1, Code: 1, createdAt: 1, updatedAt: 1, subscribe: 1,PasswordNotHashed:1 })
      .then((result) => {
        res.render("teacher/studentsRequests",
          {
            title: "StudentsRequests",
            path: req.path,
            modalData: result,
            modalDelete:null,
            studentsRequests: null,
            studentPlace: 'All',
            Grade: "Grade1",
            isSearching: false,
            nextPage: null,
            previousPage: null // Calculate previous page
          });
      })
  } catch (error) {

  }
}


const updateUserData = async (req, res) => {
  try {
    const { Username, Email, phone, parentPhone, WhatsApp, gov, Markez, subscribe } = req.body;
    const studentID = req.params.studentID;
    let Subscribe
    if (subscribe == "true") {
      Subscribe = true
    } else {
      Subscribe = false
    }
    // Assuming you have a User model and you're using Mongoose
    const updatedUser = await User.findOneAndUpdate(
      { _id: studentID },
      { Username: Username, Email: Email, phone: phone, parentPhone: parentPhone, WhatsApp: WhatsApp, gov: gov, Markez: Markez, subscribe: Subscribe },
      { new: true } // To return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Redirect to the desired page after successful update
    res.status(201).redirect('/teacher/studentsRequests');
  } catch (error) {
    // Handle errors appropriately
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const confirmDeleteStudent = async (req, res) => {
  try {
    const studentID = req.params.studentID;
    res.render("teacher/studentsRequests",
      {
        title: "StudentsRequests",
        path: req.path,
        modalData: null,
        modalDelete:studentID ,
        studentsRequests: null,
        studentPlace: 'All',
        Grade: "Grade1",
        isSearching: false,
        nextPage: null,
        previousPage: null // Calculate previous page
      });
  }


  catch (error) {
  }

}


const DeleteStudent = async (req, res) => {
  try {
    const studentID = req.params.studentID;
    if (!studentID) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if(studentID =="668138aeebc1138a4277c47a" || studentID =='668138edebc1138a4277c47c' || studentID =='66813909ebc1138a4277c47e'){
      return res.status(400).json({ error: 'You can not delete this user' });
      
    }
    await User.findByIdAndDelete(studentID).then((result) => {
      res.status(200).redirect('/teacher/studentsRequests');
    })
  } catch (error) {
    console.log(error)
  }
}
// =================================================== END Student Requests ================================================ // 



// ===================================================  MyStudent ================================================ // 


const searchToGetOneUserAllData = async (req, res) => {
  const { searchBy, searchInput } = req.query


  try {
    await User.findOne({ [`${searchBy}`]: searchInput })
      .then((result) => {
        res.render("teacher/myStudent",
          {
            title: "Mystudent",
            path: req.path,
            userData: result
          });

      })

  } catch (error) {

  }
}

const convertToExcelAllUserData = async (req, res) => {
  const { studetCode } = req.params
  console.log(studetCode)
  try {

    await User.findOne({ "Code": +studetCode })
      .then(async (user) => {
        // Create a new Excel workbook
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');
        const Header = worksheet.addRow([`بيانات الطالب ${user.Username} `]);
        Header.getCell(1).alignment = { horizontal: 'center' }; // Center align the text
        Header.font = { bold: true, size: 16 };
        Header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
        worksheet.mergeCells('A1:H1');
        worksheet.addRow()
        const headerRowUserBasicInfo = worksheet.addRow(['اسم الطالب', 'كود الطالب ', 'رقم هاتف الطالب', 'رقم هاتف ولي الامر']);
        headerRowUserBasicInfo.font = { bold: true };
        headerRowUserBasicInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };

        // Add user data to the worksheet with alternating row colors

        const rowUserBasicInfo = worksheet.addRow([user.Username, user.Code, user.phone, user.parentPhone]);
        rowUserBasicInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };


        const headerRowUserVideoInfo = worksheet.addRow(['#', 'اسم الفيديو', 'عدد مرات المشاهده', 'عدد المشاهدات المتبقيه ', 'تاريخ اول مشاهده ', 'تاريخ اخر مشاهده ', 'رفع الواجب ', 'حل الامتحان ', 'حاله الشراء ']);
        headerRowUserVideoInfo.font = { bold: true };
        headerRowUserVideoInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '9fea0c' } };
        let c = 0;

        user['videosInfo'].forEach(data => {
          c++;
          let homeWork, Exam
          if (data.prerequisites == "WithOutExamAndHW") {
            homeWork = "لا يوجد"
            Exam = "لا يوجد"
          } else if (data.prerequisites == "WithExamaAndHw") {
            homeWork = data.isHWIsUploaded ? "تم الرفع" : "لم يُرفع"
            Exam = data.isUserEnterQuiz ? "تم الدخول" : "لم يدخل"

          } else if (data.prerequisites == "WithHw") {
            homeWork = data.isHWIsUploaded ? "تم الرفع" : "لم يُرفع"

          } else {

            Exam = data.isUserEnterQuiz ? "تم الدخول" : "لم يدخل"
          }


          const headerRowUserVideoInfo = worksheet.addRow([c, data.videoName, data.numberOfWatches, data.videoAllowedAttemps, new Date(data.fristWatch).toLocaleDateString()|| "لم يشاهد بعد",  new Date(data.lastWatch).toLocaleDateString()|| "لم يشاهد بعد", homeWork, Exam, data.isVideoPrepaid ? data.videoPurchaseStatus ? "تم الشراء" : "لم يتم الشراء" : "الفيديو مجاني"]);

          if (c % 2 === 0) {
            headerRowUserVideoInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
          }


        })
        const headerRowUserQuizInfo = worksheet.addRow(['#', 'اسم الامتحان', 'تاريخ الحل ', 'مده الحل ', ' درجه الامتحان ', 'حاله الشراء ']);
        headerRowUserQuizInfo.font = { bold: true };
        headerRowUserQuizInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10a1c2' } };

        let cq = 0
        user['quizesInfo'].forEach(data => {
          cq++
          const headerRowUserQuizInfo = worksheet.addRow([cq, data.quizName, new Date(data.solvedAt).toLocaleDateString()|| "لم يحل", data.solveTime || "لم يحل", data.questionsCount + "/" + data.Score, data.isQuizPrepaid ? data.quizPurchaseStatus ? "تم الشراء" : "لم يتم الشراء" : "الامتحان مجاني"]);
          if (cq % 2 === 0) {
            headerRowUserQuizInfo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
          }


        })

        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Set response headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=users_data.xlsx');

        // Send Excel file as response
        res.send(excelBuffer)
      }).catch((error) => {
        console.log(error)
      })

  } catch (error) {
    console.log(error)
  }
}

// =================================================== END MyStudent ================================================ // 






// =================================================== Add Quiz ================================================ // 

let grade
let quizQuestions = [];
let getQuizAllData
const addQuiz_get = async (req, res) => {
  const videoData = []
  const quizData = []
  getQuizAllData = null
  quizQuestions = []
  const { Grade } = req.query
  grade = Grade
  await Chapter.find({
    chapterGrade: Grade
  }).then(async (result) => {

    result.forEach((cahpter) => {
      videoData.push({
        chapterLectures: cahpter.chapterLectures
      })

    })

    await Quiz.find({
      Grade: Grade
    }).then((result) => {

      result.forEach((quiz) => {
        quizData.push({
          quizName: quiz.quizName,
          _id: quiz._id
        })
      })

    })

  })

  res.render("teacher/addQuiz", { title: "AddQuiz", path: req.path, questions: quizQuestions, videoData: videoData, quizData: quizData, Grade: Grade, getQuizAllData: getQuizAllData || null });
};

const addQuestion = (req, res) => {

  const {
    Qtitle,
    answer1,
    answer2,
    answer3,
    answer4,
    ranswer,
    questionPhoto,
    
  } = req.body;

  const Code = Math.floor(Math.random() * 1000) + 6000;

  let question = {};

  question = {
    questionPhoto:questionPhoto,
    qNumber: quizQuestions.length + 1,
    title: Qtitle,
    answer1: answer1,
    answer2: answer2,
    answer3: answer3,
    answer4: answer4,
    ranswer: ranswer,
    code: +Code
  };

  quizQuestions.push(question);
  res.render("teacher/addQuiz", { title: "AddQuiz", path: req.path, questions: quizQuestions, videoData: null, quizData: null, Grade: null, getQuizAllData: getQuizAllData || null });

};

const deleteQuestion = (req, res) => {
  const id = req.params.code;
  console.log(id)
  // Find the index of the question with the matching code
  const indexToDelete = quizQuestions.findIndex((question) => question.code === parseInt(id));

  if (indexToDelete !== -1) {
    // If a question with the matching code is found, remove it from the array
    quizQuestions.splice(indexToDelete, 1);
  }

  res.render("teacher/addQuiz", { title: "AddQuiz", path: req.path, questions: quizQuestions, videoData: null, quizData: null, Grade: null, getQuizAllData: getQuizAllData || null });
}

const updateQuestion = (req, res) => {
  const {
    Qtitle,
    answer1,
    answer2,
    answer3,
    answer4,
    ranswer,
    code,
    questionPhoto,
  } = req.body;

  // Find the index of the question with the matching code
  const indexToUpdate = quizQuestions.findIndex((question) => question.code === parseInt(code));

  if (indexToUpdate !== -1) {
    // If a question with the matching code is found, update its properties
    quizQuestions[indexToUpdate] = {
      questionPhoto:questionPhoto,
      title: Qtitle,
      qNumber : quizQuestions[indexToUpdate].qNumber,
      answer1: answer1,
      answer2: answer2,
      answer3: answer3,
      answer4: answer4,
      ranswer: ranswer,
      code: +code,
    };
  }

  res.render("teacher/addQuiz", { title: "AddQuiz", path: req.path, questions: quizQuestions, videoData: null, quizData: null, Grade: null, getQuizAllData: getQuizAllData || null });

};

const getQuizAlldata = async (req, res) => {


  try {
    const { quizId } = req.query
   
    await Quiz.findOne({ '_id': quizId })
      .then((result) => {

        quizQuestions = result['Questions']
        getQuizAllData = result
        res.render("teacher/addQuiz", { title: "AddQuiz", path: req.path, questions: result['Questions'], videoData: null, quizData: null, Grade: null, getQuizAllData: getQuizAllData || null });

      })
  } catch (error) {

  }
}

const deleteQuiz = (req, res) => {
  try {
    const { quizID } = req.params
    console.log( quizID)
    let QuizID = new mongoose.Types.ObjectId(quizID);
    User.updateMany(
      { "quizesInfo._id": QuizID }, // Match users where the quiz is present in quizesInfo array
      { $pull: { quizesInfo: { _id: QuizID } } } // Pull the quiz from quizesInfo array
    ).then((result) => {
      console.log(result)
      Quiz.findByIdAndDelete({ '_id': quizID }).then(() => {  
        res.redirect('/teacher/addQuiz')
      }).catch
      ((error) => {
        res.send(error.message)
      })
     

    })

  } catch (error) {

  }
}

const updateQuiz = (req, res) => {
  try {
    const { quizID } = req.params
    const { quizStatus, permissionToShow, quizName, timeOfQuiz } = req.body
    console.log(quizID, quizStatus, permissionToShow)
    let updatedDate = {}
    if (quizStatus == "Active") {
      updatedDate['isQuizActive'] = true
    } else {
      updatedDate['isQuizActive'] = false
    }

    if (permissionToShow == "apper") {
      updatedDate['permissionToShow'] = true
    } else {
      updatedDate['permissionToShow'] = false

    }
    updatedDate['Questions'] = quizQuestions
    updatedDate['quizName'] = quizName
    updatedDate['timeOfQuiz'] = timeOfQuiz
    Quiz.findByIdAndUpdate({ '_id': quizID }, updatedDate)
      .then(() => {

        
        res.redirect('/teacher/addQuiz')
      })
  } catch (error) {

  }
}

const quizSubmit = (req, res) => {
  const errors = {};
  const {
    videoWillbeOpen,
    Grade,
    timeOfQuiz,
    quizName,
    prepaidStatus,

  } = req.body;

  if (!Grade) {
    errors.gradeError = "- يرجي اختيار الصف الدراسي"
  }
  if (!quizName) {
    errors.nameError = "- يرجي إدخال عنوان الامتحان";
  }
  // if (!questionsCount) {
  //   errors.countError = "- يرجي تعبئة حقل عدد الأسئلة ";
  // }
  if (quizQuestions.length == 0) {
    errors.timeError = "يجب اضافه سؤال واحد علي الاقل"

  }
  if (!(timeOfQuiz)) {
    errors.timeError = "- يرجي تعبئه حقل وقت الامتحان"
  }

  if (Object.keys(errors).length > 0) {
    return res.render("teacher/addQuiz", { title: "AddQuiz", path: req.path, questions: quizQuestions, errors: errors, videsPrerequested: null, quizData: null, Grade: null,getQuizAllData:getQuizAllData,videoData:null });

  }


 



  const quiz = new Quiz({
    quizName: quizName,
    questionsCount: +quizQuestions.length,
    timeOfQuiz: timeOfQuiz,
    videoWillbeOpen: videoWillbeOpen || null,
    Grade: Grade,
    isQuizActive: true,
    permissionToShow: true,
    Questions: quizQuestions,
    prepaidStatus: prepaidStatus == "Pay" ? true : false
  });

  quiz
    .save()
    .then((result) => {
      User.updateMany({ Grade: Grade },
        {
          $push: {
            quizesInfo: {
              _id: result._id,
              quizName: quizName,
              isEnterd: false,
              inProgress: false,
              solvedAt: null,
              solveTime: null,
              isQuizPrepaid: prepaidStatus == "Pay" ? true : false,
              quizPurchaseStatus: prepaidStatus == "Pay" ? false : true,
              answers: [],
              questionsCount: +quizQuestions.length,
              Score: 0,
            }
          }
        },
        {
          upsert: true
        }
      ).then((result) => {
        console.log(result)
      try {


        const message = `
        تم اضافة امتحان جديد علي المنصه 
اسم الامتحان : ${quizName}
مده الامتحان : ${timeOfQuiz}
عدد الاسئله : ${+quizQuestions.length} 
        `;



const twilio = require('twilio');
const client = new twilio('AC9dc144cf25dc8648bd045f464adf6a7a', 'da561a4e33fdb8806cf71e1d6474a83e');

// Define the WhatsApp group ID and message
const groupID = 'YOUR_WHATSAPP_GROUP_ID';

// Send the message to the WhatsApp group
client.messages.create({
    from: 'whatsapp:+14155238886', // Twilio WhatsApp number
    body: message,
    to: `120363224062729273` // WhatsApp group ID
})
.then(message => console.log(`Message sent: ${message.sid}`))
.catch(error => console.error(error));

      } catch (error) {
        console.log(error)
      }

      quizQuestions = []
        res.redirect("/teacher/addQuiz")
      })



    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("An error occurred while saving the quiz.");
    });


}

// =========================================== END Add Quiz =================================================== //




// =================================================== Handle Quizzes ================================================ // 

let quizGrade
let QuizId
const handleQuizzes = (req, res) => {
  quizGrade = null
  QuizId = null
  res.render("teacher/handleQuizzes", { title: "handleQuizzes", path: req.path, quizzesNamesData: null, studetsData: null, quizID: null, nextPage: null, previousPage: null, isSearching: false });

}

const getQuizzesNames = async (req, res) => {
  try {
    const { Grade } = req.query
    quizGrade = Grade
    await Quiz.find({ 'Grade': Grade }, { quizName: 1 })
      .then((result) => {
        console.log(result)
        res.render("teacher/handleQuizzes", { title: "handleQuizzes", path: req.path, quizzesNamesData: result, studetsData: null, quizID: null, nextPage: null, previousPage: null, isSearching: false });
      })
  } catch (error) {

  }
}

const getStudentsDataOfQuiz = async (req, res) => {
  try {
    const { quizID } = req.query
    let perPage = 50;
    let page = req.query.page || 1;

    const objectId = new mongoose.Types.ObjectId(quizID);
    QuizId = objectId

    await User.aggregate([
      {
        $match: {
          "Grade": quizGrade,
          "quizesInfo": {
            $elemMatch: {
              "_id": objectId,
              "isEnterd": true
            }
          }
        }
      },
      {
        $project: {
          "Username": 1,
          "Code": 1,
          "quizesInfo": 1,
          "quizesInfo": {
            $filter: {
              input: "$quizesInfo",
              as: "quiz",
              cond: {
                $eq: ["$$quiz._id", QuizId]
              }
            }
          }
        }
      },
      {
        $sort: {
          "quizesInfo.Score": -1
        }
      }
    ])
      .skip(perPage * page - perPage)
      .limit(perPage)
      .exec()
      .then(async (result) => {

        console.log(result)
        const count = await User.countDocuments({});
        const nextPage = parseInt(page) + 1;
        const hasNextPage = nextPage <= Math.ceil(count / perPage);
        const hasPreviousPage = page > 1; // Check if current page is greater than 1
        res.render("teacher/handleQuizzes", {
          title: "handleQuizzes", path: req.path,
          quizzesNamesData: null,
          studetsData: result,
          quizID: quizID,
          nextPage: hasNextPage ? nextPage : null,
          previousPage: hasPreviousPage ? page - 1 : null,
          isSearching: false
        });
      })
  } catch (error) {

  }
}


const searchForUserInQuiz = async (req, res) => {
  const { searchBy, searchInput } = req.query
  try {
    console.log(searchBy, searchInput, QuizId)

    await User.aggregate([
      {
        $match: {
          [`${searchBy}`]: searchBy == "Code" ? +searchInput : searchInput,
          "quizesInfo": {
            $elemMatch: {
              "_id": QuizId,
              "isEnterd": true
            }
          }
        }
      },
      {
        $project: {
          "Username": 1,
          "Code": 1,
          "quizesInfo": {
            $filter: {
              input: "$quizesInfo",
              as: "quiz",
              cond: {
                $eq: ["$$quiz._id", QuizId]
              }
            }
          }
        }
      },
      {
        $sort: {
          "createdAt": 1
        }
      }
    ])


      .then((result) => {
        console.log(result)

        res.render("teacher/handleQuizzes", { title: "handleQuizzes", path: req.path, quizzesNamesData: null, studetsData: result, quizID: null, nextPage: null, previousPage: null, isSearching: true });

      })
  } catch (error) {

  }

}

const convertToExcelQuiz = async (req, res) => {
  try {

    const users = await User.aggregate([
      {
        $match: {
          "Grade": quizGrade,
          "quizesInfo": {
            $elemMatch: {
              "_id": QuizId,
              "isEnterd": true
            }
          }
        }
      },
      {
        $project: {
          "Username": 1,
          "Code": 1,
          "quizesInfo": 1,
          "phone": 1,
          "parentPhone": 1,
          "quizesInfo": {
            $filter: {
              input: "$quizesInfo",
              as: "quiz",
              cond: {
                $eq: ["$$quiz._id", QuizId]
              }
            }
          }
        }
      },
      {
        $sort: {
          "createdAt": 1
        }
      }
    ])

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Users Data');

    const headerRow = worksheet.addRow(['#', 'User Name', 'Student Code', 'Student Phone', 'Parent Phone', "Quiz Grade"]);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };

    // Add user data to the worksheet with alternating row colors
    let c = 0;
    users.forEach(user => {
      c++;
      const row = worksheet.addRow([c, user.Username, user.Code, user.phone, user.parentPhone, user['quizesInfo'][0]['Score']]);
      // Apply alternating row colors
      if (c % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
      }
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users_data.xlsx');

    // Send Excel file as response
    res.send(excelBuffer)


  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).send('Error generating Excel file');
  }
};

const changeEnterToQuiz = async (req, res) => {
  try {
    const quizID = req.params.quizID
    const UserId = req.query.UserId
    console.log(QuizId, UserId)
    User.findOneAndUpdate(
      {
        _id: UserId,

      },
      {


        'quizesInfo.$[elem].isEnterd': false,
        'quizesInfo.$[elem].inProgress': false,
        'quizesInfo.$[elem].solvedAt': null,
        'quizesInfo.$[elem].solveTime': null,
        'quizesInfo.$[elem].answers': [],
        'quizesInfo.$[elem].Score': 0,
        'quizesInfo.$[elem].endTime': null,

        


      },
      {
        new: true,
        arrayFilters: [{ 'elem._id': QuizId }]
      }
    ).then((result) => {
      console.log(result)
      res.redirect(`/teacher/getStudentsDataOfQuiz?quizID=${QuizId}`)
    })
  } catch (error) {

  }
}

// =================================================== END Handle Quizzes ================================================ // 



// =================================================== Codes ================================================ // 

const Codes_get = (req, res) => {
  res.render("teacher/Codes", { title: "Codes", path: req.path, data: null, Grade: null, type: null });
};


let Type
const getChptersOrVideosData = async (req, res) => {

  try {
    const { type, Grade } = req.query
    Type = type
    const data = []

    if(Type == "Chapter" || Type == "Video") {
      await Chapter.find({ 'chapterGrade': Grade }, { chapterName: 1, chapterAccessibility: 1, chapterLectures: 1, chapterSummaries: 1, chapterSolvings: 1 })
      .then((result) => {
        result.forEach((resData) => {
          if (type == "Chapter") {
            if (resData.chapterAccessibility == "EnterInPay") {
              data.push({ Name: resData.chapterName, _id: resData._id })
            }
          } else if(type == "Video") {
            resData['chapterLectures'].forEach((lec) => {
              if (lec.paymentStatus == "Pay") {
                data.push({ Name: lec.videoTitle, _id: lec._id })
              }
            })
            resData['chapterSummaries'].forEach((sum) => {
              if (sum.paymentStatus == "Pay") {
                data.push({ Name: sum.videoTitle, _id: sum._id })
              }
            })
            resData['chapterSolvings'].forEach((solv) => {
              if (solv.paymentStatus == "Pay") {
                data.push({ Name: solv.videoTitle, _id: solv._id })
              }
            })
          }


        })

   
        res.render("teacher/Codes", { title: "Codes", path: req.path, data: data, Grade: Grade, type: type });

      })
    }else{
       await Quiz.find({ 'Grade': Grade },{quizName:1,_id:1,prepaidStatus:1}) .then((result) => { 
        result.forEach((quiz) => {
          if (quiz.prepaidStatus) {
            data.push({ Name: quiz.quizName, _id: quiz._id })

          }
        })
        res.render("teacher/Codes", { title: "Codes", path: req.path, data: data, Grade: Grade, type: type });

       })

     
    }
   

 
  } catch (error) {

  }
}

const createSpecificCodes = async (req, res) => {
  try {
    req.io.emit('creatingCodes', { nCodesFinished: 0 ,numberOfCodes:0 });

    const { IDOfVideoOrChapter, numberOfCodes } = req.body;

    // Validate the inputs
    if (!IDOfVideoOrChapter || !numberOfCodes || !Type) {
      return res.status(400).json({ message: "Name and number of codes are required." });
    }

    // Generate the specified number of codes
    const generatedCodes = [];
    for (let i = 0; i < +numberOfCodes; i++) {
      const code = generateCode(); // Function to generate code
      generatedCodes.push(code);
    }

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Codes Data');

    const headerRow = worksheet.addRow(['#', 'Code']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
    let c = 0;
    for (const code of generatedCodes) {
      // console.log(code)

      await Code.create({ Code: code, isUsed: false, codeType: Type, codeFor: IDOfVideoOrChapter, usedBy: null, usedIn: null }).then((result) => {
        console.log(result)
      });

      c++;
      req.io.emit('creatingCodes', { nCodesFinished: c ,numberOfCodes:numberOfCodes });
      const row = worksheet.addRow([c, code]);
      // Apply alternating row colors
      if (c % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
      }

    }

    // Add user data to the worksheet with alternating row colors

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Codes_data.xlsx');

    // Send Excel file as response
    res.send(excelBuffer)

  } catch (error) {
    return res.status(400).json({ message: `back and Re make the request again please ${error}` });

  }
}


const createGeneralCodes = async (req, res) => {
  try {
    req.io.emit('creatingCodes', { code: 0 });
    const { numberOfCodes } = req.body;

    // Validate the inputs
    if (!numberOfCodes) {
      return res.status(400).json({ message: "Name and number of codes are required." });
    }

    // Generate the specified number of codes
    const generatedCodes = [];
    for (let i = 0; i < +numberOfCodes; i++) {
      const code = generateCode(); // Function to generate code
      generatedCodes.push(code);
    }

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Codes Data');

    const headerRow = worksheet.addRow(['#', 'Code']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
    let c = 0;
    for (const code of generatedCodes) {
      // console.log(code)

      await Code.create({ Code: code, isUsed: false, codeType: "General", codeFor: null, usedBy: null, usedIn: null }).then((result) => {
        console.log(result)
      });

      c++;
      req.io.emit('creatingCodes', { code: c});
      const row = worksheet.addRow([c, code]);
      // Apply alternating row colors
      if (c % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
      }



    }

    // Add user data to the worksheet with alternating row colors

    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Codes_data.xlsx');

    // Send Excel file as response
    res.send(excelBuffer)


  } catch (error) {
    return res.status(400).json({ message: `back and Re make the request again please ${error}` });

  }
}

function generateCode() {
  // Generate a UUID
  const uuid = uuidv4();

  // Extract only the numbers from the UUID
  const numbers = uuid.replace(/\D/g, '');

  // Take the first 10 digits
  const code = numbers.substring(0, 12);

  return code;
}



// =================================================== END Codes ================================================ // 




// =================================================== Handel Codes ================================================ // 
let t, g, n
const handelCodes_get = async (req, res) => {
  try {
    const { type, Grade, name, excel } = req.query
    t = type
    g = Grade
    n = name
    let perPage = 50;
    let page = req.query.page || 1;

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Codes Data');

    const headerRow = worksheet.addRow(['#', 'الكود', 'حاله الاستخدام', 'كود المستخدم', '	استخدم في ', "تاريخ الاستخدام"]);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };

    const data = []
    await Chapter.find({ 'chapterGrade': Grade }, { chapterName: 1, chapterAccessibility: 1, chapterLectures: 1, chapterSummaries: 1, chapterSolvings: 1 })
      .then((result) => {
        result.forEach((resData) => {
          if (type == "Chapter") {
            if (resData.chapterAccessibility == "EnterInPay") {
              data.push({ Name: resData.chapterName, _id: resData._id })
            }
          } else {
            resData['chapterLectures'].forEach((lec) => {
              if (lec.paymentStatus == "Pay") {
                data.push({ Name: lec.videoTitle, _id: lec._id })
              }
            })
            resData['chapterSummaries'].forEach((sum) => {
              if (sum.paymentStatus == "Pay") {
                data.push({ Name: sum.videoTitle, _id: sum._id })
              }
            })
            resData['chapterSolvings'].forEach((solv) => {
              if (solv.paymentStatus == "Pay") {
                data.push({ Name: solv.videoTitle, _id: solv._id })
              }
            })
          }
        })


      })



    if (excel) {
      if (type == "General") {
        await Code.find({ 'codeType': type }).sort({ isUsed: 1 })
        
          .then(async (Codes) => {
            let c = 0;
            Codes.forEach(code => {
              c++;
              const row = worksheet.addRow([c, code.Code, code.isUsed ? "مستخدم" :"غير مستخدم" ,code.usedBy || "غير مستخدم", code.usedIn || "غير مستخدم", code.createdAt.toLocaleDateString() === code.updatedAt.toLocaleDateString() ? "غير مستخدم" : code.updatedAt.toLocaleDateString()]);
              // Apply alternating row colors
              if (c % 2 === 0) {
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
              }
            });
        
            const excelBuffer = await workbook.xlsx.writeBuffer();
            // Set response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=users_data.xlsx');

            // Send Excel file as response
            res.send(excelBuffer)
          })


      } else if (type == "Video" || type == "Chapter") {
        res.render("teacher/handelCodes", { title: "Codes", path: req.path, namesData: data, CodesData: null, type: type, Grade: Grade, name: null, nextPage: null, previousPage: null, currentPage: null });

      } else {

        if (name) {
          await Code.find({ "codeFor": name }).sort({ isUsed: 1 })
          
            .then(async (Codes) => {
              let c = 0;
              Codes.forEach(code => {
                c++;
                const row = worksheet.addRow([c, code.Code, code.isUsed ? "مستخدم" :"غير مستخدم" ,code.usedBy || "غير مستخدم", code.usedIn || "غير مستخدم", code.createdAt.toLocaleDateString() === code.updatedAt.toLocaleDateString() ? "غير مستخدم" : code.updatedAt.toLocaleDateString()]);
                // Apply alternating row colors
                if (c % 2 === 0) {
                  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDDDDD' } };
                }
              });
          
              const excelBuffer = await workbook.xlsx.writeBuffer();
              // Set response headers for file download
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', 'attachment; filename=users_data.xlsx');
  
              // Send Excel file as response
              res.send(excelBuffer)
         
            })

        } else {
          res.render("teacher/handelCodes", { title: "handel Codes", path: req.path, namesData: null, CodesData: null, type: null, Grade: null, name: null, nextPage: null, previousPage: null, currentPage: null });
        }

      }

    } else {


      if (type == "General") {
        await Code.find({ 'codeType': type }).sort({ isUsed: 1 })
          .skip(perPage * page - perPage)
          .limit(perPage)
          .exec()
          .then(async (result) => {
            const count = await Code.countDocuments({});
            const nextPage = parseInt(page) + 1;
            const hasNextPage = nextPage <= Math.ceil(count / perPage);
            const hasPreviousPage = page > 1;
            res.render("teacher/handelCodes", { title: "Codes", path: req.path, namesData: null, CodesData: result, type: type, Grade: null, name: null, nextPage: hasNextPage ? nextPage : null, previousPage: hasPreviousPage ? page - 1 : null, currentPage: page });
          })


      } else if (type == "Video" || type == "Chapter") {
        res.render("teacher/handelCodes", { title: "Codes", path: req.path, namesData: data, CodesData: null, type: type, Grade: Grade, name: null, nextPage: null, previousPage: null, currentPage: null });

      } else {

        if (name) {
          await Code.find({ "codeFor": name }).sort({ isUsed: 1 })
            .skip(perPage * page - perPage)
            .limit(perPage)
            .exec()
            .then(async (result) => {

              const count = await Code.countDocuments({});
              const nextPage = parseInt(page) + 1;
              const hasNextPage = nextPage <= Math.ceil(count / perPage);
              const hasPreviousPage = page > 1;

              res.render("teacher/handelCodes", { title: "Codes", path: req.path, namesData: null, CodesData: result, type: null, Grade: null, name: name, nextPage: hasNextPage ? nextPage : null, previousPage: hasPreviousPage ? page - 1 : null, currentPage: page });
            })

        } else {
          res.render("teacher/handelCodes", { title: "handel Codes", path: req.path, namesData: null, CodesData: null, type: null, Grade: null, name: null, nextPage: null, previousPage: null, currentPage: null });
        }

      }

    }


  } catch (error) {
    return res.status(400).json({ message: `back and Re make the request again please ${error}` });
  }

};


const searchToGetCode = async (req, res) => {
  try {
    const { searchInput } = req.query
    await Code.find({ Code: searchInput })
      .then((result) => {
        res.render("teacher/handelCodes", { title: "Codes", path: req.path, namesData: null, CodesData: result, type: t || null, Grade: g || null, name: n || null, nextPage: null, previousPage: null,currentPage:null });

      })
  } catch (error) {

  }
}



// ================================================== END Handel Codes ================================================ // 


const logOut = async (req, res) => {
  // Clearing the token cookie
  res.clearCookie('token');
  // Redirecting to the login page or any other desired page
  res.redirect('../login');
}





module.exports = {
  dash_get,
  addVideo_get,
  addQuiz_get,
  myStudent_get,
  homeWork_get,
  handelCodes_get,
  Codes_get,
  studentsRequests_get,
  confirmDeleteStudent,
  DeleteStudent,
  addQuestion,
  deleteQuestion,
  updateQuestion,
  getQuizAlldata,
  deleteQuiz,
  updateQuiz,
  quizSubmit,
  handleQuizzes,
  getQuizzesNames,
  getStudentsDataOfQuiz,
  searchForUserInQuiz,
  convertToExcelQuiz,


  addVideo_post,
  // uploadVideo,
  chapter_post,
  getAllChapters,
  


  handleVideos_get,
  getAllChaptersInHandle,
  getChapterDataToEdit,
  editChapterData,
  getSingleVideoAllData,
  updateVideoData,
  addViewsToStudent,
  convertToExcel,
  searchForUser,
  converStudentRequestsToExcel,
  getSingleUserAllData,
  updateUserData,

  searchToGetOneUserAllData,
  convertToExcelAllUserData,
  changeEnterToQuiz,
  // convertToPDFAllUserData

  // getVideosToQuiz

  // Codes
  getChptersOrVideosData,
  createSpecificCodes,
  createGeneralCodes,

  searchToGetCode,


  logOut,
};
