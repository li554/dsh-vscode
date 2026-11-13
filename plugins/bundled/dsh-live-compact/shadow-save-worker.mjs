import { parentPort, workerData } from "node:worker_threads";
import { attachShadowAccessFuse, saveShadowTransaction } from "./shadow.js";

const managed = workerData?.spineWorker === 1;
if (managed) attachShadowAccessFuse(workerData.accessFuse);

async function handle(id, payload) {
  try {
    const result = saveShadowTransaction(payload);
    parentPort.postMessage({ id, ok: true, result });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: {
      name: error?.name || "Error",
      message: error?.message || String(error),
      code: error?.code,
    } });
  }
}

let queue = Promise.resolve();
if (workerData && !managed) handle(0, workerData);
parentPort.on("message", ({ id, payload }) => {
  queue = queue.then(() => handle(id, payload));
});
