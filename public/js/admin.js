// FIXED admin.js - Consolidated and corrected thumbnail handling

// Admin Configuration
const ADMIN_CONFIG = {
    username: 'admin',
    password: 'Admin175630',
    sessionKey: 'spacePlayerAdminSession'
};

// Global state
let videos = [];
let currentEditingVideo = null;
let videoDurationCache = new Map();

// Video categories configuration
const VIDEO_CATEGORIES = [
    'Educational',
    'Documentary',
    'Animation',
    'Live',
    'Movies',
    'Not Categorized'
];

const DEFAULT_CATEGORY = 'Not Categorized';
const DEFAULT_THUMBNAIL = '/thumbnails/SpacePlayer.png';

// Initialize admin panel
document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        showLoginModal();
    } else {
        initializeAdminPanel();
    }
});

// Authentication functions
function isLoggedIn() {
    return sessionStorage.getItem(ADMIN_CONFIG.sessionKey) === 'true';
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function attemptLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        sessionStorage.setItem(ADMIN_CONFIG.sessionKey, 'true');
        hideLoginModal();
        initializeAdminPanel();
        clearLoginForm();
    } else {
        errorMessage.textContent = 'Invalid username or password';
        setTimeout(() => {
            errorMessage.textContent = '';
        }, 3000);
    }
}

function cancelLogin() {
    window.location.href = 'http://192.168.1.100:3001'; // Redirect to main site
}

function clearLoginForm() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('errorMessage').textContent = '';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem(ADMIN_CONFIG.sessionKey);
        window.location.href = 'index.html';
    }
}

// Initialize admin panel
async function initializeAdminPanel() {
    if (!isLoggedIn()) {
        showLoginModal();
        return;
    }
    createSpaceBackground();
    await loadVideos();
    await scanForUnregisteredVideos();
    setupEventListeners();
    await updateStats();
    populateCategoryDropdowns();
}

// FIXED: Single consolidated renderVideoList function with proper thumbnail handling
function renderVideoList(filteredVideos = null) {
    const videoList = document.getElementById('videoList');
    const videosToRender = filteredVideos || videos;

    if (videosToRender.length === 0) {
        videoList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6); padding: 2rem;">No videos found.</p>';
        return;
    }

    videoList.innerHTML = videosToRender.map(video => {
        const autoImportedBadge = video.autoImported ? '<span class="auto-imported-badge">Auto-imported</span>' : '';

        // FIXED: Consistent thumbnail path handling
        // Always construct full path from filename stored in database
        let thumbnailSrc;
        if (video.thumbnail && video.thumbnail !== 'SpacePlayer.png') {
            // For uploaded thumbnails, ensure we have the full path
            thumbnailSrc = video.thumbnail.startsWith('/') ? video.thumbnail : `/thumbnails/${video.thumbnail}`;
        } else {
            // Default thumbnail
            thumbnailSrc = '/thumbnails/SpacePlayer.png';
        }

        console.log(`DEBUG: Video "${video.title}" - thumbnail: "${video.thumbnail}" -> src: "${thumbnailSrc}"`);

        return `
            <div class="video-item">
                <div class="video-thumbnail">
                    <img src="${thumbnailSrc}"
                         alt="${video.title}"
                         loading="lazy"
                         onerror="this.onerror=null; this.src='/thumbnails/SpacePlayer.png'; console.log('Thumbnail failed, using default for: ${video.title}');"
                         onload="console.log('Thumbnail loaded successfully: ${thumbnailSrc}');">
                    <div class="video-duration">${video.duration}</div>
                </div>
                <div class="video-info">
                    <h3>${video.title}${autoImportedBadge}</h3>
                    <p class="video-description">${video.description || 'No description available'}</p>
                    <div class="video-meta">
                        <span class="category">${video.category}</span>
                        <span class="views">${formatViews(video.views)} views</span>
                        <span class="upload-date">${formatDate(video.uploadDate)}</span>
                    </div>
                </div>
                <div class="video-actions">
                    <button class="edit-btn" onclick="editVideo('${video.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteVideo('${video.id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Show scanning indicator
function showScanningIndicator(message = 'Scanning for new videos...') {
    let indicator = document.getElementById('scanningIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'scanningIndicator';
        indicator.className = 'scanning-indicator';
        document.body.appendChild(indicator);
    }

    indicator.innerHTML = `
        <div class="scanning-spinner"></div>
        <span>${message}</span>
    `;
    indicator.classList.remove('hidden');
}

// Hide scanning indicator
function hideScanningIndicator() {
    const indicator = document.getElementById('scanningIndicator');
    if (indicator) {
        indicator.classList.add('hidden');
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 300);
    }
}

// Scan for unregistered videos in the /videos/ folder
async function scanForUnregisteredVideos() {
    try {
        console.log('Scanning /videos/ folder for unregistered videos...');
        showScanningIndicator();

        // Simple approach: Try to access videos directory directly via filesystem
        let filesInFolder = [];

        try {
            // Method 1: Try API endpoint if available
            const apiResponse = await fetch('/api/scan-videos');
            if (apiResponse.ok) {
                filesInFolder = await apiResponse.json();
                console.log('Files found via API:', filesInFolder);
            } else {
                throw new Error('API not available, trying direct method');
            }
        } catch (apiError) {
            console.log('API method failed, trying direct folder scan...');

            // Method 2: Direct folder scanning using simple file system approach
            try {
                // Create a hidden iframe to try to list directory contents
                const videoFolderTest = await fetch('../videos/', { method: 'HEAD' });
                if (videoFolderTest.ok) {
                    // Use a more direct approach - scan common video file names
                    filesInFolder = await scanVideoFolderDirect();
                }
            } catch (directError) {
                console.log('Direct scan also failed, using fallback method...');
                // Method 3: Fallback - check for common file patterns
                filesInFolder = await scanVideoFolderFallback();
            }
        }

        if (!Array.isArray(filesInFolder) || filesInFolder.length === 0) {
            console.log('No video files found in /videos/ folder');
            hideScanningIndicator();
            return;
        }

        // Get currently registered video files
        const registeredFiles = videos.map(video => {
            return video.filename || (video.src ? video.src.split('/').pop() : null);
        }).filter(Boolean);

        console.log('Currently registered files:', registeredFiles);

        // Find unregistered videos (only video files)
        const unregisteredVideos = filesInFolder.filter(filename => {
            return !registeredFiles.includes(filename) && isVideoFile(filename);
        });

        console.log('Unregistered videos found:', unregisteredVideos);

        if (unregisteredVideos.length === 0) {
            console.log('All videos in /videos/ folder are already registered');
            hideScanningIndicator();
            return;
        }

        // Update indicator for registration process
        showScanningIndicator(`Auto-registering ${unregisteredVideos.length} external video(s)...`);

        // Register each unregistered video with default settings
        let successCount = 0;
        for (const filename of unregisteredVideos) {
            try {
                await registerExternalVideo(filename);
                successCount++;
            } catch (error) {
                console.error(`Failed to register ${filename}:`, error);
            }
        }

        // Reload videos after registration
        await loadVideos();
        console.log(`Successfully auto-registered ${successCount}/${unregisteredVideos.length} external videos`);

        if (successCount > 0) {
            showScanningIndicator(`✅ Auto-registered ${successCount} external video(s)! Now available on main site.`);
            setTimeout(hideScanningIndicator, 3000);
        } else {
            showScanningIndicator(`⚠️ Found ${unregisteredVideos.length} videos but couldn't register them`);
            setTimeout(hideScanningIndicator, 3000);
        }

    } catch (error) {
        console.error('Error scanning for unregistered videos:', error);
        showScanningIndicator(`❌ Error scanning /videos/ folder`);
        setTimeout(hideScanningIndicator, 3000);
    }
}

// Direct folder scanning method
async function scanVideoFolderDirect() {
    const commonVideoFiles = [];
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'];

    // Try to detect files by making HEAD requests to common patterns
    const testPatterns = [
        'video', 'movie', 'clip', 'record', 'footage', 'sample', 'demo',
        '1', '2', '3', '4', '5', 'test', 'new', 'latest'
    ];

    for (const pattern of testPatterns) {
        for (const ext of videoExtensions) {
            try {
                const testUrl = `../videos/${pattern}.${ext}`;
                const response = await fetch(testUrl, { method: 'HEAD' });
                if (response.ok) {
                    commonVideoFiles.push(`${pattern}.${ext}`);
                }
            } catch (e) {
                // File doesn't exist, continue
            }
        }
    }

    return commonVideoFiles;
}

// Fallback scanning method using server endpoint
async function scanVideoFolderFallback() {
    try {
        // Create a simple server request to list files
        const response = await fetch('/list-videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'scan_videos_folder' })
        });

        if (response.ok) {
            const result = await response.json();
            return result.files || [];
        }
    } catch (error) {
        console.log('Fallback method also failed:', error);
    }

    return [];
}

// FIXED: Register external video with proper thumbnail handling
async function registerExternalVideo(filename) {
    try {
        console.log('Auto-registering external video:', filename);

        // Create video data with default settings as specified
        const videoData = {
            id: generateUniqueId(),
            title: cleanFileName(filename), // Clean up the filename for title
            description: `Externally added video: ${filename}`,
            category: 'Not Categorized', // Default category as specified
            duration: '0:00', // Will try to detect, fallback to 0:00
            filename: filename,
            src: `/videos/${filename}`, // Direct path to video file
            thumbnail: 'SpacePlayer.png', // FIXED: Just filename, not full path
            views: 0,
            uploadDate: new Date().toISOString(),
            size: 'Unknown',
            autoImported: true, // Mark as auto-imported for identification
            external: true // Mark as externally added
        };

        // Try to detect video duration if possible
        try {
            const videoUrl = `../videos/${filename}`;
            const duration = await detectVideoDurationFromUrl(videoUrl);
            if (duration && duration > 0) {
                videoData.duration = formatDuration(duration);
                console.log(`Detected duration for ${filename}: ${videoData.duration}`);
            }
        } catch (durationError) {
            console.log(`Could not detect duration for ${filename}, using default`);
        }

        // Method 1: Try to register with server API
        try {
            const response = await fetch('/api/register-video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(videoData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('External video registered via API:', result);
                return result;
            } else {
                throw new Error(`Server registration failed: ${response.statusText}`);
            }
        } catch (apiError) {
            console.log('API registration failed, using local registration:', apiError);

            // Method 2: Fallback to local registration
            return await registerVideoLocally(videoData);
        }

    } catch (error) {
        console.error('Error registering external video:', filename, error);
        throw error;
    }
}

// Local video registration fallback
async function registerVideoLocally(videoData) {
    try {
        // Add to local videos array
        videos.push(videoData);

        // Try to persist to local data if possible
        try {
            const dataToSave = { videos: videos };
            localStorage.setItem('spacePlayerVideos', JSON.stringify(dataToSave));
            console.log('Video data saved locally');
        } catch (storageError) {
            console.log('Local storage failed, keeping in memory only');
        }

        console.log('External video registered locally:', videoData);
        return videoData;

    } catch (error) {
        console.error('Local registration failed:', error);
        throw error;
    }
}

// Detect video duration from URL
async function detectVideoDurationFromUrl(videoUrl) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        const timeout = setTimeout(() => {
            resolve(0); // Fallback after 5 seconds
        }, 5000);

        video.onloadedmetadata = function() {
            clearTimeout(timeout);
            resolve(this.duration);
            video.src = '';
        };

        video.onerror = function() {
            clearTimeout(timeout);
            resolve(0);
            video.src = '';
        };

        try {
            video.src = videoUrl;
        } catch (error) {
            clearTimeout(timeout);
            resolve(0);
        }
    });
}

// Enhanced clean filename function
function cleanFileName(fileName) {
    return fileName
        .substring(0, fileName.lastIndexOf('.')) || fileName // Remove extension
        .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/[^\w\s]/g, '') // Remove special characters except letters, numbers, spaces
        .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
        .trim(); // Remove leading/trailing spaces
}

// Check if a file is a video file based on extension
function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return videoExtensions.includes(extension);
}

// Category management functions
function populateCategoryDropdowns() {
    const uploadCategorySelect = document.getElementById('videoCategory');
    if (uploadCategorySelect) {
        uploadCategorySelect.innerHTML = '<option value="">Select Category</option>';
        VIDEO_CATEGORIES.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            uploadCategorySelect.appendChild(option);
        });
    }

    const editCategorySelect = document.getElementById('editCategory');
    if (editCategorySelect) {
        editCategorySelect.innerHTML = '';
        VIDEO_CATEGORIES.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            editCategorySelect.appendChild(option);
        });
    }

    const filterCategorySelect = document.getElementById('categoryFilter');
    if (filterCategorySelect) {
        filterCategorySelect.innerHTML = '<option value="">All Categories</option>';
        VIDEO_CATEGORIES.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterCategorySelect.appendChild(option);
        });
    }
}

// Create animated space background
function createSpaceBackground() {
    const container = document.getElementById('spaceParticles');
    const starCount = 100;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';

        const sizes = ['small', 'medium', 'large'];
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        star.classList.add(randomSize);

        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';

        container.appendChild(star);
    }
}

// Video management functions
async function loadVideos() {
    try {
        const response = await fetch('/api/videos');
        if (!response.ok) {
            throw new Error('Failed to fetch videos');
        }

        videos = await response.json();
        console.log('Loaded videos:', videos.length);

        // DEBUG: Log thumbnail data for first few videos
        videos.slice(0, 3).forEach(video => {
            console.log(`Video "${video.title}": thumbnail="${video.thumbnail}"`);
        });

        renderVideoList();
    } catch (error) {
        console.error('Error loading videos:', error);
        videos = [];
        renderVideoList();
    }
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
            throw new Error('Failed to fetch stats');
        }

        const stats = await response.json();

        document.getElementById('totalVideos').textContent = stats.totalVideos;
        document.getElementById('storageUsed').textContent = formatSize(stats.storageUsed);
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('totalVideos').textContent = videos.length.toString();

        // Calculate approximate storage from video count
        const approximateStorage = videos.length * 50; // Assume 50MB average per video
        document.getElementById('storageUsed').textContent = formatSize(approximateStorage);
    }
}

function formatViews(views) {
    if (views >= 1000000) {
        return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
        return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
}

function formatSize(sizeInMB) {
    if (sizeInMB >= 1024) {
        return (sizeInMB / 1024).toFixed(1) + 'GB';
    }
    return sizeInMB.toFixed(0) + 'MB';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
}

// Clear all form fields
function clearAllFields() {
    document.getElementById('videoTitle').value = '';
    document.getElementById('videoDuration').value = '';
    document.getElementById('videoDuration').placeholder = 'MM:SS';
    document.getElementById('videoDescription').value = '';
    document.getElementById('videoCategory').value = '';

    // Reset file input styling
    updateFileInputDisplay('videoFile', null);
    updateFileInputDisplay('thumbnailFile', null);

    // Clear title styling
    const titleInput = document.getElementById('videoTitle');
    titleInput.style.backgroundColor = '';
    titleInput.style.borderColor = '';
    titleInput.title = '';
}

// Update file input display
function updateFileInputDisplay(inputId, file) {
    const container = document.querySelector(`#${inputId}`).closest('.file-input-container');
    const label = container.querySelector('.file-input-label');
    const textSpan = label.querySelector('.file-text');

    if (file) {
        container.classList.add('has-file');
        textSpan.innerHTML = `${file.name} <div class="file-name">${formatFileSize(file.size)}</div>`;
    } else {
        container.classList.remove('has-file');
        if (inputId === 'videoFile') {
            textSpan.textContent = 'Choose Video File';
        } else if (inputId === 'thumbnailFile') {
            textSpan.textContent = 'Choose Thumbnail';
        } else {
            textSpan.textContent = 'Choose File';
        }
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Setup event listeners
function setupEventListeners() {
    // Upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }

    // File input change listeners
    const videoFileInput = document.getElementById('videoFile');
    if (videoFileInput) {
        videoFileInput.addEventListener('change', (e) => {
            clearAllFields(); // Clear all fields when video file is selected
            handleVideoFileChange(e);
            updateFileInputDisplay('videoFile', e.target.files[0]);
        });
    }

    const thumbnailFileInput = document.getElementById('thumbnailFile');
    if (thumbnailFileInput) {
        thumbnailFileInput.addEventListener('change', (e) => {
            updateFileInputDisplay('thumbnailFile', e.target.files[0]);
        });
    }

    const newThumbnailInput = document.getElementById('newThumbnail');
    if (newThumbnailInput) {
        newThumbnailInput.addEventListener('change', (e) => {
            updateFileInputDisplay('newThumbnail', e.target.files[0]);
        });
    }

    // Title input listeners
    const titleInput = document.getElementById('videoTitle');
    if (titleInput) {
        titleInput.addEventListener('input', handleTitleChange);
        titleInput.addEventListener('focus', handleTitleFocus);
    }

    // Edit form
    const editForm = document.getElementById('editVideoForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEdit);
    }

    // Search and filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleFilter);
    }

    // Login form enter key
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                attemptLogin();
            }
        });
    }

    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                attemptLogin();
            }
        });
    }
}

// Video duration detection
function handleVideoFileChange(e) {
    const file = e.target.files[0];
    const durationInput = document.getElementById('videoDuration');
    const titleInput = document.getElementById('videoTitle');

    if (!file) {
        durationInput.value = '';
        durationInput.placeholder = 'Auto-detected...';
        return;
    }

    if (!file.type.startsWith('video/')) {
        durationInput.value = '';
        durationInput.placeholder = 'Invalid video file';
        return;
    }

    // Auto-fill title with filename if title is empty
    if (!titleInput.value.trim()) {
        const cleanTitle = cleanFileName(file.name);
        titleInput.value = cleanTitle;

        titleInput.style.backgroundColor = 'rgba(74, 158, 255, 0.1)';
        titleInput.style.borderColor = 'rgba(74, 158, 255, 0.5)';
        titleInput.style.transition = 'all 0.3s ease';
        titleInput.title = 'Title auto-filled from filename. Click to edit.';

        setTimeout(() => {
            if (titleInput.style.backgroundColor) {
                titleInput.style.backgroundColor = '';
                titleInput.style.borderColor = '';
                titleInput.title = '';
            }
        }, 2000);
    }

    // Check cache first
    const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;
    if (videoDurationCache.has(cacheKey)) {
        const duration = videoDurationCache.get(cacheKey);
        durationInput.value = duration;
        return;
    }

    durationInput.value = '';
    durationInput.placeholder = 'Detecting duration...';

    // Create video element to get duration
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = function() {
        const duration = formatDuration(this.duration);
        durationInput.value = duration;
        durationInput.placeholder = 'Auto-detected...';

        videoDurationCache.set(cacheKey, duration);
        window.URL.revokeObjectURL(video.src);
    };

    video.onerror = function() {
        durationInput.value = '';
        durationInput.placeholder = 'Could not detect duration';
        window.URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(file);
}

function handleTitleChange(e) {
    const titleInput = e.target;
    titleInput.style.backgroundColor = '';
    titleInput.style.borderColor = '';
}

function handleTitleFocus(e) {
    const titleInput = e.target;
    titleInput.style.backgroundColor = '';
    titleInput.style.borderColor = '';
}

function formatDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return '0:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Progress bar management
function createProgressIndicator() {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress-container';
    progressContainer.innerHTML = `
        <div class="upload-progress-header">
            <span class="upload-progress-title">Uploading Video</span>
            <button class="upload-progress-close" onclick="minimizeProgress()">−</button>
        </div>
        <div class="upload-progress-body">
            <div class="upload-progress-bar-container">
                <div class="upload-progress-bar" id="uploadProgressBar"></div>
            </div>
            <div class="upload-progress-info">
                <span class="upload-progress-text" id="uploadProgressText">Preparing upload...</span>
                <span class="upload-progress-percentage" id="uploadProgressPercentage">0%</span>
            </div>
            <div class="upload-file-info" id="uploadFileInfo"></div>
        </div>
    `;

    document.body.appendChild(progressContainer);
    return progressContainer;
}

function updateProgress(percentage, text, fileInfo) {
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    const progressPercentage = document.getElementById('uploadProgressPercentage');
    const fileInfoElement = document.getElementById('uploadFileInfo');

    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    if (progressText) {
        progressText.textContent = text;
    }
    if (progressPercentage) {
        progressPercentage.textContent = Math.round(percentage) + '%';
    }
    if (fileInfoElement && fileInfo) {
        fileInfoElement.innerHTML = fileInfo;
    }
}

function minimizeProgress() {
    const container = document.querySelector('.upload-progress-container');
    if (container) {
        container.classList.toggle('minimized');
        const closeBtn = container.querySelector('.upload-progress-close');
        closeBtn.textContent = container.classList.contains('minimized') ? '+' : '−';
    }
}

function removeProgressIndicator() {
    const container = document.querySelector('.upload-progress-container');
    if (container) {
        container.style.opacity = '0';
        container.style.transform = 'translateY(100%)';
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 300);
    }
}

// Upload handling with progress bar
async function handleUpload(e) {
    e.preventDefault();

    const videoFile = document.getElementById('videoFile').files[0];
    const thumbnailFile = document.getElementById('thumbnailFile').files[0];
    const title = document.getElementById('videoTitle').value.trim();
    const description = document.getElementById('videoDescription').value.trim();
    const category = document.getElementById('videoCategory').value;
    const duration = document.getElementById('videoDuration').value.trim();

    // Basic validation - only video file and title required
    if (!videoFile || !title) {
        alert('Please select a video file and enter a title.');
        return;
    }

    if (!duration) {
        alert('Please wait for video duration to be detected, or select a valid video file.');
        return;
    }

    if (!videoFile.type.startsWith('video/')) {
        alert('Please select a valid video file.');
        return;
    }

    if (thumbnailFile && !thumbnailFile.type.startsWith('image/')) {
        alert('Please select a valid image file for the thumbnail.');
        return;
    }

    console.log('ALL VALIDATIONS PASSED - Starting upload process...');
    // Create progress indicator (non-blocking)
    const progressContainer = createProgressIndicator();

    // Update file info - show defaults when not provided
    const fileInfo = `
        <div class="file-upload-info">
            <div class="file-item">
                <span class="file-type">Video:</span>
                <span class="file-details">${videoFile.name} (${formatFileSize(videoFile.size)})</span>
            </div>
            <div class="file-item">
                <span class="file-type">Thumbnail:</span>
                <span class="file-details">${thumbnailFile ? `${thumbnailFile.name} (${formatFileSize(thumbnailFile.size)})` : '✅ Default SpacePlayer.png'}</span>
            </div>
            <div class="file-item">
                <span class="file-type">Category:</span>
                <span class="file-details">${category || '✅ Default: Not Categorized'}</span>
            </div>
        </div>
    `;
    updateProgress(0, 'Preparing upload...', fileInfo);

    // Change button text but keep it enabled for other actions
    const submitBtn = document.querySelector('.upload-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Uploading... (Continue using interface)';
    submitBtn.style.background = 'linear-gradient(45deg, #ff6b35, #ff8c42)';

    try {
        // Create FormData for upload
        const formData = new FormData();

        // DEBUG: Log what we're about to send
        console.log('DEBUG - About to create FormData with:');
        console.log('- Video file:', videoFile ? 'YES' : 'NO');
        console.log('- Thumbnail file:', thumbnailFile ? 'YES' : 'NO');

        formData.append('video', videoFile);
        if (thumbnailFile) {
            formData.append('thumbnail', thumbnailFile);
        }
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category', category || DEFAULT_CATEGORY);
        formData.append('duration', duration);

        updateProgress(10, 'Starting upload...', fileInfo);

        // Create XMLHttpRequest for progress tracking
        const uploadPromise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 80; // Reserve 20% for processing
                    const uploadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
                    const totalMB = (e.total / (1024 * 1024)).toFixed(1);
                    updateProgress(percentComplete, `Uploading... ${uploadedMB}MB / ${totalMB}MB`, fileInfo);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    updateProgress(80, 'Processing video...', fileInfo);
                    resolve(xhr.responseText);
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });

            xhr.open('POST', '/api/upload');
            xhr.send(formData);
        });

        const responseText = await uploadPromise;
        updateProgress(90, 'Finalizing...', fileInfo);

        console.log('Server response:', responseText);

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('Invalid JSON response:', responseText);
            throw new Error('Server returned invalid response');
        }

        updateProgress(95, 'Updating video list...', fileInfo);

        // Reload videos and update UI
        await loadVideos();
        await updateStats();

        updateProgress(100, 'Upload completed successfully!', fileInfo);

        // Clear form
        document.getElementById('uploadForm').reset();
        clearAllFields();

        // Show success message in progress bar
        setTimeout(() => {
            updateProgress(100, '✅ Video uploaded successfully!', fileInfo);
        }, 500);

        // Remove progress bar after delay
        setTimeout(() => {
            removeProgressIndicator();
        }, 3000);

    } catch (error) {
        console.error('Upload error:', error);
        updateProgress(0, `❌ Upload failed: ${error.message}`, fileInfo);

        // Remove progress bar after error delay
        setTimeout(() => {
            removeProgressIndicator();
        }, 5000);
    } finally {
        // Reset submit button
        submitBtn.textContent = originalText;
        submitBtn.style.background = '';
    }
}

function editVideo(id) {
    const video = videos.find(v => v.id === id);
    if (!video) return;

    currentEditingVideo = video;

    // Populate edit form
    document.getElementById('editTitle').value = video.title;
    document.getElementById('editDescription').value = video.description;
    document.getElementById('editCategory').value = video.category;
    document.getElementById('editDuration').value = video.duration;

    // Clear thumbnail input
    document.getElementById('newThumbnail').value = '';
    updateFileInputDisplay('newThumbnail', null);

    // Show edit modal
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    currentEditingVideo = null;

    const editForm = document.getElementById('editVideoForm');
    if (editForm) {
        editForm.reset();
        updateFileInputDisplay('newThumbnail', null);
    }
}

async function handleEdit(e) {
    e.preventDefault();

    if (!currentEditingVideo) return;

    const title = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const category = document.getElementById('editCategory').value;
    const duration = document.getElementById('editDuration').value.trim();
    const newThumbnail = document.getElementById('newThumbnail').files[0];

    if (!title || !category || !duration) {
        alert('Please fill in all required fields.');
        return;
    }

    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) {
        alert('Please enter duration in MM:SS or H:MM:SS format (e.g., 15:30 or 1:15:30)');
        return;
    }

    if (newThumbnail && !newThumbnail.type.startsWith('image/')) {
        alert('Please select a valid image file for the thumbnail.');
        return;
    }

    try {
        // Update video metadata
        const response = await fetch(`/api/videos/${currentEditingVideo.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                description: description,
                category: category,
                duration: duration
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Update failed');
        }

        // If new thumbnail uploaded, upload it separately
        if (newThumbnail) {
            const thumbnailFormData = new FormData();
            thumbnailFormData.append('thumbnail', newThumbnail);

            const thumbnailResponse = await fetch(`/api/videos/${currentEditingVideo.id}/thumbnail`, {
                method: 'PUT',
                body: thumbnailFormData
            });

            if (!thumbnailResponse.ok) {
                console.warn('Thumbnail update failed, but video metadata was updated');
            }
        }

        // Reload videos and close modal
        await loadVideos();
        await updateStats();
        closeEditModal();

        alert('Video updated successfully! ✅');

    } catch (error) {
        console.error('Update error:', error);
        alert(`Update failed: ${error.message}`);
    }
}

// FIXED: Delete function with better error handling and logging
// FIXED: Delete function with better error handling and client-side logging
async function deleteVideo(id) {
    const video = videos.find(v => v.id === id);
    if (!video) {
        console.log('❌ CLIENT: Video not found in local array!'); // This WILL show in browser console
        alert('Video not found!');
        return;
    }

    // CLIENT LOG (this WILL appear in browser console)
    console.log('🗑️ CLIENT DELETE REQUEST - Video details:', video);
    console.log('- ID:', video.id);
    console.log('- Title:', video.title);
    console.log('- Filename:', video.filename);
    console.log('- Thumbnail:', video.thumbnail);

    const confirmMessage = `Are you sure you want to delete "${video.title}"?\n\n` +
                          `This action cannot be undone and will delete:\n` +
                          `- Video file: ${video.filename || 'Unknown'}\n` +
                          `- Thumbnail: ${video.thumbnail || 'Default'}`;

    if (confirm(confirmMessage)) {
        try {
            console.log('🗑️ CLIENT: Sending DELETE request to:', `/api/videos/${id}`);

            const response = await fetch(`/api/videos/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('🗑️ CLIENT: Response status:', response.status);
            console.log('🗑️ CLIENT: Response ok:', response.ok);

            // Get response text first to handle both JSON and plain text responses
            const responseText = await response.text();
            console.log('🗑️ CLIENT: Raw response text:', responseText);

            if (!response.ok) {
                console.error('🗑️ CLIENT: DELETE failed - Response text:', responseText);

                let errorMessage = 'Delete failed';
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = responseText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // Try to parse as JSON
            let result;
            try {
                result = JSON.parse(responseText);
                console.log('🗑️ CLIENT: Parsed JSON result:', result);
            } catch (e) {
                console.log('🗑️ CLIENT: Response is not JSON, treating as success');
                result = { message: 'Video deleted successfully' };
            }

            console.log('✅ CLIENT: DELETE successful');

            // Remove from local array immediately for instant UI update
            const localIndex = videos.findIndex(v => v.id === id);
            if (localIndex !== -1) {
                videos.splice(localIndex, 1);
                console.log('✅ CLIENT: Removed from local videos array');
            }

            // Update UI immediately
            renderVideoList();

            // Reload from server to ensure consistency
            console.log('🔄 CLIENT: Reloading videos from server...');
            await loadVideos();
            await updateStats();

            console.log('✅ CLIENT: All updates completed');
            alert('✅ Video deleted successfully!');

        } catch (error) {
            console.error('🗑️ CLIENT DELETE ERROR - Full details:', error);
            console.error('🗑️ CLIENT DELETE ERROR - Message:', error.message);
            console.error('🗑️ CLIENT DELETE ERROR - Stack:', error.stack);

            // Detailed error message for debugging
            const errorDetails = `❌ Delete failed: ${error.message}\n\n` +
                               `Check the terminal where you started the server for server-side logs.\n` +
                               `Client error logged to browser console.`;

            alert(errorDetails);
        }
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    applyFilters(searchTerm, categoryFilter);
}

function handleFilter(e) {
    const category = e.target.value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    applyFilters(searchTerm, category);
}

function applyFilters(searchTerm, category) {
    let filteredVideos = videos;

    if (searchTerm) {
        filteredVideos = filteredVideos.filter(video =>
            video.title.toLowerCase().includes(searchTerm) ||
            video.description.toLowerCase().includes(searchTerm)
        );
    }

    if (category) {
        filteredVideos = filteredVideos.filter(video => video.category === category);
    }

    renderVideoList(filteredVideos);
}

function showStats() {
    const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
    const avgViews = videos.length > 0 ? totalViews / videos.length : 0;
    const mostViewed = videos.length > 0 ?
        videos.reduce((max, video) => video.views > max.views ? video : max, videos[0]) :
        {title: 'None', views: 0};

    const categoryStats = {};
    VIDEO_CATEGORIES.forEach(category => {
        categoryStats[category] = videos.filter(video => video.category === category).length;
    });

    const categoryBreakdown = Object.entries(categoryStats)
        .map(([category, count]) => `${category}: ${count}`)
        .join('\n');

    const autoImportedCount = videos.filter(video => video.autoImported).length;

    alert(`📊 Dashboard Statistics:\n\n` +
          `Total Videos: ${videos.length}\n` +
          `Auto-Imported Videos: ${autoImportedCount}\n` +
          `Total Views: ${formatViews(totalViews)}\n` +
          `Average Views: ${formatViews(Math.round(avgViews))}\n` +
          `Most Viewed: ${mostViewed.title} (${formatViews(mostViewed.views)} views)\n` +
          `Storage Used: ${document.getElementById('storageUsed').textContent}\n\n` +
          `Category Breakdown:\n${categoryBreakdown || 'No videos'}`);
}

// Event listeners for modal closing and keyboard interactions
document.addEventListener('click', (e) => {
    const editModal = document.getElementById('editModal');

    if (e.target === editModal && editModal.classList.contains('show')) {
        closeEditModal();
    }
});

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.video-thumbnail')) {
        e.preventDefault();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const editModal = document.getElementById('editModal');
        if (editModal && editModal.classList.contains('show')) {
            closeEditModal();
        }
    }
});

// Page visibility API to check for videos when page becomes visible
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && isLoggedIn()) {
        console.log('Page became visible, scanning for new videos...');
        await scanForUnregisteredVideos();
        await loadVideos();
        await updateStats();
    }
});

// Check when window gets focus
window.addEventListener('focus', async () => {
    if (isLoggedIn()) {
        console.log('Window focused, scanning for new videos...');
        await scanForUnregisteredVideos();
        await loadVideos();
        await updateStats();
    }
});










// TEMPORARY: Add this function to your admin.js for testing
// You can add this at the bottom of your admin.js file
async function testDeleteDiagnosis(id) {
    console.log('🧪 TESTING DELETE DIAGNOSIS for ID:', id);

    try {
        const response = await fetch(`/api/videos/debug/${id}`, {
            method: 'DELETE'
        });

        const result = await response.text();
        console.log('🧪 DIAGNOSIS RESULT:', result);

        try {
            const parsed = JSON.parse(result);
            console.log('🧪 PARSED RESULT:', parsed);
        } catch (e) {
            console.log('🧪 RESULT IS NOT JSON');
        }

        alert('Check the browser console and terminal for diagnosis results!');

    } catch (error) {
        console.error('🧪 DIAGNOSIS ERROR:', error);
        alert('Diagnosis failed: ' + error.message);
    }
}

// TEMPORARY: Also add this to make it easy to test
// Call this from browser console: testDeleteWithVideoId()
async function testDeleteWithVideoId() {
    if (videos.length === 0) {
        alert('No videos loaded!');
        return;
    }

    const video = videos[0]; // Test with first video
    console.log('🧪 TESTING WITH FIRST VIDEO:', video);

    await testDeleteDiagnosis(video.id);
}
