import { convertMlgToMsl } from "./mlg-converter.mjs";

self.addEventListener("message", (event) => {
  const { jobId } = event.data;
  try {
    const result = convertMlgToMsl(event.data.buffer);
    const encoded = new TextEncoder().encode(result.msl);
    self.postMessage(
      {
        jobId,
        output: encoded.buffer,
        stats: {
          recordCount: result.recordCount,
          channelCount: result.channelCount,
          badCrcCount: result.badCrcCount,
          counterGapCount: result.counterGapCount,
        },
      },
      [encoded.buffer],
    );
  } catch (error) {
    self.postMessage({
      jobId,
      error: error instanceof Error ? error.message : "The log could not be converted.",
    });
  }
});
