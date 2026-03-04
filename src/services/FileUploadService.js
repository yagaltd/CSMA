/**
 * File Upload Service
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: service
 * - Owner: platform-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Features:
 * - Platform-aware file upload (web, mobile, desktop)
 * - Progress tracking for multiple concurrent uploads
 * - File validation (type, size)
 * - Drag & drop support
 * - Preview generation for images
 */

import { getPlatformConfig } from '../utils/platform.js';

export function createFileUploadService(eventBus) {
    const platformConfig = getPlatformConfig();
    
    return {
        /**
         * Upload a single file with progress tracking
         */
        async uploadFile(file, options = {}) {
            const { maxFileSize = 10 * 1024 * 1024, allowedTypes = [] } = options;
            
            // Validate file
            const validation = this.validateFile(file, { maxFileSize, allowedTypes });
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // Generate file ID
            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Publish upload started
            eventBus.publishSync('FILE_UPLOAD_STARTED', {
                fileId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                timestamp: Date.now()
            });
            
            try {
                // Use platform-specific upload method
                let result;
                if (platformConfig.isMobile) {
                    result = await this._uploadMobile(file, fileId, eventBus);
                } else if (platformConfig.isDesktop) {
                    result = await this._uploadDesktop(file, fileId, eventBus);
                } else {
                    result = await this._uploadWeb(file, fileId, eventBus);
                }
                
                // If this is an image, generate preview
                let previewUrl = null;
                if (file.type.startsWith('image/')) {
                    previewUrl = await this._generatePreview(file);
                }
                
                eventBus.publishSync('FILE_UPLOAD_COMPLETED', {
                    fileId,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    previewUrl,
                    result,
                    timestamp: Date.now()
                });
                
                return { fileId, result, previewUrl };
                
            } catch (error) {
                eventBus.publishSync('FILE_UPLOAD_FAILED', {
                    fileId,
                    fileName: file.name,
                    error: error.message,
                    timestamp: Date.now()
                });
                throw error;
            }
        },
        
        /**
         * Upload multiple files
         */
        async uploadFiles(files, options = {}) {
            const uploadPromises = Array.from(files).map(file => 
                this.uploadFile(file, options).catch(error => ({ file, error }))
            );
            
            return Promise.all(uploadPromises);
        },
        
        /**
         * Validate file against constraints
         */
        validateFile(file, constraints = {}) {
            const { maxFileSize, allowedTypes } = constraints;
            
            // Check file size
            if (maxFileSize && file.size > maxFileSize) {
                return {
                    valid: false,
                    error: `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`
                };
            }
            
            // Check file type
            if (allowedTypes && allowedTypes.length > 0) {
                const fileExtension = file.name.split('.').pop().toLowerCase();
                const isAllowed = allowedTypes.some(type => {
                    if (type.startsWith('.')) {
                        return fileExtension === type.slice(1);
                    }
                    if (type.includes('/')) {
                        return file.type === type;
                    }
                    return file.type.startsWith(type + '/');
                });
                
                if (!isAllowed) {
                    return {
                        valid: false,
                        error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}`
                    };
                }
            }
            
            return { valid: true };
        },
        
        /**
         * Web upload using standard File API
         */
        async _uploadWeb(file, fileId, eventBus) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        eventBus.publishSync('FILE_UPLOAD_PROGRESS', {
                            fileId,
                            progress,
                            loaded: e.loaded,
                            total: e.total,
                            timestamp: Date.now()
                        });
                    }
                };
                
                reader.onload = () => {
                    // Simulate successful upload
                    // In production, replace with actual API call
                    resolve({ 
                        url: `data:${file.type};base64,${btoa(reader.result)}`,
                        uploaded: true 
                    });
                };
                
                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };
                
                reader.readAsBinaryString(file);
            });
        },
        
        /**
         * Mobile upload placeholder (Capacitor Filesystem)
         */
        async _uploadMobile(file, fileId, eventBus) {
            // In production with Capacitor:
            // import { Filesystem } from '@capacitor/filesystem';
            // const result = await Filesystem.writeFile({ ... });
            
            // Simulate for now
            return new Promise((resolve) => {
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 10;
                    eventBus.publishSync('FILE_UPLOAD_PROGRESS', {
                        fileId,
                        progress,
                        loaded: Math.round((progress / 100) * file.size),
                        total: file.size,
                        timestamp: Date.now()
                    });
                    
                    if (progress >= 100) {
                        clearInterval(interval);
                        resolve({ mobileUploaded: true, uri: `file://${file.name}` });
                    }
                }, 200);
            });
        },
        
        /**
         * Desktop upload placeholder (Neutralino filesystem)
         */
        async _uploadDesktop(file, fileId, eventBus) {
            // In production with Neutralino:
            // const result = await Neutralino.filesystem.writeBinaryFile({ ... });
            
            // Simulate for now
            return new Promise((resolve) => {
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 15;
                    eventBus.publishSync('FILE_UPLOAD_PROGRESS', {
                        fileId,
                        progress,
                        loaded: Math.round((progress / 100) * file.size),
                        total: file.size,
                        timestamp: Date.now()
                    });
                    
                    if (progress >= 100) {
                        clearInterval(interval);
                        resolve({ desktopUploaded: true, path: `./uploads/${file.name}` });
                    }
                }, 150);
            });
        },
        
        /**
         * Generate preview URL for image files
         */
        async _generatePreview(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        },
        
        /**
         * Remove uploaded file
         */
        async removeFile(fileId, filePath) {
            const platformConfig = getPlatformConfig();
            
            // In production, implement platform-specific deletion
            // Web: Remove from IndexedDB or revokeObjectURL
            // Mobile: Use Capacitor Filesystem.deleteFile
            // Desktop: Use Neutralino filesystem
            
            eventBus.publishSync('FILE_REMOVED', {
                fileId,
                timestamp: Date.now()
            });
            
            return true;
        }
    };
}
