/**
 * Example: one Seedance 2.5 text-to-video generation (billable). Run with credentials from Doppler:
 *   npm run example:seedance        (= doppler run -- tsx src/index.ts)
 * Prints the video URL on success; on any other outcome prints why and exits non-zero.
 */
import { configureFromEnv, generateSeedanceVideo, SeedanceError } from "./seedance.js";

try {
  configureFromEnv();
  const video = await generateSeedanceVideo({ prompt: "A cinematic scene at sunset", duration: 5, resolution: "720p", aspect_ratio: "16:9" });
  console.log(`completed: request ${video.requestId}`);
  console.log(`video URL: ${video.url}`);
} catch (err) {
  const detail = err instanceof SeedanceError ? `${err.message} (status: ${err.status})` : err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  console.error(`Seedance example did not succeed: ${detail}`);
  process.exitCode = 1;
}
