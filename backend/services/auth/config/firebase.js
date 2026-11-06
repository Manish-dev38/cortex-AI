import fs from "node:fs";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let firebaseApp = null;

/**
 * Firebase Admin is initialised on first use, not at import time. This keeps
 * the app importable for tests and health checks on hosts that do not hold the
 * service-account key, and turns a missing key into a login-time error instead
 * of a module-load crash.
 */
export function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;

    const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        || path.resolve(process.cwd(), "serviceAccountKey.json");

    const raw = inline && inline.trim().length > 0
        ? inline
        : fs.readFileSync(filePath, "utf8");

    const credentials = JSON.parse(raw);
    firebaseApp = initializeApp({ credential: cert(credentials) });
    return firebaseApp;
}

export function getFirebaseAuth() {
    return getAuth(getFirebaseApp());
}
