class MediaManager {
    constructor() {
        this.mediaItems = [];
        this.currentIndex = 0;
        this.isSlideshowActive = false;
        this.slideshowInterval = null;
        this.imageDuration = 10; // seconds
        this.transitionDuration = 1000; // milliseconds
        this.dbName = 'MediaSlideshowDB';
        this.dbVersion = 1;
        this.storeName = 'media';
        
        this.init();
    }

    async init() {
        await this.initDatabase();
        await this.loadMediaFromStorage();
        this.setupEventListeners();
        this.updateUI();
    }

    // Database Management
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async saveMediaToDatabase(mediaItem) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(mediaItem);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async loadMediaFromDatabase() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteMediaFromDatabase(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Storage Management
    async loadMediaFromStorage() {
        try {
            // Load images from localStorage
            const storedImages = localStorage.getItem('slideshowImages');
            if (storedImages) {
                const images = JSON.parse(storedImages);
                this.mediaItems.push(...images);
            }

            // Load videos from IndexedDB
            const videos = await this.loadMediaFromDatabase();
            this.mediaItems.push(...videos);

            // Sort by upload order (timestamp)
            this.mediaItems.sort((a, b) => a.timestamp - b.timestamp);
        } catch (error) {
            console.error('Error loading media from storage:', error);
        }
    }

    async saveMediaToStorage(mediaItem) {
        try {
            if (mediaItem.type === 'image') {
                // Save images to localStorage
                const storedImages = localStorage.getItem('slideshowImages') || '[]';
                const images = JSON.parse(storedImages);
                images.push(mediaItem);
                localStorage.setItem('slideshowImages', JSON.stringify(images));
            } else if (mediaItem.type === 'video') {
                // Save videos to IndexedDB
                await this.saveMediaToDatabase(mediaItem);
            }
        } catch (error) {
            console.error('Error saving media to storage:', error);
            throw error;
        }
    }

    async deleteMediaFromStorage(id, type) {
        try {
            if (type === 'image') {
                // Remove from localStorage
                const storedImages = localStorage.getItem('slideshowImages') || '[]';
                const images = JSON.parse(storedImages);
                const filteredImages = images.filter(img => img.id !== id);
                localStorage.setItem('slideshowImages', JSON.stringify(filteredImages));
            } else if (type === 'video') {
                // Remove from IndexedDB
                await this.deleteMediaFromDatabase(id);
            }
        } catch (error) {
            console.error('Error deleting media from storage:', error);
            throw error;
        }
    }

    // File Processing
    async processFile(file) {
        const fileType = file.type.startsWith('image/') ? 'image' : 'video';
        const id = this.generateId();
        const timestamp = Date.now();
        
        try {
            this.showLoading(true);
            
            let data, preview;
            
            if (fileType === 'image') {
                data = await this.readFileAsDataURL(file);
                preview = data;
            } else {
                data = await this.readFileAsBlob(file);
                preview = await this.createVideoThumbnail(file);
            }

            const mediaItem = {
                id,
                name: file.name,
                type: fileType,
                size: file.size,
                data,
                preview,
                timestamp
            };

            await this.saveMediaToStorage(mediaItem);
            this.mediaItems.push(mediaItem);
            this.updateUI();
            
            // Show success feedback
            this.showSuccessFeedback();
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showErrorFeedback('Failed to process file: ' + file.name);
        } finally {
            this.showLoading(false);
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    readFileAsBlob(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    createVideoThumbnail(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.onloadeddata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            
            video.onerror = () => {
                // Fallback to a generic video icon
                resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjMzMzIi8+CjxwYXRoIGQ9Ik0zMCAyNUw3MCA1MEwzMCA3NVYyNVoiIGZpbGw9IiMwMGQ0ZmYiLz4KPC9zdmc+');
            };
            
            video.src = URL.createObjectURL(file);
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // UI Management
    updateUI() {
        this.updateMediaGrid();
        this.updateStats();
        this.updateConfigSection();
        this.updateStartButton();
    }

    updateMediaGrid() {
        const mediaGrid = document.getElementById('mediaGrid');
        mediaGrid.innerHTML = '';

        this.mediaItems.forEach(item => {
            const mediaItem = this.createMediaItemElement(item);
            mediaGrid.appendChild(mediaItem);
        });
    }

    createMediaItemElement(item) {
        const div = document.createElement('div');
        div.className = 'media-item fade-in';
        div.innerHTML = `
            <img src="${item.preview}" alt="${item.name}" class="media-preview">
            <div class="media-info">
                <div class="media-filename">${item.name}</div>
                <div class="media-size">${this.formatFileSize(item.size)}</div>
                <div class="media-type">${item.type.toUpperCase()}</div>
            </div>
            <button class="delete-btn" onclick="mediaManager.deleteMedia('${item.id}')">×</button>
        `;
        return div;
    }

    updateStats() {
        const mediaCount = document.getElementById('mediaCount');
        const totalSize = document.getElementById('totalSize');
        
        mediaCount.textContent = `${this.mediaItems.length} items`;
        totalSize.textContent = `${this.formatFileSize(this.getTotalSize())}`;
    }

    updateConfigSection() {
        const configSection = document.getElementById('configSection');
        const hasImages = this.mediaItems.some(item => item.type === 'image');
        
        if (hasImages && this.mediaItems.length > 0) {
            configSection.style.display = 'block';
        } else {
            configSection.style.display = 'none';
        }
    }

    updateStartButton() {
        const startButton = document.getElementById('startSlideshow');
        startButton.disabled = this.mediaItems.length === 0;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getTotalSize() {
        return this.mediaItems.reduce((total, item) => total + item.size, 0);
    }

    // Media Management
    async deleteMedia(id) {
        const item = this.mediaItems.find(item => item.id === id);
        if (!item) return;

        try {
            await this.deleteMediaFromStorage(id, item.type);
            
            // Clean up blob URLs for videos
            if (item.type === 'video' && item.data) {
                URL.revokeObjectURL(item.data);
            }
            
            this.mediaItems = this.mediaItems.filter(item => item.id !== id);
            this.updateUI();
            
            // If slideshow is active and we deleted the current item, adjust index
            if (this.isSlideshowActive) {
                if (this.currentIndex >= this.mediaItems.length) {
                    this.currentIndex = 0;
                }
                this.showCurrentMedia();
            }
            
        } catch (error) {
            console.error('Error deleting media:', error);
            this.showErrorFeedback('Failed to delete media');
        }
    }

    async clearAllMedia() {
        if (!confirm('Are you sure you want to delete all media? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading(true);
            
            // Stop slideshow if active
            if (this.isSlideshowActive) {
                this.stopSlideshow();
            }

            // Clear localStorage
            localStorage.removeItem('slideshowImages');
            
            // Clear IndexedDB
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            // Clean up blob URLs
            this.mediaItems.forEach(item => {
                if (item.type === 'video' && item.data) {
                    URL.revokeObjectURL(item.data);
                }
            });

            this.mediaItems = [];
            this.currentIndex = 0;
            this.updateUI();
            
        } catch (error) {
            console.error('Error clearing all media:', error);
            this.showErrorFeedback('Failed to clear all media');
        } finally {
            this.showLoading(false);
        }
    }

    // Slideshow Management
    startSlideshow() {
        if (this.mediaItems.length === 0) return;

        this.isSlideshowActive = true;
        this.currentIndex = 0;
        
        // Add class to body to hide scrollbar
        document.body.classList.add('slideshow-active');
        
        const overlay = document.getElementById('slideshowOverlay');
        overlay.style.display = 'flex';
        
        this.showCurrentMedia();
        this.scheduleNextMedia();
        
        // Do NOT request fullscreen (Plash: keep top bar visible)
        // if (document.documentElement.requestFullscreen) {
        //     document.documentElement.requestFullscreen().catch(err => {
        //         console.log('Fullscreen request failed:', err);
        //     });
        // }
    }

    stopSlideshow() {
        this.isSlideshowActive = false;
        
        // Remove class from body to show scrollbar
        document.body.classList.remove('slideshow-active');
        
        if (this.slideshowInterval) {
            clearTimeout(this.slideshowInterval);
            this.slideshowInterval = null;
        }
        
        const overlay = document.getElementById('slideshowOverlay');
        overlay.style.display = 'none';
        
        // Do NOT exit fullscreen (Plash: keep top bar visible)
        // if (document.exitFullscreen) {
        //     document.exitFullscreen().catch(err => {
        //         console.log('Exit fullscreen failed:', err);
        //     });
        // }
        
        // Hide current media
        const slideshowImage = document.getElementById('slideshowImage');
        const slideshowVideo = document.getElementById('slideshowVideo');
        slideshowImage.style.display = 'none';
        slideshowVideo.style.display = 'none';
        slideshowImage.classList.remove('active');
        slideshowVideo.classList.remove('active');
    }

    showCurrentMedia() {
        if (this.mediaItems.length === 0) return;

        const item = this.mediaItems[this.currentIndex];
        const slideshowImage = document.getElementById('slideshowImage');
        const slideshowVideo = document.getElementById('slideshowVideo');
        const currentItemInfo = document.getElementById('currentItemInfo');
        const progressInfo = document.getElementById('progressInfo');

        // Update info
        currentItemInfo.textContent = item.name;
        progressInfo.textContent = `${this.currentIndex + 1} / ${this.mediaItems.length}`;

        // Hide both media elements
        slideshowImage.style.display = 'none';
        slideshowVideo.style.display = 'none';
        slideshowImage.classList.remove('active');
        slideshowVideo.classList.remove('active');

        if (item.type === 'image') {
            slideshowImage.src = item.data;
            slideshowImage.style.display = 'block';
            
            // Trigger reflow before adding active class
            slideshowImage.offsetHeight;
            slideshowImage.classList.add('active');
            
        } else if (item.type === 'video') {
            // Create blob URL for video
            const blob = new Blob([item.data], { type: 'video/mp4' });
            const videoUrl = URL.createObjectURL(blob);
            
            slideshowVideo.src = videoUrl;
            slideshowVideo.style.display = 'block';
            
            // Set up video event listeners
            slideshowVideo.onloadeddata = () => {
                slideshowVideo.classList.add('active');
            };
            
            slideshowVideo.onended = () => {
                URL.revokeObjectURL(videoUrl);
                this.nextMedia();
            };
            
            slideshowVideo.onerror = () => {
                URL.revokeObjectURL(videoUrl);
                console.error('Video playback error, skipping to next');
                this.nextMedia();
            };
            
            // Start playing
            slideshowVideo.play().catch(err => {
                console.error('Video autoplay failed:', err);
                this.nextMedia();
            });
        }
    }

    nextMedia() {
        if (!this.isSlideshowActive) return;

        this.currentIndex = (this.currentIndex + 1) % this.mediaItems.length;
        this.showCurrentMedia();
        this.scheduleNextMedia();
    }

    scheduleNextMedia() {
        if (!this.isSlideshowActive) return;

        const item = this.mediaItems[this.currentIndex];
        
        if (item.type === 'image') {
            // For images, schedule next after image duration
            this.slideshowInterval = setTimeout(() => {
                this.nextMedia();
            }, this.imageDuration * 1000);
        }
        // For videos, next is handled by video.onended event
    }

    // Event Listeners
    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Upload area
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // Configuration
        const imageDuration = document.getElementById('imageDuration');
        const durationValue = document.getElementById('durationValue');
        
        imageDuration.addEventListener('input', (e) => {
            this.imageDuration = parseInt(e.target.value);
            durationValue.textContent = e.target.value;
        });

        // Controls
        document.getElementById('startSlideshow').addEventListener('click', () => {
            this.startSlideshow();
        });

        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAllMedia();
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isSlideshowActive) {
                this.stopSlideshow();
            }
        });

        // Fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && this.isSlideshowActive) {
                this.stopSlideshow();
            }
        });
    }

    handleFileSelect(files) {
        const validFiles = Array.from(files).filter(file => {
            const isValid = file.type.startsWith('image/') || file.type.startsWith('video/');
            if (!isValid) {
                this.showErrorFeedback(`Unsupported file type: ${file.name}`);
            }
            return isValid;
        });

        if (validFiles.length === 0) return;

        validFiles.forEach(file => {
            this.processFile(file);
        });
    }

    // Feedback Methods
    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }

    showSuccessFeedback() {
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.classList.add('success');
        setTimeout(() => {
            uploadArea.classList.remove('success');
        }, 2000);
    }

    showErrorFeedback(message) {
        // Create temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message fade-in';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 71, 87, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 3000;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize the application
let mediaManager;

document.addEventListener('DOMContentLoaded', () => {
    mediaManager = new MediaManager();
});
