import { z } from "zod";

export const SendMessageSchema = z
  .object({
    content: z.string().optional(),
    fileUrl: z.string().url().optional(),
    fileType: z.string().optional(),
  })
  .refine((data) => data.content || data.fileUrl, {
    message: "Either content or file is required",
  });

export const UpdateMessageSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
});

export const AddReactionSchema = z.object({
  emoji: z.string().min(1, "Emoji is required"),
});

export const GetMessagesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  cursor: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>;
export type AddReactionInput = z.infer<typeof AddReactionSchema>;
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
