// Selectors
const toggleBtn = document.querySelector("#toggle-btn");
const scrollProgressBar = document.getElementById("scroll-progress");
const SigninBtn = document.querySelector(".navbar__signin-btn");
const bodyElement = document.body;
const header = document.querySelector("header");
let darkmode = localStorage.getItem("darkmode");

// Function to apply dark mode
const enableDarkmode = () => {
  document.body.classList.add("darkmode");
  toggleBtn.classList.add("fa-moon");
  SigninBtn.classList.add("active-btn");
  localStorage.setItem("darkmode", "active");
};

// Function to disable dark mode
const disableDarkmode = () => {
  document.body.classList.remove("darkmode");
  toggleBtn.classList.remove("fa-moon");
  SigninBtn.classList.remove("active-btn");
  localStorage.setItem("darkmode", null);
};

// Immediately apply saved theme on page load
(function () {
  const darkmode = localStorage.getItem("darkmode");
  if (darkmode === "active") enableDarkmode();
})();

toggleBtn.addEventListener("click", function () {
  let darkmode = localStorage.getItem("darkmode");
  if (darkmode !== "active") {
    enableDarkmode();
  } else {
    disableDarkmode();
  }
});

const handleScroll = () => {
  // Get current scroll position and viewport/page dimensions
  const scrollTop = window.scrollY;
  const totalHeight = document.body.scrollHeight;
  const viewportHeight = document.documentElement.clientHeight;

  // Update scroll progress bar
  if (scrollProgressBar) {
    const scrollPercentage = (scrollTop / (totalHeight - viewportHeight)) * 100;
    scrollProgressBar.style.width = `${Math.round(scrollPercentage)}%`;
  }

  // Show/Hide header border based on scroll position
  if (scrollTop === 0) {
    header?.classList.remove("removeBorder");
  } else {
    header?.classList.add("removeBorder");
  }
};

// Attach scroll event handler (passive for better performance)
window.addEventListener("scroll", handleScroll, { passive: true });

//show more

let showMoreButton = document.querySelector(".show-more");
let currenListen = 3;
let boxes = [...document.querySelectorAll(".slider-content-wrapper-box")];
boxes.forEach((box, index) => {
  box.style.display = index < currenListen ? "inline-block" : "none";
});
let profile = document.querySelectorAll(".sign-form");

// Active btn on mobile screen
document.querySelectorAll(".user-btn").forEach((element) => {
  element.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevent the click from propagating to the document
    profile.forEach((sign) => {
      sign.classList.toggle("active"); // Toggle the "active" class
    });
  });
});

// Add click event listener to each sign element
profile.forEach((sign) => {
  sign.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevent the click from propagating to the document
  });
});

// Add a global click listener to the document
document.addEventListener("click", () => {
  profile.forEach((sign) => {
    sign.classList.remove("active"); // Remove the "active" class
  });
});

showMoreButton.addEventListener("click", function () {
  // Show the next 6 boxes
  for (let i = currenListen; i < currenListen + 6; i++) {
    if (i < boxes.length) {
      boxes[i].style.display = "inline-block";
    }
  }

  // Update the current count
  currenListen += 6;

  // Hide the button if all boxes are displayed
  if (currenListen >= boxes.length) {
    showMoreButton.style.display = "none";
  }
});


// Function to open the video modal
function openVideo() {
  const modal = document.getElementById('videoModal');
  modal.style.display = 'flex'; // Show the modal
  // const iframe = document.getElementById('lessonVideoIframe');
  // const src = iframe.src;
  // iframe.src = ''; // Remove the video source temporarily
  // iframe.src = src; // Reset the video source to trigger autoplay
}

// Function to close the video modal
function closeVideo() {
  const modal = document.getElementById('videoModal');
  modal.style.display = 'none'; // Hide the modal
  const iframe = document.getElementById('lessonVideoIframe');
  const src = iframe.src;
  iframe.src = ''; // Stop the video by removing the source
  iframe.src = src; // Reset the video source to stop it
}




document.addEventListener('DOMContentLoaded', async () => {
  const defaultGrade = 'Grade1'; // Set default grade to Grade 3
  fetchChaptersByGrade(defaultGrade); // Load Grade 3 chapters on page load
});

// Fetch and update courses when the grade selection changes
document.getElementById('gradeSelect').addEventListener('change', (event) => {
  const selectedGrade = event.target.value;
  console.log(selectedGrade);
  fetchChaptersByGrade(selectedGrade);
});

// Function to fetch chapters based on the selected grade
async function fetchChaptersByGrade(grade) {
  console.log(grade);
  try {
    const response = await fetch(`/chaptersByGrade?grade=${grade}`);
    const chapters = await response.json(); // Parse the JSON response
    console.log(chapters);
    updateCourseList(chapters); // Update the UI with fetched chapters
  } catch (error) {
    console.error('Error fetching chapters:', error);
  }
}

// Function to update the course display dynamically
function updateCourseList(chapters) {
  const courseContainer = document.querySelector('.slider-content-wrapper');
  courseContainer.innerHTML = ''; // Clear existing courses

  // Loop through the fetched chapters and create new HTML elements
  chapters.forEach((chapter) => {
    const chapterHTML = `
      <div class="slider-content-wrapper-box">
        <div class="image-content">
          <img src="${chapter.chapterIMG}" loading="lazy" alt="${
      chapter.chapterName
    }" />
        </div>
        <div class="course-content">
          <div class="course-content-title">
            <h3>${chapter.chapterName}</h3>
            <div class="course-content-title-btns">
              <a href="/student/chapters"><button>اشترك الان!</button></a>
            </div>
          </div>
          <div class="line-divid"></div>
          <p>${chapter.chapterDescription}</p>
          <div class="line-break"></div>
          <label for="explainVideos">فيديوهات الشرح</label>
          <span id="explainVideos">: ${
            chapter.chapterLectures.length
          }</span><br>
          <label for="HWVideos">فيديوهات الحل</label>
          <span id="HWVideos">: ${chapter.chapterSolvings.length}</span><br>
          <label for="summaryVideos">فيديوهات المراجعه</label>
          <span id="summaryVideos">: ${chapter.chapterSummaries.length}</span>

          <div class="line-break"></div>
          <div class="course-content-details">
            <div class="course-content-details-price">
              <p>جنيها</p>
              <span>${chapter.chapterPrice}</span>
            </div>
            <div class="course-content-details-date">
              <p>${new Date(chapter.createdAt).toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })} <i class="fa-solid fa-hourglass-start"></i></p>
            </div>
          </div>
        </div>
      </div>
    `;
    courseContainer.insertAdjacentHTML('beforeend', chapterHTML); // Add new course HTML
  });
}
