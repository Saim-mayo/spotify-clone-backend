const Download = require('../models/download.model');
const AppError = require('../utils/appError');
const { getPlanFeatures } = require('../utils/accessControl');

const recordDownload = async ({
    user,          // full req.user object (has .subscription, .isBanned)
    songId,
    ipAddress,
    userAgent
}) => {

    if (!user?.userId || !songId) {
        throw new AppError('Invalid download information', 400);
    }

    const userId = user.userId;
    const features = getPlanFeatures(user);

    // maxDownloads === null -> unlimited (Max plan)
    if (features.maxDownloads !== null) {
        const alreadyOwned = await Download.exists({ user: userId, song: songId });

        if (!alreadyOwned) {
            const distinctCount = await Download.countDocuments({ user: userId });
            if (distinctCount >= features.maxDownloads) {
                throw new AppError(
                    `Download limit reached (${features.maxDownloads} for your plan). Upgrade to download more.`,
                    403
                );
            }
        }
    }

    return await Download.findOneAndUpdate(
        {
            user: userId,
            song: songId
        },
        {
            $inc: {
                downloadCount: 1
            },
            $set: {
                ipAddress,
                userAgent,
                downloadedAt: new Date()
            }
        },
        {
            upsert: true,
            returnDocument: "after"
        }
    );

};

const getUserDownloads = async (userId) => {

    return await Download.find({
        user: userId
    })
        .populate('song', 'title artist')
        .sort({ downloadedAt: -1 });

};

module.exports = {
    recordDownload,
    getUserDownloads
};