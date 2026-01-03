import { z } from "zod/v4";

export const CreateServerSchema = z.object({
    name: z.string("Not a valid string").min(2).max(50),
    imageUrl: z.string("Not a valid string"),
    bio: z.string("Not a valid string").min(2).max(500),
})