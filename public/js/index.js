
// FIXED index.js - displayVideos function

// Display videos in the grid
function displayVideos(videos) {
    if (!videos || videos.length === 0) {
        videoGrid.innerHTML = '';
        showNoResults(true);
        return;
    }

    showNoResults(false);

    videoGrid.innerHTML = videos.map(video => {
        // FIXED: Handle thumbnail correctly - video.thumbnail is just filename
        const thumbnailSrc = video.thumbnail ? `/thumbnails/${video.thumbnail}` : '/thumbnails/SpacePlayer.png';

        // Enhanced thumbnail handling with better error fallback
        const thumbnailHtml = `
            <img src="${thumbnailSrc}"
                 alt="${escapeHtml(video.title)}"
                 loading="lazy"
                 onerror="this.src='/thumbnails/SpacePlayer.png'; this.onerror=null;">
        `;

        return `
            <a href="video.html?id=${video.id}" class="video-card">
                <div class="video-thumbnail">
                    ${thumbnailHtml}
                    <div class="play-button">▶</div>
                    <div class="video-duration">${video.duration || '0:00'}</div>
                </div>
                <div class="video-info">
                    <div class="video-title">${escapeHtml(video.title)}</div>
                    <div class="video-meta">
                        <span class="video-views">${formatViews(video.views)} views</span>
                        ${video.category ? `<span class="video-category">${escapeHtml(video.category)}</span>` : ''}
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

// DEBUG: Add function to check what data we're receiving
function debugVideoData(videos) {
    console.log('=== VIDEO DATA DEBUG ===');
    console.log('Total videos received:', videos.length);

    if (videos.length > 0) {
        console.log('First video sample:');
        const sample = videos[0];
        console.log('- ID:', sample.id);
        console.log('- Title:', sample.title);
        console.log('- Thumbnail:', sample.thumbnail);
        console.log('- Src:', sample.src);
        console.log('- Category:', sample.category);
        console.log('- Duration:', sample.duration);
        console.log('- Views:', sample.views);
    }
    console.log('========================');
}

// ENHANCED: Fetch all videos from the API with debug
async function fetchVideos() {
    try {
        showLoading(true);
        hideError();

        console.log('🔍 Fetching videos from /api/videos...');
        const response = await fetch('/api/videos');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const videos = await response.json();
        console.log('✅ Videos fetched successfully');

        // Debug the received data
        debugVideoData(videos);

        allVideos = videos;

        displayVideos(videos);
        loadCategories(videos);

    } catch (error) {
        console.error('❌ Error fetching videos:', error);
        showError();
    } finally {
        showLoading(false);
    }
}


// Global variables
let allVideos = [];
let currentCategory = '';
let searchTimeout;

// DOM elements
const videoGrid = document.getElementById('videosGrid');
const searchInput = document.getElementById('searchInput');
const categoriesContainer = document.getElementById('categoriesContainer');
const noResultsEl = document.getElementById('noResults');
const loadingEl = document.getElementById('loading');
const errorMessageEl = document.getElementById('errorMessage');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    createSpaceBackground();
    fetchVideos();
});

// Create animated space background
function createSpaceBackground() {
    const container = document.getElementById('spaceParticles');
    const starCount = 100;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';

        // Random star size
        const sizes = ['small', 'medium', 'large'];
        const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
        star.classList.add(randomSize);

        // Random position
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';

        // Random animation delay
        star.style.animationDelay = Math.random() * 3 + 's';

        container.appendChild(star);
    }
}

// Fetch all videos from the API
async function fetchVideos() {
    try {
        showLoading(true);
        hideError();

        const response = await fetch('/api/videos');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const videos = await response.json();
        allVideos = videos;

        displayVideos(videos);
        loadCategories(videos);

    } catch (error) {
        console.error('Error fetching videos:', error);
        showError();
    } finally {
        showLoading(false);
    }
}

// Display videos in the grid
function displayVideos(videos) {
    if (!videos || videos.length === 0) {
        videoGrid.innerHTML = '';
        showNoResults(true);
        return;
    }

    showNoResults(false);

    videoGrid.innerHTML = videos.map(video => {
        // Handle thumbnail - use actual thumbnail or placeholder
        const thumbnailSrc = video.thumbnail ? `/thumbnails/${video.thumbnail}` : null;
        const thumbnailHtml = thumbnailSrc ?
            `<img src="${thumbnailSrc}" alt="${video.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div class="placeholder" style="display:none;">🎬</div>` :
            `<div class="placeholder">🎬</div>`;

        return `
            <a href="video.html?id=${video.id}" class="video-card">
                <div class="video-thumbnail">
                    ${thumbnailHtml}
                    <div class="play-button">▶</div>
                    <div class="video-duration">${video.duration || '0:00'}</div>
                </div>
                <div class="video-info">
                    <div class="video-title">${escapeHtml(video.title)}</div>
                    <div class="video-meta">
                        <span class="video-views">${formatViews(video.views)} views</span>
                        ${video.category ? `<span class="video-category">${escapeHtml(video.category)}</span>` : ''}
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

// Load and display categories
function loadCategories(videos) {
    // Extract unique categories from videos
    const categories = [...new Set(videos
        .map(video => video.category)
        .filter(category => category && category.trim() !== '')
    )].sort();

    // Keep the "All Videos" button and add dynamic categories
    const allButton = categoriesContainer.querySelector('.category-btn[data-category=""]');
    categoriesContainer.innerHTML = '';
    categoriesContainer.appendChild(allButton);

    // Add category buttons
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.textContent = category;
        button.setAttribute('data-category', category);
        button.addEventListener('click', () => filterByCategory(category, button));
        categoriesContainer.appendChild(button);
    });
}

// Filter videos by category
function filterByCategory(category, buttonEl) {
    // Update active state
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    buttonEl.classList.add('active');

    currentCategory = category;

    if (category === '') {
        // Show all videos
        displayVideos(allVideos);
    } else {
        // Filter by category
        const filteredVideos = allVideos.filter(video => video.category === category);
        displayVideos(filteredVideos);
    }

    // Clear search when filtering by category
    searchInput.value = '';
}

// Handle search functionality
function handleSearch(event) {
    if (event.key === 'Enter') {
        performSearch();
    } else {
        // Debounced search as user types
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(performSearch, 500);
    }
}

// Perform search
async function performSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        // If search is empty, show current category or all videos
        if (currentCategory) {
            const filteredVideos = allVideos.filter(video => video.category === currentCategory);
            displayVideos(filteredVideos);
        } else {
            displayVideos(allVideos);
        }
        return;
    }

    try {
        showLoading(true);

        // Use search API endpoint
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const searchResults = await response.json();
        displayVideos(searchResults);

        // Clear category selection when searching
        currentCategory = '';
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));

    } catch (error) {
        console.error('Search error:', error);
        // Fallback to client-side search
        const filteredVideos = allVideos.filter(video =>
            video.title.toLowerCase().includes(query.toLowerCase()) ||
            (video.description && video.description.toLowerCase().includes(query.toLowerCase())) ||
            (video.category && video.category.toLowerCase().includes(query.toLowerCase()))
        );
        displayVideos(filteredVideos);
    } finally {
        showLoading(false);
    }
}

// Side menu functions
function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    menu.classList.toggle('open');
    overlay.classList.toggle('show');
}

function closeMenu() {
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    menu.classList.remove('open');
    overlay.classList.remove('show');
}

// Utility functions
function showLoading(show) {
    loadingEl.style.display = show ? 'block' : 'none';
}

function showNoResults(show) {
    noResultsEl.style.display = show ? 'block' : 'none';
}

function showError() {
    errorMessageEl.style.display = 'block';
    videoGrid.style.display = 'none';
}

function hideError() {
    errorMessageEl.style.display = 'none';
    videoGrid.style.display = 'grid';
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
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.addEventListener('click', (e) => {
    // Handle category button clicks
    if (e.target.classList.contains('category-btn')) {
        const category = e.target.getAttribute('data-category') || '';
        filterByCategory(category, e.target);
    }
});

// Handle "All Videos" category button
document.querySelector('.category-btn[data-category=""]').addEventListener('click', function() {
    filterByCategory('', this);
});
