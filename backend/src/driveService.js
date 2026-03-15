/**
 * Google Drive 儲存服務
 * 環境變數：GOOGLE_DRIVE_CREDENTIALS_JSON（Service Account JSON 字串）、GOOGLE_DRIVE_FOLDER_ID
 */
import { google } from 'googleapis';
import { Readable } from 'stream';

let _drive = null;

function getDrive() {
  if (_drive) return _drive;
  const credsJson = process.env.GOOGLE_DRIVE_CREDENTIALS_JSON;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!credsJson || !folderId) return null;
  try {
    const credentials = JSON.parse(credsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']  // drive.file 在共用資料夾可能不足
    });
    _drive = { drive: google.drive({ version: 'v3', auth }), folderId };
    return _drive;
  } catch (e) {
    console.error('[driveService] 初始化失敗:', e.message);
    return null;
  }
}

export function isDriveEnabled() {
  return !!getDrive();
}

/**
 * 上傳 buffer 到 Google Drive
 * @param {Buffer} buffer - 檔案內容
 * @param {string} filename - 檔名（含副檔名）
 * @param {string} mimeType - MIME type
 * @returns {Promise<string|null>} Drive file ID，失敗回 null
 */
export async function uploadToDrive(buffer, filename, mimeType = 'application/octet-stream') {
  const d = getDrive();
  if (!d) return null;
  try {
    const stream = Readable.from(buffer);
    const { data } = await d.drive.files.create({
      requestBody: {
        name: filename,
        parents: [d.folderId]
      },
      media: {
        mimeType,
        body: stream
      },
      fields: 'id',
      supportsAllDrives: true
    });
    return data.id || null;
  } catch (e) {
    const errDetail = e.response?.data || e.message;
    console.error('[driveService] 上傳失敗:', JSON.stringify(errDetail));
    return null;
  }
}

/**
 * 取得 Drive 檔案 metadata（檔名、MIME）
 * @param {string} fileId - Drive file ID
 * @returns {Promise<{name:string,mimeType:string}|null>}
 */
export async function getDriveFileMetadata(fileId) {
  const d = getDrive();
  if (!d) return null;
  try {
    const { data } = await d.drive.files.get({
      fileId,
      fields: 'name,mimeType'
    });
    return data ? { name: data.name, mimeType: data.mimeType || 'application/octet-stream' } : null;
  } catch (e) {
    console.error('[driveService] 取得 metadata 失敗:', e.message);
    return null;
  }
}

/**
 * 從 Drive 下載檔案，回傳 buffer
 * @param {string} fileId - Drive file ID
 * @returns {Promise<Buffer|null>}
 */
export async function downloadFromDrive(fileId) {
  const d = getDrive();
  if (!d) return null;
  try {
    const res = await d.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
  } catch (e) {
    console.error('[driveService] 下載失敗:', e.message);
    return null;
  }
}
