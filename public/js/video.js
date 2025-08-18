// Video Player JavaScript - FIXED Backend Integration with Correct Property Names

// Global variables
let videoData = null;
let videoElement = null;
let isVideoLoaded = false;
let playbackSpeed = 1;
let relatedVideos = [];

// Control fade variables
let controlsTimer;
let controlsFadeTimer;
let isControlsVisible = true;

// Get video ID from URL
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id');

// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const theatreContainer = document.getElementById('theatreContainer');
const videoTitleHeader = document.getElementById('videoTitleHeader');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const progressBar = document.getElementById('progressBar');
const timeDisplay = document.getElementById('timeDisplay');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteBtn = document.getElementById('muteBtn');
const speedBtn = document.getElementById('speedBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// Mobile DOM elements
const timeDisplayMobile = document.getElementById('timeDisplayMobile');
const playPauseBtnMobile = document.getElementById('playPauseBtnMobile');
const muteBtnMobile = document.getElementById('muteBtnMobile');
const speedBtnMobile = document.getElementById('speedBtnMobile');
const fullscreenBtnMobile = document.getElementById('fullscreenBtnMobile');
const mobileVerticalFullscreen = document.getElementById('mobileVerticalFullscreen');

// Mobile orientation tracking
let isMobileFullscreen = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!videoId) {
        showError('No video ID provided');
        return;
    }

    createSpaceBackground();
    loadVideo();
    initializeControlsFading();
});

// Initialize controls fading functionality
function initializeControlsFading() {
    const topControls = document.querySelector('.top-controls');
    const bottomControls = document.querySelector('.bottom-controls');

    // Add event listeners for mouse movement and activity
    document.addEventListener('mousemove', showControlsAndResetTimer);
    document.addEventListener('mouseenter', showControlsAndResetTimer);
    document.addEventListener('click', showControlsAndResetTimer);
    document.addEventListener('keydown', showControlsAndResetTimer);

    // Add event listeners specifically for control areas to keep them visible
    topControls.addEventListener('mouseenter', () => {
        clearTimeout(controlsFadeTimer);
        showControls();
    });

    bottomControls.addEventListener('mouseenter', () => {
        clearTimeout(controlsFadeTimer);
        showControls();
    });

    topControls.addEventListener('mouseleave', () => {
        if (videoElement && !videoElement.paused) {
            startControlsFadeTimer();
        }
    });

    bottomControls.addEventListener('mouseleave', () => {
        if (videoElement && !videoElement.paused) {
            startControlsFadeTimer();
        }
    });
}

// Show controls and reset fade timer
function showControlsAndResetTimer() {
    showControls();

    // Only start fade timer if video is playing
    if (videoElement && !videoElement.paused) {
        startControlsFadeTimer();
    }
}

// Show controls
function showControls() {
    clearTimeout(controlsFadeTimer);
    const topControls = document.querySelector('.top-controls');
    const bottomControls = document.querySelector('.bottom-controls');

    if (topControls && bottomControls) {
        topControls.style.opacity = '1';
        topControls.style.transform = 'translateY(0)';
        bottomControls.style.opacity = '1';
        bottomControls.style.transform = 'translateY(0)';
        isControlsVisible = true;
    }

    document.body.style.cursor = 'default';
}

// Hide controls
function hideControls() {
    const topControls = document.querySelector('.top-controls');
    const bottomControls = document.querySelector('.bottom-controls');

    if (topControls && bottomControls && videoElement && !videoElement.paused) {
        topControls.style.opacity = '0';
        topControls.style.transform = 'translateY(-100%)';
        bottomControls.style.opacity = '0';
        bottomControls.style.transform = 'translateY(100%)';
        isControlsVisible = false;
        document.body.style.cursor = 'none';
    }
}

// Start controls fade timer (3.4 seconds)
function startControlsFadeTimer() {
    clearTimeout(controlsFadeTimer);
    controlsFadeTimer = setTimeout(() => {
        hideControls();
    }, 3400); // 3.4 seconds
}

// Add click-to-pause functionality to video player area
function initializeVideoClickHandler() {
    const videoPlayer = document.querySelector('.video-player');

    videoPlayer.addEventListener('click', (e) => {
        // Only trigger if clicking on the video player area, not on controls
        if (e.target === videoPlayer || e.target === videoElement) {
            playPause();
        }
    });
}

// Create animated space background
function createSpaceBackground() {
    const container = document.getElementById('spaceParticles');
    const starCount = 80;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';

        const sizes = ['small', 'medium'];
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        star.classList.add(randomSize);

        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 4 + 's';

        container.appendChild(star);
    }
}

// Load video from backend using correct API endpoint
async function loadVideo() {
    try {
        showLoading(true);

        console.log(`🔍 Loading video with ID: ${videoId}`);

        // Use correct API endpoint that exists in server.js
        const response = await fetch(`/api/video/${videoId}`);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Video not found');
            }
            throw new Error(`Server error: ${response.status}`);
        }

        videoData = await response.json();
        console.log('✅ Video data loaded:', videoData);

        // Debug: Check what properties we received
        console.log('📝 Available properties:', Object.keys(videoData));
        console.log('📁 Filename property:', videoData.filename);
        console.log('📁 File property:', videoData.file);
        console.log('📁 Src property:', videoData.src);

        // Setup video element
        setupVideoPlayer();

        // Populate video info
        populateVideoInfo();

        // Load related videos
        loadRelatedVideos();

        // Show the player
        showPlayer();

    } catch (error) {
        console.error('❌ Error loading video:', error);
        showError(error.message);
    }
}

// FIXED: Setup video player with correct property names
function setupVideoPlayer() {
    videoElement = document.getElementById('videoElement');
    const videoSource = document.getElementById('videoSource');

    // FIXED: Use correct property name - try multiple fallbacks
    let videoSrc;

    if (videoData.src) {
        // Use pre-constructed src path if available
        videoSrc = videoData.src;
        console.log('✅ Using src property:', videoSrc);
    } else if (videoData.filename) {
        // Construct path from filename
        videoSrc = `/videos/${videoData.filename}`;
        console.log('✅ Using filename property:', videoSrc);
    } else if (videoData.file) {
        // Fallback to file property if it exists
        videoSrc = `/videos/${videoData.file}`;
        console.log('⚠️ Using file property fallback:', videoSrc);
    } else {
        console.error('❌ No valid video file property found');
        showError('Video file path not found');
        return;
    }

    videoSource.src = videoSrc;
    console.log('🎬 Video source set to:', videoSource.src);

    // IMPORTANT: Remove any controls attributes and disable all default controls
    videoElement.removeAttribute('controls');
    videoElement.setAttribute('controlslist', 'nodownload nofullscreen noremoteplaybook');
    videoElement.setAttribute('disablepictureinpicture', '');

    // Video event listeners
    videoElement.addEventListener('loadedmetadata', () => {
        isVideoLoaded = true;
        updateTimeDisplay();
        // Initialize click handler after video is loaded
        initializeVideoClickHandler();
        console.log('✅ Video metadata loaded successfully');
    });

    videoElement.addEventListener('timeupdate', () => {
        updateProgressBar();
        updateTimeDisplay();
    });

    videoElement.addEventListener('ended', () => {
        updatePlayPauseButtons('<i class="fas fa-play"></i>');
        showControls(); // Show controls when video ends
    });

    videoElement.addEventListener('error', (e) => {
        console.error('❌ Video loading error:', e);
        console.error('❌ Video source that failed:', videoSource.src);
        showError('Failed to load video file. Please check if the video exists.');
    });

    videoElement.addEventListener('play', () => {
        updatePlayPauseButtons('<i class="fas fa-pause"></i>');
        showNotification('Playing', 1700);
        // Start fade timer when video starts playing
        startControlsFadeTimer();
    });

    videoElement.addEventListener('pause', () => {
        updatePlayPauseButtons('<i class="fas fa-play"></i>');
        showNotification('Paused', 1700);
        // Show controls when paused and stop fade timer
        clearTimeout(controlsFadeTimer);
        showControls();
    });

    // Prevent context menu on video
    videoElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Disable double-click fullscreen
    videoElement.addEventListener('dblclick', (e) => {
        e.preventDefault();
    });

    // Load the video
    videoElement.load();
}

// Update both desktop and mobile play/pause buttons
function updatePlayPauseButtons(iconHTML) {
    if (playPauseBtn) playPauseBtn.innerHTML = iconHTML;
    if (playPauseBtnMobile) playPauseBtnMobile.innerHTML = iconHTML;
}

// Update both desktop and mobile mute buttons
function updateMuteButtons(iconHTML) {
    if (muteBtn) muteBtn.innerHTML = iconHTML;
    if (muteBtnMobile) muteBtnMobile.innerHTML = iconHTML;
}

// Update both desktop and mobile speed buttons
function updateSpeedButtons(text) {
    if (speedBtn) speedBtn.textContent = text;
    if (speedBtnMobile) speedBtnMobile.textContent = text;
}

// Update both desktop and mobile fullscreen buttons
function updateFullscreenButtons(iconHTML) {
    if (fullscreenBtn) fullscreenBtn.innerHTML = iconHTML;
    if (fullscreenBtnMobile) fullscreenBtnMobile.innerHTML = iconHTML;
}

// FIXED: Populate video information with correct property names
function populateVideoInfo() {
    // Main title
    videoTitleHeader.textContent = videoData.title;
    document.title = `Space Player - ${videoData.title}`;

    // Description
    document.getElementById('videoDescription').textContent =
        videoData.description || 'No description available';

    // Duration
    document.getElementById('videoDuration').textContent =
        videoData.duration || 'Unknown';

    // Views
    document.getElementById('videoViews').textContent =
        formatViews(videoData.views || 0);

    // Upload date
    const uploadDate = new Date(videoData.uploadDate);
    document.getElementById('uploadDate').textContent =
        uploadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    document.getElementById('fullUploadDate').textContent =
        uploadDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Category
    document.getElementById('videoCategory').textContent =
        videoData.category || 'Uncategorized';
    document.getElementById('fullCategory').textContent =
        videoData.category || 'Uncategorized';

    // FIXED: File info using correct property names with fallbacks
    const fileName = videoData.filename || videoData.file || 'Unknown';
    document.getElementById('fileName').textContent = fileName;
    document.getElementById('videoId').textContent = videoData.id;
}

// Load related videos using existing search API
async function loadRelatedVideos() {
    try {
        if (!videoData.category) {
            document.getElementById('relatedVideos').innerHTML =
                '<p>No related videos found.</p>';
            return;
        }

        // Use existing search API to find videos in same category
        const response = await fetch(`/api/search?q=${encodeURIComponent(videoData.category)}`);
        if (!response.ok) throw new Error('Failed to load related videos');

        const videos = await response.json();
        relatedVideos = videos.filter(v => v.id !== videoId).slice(0, 5);

        displayRelatedVideos();
    } catch (error) {
        console.error('Error loading related videos:', error);
        document.getElementById('relatedVideos').innerHTML =
            '<p>Unable to load related videos.</p>';
    }
}

// Display related videos
function displayRelatedVideos() {
    const container = document.getElementById('relatedVideos');

    if (relatedVideos.length === 0) {
        container.innerHTML = '<p>No related videos found.</p>';
        return;
    }

    container.innerHTML = relatedVideos.map(video => {
        const thumbnailSrc = video.thumbnail ?
            `/thumbnails/${video.thumbnail}` :
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="%23333"/><text x="50%" y="50%" fill="white" text-anchor="middle" dy=".3em">🎬</text></svg>';

        return `
            <div class="related-video" onclick="goToVideo('${video.id}')">
                <img src="${thumbnailSrc}" alt="${escapeHtml(video.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;100&quot; height=&quot;60&quot;><rect width=&quot;100&quot; height=&quot;60&quot; fill=&quot;%23333&quot;/><text x=&quot;50%&quot; y=&quot;50%&quot; fill=&quot;white&quot; text-anchor=&quot;middle&quot; dy=&quot;.3em&quot;>🎬</text></svg>'">
                <div class="related-info">
                    <h4>${escapeHtml(video.title)}</h4>
                    <p>${formatViews(video.views || 0)} views</p>
                </div>
            </div>
        `;
    }).join('');
}

// Navigate to another video
function goToVideo(id) {
    window.location.href = `video.html?id=${id}`;
}

// Start video playback
async function startVideo() {
    if (!isVideoLoaded) {
        showNotification('Video is still loading...');
        return;
    }

    // Hide placeholder and show video
    videoPlaceholder.style.display = 'none';
    videoElement.style.display = 'block';

    // Start playing
    try {
        await videoElement.play();
        showNotification('🚀 Video started!');
    } catch (error) {
        console.error('Error playing video:', error);
        showNotification('Unable to start video playback');
    }
}

// Video controls with FontAwesome icons
function playPause() {
    if (!videoElement || !isVideoLoaded) return;

    if (videoElement.paused) {
        videoElement.play();
    } else {
        videoElement.pause();
    }
}

function skipBackward() {
    if (!videoElement || !isVideoLoaded) return;
    videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
    showControlsAndResetTimer();
}

function skipForward() {
    if (!videoElement || !isVideoLoaded) return;
    videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 10);
    showControlsAndResetTimer();
}

function seekVideo(event) {
    if (!videoElement || !isVideoLoaded) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const percentage = clickPosition / rect.width;

    videoElement.currentTime = percentage * videoElement.duration;
    showControlsAndResetTimer();
}

function toggleMute() {
    if (!videoElement) return;

    videoElement.muted = !videoElement.muted;

    // Update icon based on mute status and volume
    let iconHTML;
    if (videoElement.muted) {
        iconHTML = '<i class="fas fa-volume-mute"></i>';
    } else {
        const volume = videoElement.volume;
        if (volume === 0) {
            iconHTML = '<i class="fas fa-volume-off"></i>';
        } else if (volume < 0.5) {
            iconHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            iconHTML = '<i class="fas fa-volume-up"></i>';
        }
    }

    updateMuteButtons(iconHTML);
    showControlsAndResetTimer();
}

function changeVolume(value) {
    if (!videoElement) return;

    videoElement.volume = value / 100;

    // Update mute button icon based on volume
    let iconHTML;
    if (value == 0) {
        iconHTML = '<i class="fas fa-volume-off"></i>';
    } else if (value < 50) {
        iconHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        iconHTML = '<i class="fas fa-volume-up"></i>';
    }

    updateMuteButtons(iconHTML);

    // Unmute if volume is changed from 0
    if (videoElement.muted && value > 0) {
        videoElement.muted = false;
    }
    showControlsAndResetTimer();
}

function changePlaybackSpeed() {
    if (!videoElement) return;

    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;

    playbackSpeed = speeds[nextIndex];
    videoElement.playbackRate = playbackSpeed;
    updateSpeedButtons(playbackSpeed + 'x');
    showControlsAndResetTimer();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        theatreContainer.requestFullscreen();
        updateFullscreenButtons('<i class="fas fa-compress"></i>');
        showNotification('Fullscreen enabled', 1700);
    } else {
        document.exitFullscreen();
        updateFullscreenButtons('<i class="fas fa-expand"></i>');
        showNotification('Fullscreen disabled', 1700);
    }
    showControlsAndResetTimer();
}

// Mobile-specific fullscreen handler for vertical mode
function toggleMobileFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen and force landscape
        theatreContainer.requestFullscreen().then(() => {
            isMobileFullscreen = true;
            // Try to lock orientation to landscape
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(err => {
                    console.log('Could not lock orientation:', err);
                });
            }
            updateMobileFullscreenButton('<i class="fas fa-compress"></i>', 'Exit Fullscreen');
            showNotification('Fullscreen enabled - Rotate to landscape', 2500);
        }).catch(err => {
            console.error('Fullscreen request failed:', err);
            showNotification('Fullscreen not available', 1700);
        });
    } else {
        // Exit fullscreen and return to portrait
        document.exitFullscreen().then(() => {
            isMobileFullscreen = false;
            // Unlock orientation
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
            updateMobileFullscreenButton('<i class="fas fa-expand"></i>', 'Enter Fullscreen');
            showNotification('Returned to normal view', 1700);
        });
    }
    showControlsAndResetTimer();
}

// Update mobile vertical fullscreen button
function updateMobileFullscreenButton(iconHTML, title) {
    if (mobileVerticalFullscreen) {
        mobileVerticalFullscreen.innerHTML = iconHTML;
        mobileVerticalFullscreen.title = title;
    }
}

// FIXED: Download function using correct property name
function downloadVideo() {
    if (!videoData) return;

    // Use correct property with fallbacks
    const fileName = videoData.filename || videoData.file;
    if (!fileName) {
        showNotification('Download failed: File name not found', 2000);
        return;
    }

    const link = document.createElement('a');
    link.href = `/videos/${fileName}`;
    link.download = fileName;
    link.click();

    showNotification('Download started!', 1700);
    showControlsAndResetTimer();
}

// Update progress bar
function updateProgressBar() {
    if (!videoElement || !isVideoLoaded) return;

    const progress = (videoElement.currentTime / videoElement.duration) * 100;
    progressBar.style.width = progress + '%';
}

// Update time display - both desktop and mobile
function updateTimeDisplay() {
    if (!videoElement || !isVideoLoaded) return;

    const current = formatTime(videoElement.currentTime);
    const total = formatTime(videoElement.duration);
    const timeText = `${current} / ${total}`;

    if (timeDisplay) timeDisplay.textContent = timeText;
    if (timeDisplayMobile) timeDisplayMobile.textContent = timeText;
}

// Info panel controls
function toggleInfo() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.classList.toggle('open');
    showControlsAndResetTimer();
}

function closeInfo() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.classList.remove('open');
    showControlsAndResetTimer();
}

// UI state management
function showLoading(show) {
    loadingScreen.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    errorScreen.style.display = 'flex';
    loadingScreen.style.display = 'none';
    theatreContainer.style.display = 'none';

    const errorContent = errorScreen.querySelector('.error-content p');
    errorContent.textContent = message;
}

function showPlayer() {
    loadingScreen.style.display = 'none';
    errorScreen.style.display = 'none';
    theatreContainer.style.display = 'flex';
}

// Utility functions
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views) {
    const num = parseInt(views) || 0;
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Enhanced notification system with custom duration
function showNotification(message, duration = 2500) {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.space-notification');
    existingNotifications.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = 'space-notification';
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%) translateY(-50px);
        background: linear-gradient(45deg, rgba(74, 158, 255, 0.95), rgba(255, 107, 53, 0.95));
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        z-index: 10000;
        backdrop-filter: blur(15px);
        box-shadow: 0 8px 25px rgba(74, 158, 255, 0.4);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 600;
        font-size: 14px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        pointer-events: none;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(0)';
        notification.style.opacity = '1';
    }, 50);

    // Animate out
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(-50px)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 400);
    }, duration);

    showControlsAndResetTimer();
}

// Enhanced keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if user is typing in an input
    if (e.target.tagName === 'INPUT') return;

    switch(e.code) {
        case 'Space':
            e.preventDefault();
            playPause();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            skipBackward();
            break;
        case 'ArrowRight':
            e.preventDefault();
            skipForward();
            break;
        case 'KeyM':
            e.preventDefault();
            toggleMute();
            break;
        case 'KeyF':
            e.preventDefault();
            toggleFullscreen();
            break;
        case 'KeyI':
            e.preventDefault();
            toggleInfo();
            break;
        case 'Escape':
            e.preventDefault();
            closeInfo();
            // Enhanced ESC behavior: Exit fullscreen first, then go home on second press
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                // If not in fullscreen, go to home page
                window.location.href = 'http://192.168.1.100:3001/index.html';
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (videoElement) {
                const newVolume = Math.min(1, videoElement.volume + 0.1);
                videoElement.volume = newVolume;
                const volumeSlider = document.querySelector('.volume-slider');
                if (volumeSlider) volumeSlider.value = newVolume * 100;
                changeVolume(newVolume * 100);
            }
            break;
        case 'ArrowDown':
            e.preventDefault();
            if (videoElement) {
                const newVolume = Math.max(0, videoElement.volume - 0.1);
                videoElement.volume = newVolume;
                const volumeSlider = document.querySelector('.volume-slider');
                if (volumeSlider) volumeSlider.value = newVolume * 100;
                changeVolume(newVolume * 100);
            }
            break;
    }
});

// Handle fullscreen changes
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        updateFullscreenButtons('<i class="fas fa-compress"></i>');
        updateMobileFullscreenButton('<i class="fas fa-compress"></i>', 'Exit Fullscreen');
        // Hide mobile vertical button when in fullscreen
        if (mobileVerticalFullscreen) {
            mobileVerticalFullscreen.classList.add('hidden');
        }
    } else {
        updateFullscreenButtons('<i class="fas fa-expand"></i>');
        updateMobileFullscreenButton('<i class="fas fa-expand"></i>', 'Enter Fullscreen');
        document.body.style.cursor = 'default';

        // Show mobile vertical button when exiting fullscreen (if in portrait)
        if (mobileVerticalFullscreen && isMobile() && isPortraitMode()) {
            mobileVerticalFullscreen.classList.remove('hidden');
        }

        // Reset mobile fullscreen flag
        isMobileFullscreen = false;
    }
});

// Orientation change handler
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        // Show/hide mobile fullscreen button based on orientation
        if (mobileVerticalFullscreen) {
            if (isPortraitMode() && !document.fullscreenElement && isMobile()) {
                mobileVerticalFullscreen.classList.remove('hidden');
            } else {
                mobileVerticalFullscreen.classList.add('hidden');
            }
        }

        // Adjust video display based on orientation in fullscreen
        if (document.fullscreenElement && isMobileFullscreen) {
            if (isPortraitMode()) {
                // In portrait fullscreen, make video fit vertically
                videoElement.style.objectFit = 'cover';
                showNotification('Vertical video mode', 1700);
            } else {
                // In landscape fullscreen, contain the video normally
                videoElement.style.objectFit = 'contain';
                showNotification('Landscape video mode', 1700);
            }
        }
    }, 500); // Delay to ensure orientation change is complete
});

// Utility functions for mobile detection
function isMobile() {
    return window.innerWidth <= 768;
}

function isPortraitMode() {
    return window.innerHeight > window.innerWidth;
}

// Handle page visibility change - REMOVED automatic pause behavior
document.addEventListener('visibilitychange', () => {
    // Video now continues playing in background when tab is switched
    // This allows background video playback for better user experience
    if (document.hidden) {
        console.log('Tab hidden - video continues playing in background');
    } else {
        console.log('Tab visible - video continues normally');
    }
});

// Prevent right-click on video
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'VIDEO') {
        e.preventDefault();
    }
});

// Initialize volume slider
document.addEventListener('DOMContentLoaded', () => {
    const volumeSlider = document.querySelector('.volume-slider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            changeVolume(e.target.value);
        });
    }
});
