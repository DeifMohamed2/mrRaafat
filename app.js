require('dotenv').config()
const express = require('express');
const morgan = require('morgan')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo')
const session = require('express-session')
const fileUpload = require('express-fileupload');
const cors = require('cors')



const fs = require('fs')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
// const { authenticateUser } = require('./middleware/authMiddleware')




const homeRoutes = require('./routes/homeRoutes')
const teacherRoutes = require('./routes/teacherRoutes')
const studentRoutes = require('./routes/studentRoutes');
// express app
const app = express();
const socketio = require('socket.io');
const path = require('path');


// CONECT to mongodb
let io
const dbURI = 'mongodb+srv://3devWay:1qaz2wsx@cluster0.5orkagp.mongodb.net/Raafat?retryWrites=true&w=majority&appName=Cluster0'
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => {
        let server = app.listen(8899);

        io = socketio(server)
        io.on('connection', (socket) => {
            console.log(`New connection: ${socket.id}`);
        })


        

        console.log("Dadad")
    }).catch((err) => {
        console.log(err)
    })

// register view engine
app.set('view engine', 'ejs');
// listen for requests


app.use(cors())
app.use((req, res, next) => {
    req.io = io; // Attach io to the request object
    next(); // Move to the next middleware or route handler
});

app.use(morgan('dev'));
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(fileUpload());
// let uri = ""; // Declare the 'uri' variable

app.use(session({
    secret: "Keybord",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: dbURI
    }),

}))


// Custom middleware to make io accessible in all routes


app.use('/', homeRoutes)
app.use('/teacher', teacherRoutes)
app.use('/student', studentRoutes)



const Excel = require('exceljs');


app.post("/teacher/uploadVideo", async (req, res) => {

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Video Data');

    const headerRow = worksheet.addRow(['#', 'User Name', 'Student Code', 'Student Phone', 'Parent Phone']);
 
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users_data.xlsx');


    if (!req.files || !req.files.filetoupload) {
        return res.status(400).send('No files were uploaded.');
    }

    const uploadedFile = req.files.filetoupload;
    const uploadDirectory = path.join(__dirname, 'uploads'); // Directory where uploaded files will be stored

    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDirectory)) {
        fs.mkdirSync(uploadDirectory);
    }

    // Save the uploaded file
    const filePath = path.join(uploadDirectory, uploadedFile.name);



    uploadedFile.mv(filePath, (err) => {
        if (err) {
            return res.status(500).send(err);
        }



        const Vimeo = require('vimeo').Vimeo

        try {


            // Instantiate the library with your client id, secret and access token (pulled from dev site)
            const client = new Vimeo("58133a717ee5c29b2f419d7841021b1fc6d306c1", "NMEyxm7hJ0RPC01v6u8n5Cn+Z0DvfdP7YeYLVGYdrfx+62BmhW9fwKJtOI2pw6OBuVOeObUoJvBlMbYoWedlobZ13teA3ewTO16+Tg2WrhbO1pTMgVnPvJHpB+cK2X8m", "b08f6b1dab35f2ae9ebb4e44ca25d9f2")

            // Create a variable with a hard coded path to your file system

            console.log('Uploading: ' + filePath)

            const params = {
                name: uploadedFile.name,
                description: "This video was uploaded through the Vimeo API's NodeJS SDK."
            }

            client.upload(
                filePath,
                params,
                function (uri) {
                    io.emit('upload_progress', { percentage: 100 });

                    // Get the metadata response from the upload and log out the Vimeo.com url
                    client.request(uri + '?fields=link', function (error, body, statusCode, headers) {
                        if (error) {
                            console.log('There was an error making the request.')
                            console.log('Server reported: ' + error)
                            return
                        }

                        console.log('"' + filePath + '" has been uploaded to ' + body.link)

                        // Make an API call to edit the title and description of the video.
                        client.request({
                            method: 'PATCH',
                            path: uri,
                            params: {
                                name: 'Vimeo API SDK test edit',
                                description: "This video was edited through the Vimeo API's NodeJS SDK."
                            }
                        }, function (error, body, statusCode, headers) {
                            if (error) {
                                console.log('There was an error making the request.')
                                console.log('Server reported: ' + error)
                                return
                            }

                            console.log('The title and description for ' + uri + ' has been edited.')

                            client.request(
                                uri + '?fields=link',
                                function (error, body, statusCode, headers) {
                                    if (error) {
                                        console.log('There was an error making the request.')
                                        console.log('Server reported: ' + error)
                                        return
                                    }
                            
                                    console.log('Your video link is: ' + body.link );
                            
                                    const videoId = body.link.substring(body.link.lastIndexOf('/') + 1); // Extract video ID
                                    const videoLink = `https://player.vimeo.com/video/${videoId}`; // Construct new link
                            
                                    // Generate the iframe embed code
                                    io.emit('videoLink', { videoLink: videoLink });

                             
                                }
                            );

                        })
                    })
                },
                function (bytesUploaded, bytesTotal) {
                    const percentage = (bytesUploaded / bytesTotal * 100).toFixed(2)
                    io.emit('upload_progress', { percentage });

                    console.log(bytesUploaded, bytesTotal, percentage + '%')
                },
                function (error) {
                    console.log('Failed because: ' + error)
                }
            )
        } catch (error) {
            console.error('ERROR: For this example to run properly you must create an API app at ' +
                'https://developer.vimeo.com/apps/new and set your callback url to ' +
                '`http://localhost:8080/oauth_callback`.')
            console.error('ERROR: Once you have your app, make a copy of `config.json.example` named ' +
                '`config.json` and add your client ID, client secret and access token.')
            process.exit()
        }






    });


    res.send(excelBuffer);


});





// app.post("/teacher/uploadVideo", async (req, res) => {


//     if (!req.files || !req.files.filetoupload) {
//         return res.status(400).send('No files were uploaded.');
//     }

//     const uploadedFile = req.files.filetoupload;
//     const uploadDirectory = path.join(__dirname, 'uploads'); // Directory where uploaded files will be stored

//     // Create the directory if it doesn't exist
//     if (!fs.existsSync(uploadDirectory)) {
//         fs.mkdirSync(uploadDirectory);
//     }

//     // Save the uploaded file
//     const filePath = path.join(uploadDirectory, uploadedFile.name);

//     uploadedFile.mv(filePath, async (err) => {
//         if (err) {
//             return res.status(500).send(err);
//         }

//         try {
//             const Vimeo = require('vimeo').Vimeo;

//             // Instantiate the Vimeo client with your credentials
//             const client = new Vimeo(
//                 "58133a717ee5c29b2f419d7841021b1fc6d306c1", // Client ID
//                 "NMEyxm7hJ0RPC01v6u8n5Cn+Z0DvfdP7YeYLVGYdrfx+62BmhW9fwKJtOI2pw6OBuVOeObUoJvBlMbYoWedlobZ13teA3ewTO16+Tg2WrhbO1pTMgVnPvJHpB+cK2X8m", // Client Secret
//                 "b08f6b1dab35f2ae9ebb4e44ca25d9f2" // Access Token
//             );

//             // Specify the folder URI
//             const folderUri = "/folders/19740524";

//             // Upload video to Vimeo and assign it to the specified folder
//             client.upload(
//                 filePath,
//                 {
//                     name: uploadedFile.name,
//                     description: "This video was uploaded through the Vimeo API's NodeJS SDK.",
//                     upload: {
//                         approach: 'pull',
//                         size: uploadedFile.size,
//                         folder: folderUri // Assign video to the specified folder
//                     }
//                 },
//                 function (uri) {
  
//                 },
//                 function (bytesUploaded, bytesTotal) {
//                     // Progress callback
//                     console.log(bytesUploaded, bytesTotal);
//                 },
//                 function (error) {
//                     // Error callback
//                     console.error('Failed because: ' + error);
//                     res.status(500).send('Failed to upload video.');
//                 }
//             );
//         } catch (error) {
//             console.error('Error:', error);
//             res.status(500).send('Error uploading video.');
//         }
//     });

 
// });








// 404 page
app.use((req, res) => {
    res.status(404).render('404', { title: '404' });
});
