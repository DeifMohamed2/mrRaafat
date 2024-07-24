const User = require("../models/User");
const mongoose = require('mongoose');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const  jwtSecret = process.env.JWTSECRET



// check Login 





const home_page = (req, res) => {

  res.render("index", { title: "Home Page" });
};

const public_login_get = (req, res) => {
  res.render("login", { title: "Login Page" ,Email:'',Password:'',error:""});
};

const public_login_post = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    const user = await User.findOne({
      $or: [
       
        { phone: emailOrPhone } 
      ]
    });

    if (!user) {
      return res.status(401).render("login", { title: "Login Page" ,Email:"",Password:null,error:"البريد الالكتروني او كلمه المرور خاطئه"});
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).render("login", { title: "Login Page" ,Email:"",Password:null,error:"البريد الالكتروني او كلمه المرور خاطئه"});
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret);
    res.cookie('token', token, { httpOnly: true });

    if (user.isTeacher) {
      return res.redirect('/teacher/dash');
    } else {
      if (user.subscribe) {
        return res.redirect('/student/dash');
      }else{
        return res.redirect('/login?StudentCode='+user.Code);
      }

    }

  } catch (error) {
    console.log(error);
    return res.status(500).redirect('/login');
  }
}

const public_Register_get = (req, res) => {
   const StudentCode = req.query.StudentCode 

  res.render("Register", { title: "Login Page" ,  formData: req.body,firebaseError:"",StudentCode});
};

const public_Register_post = async (req, res) => {
  const {
    Password,
    Username,
    gov,
    Markez,
    schoolName,
    Grade,
    gender,
    phone,
    parentPhone,
    place,
    ARorEN,
  } = req.body;

  // Create an object to store validation errors
  const errors = {};

  // Check if the password is at least 7 characters long
  if (Password.length < 7) {
    req.body.Password = "";
    errors.password = "- كلمة المرور يجب ان لا تقل عن 7";
  }
  let Code = Math.floor((Math.random() * 400000) + 600000);

  // Check if the phone number has 11 digits
  if (phone.length !== 11) {
    req.body.phone = "";
    errors.phone = "- رقم الهاتف يجب ان يحتوي علي 11 رقم";
  }


  // Check if the parent's phone number has 11 digits
  if (parentPhone.length !== 11) {
    req.body.parentPhone = "";
    errors.parentPhone = "- رقم هاتف ولي الامر يجب ان يحتوي علي 11 رقم";
  }

  // Check if phone is equal to parentPhone
  if (phone === parentPhone) {
    // Clear the phone and parentPhone fields in the form data
    req.body.phone = "";
    req.body.parentPhone = "";

    // Set an error message for this condition
    errors.phone = "- رقم هاتف الطالب لا يجب ان يساوي رقم هاتف ولي الامر";
  }
  if (!gender) {
    errors.gender = "- يجب اختيار نوع الجنس";
  }
  if (!gov) {
    errors.gov = "- يجب اختيار محافظة";
  }
  if (!Grade) {
    errors.Grade = "- يجب اختيار الصف الدراسي";
  }
  if (!ARorEN) {
    errors.Grade = "- يجب اختيار انت عربي ولا لغات";
  }
  // If there are validation errors, render the registration form again with error messages
  if (Object.keys(errors).length > 0) {
    return res.render("Register", {
      title: "Register Page",
      errors:errors,
      firebaseError:"",
      formData: req.body, // Pass the form data back to pre-fill the form
    });
  }

  // auth Of jwt

  let quizesInfo = []
  let videosInfo = []

  if (Grade ==="Grade1") {
    await User.findOne({Grade:Grade,Code:926273}).then((result)=>{
      quizesInfo = result.quizesInfo
      videosInfo = result.videosInfo
      
    })
  }else if(Grade ==="Grade2"){
    await User.findOne({Grade:Grade,Code:870726}).then((result)=>{
      quizesInfo = result.quizesInfo
      videosInfo = result.videosInfo
    })
  }else if(Grade ==="Grade3"){
    await User.findOne({Grade:Grade,Code:707541}).then((result)=>{
      quizesInfo = result.quizesInfo
      videosInfo = result.videosInfo
    })
  }



  const hashedPassword = await bcrypt.hash(Password,10)

  try {
    const user =  new User({
      Username:Username,
      PasswordNotHashed:Password,
      Password:hashedPassword,
      gov:gov,
      Markez:Markez,
      schoolName:schoolName,
      Grade:Grade,
      gender:gender,
      phone:phone,
      parentPhone:parentPhone,
      place:place,
      Code:Code,
      subscribe :false,
      quizesInfo :quizesInfo,
      videosInfo : videosInfo,
      totalScore:0,
      examsEnterd:0,
      totalQuestions:0,
      totalSubscribed:0,
      isTeacher:false,
      ARorEN : "AR",
      chaptersPaid:[],
      videosPaid: [],
      examsPaid: [],
  
    });
    user
    .save()
    .then((result) => {
      
        res.status(201).redirect("Register?StudentCode=" + encodeURIComponent(Code));

    }).catch((error)=>{
      if (error.name === 'MongoServerError' && error.code === 11000) {
        // Duplicate key error
        errors.emailDub = "هذا الرقم مستخدم من قبل";
        // Handle the error as needed
        res.render("Register", {
          title: "Register Page",
          errors:errors,
          firebaseError:"",
          formData: req.body, // Pass the form data back to pre-fill the form
        });
    } else {
        // Handle other errors
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
    })

  } catch (error) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        // Duplicate key error
        errors.emailDub = "This email is already in use.";
        // Handle the error as needed
        res.status(409).json({ message: 'User already in use' });
    } else {
        // Handle other errors
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

  


};

const forgetPassword_get = (req,res)=>{
  res.render("forgetPassword", { title: "Forget Password" ,error:null,success:null});

}



const forgetPassword_post = async(req,res)=>{

  try {


    const { phone } = req.body;

    const user = await User.findOne({
      $or: [
        { phone: phone },

      ]
    });

    if (!user&&phone) {
      res.render("forgetPassword", { title: "Forget Password" ,error:"لا يوجد حساب لهذا الايميل او رقم الهاتف",success:null})
      return ''
    }else if(user&&phone){
      const secret = jwtSecret + user.Password
      const token = jwt.sign({phone:phone,_id :user._id },secret,{expiresIn:'15m'})
      const link  = `http://localhost:3000/reset-password/${user._id }/${token}`
   

        console.log("aerd",link,postData)
    
  
      return ''
    }


  } catch (error) {
    console.log(error)
    res.status(500).send('Internal Server Error'); // Handle other errors

  }
  
  res.render("forgetPassword", { title: "Forget Password" ,error:null,success:null});

}

const reset_password_get = async(req,res)=>{
  try {
    const {id , token} = req.params

    const user =  await User.findOne({_id:id})
    if (!user) {
      res.send('invalid Id....')
      return
    }
    const secret = jwtSecret + user.Password
    const payload = jwt.verify(token,secret)
    res.render('reset-password',{phone:user.phone,error:null})  
  } catch (error) {
    res.send(error.message)
  }

}

const reset_password_post = async(req,res)=>{
  try {
    const {id , token} = req.params
    const {password1,password2} = req.body
    const user =  await User.findOne({_id:id})
    if (!user) {
      res.send('invalid Id....')
      return
    }
    if (password1===password2) {
      const secret = jwtSecret + user.Password
      const payload = jwt.verify(token,secret)
      const hashedPassword = await bcrypt.hash(password1,10)
      await User.findByIdAndUpdate({_id:id},{Password:hashedPassword}).then(()=>{
        res.redirect('/login')  
      }).catch((error)=>{
        res.send(error.message)
      })

    }else{
     res.render('reset-password',{phone:user.phone,error:"لازم يكونو شبه بعض"}) 
    }


  } catch (error) {
    res.send(error.message)
  }

}




module.exports = {
  home_page,
  public_login_get,
  public_Register_get,
  public_Register_post,
  public_login_post,
  forgetPassword_get,
  forgetPassword_post,
  reset_password_get,
  reset_password_post,
};


