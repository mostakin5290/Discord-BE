import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "discord-clone" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result?.secure_url || "");
      }
    );
    uploadStream.end(buffer);
  });
};
