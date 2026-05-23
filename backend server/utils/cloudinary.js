const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Cloudinary will read configuration from CLOUDINARY_URL or env vars
cloudinary.config({ secure: true });

function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = { resource_type: options.resource_type || 'auto', folder: options.folder || 'klians' };
    if (options.public_id) opts.public_id = options.public_id;
    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

function uploadBase64(dataUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = { resource_type: options.resource_type || 'auto', folder: options.folder || 'klians' };
    if (options.public_id) opts.public_id = options.public_id;
    cloudinary.uploader.upload(dataUrl, opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

module.exports = { uploadBuffer, uploadBase64 };
