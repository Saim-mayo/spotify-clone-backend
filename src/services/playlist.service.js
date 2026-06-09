const mongoose = require('mongoose');
const Playlist = require('../models/playlist.model');
const AppError = require('../utils/appError');

/**
 * =========================
 * 🎧 CREATE PLAYLIST (FIXED)
 * =========================
 */
const createPlaylistService = async ({
    title,
    userId,
    isPublic
}) => {

    if (!title || title.trim() === '') {
        throw new AppError('Title is required', 400);
    }

    const cleanTitle = title.trim();

    // optional safety (DB index already protects)
    const existing = await Playlist.findOne({
        user: userId,
        title: cleanTitle
    });

    if (existing) {
        throw new AppError('Playlist already exists', 409);
    }

    return await Playlist.create({
        title: cleanTitle,
        user: userId,
        isPublic: isPublic ?? true,
        songs: []
    });
};

/**
 * =========================
 * ➕ ADD SONG (FIXED)
 * =========================
 */
const addSongToPlaylistService = async ({
    playlistId,
    songId,
    userId
}) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw new AppError('Invalid songId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    if (playlist.user.toString() !== userId.toString()) {
        throw new AppError('Not allowed', 403);
    }

    const alreadyExists = playlist.songs.some(
        (s) => s.toString() === songId.toString()
    );

    if (alreadyExists) {
        throw new AppError('Song already in playlist', 409);
    }

    playlist.songs.push(songId);
    await playlist.save();

    return playlist;
};

/**
 * =========================
 * ❌ REMOVE SONG (FIXED)
 * =========================
 */
const removeSongFromPlaylistService = async ({
    playlistId,
    songId,
    userId
}) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
        throw new AppError('Invalid songId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    if (playlist.user.toString() !== userId.toString()) {
        throw new AppError('Not allowed', 403);
    }

    const exists = playlist.songs.some(
        (s) => s.toString() === songId.toString()
    );

    if (!exists) {
        throw new AppError('Song not in playlist', 409);
    }

    playlist.songs = playlist.songs.filter(
        id => id.toString() !== songId.toString()
    );

    await playlist.save();

    return playlist;
};

/**
 * =========================
 * 📄 GET MY PLAYLISTS
 * =========================
 */
const getMyPlaylistsService = async (userId) => {
    return await Playlist.find({ user: userId })
        .populate('songs', 'title uri');
};

/**
 * =========================
 * 📄 GET BY ID
 * =========================
 */
const getPlaylistByIdService = async (playlistId) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    const playlist = await Playlist.findById(playlistId)
        .populate('songs', 'title uri artist')
        .populate('user', 'username avatar');

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    return playlist;
};

/**
 * =========================
 * 🗑 DELETE PLAYLIST (FIXED)
 * =========================
 */
const removePlaylistService = async (playlistId, userId) => {

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new AppError('Invalid playlistId', 400);
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new AppError('Playlist not found', 404);
    }

    if (playlist.user.toString() !== userId.toString()) {
        throw new AppError('Not allowed to delete this playlist', 403);
    }

    await playlist.deleteOne();

    return true;
};

module.exports = {
    createPlaylistService,
    addSongToPlaylistService,
    removeSongFromPlaylistService,
    getMyPlaylistsService,
    getPlaylistByIdService,
    removePlaylistService
};