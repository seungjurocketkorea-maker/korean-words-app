// DOM Elements
const elements = {
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  statPending: document.getElementById('stat-pending'),
  statLearning: document.getElementById('stat-learning'),
  statMastered: document.getElementById('stat-mastered'),
  
  cardContainer: document.getElementById('word-card-container'),
  cardInner: document.getElementById('word-card-inner'),
  wordFront: document.getElementById('word-front'),
  wordFrontHanja: document.getElementById('word-front-hanja'),
  wordFrontHanjaMeaning: document.getElementById('word-front-hanja-meaning'),
  wordFrontExample: document.getElementById('word-front-example'),
  userMeaningInput: document.getElementById('user-meaning-input'),
  loadingIndicator: document.getElementById('loading-indicator'),

  aiJudgmentArea: document.getElementById('ai-judgment-area'),
  aiJudgmentText: document.getElementById('ai-judgment-text'),
  aiFeedback: document.getElementById('ai-feedback'),
  hanjaBreakdownArea: document.getElementById('hanja-breakdown-area'),
  wordBackHanjaBreakdown: document.getElementById('word-back-hanja-breakdown'),
  wordBackMeaning: document.getElementById('word-back-meaning'),
  wordBackExample: document.getElementById('word-back-example'),
  
  btnSubmit: document.getElementById('btn-submit'),
  btnContainerActions: document.getElementById('btn-container-actions'),
  btnContainerNext: document.getElementById('btn-container-next'),
  
  btnMarkPending: document.getElementById('btn-mark-pending'),
  btnMarkLearning: document.getElementById('btn-mark-learning'),
  btnMarkMastered: document.getElementById('btn-mark-mastered'),
  btnNext: document.getElementById('btn-next'),

  emptyState: document.getElementById('empty-state'),
  cardArea: document.getElementById('card-area')
};

// State
let words = [];
let currentWord = null;
let isFlipped = false;
let isLoading = false;

// Initialize Application
function init() {
  loadData();
  updateDashboard();
  loadNextWord();
  setupEventListeners();
}

// Data Management
function loadData() {
  const stored = localStorage.getItem('kWordMasterData');
  if (stored) {
    const parsed = JSON.parse(stored);
    // Force reload dummyData if first word doesn't match new schema (data reset)
    if (parsed.length > 0 && !parsed[0].hanjaMeaning) {
      words = [...dummyData];
      saveData();
    } else {
      words = parsed;
    }
  } else {
      words = [...dummyData];
      saveData();
  }
}

function saveData() {
  localStorage.setItem('kWordMasterData', JSON.stringify(words));
  updateDashboard();
}

// UI Updates
function updateDashboard() {
  const total = words.length;
  const pending = words.filter(w => w.status === 'pending').length;
  const learning = words.filter(w => w.status === 'learning').length;
  const mastered = words.filter(w => w.status === 'mastered').length;

  const progressPercent = total === 0 ? 0 : Math.round((mastered / total) * 100);

  elements.progressBar.style.width = `${progressPercent}%`;
  elements.progressText.textContent = `${progressPercent}%`;

  elements.statPending.textContent = pending;
  elements.statLearning.textContent = learning;
  elements.statMastered.textContent = mastered;
}

// Logic: Get next word to study
function getNextWordToStudy() {
  let candidates = words.filter(w => w.status === 'learning');
  if (candidates.length === 0) {
    candidates = words.filter(w => w.status === 'pending');
  }
  
  if (candidates.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

function loadNextWord() {
  currentWord = getNextWordToStudy();
  
  if (!currentWord) {
    elements.cardArea.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    return;
  }
  
  elements.cardArea.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');

  // Reset UI
  isFlipped = false;
  isLoading = false;
  elements.userMeaningInput.value = '';
  elements.userMeaningInput.disabled = false;
  elements.cardContainer.classList.remove('card-flipped');
  elements.btnContainerActions.classList.add('hidden');
  elements.btnContainerNext.classList.add('hidden');
  elements.btnSubmit.classList.remove('hidden');
  elements.btnSubmit.disabled = false;
  elements.loadingIndicator.classList.add('hidden');
  elements.loadingIndicator.classList.remove('flex');
  
  elements.userMeaningInput.focus();

  elements.wordFront.textContent = currentWord.word;
  elements.wordFrontHanja.textContent = currentWord.hanja && currentWord.hanja !== "고유어" ? `(${currentWord.hanja})` : "";
  elements.wordFrontHanjaMeaning.textContent = currentWord.hanjaMeaning || "";
  elements.wordFrontExample.textContent = `"${currentWord.example}"`;
  
  elements.hanjaBreakdownArea.classList.add('hidden');
}

// Interactivity / Form Submit
async function submitAnswer() {
  if (!currentWord || isFlipped || isLoading) return;
  
  const userAnswer = elements.userMeaningInput.value.trim();
  if (!userAnswer) {
    alert('단어의 뜻을 먼저 입력해주세요!');
    elements.userMeaningInput.focus();
    return;
  }

  // Set Loading State
  isLoading = true;
  elements.userMeaningInput.disabled = true;
  elements.btnSubmit.disabled = true;
  elements.loadingIndicator.classList.remove('hidden');
  elements.loadingIndicator.classList.add('flex');

  // Call AI (Mock vs Real Endpoint)
  // 향후 worker.js가 배포되면 아래 함수가 실제 fetch() 로 교체됩니다.
  const aiResult = await checkAnswerWithAI(currentWord, userAnswer);

  // Parse Result & Show Back
  renderAIResult(aiResult);
  
  isLoading = false;
  elements.loadingIndicator.classList.add('hidden');
  elements.loadingIndicator.classList.remove('flex');
  
  // Flip Card
  isFlipped = true;
  elements.cardContainer.classList.add('card-flipped');
  
  setTimeout(() => {
    elements.btnSubmit.classList.add('hidden');
    elements.btnContainerActions.classList.remove('hidden');
  }, 150);
}

// AI Mock function (Will be replaced with real logic)
async function checkAnswerWithAI(wordObject, userAnswer) {
  // 실제 연동 전, 1.5초 대기하며 결과 모의(Mocking)
  return new Promise((resolve) => {
    setTimeout(() => {
      let isCorrect = "incorrect";
      let message = "원래 의미와는 조금 거리가 있네요. 정답을 확인해보세요.";
      const correctMeaning = wordObject.meaning;
      const threshold = correctMeaning.length > 5 ? 4 : 2;
      
      if (userAnswer.length >= correctMeaning.length * 0.8) {
        isCorrect = "correct";
        message = "완벽합니다! 맥락을 아주 잘 파악하셨어요.";
      } else if (userAnswer.length >= threshold) {
        isCorrect = "partial";
        message = "어느 정도 의미는 통하지만, 정확한 뉘앙스는 다를 수 있어요.";
      }

      let breakDownText = "";
      if (wordObject.hanja && wordObject.hanja !== "고유어") {
        breakDownText = `${wordObject.hanja} : AI가 이 한자의 음과 뜻을 분리하여 설명해주고, 왜 이런 뜻이 되었는지 풀이해 줍니다.`;
      }

      resolve({
        isCorrect: isCorrect,
        feedback: message,
        exactMeaning: correctMeaning,
        exampleSentence: `AI가 새롭게 생성한 예문: <strong>${wordObject.word}</strong>를 이렇게 쓸 수도 있어요.`,
        hanjaBreakdown: breakDownText
      });
    }, 1500);
  });
}

function renderAIResult(aiResult) {
  elements.wordBackMeaning.textContent = aiResult.exactMeaning;
  elements.wordBackExample.innerHTML = aiResult.exampleSentence; // innerHTML for safe styling
  elements.aiFeedback.textContent = aiResult.feedback;

  if (aiResult.hanjaBreakdown) {
    elements.hanjaBreakdownArea.classList.remove('hidden');
    elements.wordBackHanjaBreakdown.textContent = aiResult.hanjaBreakdown;
  } else {
    elements.hanjaBreakdownArea.classList.add('hidden');
  }

  elements.aiJudgmentArea.classList.remove('bg-green-100', 'bg-yellow-100', 'bg-red-100', 'bg-[#E8EDE1]', 'bg-[#F2E5C9]', 'bg-[#E6C9C9]');
  elements.aiJudgmentText.classList.remove('text-green-700', 'text-yellow-700', 'text-red-700', 'text-[#556343]', 'text-[#8C6D2C]', 'text-[#994D4D]');

  if (aiResult.isCorrect === 'correct') {
    elements.aiJudgmentArea.classList.add('bg-[#E8EDE1]');
    elements.aiJudgmentText.classList.add('text-[#556343]');
    elements.aiJudgmentText.textContent = "정답입니다! 👏";
  } else if (aiResult.isCorrect === 'partial') {
    elements.aiJudgmentArea.classList.add('bg-[#F2E5C9]');
    elements.aiJudgmentText.classList.add('text-[#8C6D2C]');
    elements.aiJudgmentText.textContent = "부분 점수! 🥲";
  } else {
    elements.aiJudgmentArea.classList.add('bg-[#E6C9C9]');
    elements.aiJudgmentText.classList.add('text-[#994D4D]');
    elements.aiJudgmentText.textContent = "아닙니다 😅";
  }
}

function updateWordStatus(newStatus) {
  if (!currentWord) return;
  
  const index = words.findIndex(w => w.id === currentWord.id);
  if (index !== -1) {
    words[index].status = newStatus;
    saveData();
  }
  
  elements.btnContainerActions.classList.add('hidden');
  elements.btnContainerNext.classList.remove('hidden');
}

// Event Listeners
function setupEventListeners() {
  elements.btnSubmit.addEventListener('click', () => {
    submitAnswer();
  });

  // Enter key support for textarea (Ctrl+Enter for textareas usually)
  elements.userMeaningInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      submitAnswer();
    }
  });

  elements.btnMarkPending.addEventListener('click', () => updateWordStatus('pending'));
  elements.btnMarkLearning.addEventListener('click', () => updateWordStatus('learning'));
  elements.btnMarkMastered.addEventListener('click', () => updateWordStatus('mastered'));

  elements.btnNext.addEventListener('click', () => {
    loadNextWord();
  });
}

// Boot
init();
