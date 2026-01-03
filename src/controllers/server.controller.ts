import type { Request, Response } from "express";
import client from "../config/db.js";
import { CreateServerSchema } from "../types/index.js";

export const createServer = async (req: Request, res: Response) => {
    try {
        const { success, data } = CreateServerSchema.safeParse(req.body);

        if (!success) {
            res.status(400).json({
                success: false,
                message: "Invalid data",
            });
        }

        // TODO: Create vectors and upload it to the vector db!

        const server = await client.server.create({
            data: {
                name: data?.name ?? "",
                imageUrl: data?.imageUrl ?? "",
                bio: data?.bio ?? "",
                userId: "",
                members: {
                    create: {
                        role: "ADMIN",
                        userId: ""
                    }
                },
                channels: {
                    create: {
                        name: "general",
                        type: "TEXT",
                        userId: ""
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: "Server created successfully",
            server: server
        })
    } catch (e) {
        console.log(e);
        res.status(500).json({
            success: false,
            message: "failed to create server",
        })
    }
};