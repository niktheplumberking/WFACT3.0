/**
 * Runs a build command with NO network and NO secrets (Step 4B M4: "the build runs with no secrets in the
 * build step and no network beyond the package cache"). The package cache is npm's local cache on disk,
 * read with `npm ci --offline`; nothing else is reachable.
 *
 *   - Secrets: the child gets an explicit, short environment (PATH, HOME, the npm cache path and a few
 *     build flags). Nothing from the parent's environment is inherited, so a parent started with
 *     `doppler run` (the Cockpit job runner) passes none of its keys to the build.
 *   - Network: macOS runs the command under sandbox-exec with every network operation denied; Linux runs
 *     it in a new network namespace (unshare), which has no interfaces but a downed loopback. If neither
 *     is available the build is refused; there is no unisolated fallback.
 *   - Proof: `probeIsolation()` runs in the same isolation before every build and checks that an outbound
 *     connection fails and that the environment holds only the allowed names. Its result is recorded with
 *     the build, so the claim is checked each time, not assumed.
 */
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export type IsolationMethod = "macos-sandbox-exec" | "linux-unshare" | "linux-sudo-unshare";

export class IsolationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IsolationUnavailableError";
  }
}

/** Deny every network operation except local unix sockets (process plumbing). */
const MACOS_PROFILE = "(version 1)(allow default)(deny network*)(allow network* (local unix-socket))(allow network* (remote unix-socket))";

/** The only environment names a build may see. Values are set by this module, never copied wholesale. */
export const ALLOWED_ENV = ["PATH", "HOME", "TMPDIR", "LANG", "CI", "NEXT_TELEMETRY_DISABLED", "npm_config_cache", "npm_config_update_notifier", "npm_config_fund", "npm_config_audit"] as const;

let npmCache: string | null = null;
async function npmCacheDir(): Promise<string> {
  if (!npmCache) npmCache = (await execFileP("npm", ["config", "get", "cache"], { env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } })).stdout.trim();
  return npmCache;
}

export async function buildEnv(): Promise<Record<string, string>> {
  return {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME ?? "/tmp",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    LANG: "C.UTF-8",
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    npm_config_cache: await npmCacheDir(),
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false",
  };
}

async function works(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execFileP(cmd, args, { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

let detected: IsolationMethod | null = null;

/** The strongest isolation this host offers, or an error naming what is missing. */
export async function detectIsolation(): Promise<IsolationMethod> {
  if (detected) return detected;
  if (process.platform === "darwin") {
    if (await works("sandbox-exec", ["-p", MACOS_PROFILE, "/usr/bin/true"])) return (detected = "macos-sandbox-exec");
    throw new IsolationUnavailableError("sandbox-exec is not usable on this Mac; the Track B build will not run without network isolation");
  }
  if (process.platform === "linux") {
    if (await works("unshare", ["--user", "--map-root-user", "--net", "true"])) return (detected = "linux-unshare");
    if (await works("sudo", ["-n", "unshare", "--net", "true"])) return (detected = "linux-sudo-unshare");
    throw new IsolationUnavailableError("neither unprivileged `unshare --user --net` nor passwordless `sudo unshare --net` works on this host; the Track B build will not run without network isolation");
  }
  throw new IsolationUnavailableError(`no network isolation is implemented for platform ${process.platform}`);
}

function wrap(method: IsolationMethod, cmd: string, args: string[], env: Record<string, string>): [string, string[]] {
  switch (method) {
    case "macos-sandbox-exec":
      return ["sandbox-exec", ["-p", MACOS_PROFILE, cmd, ...args]];
    case "linux-unshare":
      return ["unshare", ["--user", "--map-root-user", "--net", "--", cmd, ...args]];
    case "linux-sudo-unshare": {
      // Root only creates the namespace; the command itself runs as this user, with only `env`'s variables.
      const uid = String(process.getuid?.() ?? 1000);
      const gid = String(process.getgid?.() ?? 1000);
      const envArgs = Object.entries(env).map(([k, v]) => `${k}=${v}`);
      return ["sudo", ["-n", "unshare", "--net", "--", "setpriv", `--reuid=${uid}`, `--regid=${gid}`, "--clear-groups", "--", "env", "-i", ...envArgs, cmd, ...args]];
    }
  }
}

export interface IsolatedResult {
  code: number | null;
  output: string;
  durationMs: number;
  method: IsolationMethod;
}

/** Runs one command in isolation. Output is captured (last 200 KB) for the build record. */
export async function runIsolated(cmd: string, args: string[], opts: { cwd: string; timeoutMs?: number; method?: IsolationMethod }): Promise<IsolatedResult> {
  const method = opts.method ?? (await detectIsolation());
  const env = await buildEnv();
  const [bin, argv] = wrap(method, cmd, args, env);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, argv, { cwd: opts.cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const sink = (b: Buffer) => {
      output = (output + b.toString("utf8")).slice(-200_000);
    };
    child.stdout.on("data", sink);
    child.stderr.on("data", sink);
    const timer = setTimeout(() => {
      output += `\n[isolate] killed after ${opts.timeoutMs} ms`;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? 600_000);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, durationMs: Date.now() - started, method });
    });
  });
}

export interface IsolationProbe {
  method: IsolationMethod;
  /** "blocked" only when every outbound attempt failed. */
  network: "blocked" | "open";
  attempts: string[];
  /** Environment variable names the isolated process could see. */
  envNames: string[];
  /** Names present that are not in ALLOWED_ENV (must be empty). */
  unexpectedEnv: string[];
}

const PROBE = `
const targets = ["https://registry.npmjs.org/", "http://1.1.1.1/", "http://[2606:4700:4700::1111]/"];
Promise.allSettled(targets.map((t) => fetch(t, { signal: AbortSignal.timeout(4000) }))).then((r) => {
  console.log(JSON.stringify({
    attempts: r.map((x, i) => targets[i] + " " + (x.status === "fulfilled" ? "REACHED " + x.value.status : "failed " + (x.reason?.cause?.code ?? x.reason?.name ?? "error"))),
    reached: r.some((x) => x.status === "fulfilled"),
    env: Object.keys(process.env).sort(),
  }));
});`;

/** Checks, inside the isolation itself, that the network is unreachable and no extra variables leaked in. */
export async function probeIsolation(cwd: string, method?: IsolationMethod): Promise<IsolationProbe> {
  const r = await runIsolated(process.execPath, ["-e", PROBE], { cwd, timeoutMs: 30_000, method });
  const line = r.output.trim().split("\n").filter((l) => l.startsWith("{")).at(-1);
  if (r.code !== 0 || !line) throw new IsolationUnavailableError(`isolation probe did not run (exit ${r.code}): ${r.output.slice(-400)}`);
  const parsed = JSON.parse(line) as { attempts: string[]; reached: boolean; env: string[] };
  // Variables a shell or the platform sets on its own inside the sandbox are not secrets; anything else is reported.
  const platform = new Set(["PWD", "SHLVL", "_", "OLDPWD", "__CF_USER_TEXT_ENCODING"]);
  const allowed = new Set<string>(ALLOWED_ENV);
  return {
    method: r.method,
    network: parsed.reached ? "open" : "blocked",
    attempts: parsed.attempts,
    envNames: parsed.env,
    unexpectedEnv: parsed.env.filter((n) => !allowed.has(n) && !platform.has(n)),
  };
}
