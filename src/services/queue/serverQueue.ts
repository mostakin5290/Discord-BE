// We will use this to queue server related operations
import { pineconeIndex } from "../../config/pinecone.js";
import { createEmbedding } from "../../utils/embedding.js";
import { startConsumer, ensureTopicExists } from "../messaging/kafka.js";

export interface ServerIndexContent {
    serverId: string;
    content: {
        name: string;
        bio: string;
        searchContent: string;
    };
}

const handleServerIndex = async (message: ServerIndexContent) => {
    const { content, serverId } = message;

    const serverEmbeddings = await createEmbedding(content.searchContent);

    // Create server - vector in Pinecone
    await pineconeIndex.upsert([
        {
            id: serverId,
            values: serverEmbeddings,
            metadata: {
                serverName: content.name || '',
                serverBio: content.bio || '',
            }
        },
    ]);
};

export const initServerQueueConsumers = async () => {
    // Ensure topic exists before starting consumers
    await ensureTopicExists("server-index");

    await startConsumer("server-writer-group", "server-index", handleServerIndex);
};