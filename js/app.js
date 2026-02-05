// Moveo - Movement Made Simple
// Main application JavaScript

// State management
let exercises = [];
let bookmarkedExercises = [];
let currentExercise = null;
let animationSpeed = 1.0;
let isPlaying = false;
let showMuscleHighlight = false;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'exercise') {
    initExercisePage();
    return;
  }
  initializeApp();
});

async function initExercisePage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('exercisePageContent');
  if (!container) return;
  if (!id) {
    container.innerHTML = '<p class="no-exercises">No exercise selected.</p><a href="index.html" class="btn-secondary">← Back to Gallery</a>';
    return;
  }
  await loadExercises();
  const exercise = exercises.find(ex => ex.id === id);
  if (!exercise) {
    container.innerHTML = '<p class="no-exercises">Exercise not found.</p><a href="index.html" class="btn-secondary">← Back to Gallery</a>';
    return;
  }
  loadBookmarks();
  renderExerciseDetail(exercise, { containerId: 'exercisePageContent', backHref: 'index.html', baseUrl: getBaseUrl() });
}

async function initializeApp() {
  // Load exercises data
  await loadExercises();
  
  // Load bookmarks from localStorage
  loadBookmarks();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set daily exercise
  setDailyExercise();
  
  // Render exercise gallery
  renderExerciseGallery();
  
  // Announce page load to screen readers
  announceToScreenReader('Moveo loaded. Use navigation to explore exercises.');
}

// Base URL for relative paths (works from file, local server, or subdirectory like GitHub Pages)
function getBaseUrl() {
  const href = window.location.href;
  const lastSlash = href.lastIndexOf('/');
  return lastSlash >= 0 ? href.slice(0, lastSlash + 1) : href + '/';
}

// Load exercises from JSON file
async function loadExercises() {
  const base = getBaseUrl();
  const url = base + 'data/exercises.json';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to load exercises');
    }
    exercises = await response.json();
  } catch (error) {
    console.error('Error loading exercises:', error);
    showError('Failed to load exercises. Please refresh the page, or open the site from a local server (e.g. live server).');
  }
}

// Load bookmarks from localStorage
function loadBookmarks() {
  const stored = localStorage.getItem('moveoBookmarks');
  if (stored) {
    try {
      bookmarkedExercises = JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing bookmarks:', error);
      bookmarkedExercises = [];
    }
  }
}

// Save bookmarks to localStorage
function saveBookmarks() {
  localStorage.setItem('moveoBookmarks', JSON.stringify(bookmarkedExercises));
}

// Setup event listeners
function setupEventListeners() {
  // Navigation
  const learnMoveBtn = document.getElementById('learnMoveBtn');
  const workoutOfDayBtn = document.getElementById('workoutOfDayBtn');
  
  if (learnMoveBtn) {
    learnMoveBtn.addEventListener('click', () => {
      document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
      announceToScreenReader('Navigated to exercise gallery');
    });
  }
  
  if (workoutOfDayBtn) {
    workoutOfDayBtn.addEventListener('click', () => {
      const dailyExercise = getDailyExercise();
      if (dailyExercise) {
        window.location.href = getBaseUrl() + 'exercise.html?id=' + encodeURIComponent(dailyExercise.id);
      }
    });
  }
  
  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboardNavigation);
}

// Handle keyboard navigation
function handleKeyboardNavigation(event) {
  // Escape key closes modals/overlays
  if (event.key === 'Escape') {
    const tipsOverlay = document.getElementById('tipsOverlay');
    if (tipsOverlay && tipsOverlay.classList.contains('active')) {
      toggleTipsOverlay();
    }
  }
  
  // Space bar toggles play/pause when focused on animation controls
  if (event.target.classList.contains('control-btn') && event.key === ' ') {
    event.preventDefault();
    if (event.target.id === 'playPauseBtn') {
      togglePlayPause();
    }
  }
}

// Render exercise gallery
function renderExerciseGallery() {
  const gallery = document.getElementById('exercisesGrid');
  if (!gallery) return;
  
  if (exercises.length === 0) {
    gallery.innerHTML = '<p class="no-exercises">No exercises available. Please check back soon!</p>';
    return;
  }
  
  gallery.innerHTML = exercises.map(exercise => createExerciseCard(exercise)).join('');
  
  // Add click handlers - navigate to exercise page
  gallery.querySelectorAll('.exercise-card').forEach((card, index) => {
    const exercise = exercises[index];
    const href = getBaseUrl() + 'exercise.html?id=' + encodeURIComponent(exercise.id);
    card.setAttribute('data-href', href);
    card.addEventListener('click', () => { window.location.href = href; });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = href;
      }
    });
  });
}

// Create exercise card HTML
function createExerciseCard(exercise) {
  const isBookmarked = bookmarkedExercises.includes(exercise.id);
  const bookmarkIcon = isBookmarked ? 'bookmarked' : 'bookmark';
  
  return `
    <article class="exercise-card" tabindex="0" role="button" aria-label="View ${exercise.name} exercise">
      <div class="exercise-thumbnail">
        ${exercise.previewVideo ? 
          `<video src="${exercise.previewVideo}" muted loop playsinline aria-hidden="true"></video>` :
          `<div class="placeholder-icon" aria-hidden="true">${getCategoryIcon(exercise.category)}</div>`
        }
      </div>
      <div class="exercise-info">
        <h3>${exercise.name}</h3>
        <p>${exercise.description.substring(0, 100)}${exercise.description.length > 100 ? '...' : ''}</p>
        <div class="exercise-meta">
          <span>⏱️ ${exercise.duration} min</span>
          <span class="difficulty-badge ${exercise.difficulty}">${exercise.difficulty}</span>
          <span>${getCategoryIcon(exercise.category)} ${exercise.category}</span>
        </div>
        <button 
          class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
          onclick="event.stopPropagation(); toggleBookmark('${exercise.id}')"
          aria-label="${isBookmarked ? 'Remove' : 'Add'} ${exercise.name} to bookmarks"
          aria-pressed="${isBookmarked}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
          </svg>
          ${isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>
    </article>
  `;
}

// View exercise detail page
function viewExercise(exerciseId) {
  const exercise = exercises.find(ex => ex.id === exerciseId);
  if (!exercise) {
    showError('Exercise not found');
    return;
  }
  
  currentExercise = exercise;
  
  // Update URL without page reload
  window.history.pushState({ exerciseId }, '', `?exercise=${exerciseId}`);
  
  // Hide gallery, show detail
  document.getElementById('gallery').classList.add('hidden');
  document.getElementById('exerciseDetail').classList.remove('hidden');
  
  renderExerciseDetail(exercise);
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  announceToScreenReader(`Viewing ${exercise.name} exercise`);
}

// Render exercise detail
function renderExerciseDetail(exercise) {
  const detailContainer = document.getElementById('exerciseDetailContent');
  if (!detailContainer) return;
  
  const isBookmarked = bookmarkedExercises.includes(exercise.id);
  
  detailContainer.innerHTML = `
    <div class="exercise-detail">
      <header>
        <h1>${exercise.name}</h1>
        <button 
          class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" 
          onclick="toggleBookmark('${exercise.id}')"
          aria-label="${isBookmarked ? 'Remove' : 'Add'} ${exercise.name} to bookmarks"
          aria-pressed="${isBookmarked}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
          </svg>
          ${isBookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </header>
      
      <div class="exercise-animation-container">
        <div class="animation-display" id="animationDisplay" role="img" aria-label="Animation of ${exercise.name} exercise">
          ${exercise.previewVideo ? 
            `<video id="exerciseVideo" src="${exercise.previewVideo}" muted loop playsinline aria-label="Video demonstration of ${exercise.name}"></video>` :
            `<div class="placeholder-animation" aria-hidden="true">${getCategoryIcon(exercise.category)}</div>`
          }
        </div>
        
        <div class="animation-controls" role="group" aria-label="Animation controls">
          <button 
            id="playPauseBtn" 
            class="control-btn ${isPlaying ? 'active' : ''}" 
            onclick="togglePlayPause()"
            aria-label="${isPlaying ? 'Pause' : 'Play'} animation">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              ${isPlaying ? 
                '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>' :
                '<path d="M8 5v14l11-7z"/>'
              }
            </svg>
            ${isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <button 
            id="slowMotionBtn" 
            class="control-btn ${animationSpeed === 0.5 ? 'active' : ''}" 
            onclick="toggleSlowMotion()"
            aria-label="Toggle slow motion">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M10 8v8l6-4-6-4zm11-5H3v18h18V3zm-2 16H5V5h14v14z"/>
            </svg>
            Slow Motion
          </button>
          
          <button 
            id="highlightMusclesBtn" 
            class="control-btn ${showMuscleHighlight ? 'active' : ''}" 
            onclick="toggleMuscleHighlight()"
            aria-label="Toggle muscle highlight">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Highlight Muscles
          </button>
        </div>
      </div>
      
      <div class="exercise-info">
        <p>${exercise.description}</p>
        
        <div class="exercise-meta">
          <span>⏱️ Duration: ${exercise.duration} minutes</span>
          <span class="difficulty-badge ${exercise.difficulty}">${exercise.difficulty}</span>
          <span>${getCategoryIcon(exercise.category)} ${exercise.category}</span>
        </div>
        
        <div class="muscle-groups">
          <h3>Target Muscles</h3>
          <div id="muscleTags">
            ${exercise.muscleGroups.map(muscle => 
              `<span class="muscle-highlight ${showMuscleHighlight ? 'active' : ''}">${muscle}</span>`
            ).join('')}
          </div>
        </div>
        
        <button 
          class="btn-primary" 
          onclick="toggleTipsOverlay()"
          aria-expanded="false"
          aria-controls="tipsOverlay">
          Show Form Tips
        </button>
      </div>
      
      <div id="tipsOverlay" class="tips-overlay hidden" role="region" aria-labelledby="tipsHeading">
        <h3 id="tipsHeading">Form Tips</h3>
        <ul class="tips-list">
          ${exercise.tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
        
        ${exercise.commonMistakes ? `
          <h3 style="margin-top: 2rem;">Common Mistakes to Avoid</h3>
          <ul class="tips-list" style="list-style-type: disc;">
            ${exercise.commonMistakes.map(mistake => `<li style="color: var(--error);">${mistake}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${exercise.progression ? `
          <h3 style="margin-top: 2rem;">Progression Tips</h3>
          <ul class="tips-list">
            ${exercise.progression.map(step => `<li>${step}</li>`).join('')}
          </ul>
        ` : ''}
        
        ${exercise.rhythm ? `
          <div style="margin-top: 2rem; padding: 1rem; background: var(--light); border-radius: 8px;">
            <strong>💡 Rhythm & Timing:</strong> ${exercise.rhythm}
          </div>
        ` : ''}
      </div>
    </div>
    
    ${backMarkup}
  `;
  
  // Setup video controls if video exists (preview paths relative to current page)
  const video = document.getElementById('exerciseVideo');
  if (video && exercise.previewVideo) {
    video.src = (options && options.baseUrl) ? options.baseUrl + exercise.previewVideo : exercise.previewVideo;
    video.playbackRate = animationSpeed;
    if (isPlaying) {
      video.play().catch(err => console.error('Video play error:', err));
    }
  }
}

// Toggle play/pause
function togglePlayPause() {
  isPlaying = !isPlaying;
  const video = document.getElementById('exerciseVideo');
  const btn = document.getElementById('playPauseBtn');
  
  if (video) {
    if (isPlaying) {
      video.play().catch(err => {
        console.error('Video play error:', err);
        isPlaying = false;
      });
    } else {
      video.pause();
    }
  }
  
  if (btn) {
    btn.classList.toggle('active', isPlaying);
    btn.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        ${isPlaying ? 
          '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>' :
          '<path d="M8 5v14l11-7z"/>'
        }
      </svg>
      ${isPlaying ? 'Pause' : 'Play'}
    `;
    btn.setAttribute('aria-label', `${isPlaying ? 'Pause' : 'Play'} animation`);
  }
  
  announceToScreenReader(`Animation ${isPlaying ? 'playing' : 'paused'}`);
}

// Toggle slow motion
function toggleSlowMotion() {
  animationSpeed = animationSpeed === 1.0 ? 0.5 : 1.0;
  const video = document.getElementById('exerciseVideo');
  const btn = document.getElementById('slowMotionBtn');
  
  if (video) {
    video.playbackRate = animationSpeed;
  }
  
  if (btn) {
    btn.classList.toggle('active', animationSpeed === 0.5);
    btn.setAttribute('aria-label', `Slow motion ${animationSpeed === 0.5 ? 'on' : 'off'}`);
  }
  
  announceToScreenReader(`Slow motion ${animationSpeed === 0.5 ? 'enabled' : 'disabled'}`);
}

// Toggle muscle highlight
function toggleMuscleHighlight() {
  showMuscleHighlight = !showMuscleHighlight;
  const btn = document.getElementById('highlightMusclesBtn');
  const muscleTags = document.querySelectorAll('.muscle-highlight');
  
  if (btn) {
    btn.classList.toggle('active', showMuscleHighlight);
    btn.setAttribute('aria-label', `Muscle highlight ${showMuscleHighlight ? 'on' : 'off'}`);
  }
  
  muscleTags.forEach(tag => {
    tag.classList.toggle('active', showMuscleHighlight);
  });
  
  announceToScreenReader(`Muscle highlight ${showMuscleHighlight ? 'enabled' : 'disabled'}`);
}

// Toggle bookmark
function toggleBookmark(exerciseId) {
  const index = bookmarkedExercises.indexOf(exerciseId);
  
  if (index > -1) {
    bookmarkedExercises.splice(index, 1);
    announceToScreenReader('Exercise removed from bookmarks');
  } else {
    bookmarkedExercises.push(exerciseId);
    announceToScreenReader('Exercise added to bookmarks');
  }
  
  saveBookmarks();
  
  // Update UI
  const exercise = exercises.find(ex => ex.id === exerciseId);
  if (exercise) {
    if (currentExercise && currentExercise.id === exerciseId) {
      renderExerciseDetail(exercise);
    } else {
      renderExerciseGallery();
    }
  }
}

// Toggle tips overlay
function toggleTipsOverlay() {
  const overlay = document.getElementById('tipsOverlay');
  const btn = document.querySelector('[aria-controls="tipsOverlay"]');
  
  if (overlay) {
    overlay.classList.toggle('hidden');
    const isExpanded = !overlay.classList.contains('hidden');
    
    if (btn) {
      btn.setAttribute('aria-expanded', isExpanded);
      btn.textContent = isExpanded ? 'Hide Form Tips' : 'Show Form Tips';
    }
    
    announceToScreenReader(`Form tips ${isExpanded ? 'shown' : 'hidden'}`);
  }
}

// Back to gallery
function backToGallery() {
  document.getElementById('gallery').classList.remove('hidden');
  document.getElementById('exerciseDetail').classList.add('hidden');
  window.history.pushState({}, '', '/');
  announceToScreenReader('Returned to exercise gallery');
}

// Get daily exercise
function getDailyExercise() {
  if (exercises.length === 0) return null;
  const dayIndex = new Date().getDate() % exercises.length;
  return exercises[dayIndex];
}

// Set daily exercise on homepage
function setDailyExercise() {
  const dailyExercise = getDailyExercise();
  const container = document.getElementById('dailyExerciseContent');
  
  if (!container || !dailyExercise) return;
  
  const exerciseUrl = getBaseUrl() + 'exercise.html?id=' + encodeURIComponent(dailyExercise.id);
  container.innerHTML = `
    <h2>${dailyExercise.name}</h2>
    <p>${dailyExercise.description}</p>
    <div class="exercise-meta">
      <span>⏱️ ${dailyExercise.duration} min</span>
      <span class="difficulty-badge ${dailyExercise.difficulty}">${dailyExercise.difficulty}</span>
      <span>${getCategoryIcon(dailyExercise.category)} ${dailyExercise.category}</span>
    </div>
    <a href="${exerciseUrl}" class="btn-primary btn-link">Try It Now</a>
  `;
}

// Get category icon
function getCategoryIcon(category) {
  const icons = {
    strength: '💪',
    cardio: '❤️',
    flexibility: '🧘',
    balance: '⚖️'
  };
  return icons[category] || '⭐';
}

// Announce to screen readers
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.setAttribute('role', 'alert');
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: var(--error);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: fadeInUp 0.3s ease-out;
  `;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.exerciseId) {
    viewExercise(event.state.exerciseId);
  } else {
    backToGallery();
  }
});

// Make functions globally available
window.viewExercise = viewExercise;
window.toggleBookmark = toggleBookmark;
window.togglePlayPause = togglePlayPause;
window.toggleSlowMotion = toggleSlowMotion;
window.toggleMuscleHighlight = toggleMuscleHighlight;
window.toggleTipsOverlay = toggleTipsOverlay;
window.backToGallery = backToGallery;
