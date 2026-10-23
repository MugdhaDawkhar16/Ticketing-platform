
import dotenv from "dotenv";
import app from "./app.js";
import { connectRedis } from "./lib/redis.js";
import { connectKafka } from "./lib/kafka.js";
import { startPaymentConsumer } from "./workers/payment-consumer.js";
import { releaseExpiredHolds } from "./workers/hold-expiration.js";

dotenv.config();

const PORT = process.env.PORT || 3001;

Promise.all([
  connectRedis(),
  connectKafka(),
  startPaymentConsumer(),
])
  .then(() => {
    console.log("Infrastructure connected");

    app.listen(PORT, () => {
      console.log(`Event service running on port ${PORT}`);
    });

    setInterval(async () => {
      try {
        await releaseExpiredHolds();
      } catch (error) {
        console.error("Hold expiration worker error:", error);
      }
    }, 10_000);
  })
  .catch((error) => {
    console.error("Failed to connect to infrastructure:", error);
    process.exit(1);
  });
