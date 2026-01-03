// src/routes/cloudinary.ts
import { Router, type Request, type Response } from "express";
import cloudinary from "../config/cloudinary.js";

const uploadRoutes = Router();

uploadRoutes.get("/cloudinary-signature", (req: Request, res: Response) => {
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: "uploads" },
        process.env.CLOUDINARY_API_SECRET!
    );

    res.json({
        timestamp,
        signature,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
    });
});

export default uploadRoutes;