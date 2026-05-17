const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalNameWithoutExt = path.parse(file.originalname).name;
        // Clean original name (remove non-alphanumeric characters except dashes/underscores)
        const cleanOriginalName = originalNameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '');
        const finalName = cleanOriginalName || 'file';
        cb(null, finalName + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(messageType(file.mimetype));

    if (extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: File type not supported!'));
    }
};

function messageType(mimetype) {
    // Basic mapping
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype === 'application/pdf') return 'pdf';
    return mimetype;
}

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
});

module.exports = upload;
