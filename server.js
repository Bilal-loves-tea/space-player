const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const app = express();
const PORT = 3001;

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// Middleware with increased limits for video uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public')); // Serve files from /public folder

// Serve videos and thumbnails as static files
app.use('/videos', express.static('videos'));
app.use('/thumbnails', express.static('thumbnails'));

// Initialize required folders and files
function initializeDirectories() {
    const dirs = ['videos', 'thumbnails', 'public'];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created folder: /${dir}`);
        }
    });

    // Initialize data.json if it doesn't exist or is empty
    if (!fs.existsSync('data.json')) {
        const initialData = { videos: [] };
        fs.writeFileSync('data.json', JSON.stringify(initialData, null, 2));
        console.log('📄 Created data.json');
    } else {
        // Check if data.json is empty and fix it
        try {
            const content = fs.readFileSync('data.json', 'utf8').trim();
            if (!content) {
                const initialData = { videos: [] };
                fs.writeFileSync('data.json', JSON.stringify(initialData, null, 2));
                console.log('🔧 Fixed empty data.json');
            } else {
                JSON.parse(content); // Test if valid JSON
            }
        } catch (error) {
            console.log('🔧 Fixing corrupted data.json');
            const initialData = { videos: [] };
            fs.writeFileSync('data.json', JSON.stringify(initialData, null, 2));
        }
    }
}

// Helper function to read data.json
async function readVideoData() {
    try {
        const data = await readFile('data.json', 'utf8');
        const parsedData = JSON.parse(data);
        // Ensure videos array exists
        if (!parsedData.videos) {
            parsedData.videos = [];
        }
        return parsedData;
    } catch (error) {
        console.error('Error reading data.json:', error);
        return { videos: [] };
    }
}

// Helper function to write data.json
async function writeVideoData(data) {
    try {
        console.log('DEBUG writeVideoData - About to write:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
        console.log('DEBUG writeVideoData - Video count:', data.videos.length);

        await writeFile('data.json', JSON.stringify(data, null, 2));

        // Verify the write worked
        const verification = await readFile('data.json', 'utf8');
        const parsed = JSON.parse(verification);
        console.log('DEBUG writeVideoData - Verification read back:', parsed.videos.length, 'videos');

        console.log('💾 Data saved successfully');
    } catch (error) {
        console.error('ERROR in writeVideoData:', error);
        console.error('ERROR stack:', error.stack);
        throw error;
    }
}

// Generate unique ID
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'video') {
            cb(null, 'videos/');
        } else if (file.fieldname === 'thumbnail') {
            cb(null, 'thumbnails/');
        }
    },
    filename: function (req, file, cb) {
        const uniqueId = req.body.videoId || generateUniqueId();
        const extension = path.extname(file.originalname);
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uniqueId}_${cleanName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: Infinity,
        fieldSize: Infinity,
        fields: Infinity,
        files: Infinity,
        parts: Infinity,
        headerPairs: Infinity
    },
    fileFilter: function (req, file, cb) {
        if (file.fieldname === 'video') {
            if (file.mimetype.startsWith('video/')) {
                cb(null, true);
            } else {
                cb(new Error('Only video files are allowed for video field'));
            }
        } else if (file.fieldname === 'thumbnail') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed for thumbnail field'));
            }
        } else {
            cb(new Error('Unexpected field'));
        }
    }
});

// API Routes

// Get all videos - FIXED
app.get('/api/videos', async (req, res) => {
    try {
        const data = await readVideoData();
        console.log(`📹 Returning ${data.videos.length} videos`);
        res.json(data.videos);
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// Search videos endpoint - ADDED (was missing)
app.get('/api/search', async (req, res) => {
    const query = req.query.q?.toLowerCase() || '';
    console.log(`🔍 Searching for: "${query}"`);

    try {
        const data = await readVideoData();
        const videos = data.videos;

        const filtered = videos.filter(video =>
            video.title.toLowerCase().includes(query) ||
            video.description?.toLowerCase().includes(query) ||
            video.category?.toLowerCase().includes(query)
        );

        console.log(`🔍 Found ${filtered.length} results for "${query}"`);
        res.json(filtered);
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get single video details - ADDED (was missing)
app.get('/api/video/:id', async (req, res) => {
    try {
        const data = await readVideoData();
        const video = data.videos.find(v => v.id === req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Increment view count
        video.views = (parseInt(video.views) || 0) + 1;
        await writeVideoData(data);

        console.log(`👀 Playing: ${video.title} (${video.views} views)`);
        res.json(video);
    } catch (error) {
        console.error('Error getting video:', error);
        res.status(500).json({ error: 'Failed to get video' });
    }
});


// In server.js - FIXED thumbnail handling

// Upload new video - FIXED VERSION
app.post('/api/upload', (req, res, next) => {
    req.setTimeout(30 * 60 * 1000);
    res.setTimeout(30 * 60 * 1000);

    upload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 }
    ])(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'File too large' });
            }
            return res.status(400).json({ error: 'Upload error: ' + err.message });
        }

        try {
            console.log('=== UPLOAD PROCESS START ===');
            console.log('Request body:', req.body);
            console.log('Request files:', req.files);

            const { title, description, category, duration } = req.body;

            console.log('STEP 1 - Extracted data:');
            console.log('- Title:', title);
            console.log('- Description:', description);
            console.log('- Category:', category);
            console.log('- Duration:', duration);
            console.log('- Video file:', req.files.video ? 'YES' : 'NO');
            console.log('- Thumbnail file:', req.files.thumbnail ? 'YES' : 'NO');

            // Only validate that video file exists
            if (!req.files || !req.files.video) {
                console.log('STEP 1 FAILED - No video file');
                return res.status(400).json({ error: 'Video file is required' });
            }
            console.log('STEP 1 PASSED - Video file exists');

            const videoFile = req.files.video[0];
            let thumbnailFilename;

            console.log('STEP 2 - Processing files:');
            console.log('- Video filename:', videoFile.filename);

            // FIXED: Handle thumbnail - store just filename, not full path
            if (req.files.thumbnail && req.files.thumbnail[0]) {
                thumbnailFilename = req.files.thumbnail[0].filename;
                console.log('- Using uploaded thumbnail:', thumbnailFilename);
            } else {
                thumbnailFilename = 'SpacePlayer.png';
                console.log('- Using default thumbnail:', thumbnailFilename);
            }

            console.log('STEP 3 - Creating video object');
            const newVideo = {
                id: generateUniqueId(),
                title: title,
                description: description || '',
                category: category || 'Not Categorized',
                duration: duration || '0:00',
                filename: videoFile.filename,
                src: `/videos/${videoFile.filename}`,
                thumbnail: thumbnailFilename,  // FIXED: Just filename, not full path
                size: formatFileSize(videoFile.size),
                uploadDate: new Date().toISOString(),
                views: 0
            };
            console.log('Created video object:', newVideo);

            console.log('STEP 4 - Reading existing data');
            const data = await readVideoData();
            console.log('Current videos in data.json:', data.videos.length);

            console.log('STEP 5 - Adding new video to array');
            data.videos.unshift(newVideo);
            console.log('Videos after adding new one:', data.videos.length);

            console.log('STEP 6 - Writing data to file');
            await writeVideoData(data);
            console.log('Data successfully written to data.json');

            console.log('STEP 7 - Sending response');
            const response = {
                message: 'Video uploaded successfully',
                video: newVideo,
                totalVideos: data.videos.length
            };
            console.log('Response object:', response);
            console.log('=== UPLOAD PROCESS SUCCESS ===');

            res.json(response);

        } catch (error) {
            console.error('=== SERVER UPLOAD ERROR ===');
            console.error('Error details:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Request body:', req.body);
            console.error('Request files:', req.files);
            console.error('===============================');

            if (req.files) {
                if (req.files.video) {
                    try { await unlink(req.files.video[0].path); } catch (e) {}
                }
                if (req.files.thumbnail) {
                    try { await unlink(req.files.thumbnail[0].path); } catch (e) {}
                }
            }

            res.status(500).json({ error: error.message || 'Upload failed' });
        }
    });
});

// Edit video metadata
app.put('/api/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, duration } = req.body;

        const data = await readVideoData();
        const videoIndex = data.videos.findIndex(v => v.id === id);

        if (videoIndex === -1) {
            return res.status(404).json({ error: 'Video not found' });
        }

        data.videos[videoIndex] = {
            ...data.videos[videoIndex],
            title: title,
            description: description || '',
            category: category,
            duration: duration
        };

        await writeVideoData(data);

        console.log(`✏️ Video updated: ${title}`);
        res.json({
            message: 'Video updated successfully',
            video: data.videos[videoIndex]
        });

    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Failed to update video' });
    }
});

// ALSO FIX: Update video thumbnail endpoint
app.put('/api/videos/:id/thumbnail', upload.single('thumbnail'), async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Thumbnail file is required' });
        }

        const data = await readVideoData();
        const videoIndex = data.videos.findIndex(v => v.id === id);

        if (videoIndex === -1) {
            await unlink(req.file.path);
            return res.status(404).json({ error: 'Video not found' });
        }

        // FIXED: Delete old thumbnail if it exists and is not default
        const currentThumbnail = data.videos[videoIndex].thumbnail;
        if (currentThumbnail && currentThumbnail !== 'SpacePlayer.png') {
            const oldThumbnailPath = path.join('thumbnails', currentThumbnail);
            if (fs.existsSync(oldThumbnailPath)) {
                await unlink(oldThumbnailPath);
            }
        }

        // FIXED: Store just filename
        data.videos[videoIndex].thumbnail = req.file.filename;
        await writeVideoData(data);

        console.log(`🖼️ Thumbnail updated for: ${data.videos[videoIndex].title}`);
        res.json({
            message: 'Thumbnail updated successfully',
            video: data.videos[videoIndex]
        });

    } catch (error) {
        console.error('Thumbnail update error:', error);

        if (req.file) {
            try { await unlink(req.file.path); } catch (e) {}
        }

        res.status(500).json({ error: 'Failed to update thumbnail' });
    }
});







// DIAGNOSTIC: Add this TEMPORARY endpoint to your server.js to debug the issue
// Add this ABOVE your existing delete endpoint
app.delete('/api/videos/debug/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔍 DEBUG DELETE - ID: ${id}`);

        const data = await readVideoData();
        console.log(`🔍 DEBUG - Videos in database: ${data.videos.length}`);

        const video = data.videos.find(v => v.id === id);
        if (!video) {
            console.log(`🔍 DEBUG - Video not found with ID: ${id}`);
            console.log(`🔍 DEBUG - Available IDs:`, data.videos.map(v => v.id).slice(0, 5));
            return res.json({ error: 'Video not found', availableIds: data.videos.map(v => v.id) });
        }

        console.log(`🔍 DEBUG - Found video:`, JSON.stringify(video, null, 2));

        // Check file existence
        const videoFilename = video.filename || video.file;
        if (videoFilename) {
            const videoPath = path.join(__dirname, 'videos', videoFilename);
            const videoExists = fs.existsSync(videoPath);
            console.log(`🔍 DEBUG - Video file path: ${videoPath}`);
            console.log(`🔍 DEBUG - Video file exists: ${videoExists}`);
        } else {
            console.log(`🔍 DEBUG - No filename found in video object`);
        }

        if (video.thumbnail && video.thumbnail !== 'SpacePlayer.png') {
            const thumbPath = path.join(__dirname, 'thumbnails', video.thumbnail);
            const thumbExists = fs.existsSync(thumbPath);
            console.log(`🔍 DEBUG - Thumbnail path: ${thumbPath}`);
            console.log(`🔍 DEBUG - Thumbnail exists: ${thumbExists}`);
        }

        res.json({
            success: true,
            video: video,
            diagnosis: 'Video found and analyzed - check terminal for details'
        });

    } catch (error) {
        console.error(`🔍 DEBUG ERROR:`, error.message);
        console.error(`🔍 DEBUG ERROR STACK:`, error.stack);
        res.json({ error: error.message, stack: error.stack });
    }
});




// Delete video
// FIXED Delete video endpoint - corrected property name
// FIXED Delete video endpoint with enhanced error handling and logging
// FIXED Delete video endpoint with enhanced debugging and error handling
app.delete('/api/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // SERVER LOG (appears in terminal, not browser)
        console.log(`🗑️ DELETE REQUEST RECEIVED for video ID: ${id}`);

        const data = await readVideoData();
        console.log(`🗑️ Total videos in database: ${data.videos.length}`);

        const videoIndex = data.videos.findIndex(v => v.id === id);
        console.log(`🗑️ Video found at index: ${videoIndex}`);

        if (videoIndex === -1) {
            console.log(`🗑️ ERROR: Video with ID ${id} not found in database`);
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = data.videos[videoIndex];
        console.log(`🗑️ Video to delete:`, JSON.stringify(video, null, 2));

        // FIXED: Handle multiple possible filename properties
        const videoFilename = video.filename || video.file || video.src?.split('/').pop();
        console.log(`🗑️ Determined video filename: ${videoFilename}`);

        if (!videoFilename) {
            console.log(`🗑️ ERROR: Could not determine video filename from video object`);
            console.log(`🗑️ Video object keys:`, Object.keys(video));
            return res.status(400).json({
                error: 'Video filename not found in database',
                videoData: video
            });
        }

        // Construct absolute paths
        const videoPath = path.resolve(__dirname, 'videos', videoFilename);
        console.log(`🗑️ Video file path: ${videoPath}`);
        console.log(`🗑️ Video file exists: ${fs.existsSync(videoPath)}`);

        // Handle video file deletion
        if (fs.existsSync(videoPath)) {
            try {
                await unlink(videoPath);
                console.log(`✅ Video file deleted successfully: ${videoPath}`);
            } catch (fileError) {
                console.error(`❌ Failed to delete video file: ${fileError.message}`);
                // Don't return error - continue with database cleanup
            }
        } else {
            console.log(`⚠️ Video file not found on disk: ${videoPath}`);
            // Continue anyway - file might already be deleted
        }

        // Handle thumbnail deletion
        const thumbnailFilename = video.thumbnail;
        console.log(`🗑️ Thumbnail filename: ${thumbnailFilename}`);

        if (thumbnailFilename &&
            thumbnailFilename !== 'SpacePlayer.png' &&
            !thumbnailFilename.includes('SpacePlayer')) {

            const thumbnailPath = path.resolve(__dirname, 'thumbnails', thumbnailFilename);
            console.log(`🗑️ Thumbnail path: ${thumbnailPath}`);
            console.log(`🗑️ Thumbnail exists: ${fs.existsSync(thumbnailPath)}`);

            if (fs.existsSync(thumbnailPath)) {
                try {
                    await unlink(thumbnailPath);
                    console.log(`✅ Thumbnail deleted successfully: ${thumbnailPath}`);
                } catch (thumbError) {
                    console.error(`❌ Failed to delete thumbnail: ${thumbError.message}`);
                    // Continue anyway
                }
            }
        } else {
            console.log(`🗑️ Skipping thumbnail deletion (default or missing)`);
        }

        // Remove from database array
        console.log(`🗑️ Removing video from database array...`);
        const deletedVideo = data.videos.splice(videoIndex, 1)[0];
        console.log(`🗑️ Videos remaining in array: ${data.videos.length}`);

        // Save updated database
        try {
            await writeVideoData(data);
            console.log(`✅ Database updated successfully`);
        } catch (dbError) {
            console.error(`❌ Database update failed: ${dbError.message}`);
            // This is critical - restore the video to array
            data.videos.splice(videoIndex, 0, deletedVideo);
            throw new Error(`Failed to update database: ${dbError.message}`);
        }

        console.log(`✅ DELETE SUCCESSFUL: "${video.title}" completely removed`);

        // Send success response
        res.json({
            success: true,
            message: 'Video deleted successfully',
            deletedVideo: {
                id: video.id,
                title: video.title,
                filename: videoFilename,
                thumbnail: thumbnailFilename
            },
            remainingVideos: data.videos.length
        });

    } catch (error) {
        console.error('🗑️ CRITICAL DELETE ERROR:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Request params:', req.params);

        res.status(500).json({
            error: `Delete failed: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
});



// Serve individual HTML files from public directory
app.get('/video.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'video.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Default route to index
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Get video stats - ADDED
app.get('/api/stats', async (req, res) => {
    try {
        const data = await readVideoData();
        const videos = data.videos;

        const stats = {
            totalVideos: videos.length,
            totalViews: videos.reduce((sum, v) => sum + (v.views || 0), 0),
            categories: {},
            storageUsed: 0
        };

        videos.forEach(video => {
            if (stats.categories[video.category]) {
                stats.categories[video.category]++;
            } else {
                stats.categories[video.category] = 1;
            }

            if (video.size) {
                const sizeStr = video.size.replace(/[^\d.]/g, '');
                const sizeNum = parseFloat(sizeStr) || 0;
                if (video.size.includes('GB')) {
                    stats.storageUsed += sizeNum * 1024;
                } else {
                    stats.storageUsed += sizeNum;
                }
            }
        });

        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        console.error('Multer error details:', error);
        return res.status(400).json({ error: 'File upload error: ' + error.message });
    }

    console.error('Unhandled error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
});

// Initialize and start server
initializeDirectories();

const server = app.listen(PORT, () => {
    console.log('\n🚀 Space Player Server Started!');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🎮 Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`🌍 User interface: http://localhost:${PORT}/index.html`);
    console.log('\n✅ Ready to upload videos of any size!');
    console.log('📁 File size limits: UNLIMITED');
    console.log('⏱️ Upload timeout: 30 minutes');
});

server.timeout = 30 * 60 * 1000;
