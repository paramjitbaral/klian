const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist (disk fallback)
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

function messageType(mimetype) {
    if (!mimetype) return '';
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype === 'application/pdf') return 'pdf';
    return mimetype;
}

const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;

// Choose storage: memory for Cloudinary, disk otherwise
const useCloudinary = !!process.env.CLOUDINARY_URL || !!process.env.CLOUDINARY_CLOUD_NAME;
const storage = useCloudinary ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalNameWithoutExt = path.parse(file.originalname).name;
        const cleanOriginalName = originalNameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '');
        const finalName = cleanOriginalName || 'file';
        cb(null, finalName + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const multerInstance = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(messageType(file.mimetype));
        if (extname || mimetype) return cb(null, true);
        cb(new Error('Error: File type not supported!'));
    }
});

// If Cloudinary is enabled, after multer.memoryStorage we upload the buffer to Cloudinary
function cloudinaryPostHandler(fieldName) {
    return async (req, res, next) => {
        if (!useCloudinary) return next();
        if (!req.file || !req.file.buffer) return next();
        try {
            const cloudinaryHelper = require('../utils/cloudinary');
            const originalName = req.file.originalname || undefined;
            const result = await cloudinaryHelper.uploadBuffer(req.file.buffer, { public_id: `${Date.now()}-${originalName?.replace(/[^a-zA-Z0-9-_\.]/g,'')}` });
            req.file.uploadedUrl = result.secure_url || result.url;
            req.file.filename = (result.public_id || '') + (result.format ? '.' + result.format : '');
            next();
        } catch (err) {
            console.error('Cloudinary upload failed:', err);
            next(err);
        }
    };
}

// Export API compatible with existing usage: upload.single('file') -> returns middleware (or array)
module.exports = {
    single: (fieldName) => {
        const middlewares = [multerInstance.single(fieldName)];
        if (useCloudinary) middlewares.push(cloudinaryPostHandler(fieldName));
        return middlewares;
    }
};
