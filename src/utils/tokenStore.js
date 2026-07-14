// utils/tokenStore.js
const crypto = require('crypto');
const RefreshToken = require('../models/refreshToken');

const HMAC_SECRET = process.env.REFRESH_TOKEN_HMAC_SECRET;
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

if (!HMAC_SECRET) {
    throw new Error('REFRESH_TOKEN_HMAC_SECRET env var is required');
}

function hashToken(raw) {
    return crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(raw)
        .digest('hex');
}
/**
 * Called on every login / register / googleLogin.
 * Creates a brand new token family. Old family tokens remain
 * but become detached (they'll fail lookup by userId matching).
 */
async function createTokenFamily(userId) {
    await RefreshToken.deleteMany({
        userId
    });
    const family = crypto.randomUUID();
    const raw = crypto.randomBytes(40).toString('hex');
    const tokenHash = hashToken(raw);
    await RefreshToken.create({
        tokenHash,
        userId,
        family,
        used: false,
        expiresAt: new Date(Date.now() + EXPIRY_MS),
    });

    return { raw, family };
}

/**
 * Called on /refresh.
 * Returns userId if valid, throws descriptive error otherwise.
 * Handles marking old token used and creating the next one.
 */
async function rotateToken(rawIncoming) {
    const incomingHash = hashToken(rawIncoming);

    // ATOMIC: find AND mark used in one DB operation — no race window
    const existing = await RefreshToken.findOneAndUpdate(
        { tokenHash: incomingHash, used: false },
        { $set: { used: true } },
        { new: false }  // return the document BEFORE update
    );

    if (!existing) {
        // Either doesn't exist, or was already used (replay attack)
        // Check if the hash exists at all to differentiate
        const stale = await RefreshToken.findOne({ tokenHash: incomingHash });
        if (stale) {
            // Token exists but was already used → REPLAY
            await RefreshToken.deleteMany({ userId: stale.userId, family: stale.family });
            throw Object.assign(new Error('TOKEN_REUSE'), { status: 403 });
        }
        throw Object.assign(new Error('INVALID_TOKEN'), { status: 401 });
    }

    if (existing.expiresAt < new Date()) {
        await RefreshToken.deleteOne({ _id: existing._id });
        throw Object.assign(new Error('TOKEN_EXPIRED'), { status: 401 });
    }

    const newRaw = crypto.randomBytes(40).toString('hex');
    await RefreshToken.create({
        tokenHash: hashToken(newRaw),
        userId: existing.userId,
        family: existing.family,
        used: false,
        expiresAt: new Date(Date.now() + EXPIRY_MS)
    });

    return { newRaw, userId: existing.userId };
}
/**
 * Called on logout.
 */
async function revokeFamily(rawToken) {
    const tokenHash = hashToken(rawToken);
    const token = await RefreshToken.findOne({ tokenHash });
    if (token) {
        await RefreshToken.deleteMany({
            userId: token.userId,
            family: token.family,
        });
    }
}

module.exports = { createTokenFamily, rotateToken, revokeFamily, hashToken };