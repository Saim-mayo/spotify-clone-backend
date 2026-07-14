const ImageKit = require("@imagekit/nodejs");
const path = require("path");

if (
    !process.env.IMAGE_KIT_PUBLIC_KEY ||
    !process.env.IMAGE_KIT_PRIVATE_KEY ||
    !process.env.IMAGE_KIT_URL_ENDPOINT
) {
    throw new Error("ImageKit configuration missing");
}

const imagekitClient = new ImageKit({
    publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGE_KIT_URL_ENDPOINT
});

async function uploadFile(
    fileBuffer,
    fileName,
    folder = "ytmusic-clone"
) {

    if (!fileBuffer)
        throw new Error("Missing file");

    const safeName = path
        .basename(fileName)
        .replace(/[^a-zA-Z0-9._-]/g, "_");

    const result = await imagekitClient.files.upload({

        file: fileBuffer.toString("base64"),

        fileName: `${Date.now()}_${safeName}`,

        folder
    });

    return {

        fileId: result.fileId,

        filePath: result.filePath,

        url: result.url

    };

}

/*
    DO NOT expose ImageKit URLs.

    Backend will proxy every request.
*/
function getInternalFileUrl(filePath) {

    if (!filePath)
        throw new Error("Missing filePath");

    return `${process.env.IMAGE_KIT_URL_ENDPOINT}${filePath}`;

}

module.exports = {

    uploadFile,

    getInternalFileUrl,

    imagekitClient

};