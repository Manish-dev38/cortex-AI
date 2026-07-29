import { getAuth } from "firebase-admin/auth";
import { app } from "../config/firebase.js";
import crypto from "crypto";
import redis from "../../../shared/redis/redis.js"
import User from "../models/user.model.js";

export const login = async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = await getAuth(app).verifyIdToken(token)

        let dbUser = await User.findOne({ firebaseUid: decoded.uid });
        if (!dbUser) {
            dbUser = await User.create({
                _id: decoded.uid,
                firebaseUid: decoded.uid,
                name: decoded.name || decoded.email || "User",
                email: decoded.email || "",
                avatar: decoded.picture || ""
            });
        } else {
            // Update name and avatar if they changed
            dbUser.name = decoded.name || dbUser.name;
            dbUser.avatar = decoded.picture || dbUser.avatar;

            // Set defaults for existing users who registered before the new fields were added
            if (dbUser.plan === undefined || dbUser.plan === null) {
                dbUser.plan = "Free";
            }
            if (dbUser.credits === undefined || dbUser.credits === null) {
                dbUser.credits = 100;
            }
            if (dbUser.totalCredits === undefined || dbUser.totalCredits === null) {
                dbUser.totalCredits = 100;
            }

            await dbUser.save();
        }

        const sessionId = crypto.randomUUID();

        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: dbUser.firebaseUid,
            name: dbUser.name,
            email: dbUser.email,
            avatar: dbUser.avatar,
            plan: dbUser.plan,
            credits: dbUser.credits,
            totalCredits: dbUser.totalCredits,
            planExpiresAt: dbUser.planExpiresAt
        }),
            "EX", 7 * 24 * 60 * 60
        )

        res.cookie("session", sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })
        console.log(dbUser)
        return res.status(200).json(dbUser);

    } catch (error) {
        console.error("Login failed:", error)
        return res.status(500).json({ message: error.message || "Unable to create a session." })
    }
}


export const logout = async (req, res) => {
    try {
        const sessionId = req.cookies?.session;
        await redis.del(`session-${sessionId}`)

        res.clearCookie("session")
        return res.status(200).json({ message: "Logout Sucessfully" })
    } catch (error) {
        return res.status(500).json({ message: "LOGOUT ERROR" })
    }
}

export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId } = req.body

        const user = await User.findOne({ firebaseUid: userId })

        if (!user) {
            return res.status(404).json({ message: "User Not Found" })
        }

        user.plan = plan
        user.credits += credits
        user.totalCredits += credits
        user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await user.save()

        const sessionId = await redis.get(`user-session-${user?._id}`)
        console.log("sessionId:=>", sessionId)

        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: user.firebaseUid,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }),
            "EX", 7 * 24 * 60 * 60
        )

        return res.status(200).json({ success: true, message: "Updated User Payment" })

    } catch (error) {
        return res.status(500).json({ message: `Update user Payment Error=>${error}` })
    }
}


export const deductCredits = async (req, res) => {
    try {
        const { userId, agent } = req.body
        const COST = {
            chat: 3,
            search: 5,
            coding: 10,
            pdf: 10,
            ppt: 10,
            vision: 8,
        };

        const user = await User.findOne({ firebaseUid: userId })

        if (!user) {
            return res.status(400).json({ Message: "User Not Found" })
        }

        const requiredCredit = COST[agent] || 1;

        if (user.credits < requiredCredit) {
            return res.status(400).json({ Message: "Not Enough credit." })
        }

        user.credits -= requiredCredit
        await user.save()

        const sessionId = await redis.get(`user-session-${user?._id}`)
        console.log("sessionId:=>", sessionId)

        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: user.firebaseUid,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }),
            "EX", 7 * 24 * 60 * 60
        )

        return res.status(200).json({ success: true, credits: user.credits })

    } catch (error) {
        return res.status(500).json({ message: `Deduct Credit Error=>${error}` })
    }
}

