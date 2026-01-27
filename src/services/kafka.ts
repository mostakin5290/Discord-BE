import {
  Kafka,
  type Producer,
  type Consumer,
  type EachMessagePayload,
} from "kafkajs";
import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kafkaConfig: any = {
  clientId: "discord-clone",
  brokers: [env.KAFKA.BROKER],
};

// Add SSL configuration if enabled
if (env.KAFKA.SSL) {
  const projectRoot = path.resolve(__dirname, "../..");
  kafkaConfig.ssl = {
    rejectUnauthorized: true,
    ca: [fs.readFileSync(path.join(projectRoot, env.KAFKA.CA_CERT), "utf-8")],
    cert: fs.readFileSync(
      path.join(projectRoot, env.KAFKA.CLIENT_CERT),
      "utf-8",
    ),
    key: fs.readFileSync(path.join(projectRoot, env.KAFKA.CLIENT_KEY), "utf-8"),
  };
}

const kafka = new Kafka(kafkaConfig);

let producer: Producer | null = null;

// Create topic if not exists
export const ensureTopicExists = async (topicName: string) => {
  try {
    const admin = kafka.admin();
    await admin.connect();

    const topics = await admin.listTopics();
    if (!topics.includes(topicName)) {
      await admin.createTopics({
        topics: [
          {
            topic: topicName,
            numPartitions: 2,
            replicationFactor: 2,
          },
        ],
      });
      // console.log(`Kafka topic '${topicName}' created`);
    }

    await admin.disconnect();
  } catch (error) {
    console.error(`Error ensuring topic ${topicName}:`, error);
  }
};

export const connectProducer = async () => {
  if (producer) return producer;
  producer = kafka.producer();
  await producer.connect();
  console.log("Kafka Producer connected");
  return producer;
};

export const produceMessage = async (
  topic: string,
  key: string,
  message: any,
) => {
  if (!producer) {
    await connectProducer();
  }
  await producer?.send({
    topic,
    messages: [{ key, value: JSON.stringify(message) }],
  });
};

export const startConsumer = async (
  groupId: string,
  topic: string,
  handleMessage: (message: any) => Promise<void>,
) => {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      const value = message.value?.toString();
      if (value) {
        try {
          await handleMessage(JSON.parse(value));
        } catch (error) {
          console.error("Error processing Kafka message:", error);
        }
      }
    },
  });
  // console.log(`Kafka Consumer connected (Group: ${groupId}, Topic: ${topic})`);
};
