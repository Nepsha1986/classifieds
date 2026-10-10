import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_LISTING,
  PHOTO_MIME_TYPES,
  PHOTO_UPLOAD_FIELD,
  isPhotoMimeType,
} from '@classifieds/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError, badRequest } from '../lib/http-error.js';
import { UPLOAD_TMP_DIR } from '../lib/uploads.js';

const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_TMP_DIR }),
  limits: {
    fileSize: PHOTO_MAX_BYTES,
    files: PHOTO_MAX_PER_LISTING,
    // Photos only: any text field is rejected.
    fields: 0,
    parts: PHOTO_MAX_PER_LISTING,
  },
  fileFilter: (_req, file, cb) => {
    // A cheap early reject by the declared type; the real format is checked from the bytes later.
    if (isPhotoMimeType(file.mimetype)) cb(null, true);
    else cb(unsupportedPhotoType());
  },
}).array(PHOTO_UPLOAD_FIELD, PHOTO_MAX_PER_LISTING);

export const unsupportedPhotoType = () =>
  new HttpError(415, `Photos must be ${PHOTO_MIME_TYPES.join(', ')}`, { allowed: PHOTO_MIME_TYPES });

/**
 * Parses `multipart/form-data` photos into `req.files` (stored in the temp upload dir). Multer removes
 * already-written files itself when it fails; on success the handler owns them.
 */
export const photoUpload: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => next(err === undefined ? undefined : toHttpError(err)));
};

function toHttpError(err: unknown): unknown {
  if (!(err instanceof multer.MulterError)) return err;
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new HttpError(413, `Each photo must be at most ${PHOTO_MAX_BYTES / 1024 / 1024} MB`);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return badRequest(`At most ${PHOTO_MAX_PER_LISTING} photos per listing`);
    case 'LIMIT_UNEXPECTED_FILE':
      return err.field === PHOTO_UPLOAD_FIELD
        ? badRequest(`At most ${PHOTO_MAX_PER_LISTING} photos per listing`)
        : badRequest(`Photos must be sent in the "${PHOTO_UPLOAD_FIELD}" field`);
    case 'LIMIT_FIELD_COUNT':
      return badRequest('Only photo files are accepted');
    default:
      return badRequest(err.message);
  }
}
