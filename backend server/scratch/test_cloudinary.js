const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: '../.env' });
cloudinary.config({ secure: true });

async function testCloudinary() {
  const fs = require('fs');
  const buffer = fs.readFileSync('../package.json'); // upload package.json
  
  cloudinary.uploader.upload_stream({ resource_type: 'auto', public_id: 'test_file.json' }, (error, result) => {
    console.log('Result for auto + .json:', result.secure_url, result.public_id);
  }).end(buffer);

  const pdfBuffer = Buffer.from('%PDF-1.4\n%EOF\n');
  cloudinary.uploader.upload_stream({ resource_type: 'auto', public_id: 'test_file.pdf' }, (error, result) => {
    console.log('Result for auto + .pdf:', result.secure_url, result.public_id);
  }).end(pdfBuffer);
}
testCloudinary();
