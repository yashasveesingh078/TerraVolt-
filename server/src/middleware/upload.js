import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Builds an upload middleware that saves up to 6 photos into uploads/<folder>
function makeUploader(folder) {
  const upload = multer({
    storage: multer.diskStorage({
      destination: `uploads/${folder}`,
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 6 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.mimetype.startsWith('image/') && ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
      else cb(new Error('Only JPG, PNG or WEBP photos can be uploaded'));
    },
  });

  return (req, res, next) => {
    upload.array('photos', 6)(req, res, (err) => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be under 5 MB' : err.message;
        return res.status(400).json({ error: message });
      }
      next();
    });
  };
}

export const uploadSurveyPhotos = makeUploader('surveys');
export const uploadJobPhotos = makeUploader('jobs');