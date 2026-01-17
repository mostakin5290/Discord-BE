import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env.js";

const { API_KEY, INDEX_NAME } = env.PINECONE;

if (!API_KEY || !INDEX_NAME) {
  throw new Error(
    "Pinecone configuration requires PINECONE_API_KEY and PINECONE_INDEX_NAME to be set"
  );
}

export const pinecone = new Pinecone({
  apiKey: API_KEY,
});
export const pineconeIndex = pinecone.index(INDEX_NAME);
