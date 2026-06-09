
const  ImageKit  = require("@imagekit/nodejs");
const imagekitClient = new ImageKit({
    publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGE_KIT_URL_ENDPOINT
});

async function uploadFile(fileBuffer, fileName) {
    const result = await imagekitClient.files.upload({
        file: Buffer.from(fileBuffer), // Convert buffer to base64 string
        fileName: "music_" + Date.now() + "_" + fileName,   
        folder: "ytmusic-clone/music"
    });

    return result;
}

module.exports = { uploadFile };