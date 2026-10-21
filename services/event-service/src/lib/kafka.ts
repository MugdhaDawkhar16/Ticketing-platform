import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

export const kafka = new Kafka({
  clientId: "event-service",
  brokers,
});

export const producer = kafka.producer();

export async function connectKafka() {
  await producer.connect();
  console.log("Kafka connected");
}

export async function publishEvent(
  topic: string,
  event: object
) {
  await producer.send({
    topic,
    messages: [
      {
        value: JSON.stringify(event),
      },
    ],
  });
}