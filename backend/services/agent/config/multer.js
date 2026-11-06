import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import multer from "multer"

const uploadDir = path.resolve("./temp")

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const EXTENSION_BY_MIME = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
};

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDir)
    },
    filename(req, file, cb) {
        // Never reuse the client-supplied name: it can contain path segments
        // and would let a caller choose where the file is written.
        const ext = EXTENSION_BY_MIME[file.mimetype] || "";
        cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`)
    },
})

const fileFilter = (req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(EXTENSION_BY_MIME, file.mimetype)) {
        cb(null, true)
    } else {
        cb(new Error("Only PDF and image uploads are allowed."))
    }
}


export default multer({
    storage, fileFilter, limits: {
        fileSize: 20 * 1024 * 1024,
        files: 1,
    }
})
