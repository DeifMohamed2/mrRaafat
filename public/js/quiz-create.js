/**
 * Quiz Creation JavaScript
 * Handles quiz creation, question management, and image uploads
 */

// Quiz Creation JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
            }
        });
    }
    
    // Toggle price field based on payment status
    const prepaidStatusSelect = document.getElementById('prepaidStatus');
    const priceGroup = document.getElementById('priceGroup');
    
    if (prepaidStatusSelect && priceGroup) {
        prepaidStatusSelect.addEventListener('change', function() {
            priceGroup.style.display = this.value === 'true' ? 'block' : 'none';
        });
    }
    
    // Questions Management
    const questions = [];
    let currentEditingIndex = -1;
    const questionsContainer = document.getElementById('questionsContainer');
    const noQuestionsMessage = document.getElementById('noQuestionsMessage');
    const questionTemplate = document.getElementById('questionTemplate');
    const questionsDataInput = document.getElementById('questionsData');
    
    // Add Question Button
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', function() {
            openQuestionModal();
        });
    }
    
    // Question Modal Elements
    const questionModal = document.getElementById('questionModal');
    const modalTitle = document.getElementById('modalTitle');
    const questionTitle = document.getElementById('questionTitle');
    const questionImageURL = document.getElementById('questionImageURL');
    const questionImagePreview = document.getElementById('questionImagePreview');
    const questionImageDisplay = document.getElementById('questionImageDisplay');
    const correctAnswer = document.getElementById('correctAnswer');
    const answer1 = document.getElementById('answer1');
    const answer2 = document.getElementById('answer2');
    const answer3 = document.getElementById('answer3');
    const answer4 = document.getElementById('answer4');
    
    // Upload progress elements
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadStatusText = document.getElementById('uploadStatusText');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    // Close Modal Events
    const modalClose = document.querySelector('.modal-close');
    const modalCancel = document.querySelector('.modal-cancel');
    const modalOverlay = document.querySelector('.modal-overlay');
    
    if (modalClose) modalClose.addEventListener('click', closeQuestionModal);
    if (modalCancel) modalCancel.addEventListener('click', closeQuestionModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeQuestionModal);
    
    // Correct Answer Selection
    if (correctAnswer) {
        correctAnswer.addEventListener('change', function() {
            // Hide all indicators
            document.querySelectorAll('.correct-indicator').forEach(indicator => {
                indicator.style.display = 'none';
            });
            
            // Show the selected correct answer indicator
            const selectedIndicator = document.querySelector(`[data-option="${this.value}"].correct-indicator`);
            if (selectedIndicator) {
                selectedIndicator.style.display = 'inline';
            }
        });
    }
    
    // Save Question Button
    const saveQuestionBtn = document.getElementById('saveQuestionBtn');
    if (saveQuestionBtn) {
        saveQuestionBtn.addEventListener('click', function() {
            if (!validateQuestionForm()) {
                return;
            }
            
            const question = {
                id: currentEditingIndex >= 0 ? questions[currentEditingIndex].id : Date.now().toString(),
                title: questionTitle.value.trim(),
                questionPhoto: questionImageURL.value.trim(),
                answer1: answer1.value.trim(),
                answer2: answer2.value.trim(),
                answer3: answer3.value.trim(),
                answer4: answer4.value.trim(),
                ranswer: parseInt(correctAnswer.value) // Selected correct answer
            };
            
            if (currentEditingIndex >= 0) {
                // Edit existing question
                questions[currentEditingIndex] = question;
            } else {
                // Add new question
                questions.push(question);
            }
            
            updateQuestionsDisplay();
            closeQuestionModal();
        });
    }
    
    // Image Upload Button - Cloudinary Integration
    const uploadQuestionImageBtn = document.getElementById('uploadQuestionImageBtn');
    if (uploadQuestionImageBtn) {
        uploadQuestionImageBtn.addEventListener('click', function() {
            openCloudinaryWidget();
        });
    }
    
    // Form Submission
    const quizForm = document.getElementById('quizForm');
    if (quizForm) {
        quizForm.addEventListener('submit', function(event) {
            if (questions.length === 0) {
                event.preventDefault();
                alert('يرجى إضافة سؤال واحد على الأقل');
                return;
            }
            
            const questionsToShow = parseInt(document.getElementById('questionsToShow').value);
            if (questionsToShow > questions.length) {
                event.preventDefault();
                alert(`لا يمكن اختيار ${questionsToShow} سؤال عشوائي لأن عدد الأسئلة الكلي هو ${questions.length} فقط`);
                return;
            }
        });
    }
    
    // Functions
    function openQuestionModal(index = -1) {
        currentEditingIndex = index;
        
        if (index >= 0) {
            // Edit mode
            const question = questions[index];
            modalTitle.textContent = 'تعديل السؤال';
            questionTitle.value = question.title;
            questionImageURL.value = question.questionPhoto || '';
            correctAnswer.value = question.ranswer || 1;
            answer1.value = question.answer1;
            answer2.value = question.answer2;
            answer3.value = question.answer3;
            answer4.value = question.answer4;
            
            // Show correct answer indicator
            document.querySelectorAll('.correct-indicator').forEach(indicator => {
                indicator.style.display = 'none';
            });
            const selectedIndicator = document.querySelector(`[data-option="${question.ranswer}"]`);
            if (selectedIndicator && selectedIndicator.classList.contains('correct-indicator')) {
                selectedIndicator.style.display = 'inline';
            }
            
            if (question.questionPhoto) {
                questionImageDisplay.src = question.questionPhoto;
                questionImagePreview.style.display = 'block';
            } else {
                questionImagePreview.style.display = 'none';
            }
        } else {
            // Add mode
            modalTitle.textContent = 'إضافة سؤال جديد';
            questionTitle.value = '';
            questionImageURL.value = '';
            correctAnswer.value = '1';
            answer1.value = '';
            answer2.value = '';
            answer3.value = '';
            answer4.value = '';
            questionImagePreview.style.display = 'none';
            
            // Show first option as correct by default
            document.querySelectorAll('.correct-indicator').forEach(indicator => {
                indicator.style.display = 'none';
            });
            const firstIndicator = document.querySelector('[data-option="1"]');
            if (firstIndicator && firstIndicator.classList.contains('correct-indicator')) {
                firstIndicator.style.display = 'inline';
            }
        }
        
        questionModal.classList.add('active');
    }
    
    function closeQuestionModal() {
        questionModal.classList.remove('active');
        currentEditingIndex = -1;
    }
    
    function validateQuestionForm() {
        const fields = [
            { el: questionTitle, name: 'نص السؤال' },
            { el: answer1, name: 'الخيار الأول' },
            { el: answer2, name: 'الخيار الثاني' },
            { el: answer3, name: 'الخيار الثالث' },
            { el: answer4, name: 'الخيار الرابع' }
        ];
        
        for (const field of fields) {
            if (!field.el.value.trim()) {
                alert(`يرجى إدخال ${field.name}`);
                field.el.focus();
                return false;
            }
        }
        
        return true;
    }
    
    function updateQuestionsDisplay() {
        // Update hidden input with questions data
        questionsDataInput.value = JSON.stringify(questions);
        
        // Clear container
        questionsContainer.innerHTML = '';
        
        // Show/hide empty state
        if (questions.length === 0) {
            questionsContainer.appendChild(noQuestionsMessage);
            return;
        }
        
        // Add question cards
        questions.forEach((question, index) => {
            const questionCard = questionTemplate.content.cloneNode(true);
            const cardElement = questionCard.querySelector('.question-card');
            
            // Set question ID
            cardElement.dataset.questionId = question.id;
            
            // Set question number
            cardElement.querySelector('.question-index').textContent = index + 1;
            
            // Set question text
            cardElement.querySelector('.question-text').textContent = question.title;
            
            // Set question image if exists
            if (question.questionPhoto) {
                const imageContainer = cardElement.querySelector('.question-image-container');
                const image = cardElement.querySelector('.question-image');
                image.src = question.questionPhoto;
                imageContainer.style.display = 'block';
            }
            
            // Set options text and mark correct answer
            const optionElements = cardElement.querySelectorAll('.option');
            optionElements[0].querySelector('.option-text').textContent = question.answer1;
            optionElements[1].querySelector('.option-text').textContent = question.answer2;
            optionElements[2].querySelector('.option-text').textContent = question.answer3;
            optionElements[3].querySelector('.option-text').textContent = question.answer4;
            
            // Mark the correct answer
            optionElements.forEach((option, idx) => {
                option.classList.remove('correct-option');
                if (idx + 1 === question.ranswer) {
                    option.classList.add('correct-option');
                }
            });
            
            // Add event listeners
            cardElement.querySelector('.edit-question').addEventListener('click', function() {
                openQuestionModal(index);
            });
            
            cardElement.querySelector('.delete-question').addEventListener('click', function() {
                if (confirm('هل أنت متأكد من حذف هذا السؤال؟')) {
                    questions.splice(index, 1);
                    updateQuestionsDisplay();
                }
            });
            
            questionsContainer.appendChild(cardElement);
        });
    }
    
    // Initialize empty state
    updateQuestionsDisplay();
    
    // Cloudinary Upload Widget Function
    function openCloudinaryWidget() {
        if (!uploadQuestionImageBtn) return;
        
        // Disable upload button and show uploading state
        uploadQuestionImageBtn.disabled = true;
        uploadQuestionImageBtn.classList.add('upload-btn-uploading');
        uploadQuestionImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحميل...';
        
        // Show progress container
        if (uploadProgress) {
            uploadProgress.style.display = 'block';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            uploadStatusText.textContent = 'جاري رفع الصورة...';
        }
        
        const uploadWidget = cloudinary.createUploadWidget({
            cloudName: 'dusod9wxt', // From the chapter-create.ejs file
            uploadPreset: 'order_project', // From the chapter-create.ejs file
            sources: ['local', 'url', 'camera'],
            multiple: false,
            maxFileSize: 10000000, // 10MB
            resourceType: 'image',
            folder: 'quiz_images',
            clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            styles: {
                palette: {
                    window: "#FFFFFF",
                    windowBorder: "#90A0B3",
                    tabIcon: "#4F46E5",
                    menuIcons: "#5A616A",
                    textDark: "#000000",
                    textLight: "#FFFFFF",
                    link: "#4F46E5",
                    action: "#4F46E5",
                    inactiveTabIcon: "#0E2F5A",
                    error: "#F44235",
                    inProgress: "#4F46E5",
                    complete: "#20B832",
                    sourceBg: "#E4EBF1"
                },
                fonts: {
                    default: {
                        active: true
                    }
                }
            }
        }, (error, result) => {
            if (error) {
                console.error('Upload error:', error);
                handleUploadError();
                return;
            }
            
            if (result.event === 'upload-progress' && progressFill && progressText) {
                const percent = Math.round(result.data.percent);
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `${percent}%`;
                uploadStatusText.textContent = `جاري الرفع... ${percent}%`;
            }
            
            if (result.event === 'success') {
                handleUploadSuccess(result.info.secure_url);
            }
            
            if (result.event === 'close') {
                // Reset button if upload was cancelled
                resetUploadButton();
            }
        });
        
        uploadWidget.open();
    }
    
    function handleUploadSuccess(imageUrl) {
        // Set the image URL to the hidden input
        questionImageURL.value = imageUrl;
        
        // Update the image preview
        questionImageDisplay.src = imageUrl;
        questionImagePreview.style.display = 'block';
        
        // Update progress to 100%
        if (progressFill && progressText) {
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            uploadStatusText.innerHTML = '<i class="fas fa-check"></i> تم رفع الصورة بنجاح!';
        }
        
        // Update button to success state
        uploadQuestionImageBtn.classList.remove('upload-btn-uploading');
        uploadQuestionImageBtn.classList.add('upload-btn-success');
        uploadQuestionImageBtn.innerHTML = '<i class="fas fa-check"></i> تم الرفع بنجاح';
        
        // Hide progress after 2 seconds
        setTimeout(() => {
            if (uploadProgress) {
                uploadProgress.style.display = 'none';
            }
            resetUploadButton();
        }, 2000);
    }
    
    function handleUploadError() {
        // Update button to error state
        uploadQuestionImageBtn.classList.remove('upload-btn-uploading');
        uploadQuestionImageBtn.classList.add('upload-btn-error');
        uploadQuestionImageBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> خطأ في الرفع';
        
        if (uploadStatusText) {
            uploadStatusText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> فشل في رفع الصورة';
        }
        
        // Reset after 3 seconds
        setTimeout(() => {
            if (uploadProgress) {
                uploadProgress.style.display = 'none';
            }
            resetUploadButton();
        }, 3000);
    }
    
    function resetUploadButton() {
        uploadQuestionImageBtn.disabled = false;
        uploadQuestionImageBtn.classList.remove('upload-btn-uploading', 'upload-btn-success', 'upload-btn-error');
        uploadQuestionImageBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> تحميل صورة';
    }
}); 