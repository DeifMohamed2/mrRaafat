/**
 * Quiz Taking JavaScript
 * Handles quiz timer, question navigation, and answer submission
 */

// Global variables
let quizData = {};
let userAnswers = [];
let timerInterval;
let endTime;
let currentQuestionNumber = 1;
let totalQuestions = 1;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Quiz taking JS loaded');
  
  // Get quiz data from the page
  const quizIdElement = document.querySelector('[data-quiz-id]');
  if (quizIdElement) {
    quizData.quizId = quizIdElement.getAttribute('data-quiz-id');
    currentQuestionNumber = parseInt(quizIdElement.getAttribute('data-current-question')) || 1;
    totalQuestions = parseInt(quizIdElement.getAttribute('data-total-questions')) || 1;
    endTime = new Date(quizIdElement.getAttribute('data-end-time')).getTime();
    
    console.log('Quiz data loaded:', {
      quizId: quizData.quizId,
      currentQuestion: currentQuestionNumber,
      totalQuestions: totalQuestions,
      endTime: new Date(endTime)
    });
    
    // Initialize quiz
    initializeQuiz();
  }
});

function initializeQuiz() {
  // Load saved answers
  loadSavedAnswers();
  
  // Initialize timer
  initializeTimer();
  
  // Update navigation
  updateQuestionNavigation();
  
  // Setup event listeners
  setupEventListeners();
}

function loadSavedAnswers() {
  const storageKey = 'quizAnswers_' + quizData.quizId;
  userAnswers = JSON.parse(localStorage.getItem(storageKey) || '[]');
  
  // Ensure array is properly sized
  while (userAnswers.length < totalQuestions) {
    userAnswers.push(null);
  }
  
  console.log('Loaded answers:', userAnswers);
  
  // Apply saved answer for current question
  const questionIndex = currentQuestionNumber - 1;
  if (userAnswers[questionIndex]) {
    const answerElement = document.getElementById(userAnswers[questionIndex]);
    if (answerElement) {
      answerElement.checked = true;
      answerElement.closest('.answer-option').classList.add('selected');
      console.log('Applied saved answer:', userAnswers[questionIndex]);
    }
  }
}

function initializeTimer() {
  if (!endTime || isNaN(endTime)) {
    console.error('Invalid end time');
    return;
  }
  
  console.log('Initializing timer with end time:', new Date(endTime));
  
  function updateTimer() {
    const now = new Date().getTime();
    const timeLeft = Math.max(0, endTime - now);
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert('انتهى وقت الامتحان! سيتم تسليم إجاباتك تلقائياً.');
      submitQuiz();
      return;
    }

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    const timeElement = document.getElementById('timeRemaining');
    if (timeElement) {
      timeElement.textContent = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }
    
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
      timerDisplay.classList.remove('warning', 'danger');
      if (minutes < 5 && minutes >= 2) {
        timerDisplay.classList.add('warning');
      } else if (minutes < 2) {
        timerDisplay.classList.add('danger');
      }
    }
  }
  
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function setupEventListeners() {
  // Answer selection
  document.querySelectorAll('.answer-option').forEach(function(option) {
    option.addEventListener('click', function() {
      const answerId = this.querySelector('input[type="radio"]').value;
      selectAnswer(this, answerId);
    });
  });
  
  // Prevent context menu and shortcuts
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'U')) {
      e.preventDefault();
    }
  });
}

function selectAnswer(element, answerId) {
  console.log('Selecting answer:', answerId, 'for question:', currentQuestionNumber);
  
  // Remove selection from all options
  document.querySelectorAll('.answer-option').forEach(function(option) {
    option.classList.remove('selected');
  });
  
  // Add selection to clicked option
  element.classList.add('selected');
  
  // Check the radio button
  const radioButton = document.getElementById(answerId);
  if (radioButton) {
    radioButton.checked = true;
  }
  
  // Save to localStorage
  const questionIndex = currentQuestionNumber - 1;
  userAnswers[questionIndex] = answerId;
  
  const storageKey = 'quizAnswers_' + quizData.quizId;
  localStorage.setItem(storageKey, JSON.stringify(userAnswers));
  
  console.log('Saved answer to localStorage:', userAnswers);
  
  // Save to server
  saveAnswerToServer(questionIndex, answerId);
  
  // Show auto-save indicator
  showAutoSaveIndicator();
  
  // Update navigation
  updateQuestionNavigation();
}

function saveAnswerToServer(questionIndex, answerId) {
  if (!quizData.quizId) return;
  
  fetch('/student/quiz-save-answer/' + quizData.quizId, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      questionIndex: questionIndex,
      answer: answerId,
      allAnswers: userAnswers
    })
  }).catch(function(error) {
    console.error('Error saving answer to server:', error);
  });
}

function showAutoSaveIndicator() {
  const indicator = document.getElementById('autoSaveIndicator');
  if (indicator) {
    indicator.classList.add('show');
    setTimeout(function() { 
      indicator.classList.remove('show'); 
    }, 2000);
  }
}

function updateQuestionNavigation() {
  const navButtons = document.querySelectorAll('.question-nav-btn');
  
  navButtons.forEach(function(btn, index) {
    btn.classList.remove('answered');
    if (userAnswers[index]) {
      btn.classList.add('answered');
    }
  });
  
  // Update answered count in modal
  const answeredCount = userAnswers.filter(function(answer) { 
    return answer; 
  }).length;
  
  const countElement = document.getElementById('answeredCount');
  if (countElement) {
    countElement.textContent = answeredCount;
  }
}

function nextQuestion() {
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<div class="spinner"></div> جاري التحميل...';
  }
  
  // Save current answer before navigation
  const selectedAnswer = document.querySelector('input[name="answer"]:checked');
  if (selectedAnswer) {
    const questionIndex = currentQuestionNumber - 1;
    userAnswers[questionIndex] = selectedAnswer.value;
    localStorage.setItem('quizAnswers_' + quizData.quizId, JSON.stringify(userAnswers));
    saveAnswerToServer(questionIndex, selectedAnswer.value);
  }
  
  window.location.href = '/student/quiz-taking/' + quizData.quizId + '?qNumber=' + (currentQuestionNumber + 1);
}

function showSubmitModal() {
  updateQuestionNavigation();
  const modal = document.getElementById('submitModal');
  if (modal) {
    modal.classList.add('show');
  }
}

function closeSubmitModal() {
  const modal = document.getElementById('submitModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function submitQuiz() {
  clearInterval(timerInterval);
  
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner"></div> جاري التسليم...';
  }

  console.log('Submitting quiz with answers:', userAnswers.slice(0, totalQuestions));
  console.log('Total questions shown:', totalQuestions);
  
  // Submit to server (let server calculate score)
  fetch('/student/quiz-taking/' + quizData.quizId, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      answers: userAnswers.slice(0, totalQuestions) // Only send answers for questions shown
    })
  })
  .then(function(response) { 
    return response.json(); 
  })
  .then(function(data) {
    if (data.success) {
      localStorage.removeItem('quizAnswers_' + quizData.quizId);
      closeSubmitModal();
      
             const finalScoreElement = document.getElementById('finalScore');
       const maxScoreElement = document.getElementById('maxScore');
       
       console.log('External JS - Quiz finish response data:', data);
       console.log('External JS - Updating final score to:', data.score);
       console.log('External JS - Updating max score to:', data.maxScore);
       
       if (finalScoreElement) {
         finalScoreElement.textContent = data.score || 0;
       }
       if (maxScoreElement) {
         // Always update maxScore from server response, fallback to totalQuestions if not provided
         maxScoreElement.textContent = data.maxScore || totalQuestions;
       }
      
      const successModal = document.getElementById('successModal');
      if (successModal) {
        successModal.classList.add('show');
      }
    } else {
      alert('حدث خطأ في تسليم الامتحان. يرجى المحاولة مرة أخرى.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> تأكيد التسليم';
      }
    }
  })
  .catch(function(error) {
    console.error('Error:', error);
    alert('حدث خطأ في تسليم الامتحان. يرجى المحاولة مرة أخرى.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> تأكيد التسليم';
    }
  });
}

function goToExams() {
  window.location.href = '/student/exams';
}

function previewImage(imageSrc) {
  const modal = document.getElementById('imagePreviewModal');
  const previewImg = document.getElementById('previewImage');
  
  if (modal && previewImg) {
    previewImg.src = imageSrc;
    modal.classList.add('show');
    
    modal.onclick = function(e) {
      if (e.target === modal) {
        closeImagePreview();
      }
    };
  }
}

function closeImagePreview() {
  const modal = document.getElementById('imagePreviewModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Global functions for backward compatibility
window.selectAnswer = selectAnswer;
window.nextQuestion = nextQuestion;
window.showSubmitModal = showSubmitModal;
window.closeSubmitModal = closeSubmitModal;
window.submitQuiz = submitQuiz;
window.goToExams = goToExams;
window.previewImage = previewImage;
window.closeImagePreview = closeImagePreview; 