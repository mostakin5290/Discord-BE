import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT ?? "";
const frontend_url = process.env.FRONTEND_BASE_URL ?? "";

app.use(cors({
    origin: [frontend_url,],
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({
        message: "All Good!"
    })
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
});