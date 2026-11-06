import { getFirebaseAuth } from "../config/firebase.js";
import User from "../models/user.model.js";
import { sanitizeUser } from "../utils/plan.js";
import {
    createSession,
    destroySession,
    sessionCookieOptions,
    clearCookieOptions,
} from "../utils/session.js";

function isDuplicateKey(error) {
    return error?.code === 11000;
}

export const login = async (req, res) => {
    try {
        const { token } = req.body ?? {};
        if (typeof token !== "string" || token.trim().length === 0) {
            return res.status(400).json({ message: "A Firebase ID token is required." });
        }

        const decoded = await getFirebaseAuth().verifyIdToken(token);

        let dbUser = await User.findOne({ firebaseUid: decoded.uid });
        if (!dbUser) {
            try {
                dbUser = await User.create({
                    _id: decoded.uid,
                    firebaseUid: decoded.uid,
                    name: decoded.name || decoded.email || "User",
                    email: decoded.email || "",
                    avatar: decoded.picture || ""
                });
            } catch (error) {
                // Concurrent first logins race on the unique firebaseUid.
                if (!isDuplicateKey(error)) throw error;
                dbUser = await User.findOne({ firebaseUid: decoded.uid });
            }
        } else {
            const nextName = decoded.name || dbUser.name;
            const nextAvatar = decoded.picture || dbUser.avatar;
            if (nextName !== dbUser.name || nextAvatar !== dbUser.avatar) {
                dbUser.name = nextName;
                dbUser.avatar = nextAvatar;
                await dbUser.save();
            }
        }

        if (!dbUser) {
            return res.status(500).json({ message: "Unable to create a session." });
        }

        const sessionId = await createSession(dbUser.firebaseUid);
        res.cookie("session", sessionId, sessionCookieOptions());

        return res.status(200).json(sanitizeUser(dbUser));
    } catch (error) {
        console.error("[auth] login failed");
        const status = error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error" ? 401 : 500;
        return res.status(status).json({ message: "Unable to sign in." });
    }
}


export const logout = async (req, res) => {
    try {
        await destroySession(req.cookies?.session);
        res.clearCookie("session", clearCookieOptions());
        return res.status(200).json({ message: "Logged out." });
    } catch (error) {
        console.error("[auth] logout failed");
        return res.status(500).json({ message: "Unable to log out." });
    }
}


export const me = async (req, res) => {
    try {
        const user = await User.findOne({ firebaseUid: req.userId });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        return res.status(200).json(sanitizeUser(user));
    } catch (error) {
        console.error("[auth] current user lookup failed");
        return res.status(500).json({ message: "Unable to load the current user." });
    }
}
