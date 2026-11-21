export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024
export const MAX_UPLOAD_MB = 40

export function isWithinUploadLimit(file) {
  return !file || file.size <= MAX_UPLOAD_BYTES
}

export function uploadTooLargeMessage(label = 'Image') {
  return `${label} must be ${MAX_UPLOAD_MB} MB or smaller.`
}
