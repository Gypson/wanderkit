import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MOBILE_WEB_URL = process.env.MOBILE_WEB_URL ?? "http://localhost:8085";
const HEADLESS = process.env.WK_SMOKE_HEADLESS !== "0";
const TEXT_WAIT_TIMEOUT_MS = 45_000;
const SERVER_WAIT_TIMEOUT_MS = 180_000;

let expoProcess = null;
let browserProcess = null;
let browserUserDataDir = null;
let browserOutput = "";
let lastBrowserProbeError = "";

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

async function main() {
  console.log("Running Supabase smoke check.");
  runExecutable(process.execPath, ["scripts/supabase-smoke.mjs"]);

  const startedExpo = await ensureMobileWebServer();
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage("about:blank");
    await page.enable();

    await page.navigate(`${MOBILE_WEB_URL}/`);
    await page.evaluate("localStorage.clear(); true");
    await page.navigate(`${MOBILE_WEB_URL}/`);
    await waitForText(page, [
      "Enter tour code",
      "OFFLINE CACHE",
      "TOURS",
      "0",
      "AUDIO",
      "0 files"
    ]);
    console.log("Entry screen renders with empty offline cache.");

    await page.navigate(`${MOBILE_WEB_URL}/tour/OLDTOWN`);
    await waitForText(page, ["Old Town Loop", "Route preview"]);
    await assertText(page, [
      "0 of 3 stops played",
      "Streaming only",
      "Download unavailable",
      "3 route points - 3 stops",
      "Market Square",
      "Johnson Street",
      "Harbor Edge"
    ]);
    console.log("OLDTOWN route renders published manifest content.");

    await page.navigate(
      `${MOBILE_WEB_URL}/tour/OLDTOWN/stop/00000000-0000-0000-0000-000000000401`
    );
    await waitForText(page, ["Market Square", "Audio"]);
    await assertText(page, [
      "LATITUDE",
      "48.42840",
      "LONGITUDE",
      "-123.36560",
      "Not played yet",
      "0 of 3 stops played",
      "About this stop"
    ]);
    await clickByText(page, "Play");
    await waitForText(page, [
      "Streaming audio",
      "Stop played",
      "1 of 3 stops played"
    ]);
    console.log("Stop detail renders audio controls and stop metadata.");

    await page.navigate(`${MOBILE_WEB_URL}/`);
    await waitForText(page, ["CONTINUE", "Continue stop"]);
    await assertText(page, [
      "Stop 1: Market Square",
      "Old Town Loop",
      "1 played",
      "1/3 played"
    ]);
    await clickByText(page, "Continue stop");
    await waitForText(page, ["Market Square", "Audio"]);
    console.log("Entry screen resumes the last opened stop.");

    await page.navigate(`${MOBILE_WEB_URL}/tour/OLDTOWN/stop/missing-stop`);
    await waitForText(page, ["Stop not found", "Open route"]);
    await clickByText(page, "Open route");
    await waitForText(page, [
      "Old Town Loop",
      "Route preview",
      "1 of 3 stops played",
      "Streaming only",
      "Download unavailable",
      "Played"
    ]);
    console.log("Bad stop deep links offer a route fallback.");

    await page.navigate(
      `${MOBILE_WEB_URL}/tour/OLDTOWN/stop/00000000-0000-0000-0000-000000000402`
    );
    await waitForText(page, ["Johnson Street", "Not played yet"]);
    await clickByText(page, "Play");
    await waitForText(page, ["Stop played", "2 of 3 stops played"]);

    await page.navigate(
      `${MOBILE_WEB_URL}/tour/OLDTOWN/stop/00000000-0000-0000-0000-000000000403`
    );
    await waitForText(page, ["Harbor Edge", "Not played yet"]);
    await clickByText(page, "Play");
    await waitForText(page, ["Tour complete", "3 of 3 stops played"]);
    console.log("Played-stop progress reaches tour completion.");

    await page.navigate(`${MOBILE_WEB_URL}/tour/OLDTOWN`);
    await waitForText(page, ["Tour complete", "Reset progress"]);
    await clickByText(page, "Reset progress");
    await waitForText(page, ["0 of 3 stops played", "NOT PLAYED"]);
    console.log("Tour progress can be reset for the current tour.");

    await page.navigate(`${MOBILE_WEB_URL}/tour/BADJSON`);
    await waitForText(page, ["Manifest is invalid"]);
    await assertText(page, [
      "publishId: Required",
      "description: Required",
      "Retry lookup"
    ]);
    console.log("BADJSON renders invalid-manifest state.");

    await page.navigate(`${MOBILE_WEB_URL}/tour/NOPE`);
    await waitForText(page, ["Tour not found", "No published tour exists"]);
    await assertText(page, ["Retry lookup"]);
    console.log("Unknown code renders not-found state.");

    await page.navigate(`${MOBILE_WEB_URL}/`);
    await waitForText(page, ["Old Town Loop", "TOURS"]);
    await assertText(page, [
      "CONTINUE",
      "Continue route",
      "Route map",
      "Victoria - 3 stops",
      "0/3 played",
      "Published",
      "Hash",
      "Open",
      "OLDTOWN"
    ]);
    await clickByText(page, "Clear offline data");
    await waitForText(page, ["Cleared 1 saved tour", "TOURS"]);
    await assertText(page, ["Loaded tours and played audio will appear here."]);
    console.log("Offline manifest cache saves and clears.");

    const logs = await page.logs(["error"]);
    if (logs.length > 0) {
      throw new Error(
        `Browser console had errors:\n${logs
          .map((entry) => `${entry.level}: ${entry.message}`)
          .join("\n")}`
      );
    }

    console.log("Mobile smoke test passed.");
  } finally {
    await browser.close();
    if (startedExpo) {
      stopExpo();
    }
  }
}

async function ensureMobileWebServer() {
  if (await isHttpOk(MOBILE_WEB_URL)) {
    console.log(`Using existing mobile web server at ${MOBILE_WEB_URL}.`);
    return false;
  }

  console.log("Starting mobile web server.");
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  expoProcess = spawn(command, ["dev:mobile:web"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  expoProcess.stdout.on("data", (chunk) => {
    process.stdout.write(prefixLines(chunk, "expo"));
  });
  expoProcess.stderr.on("data", (chunk) => {
    process.stderr.write(prefixLines(chunk, "expo"));
  });

  const deadline = Date.now() + SERVER_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isHttpOk(MOBILE_WEB_URL)) {
      console.log(`Mobile web server is ready at ${MOBILE_WEB_URL}.`);
      return true;
    }

    if (expoProcess.exitCode !== null) {
      throw new Error(`Mobile web server exited with code ${expoProcess.exitCode}.`);
    }

    await delay(1000);
  }

  throw new Error(`Mobile web server did not start at ${MOBILE_WEB_URL}.`);
}

async function launchBrowser() {
  const executablePath = findBrowserExecutable();
  const debuggingPort = await chooseBrowserDebugPort();
  browserUserDataDir = mkdtempSync(join(tmpdir(), "wanderkit-mobile-smoke-"));
  const args = [
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${browserUserDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=390,844"
  ];

  if (HEADLESS) {
    args.push("--headless=new");
  }

  args.push("about:blank");

  browserOutput = "";
  browserProcess = spawn(executablePath, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });
  browserProcess.stdout.on("data", (chunk) => {
    browserOutput += String(chunk);
  });
  browserProcess.stderr.on("data", (chunk) => {
    browserOutput += String(chunk);
  });

  const browserUrl = `http://127.0.0.1:${debuggingPort}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await requestJson(`${browserUrl}/json/version`);
      {
        return new BrowserController(browserUrl);
      }
    } catch (error) {
      lastBrowserProbeError =
        error instanceof Error ? error.message : "Unknown browser probe error.";
      // Browser is still booting.
    }
    await delay(250);
  }

  throw new Error(
    `Browser did not expose a debugging endpoint. executable=${executablePath} port=${debuggingPort} exited=${browserProcess?.exitCode ?? "no"} probe=${lastBrowserProbeError} output=${browserOutput.slice(-1200)}`
  );
}

function findBrowserExecutable() {
  const candidates = [
    process.env.WK_SMOKE_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge"
  ].filter(Boolean);

  const executablePath = candidates.find((candidate) => existsSync(candidate));

  if (!executablePath) {
    throw new Error(
      "Could not find Chrome or Edge. Set WK_SMOKE_BROWSER_PATH to a Chromium-compatible browser executable."
    );
  }

  return executablePath;
}

class BrowserController {
  constructor(browserUrl) {
    this.browserUrl = browserUrl;
  }

  async newPage(url) {
    const target = await requestJson(
      `${this.browserUrl}/json/new?${encodeURIComponent(url)}`,
      { method: "PUT" }
    );
    return PageController.connect(target.webSocketDebuggerUrl);
  }

  async close() {
    if (browserProcess && !browserProcess.killed) {
      browserProcess.kill();
    }
    browserProcess = null;
  }
}

class PageController {
  static async connect(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    const controller = new PageController(socket);
    await controller.opened;
    return controller;
  }

  constructor(socket) {
    this.id = 1;
    this.logsBuffer = [];
    this.pending = new Map();
    this.socket = socket;
    this.opened = new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });
  }

  async enable() {
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    await this.send("Log.enable");
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitForLoad();
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.text ??
          result.exceptionDetails.exception?.description ??
          "Browser evaluation failed."
      );
    }

    return result.result?.value;
  }

  async bodyText() {
    return this.evaluate("document.body ? document.body.innerText : ''");
  }

  async logs(levels) {
    return this.logsBuffer.filter((entry) => levels.includes(entry.level));
  }

  async close() {
    this.socket.close();
  }

  async waitForLoad() {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  send(method, params = {}) {
    const id = this.id;
    this.id += 1;

    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });

    this.socket.send(JSON.stringify({ id, method, params }));

    return promise;
  }

  handleMessage(rawMessage) {
    const message = JSON.parse(String(rawMessage));

    if (message.id && this.pending.has(message.id)) {
      const { reject, resolve } = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }

    if (message.method === "Runtime.consoleAPICalled") {
      this.logsBuffer.push({
        level: message.params.type,
        message: message.params.args
          .map((arg) => arg.value ?? arg.description ?? "")
          .join(" ")
      });
    }

    if (message.method === "Log.entryAdded") {
      this.logsBuffer.push({
        level: message.params.entry.level,
        message: message.params.entry.text
      });
    }
  }
}

async function waitForText(page, expectedTexts) {
  const deadline = Date.now() + TEXT_WAIT_TIMEOUT_MS;
  let latestText = "";

  while (Date.now() < deadline) {
    latestText = await page.bodyText();
    if (expectedTexts.every((text) => latestText.includes(text))) {
      return latestText;
    }
    await delay(500);
  }

  throw new Error(
    `Timed out waiting for text: ${expectedTexts.join(", ")}\nLatest page text:\n${latestText}`
  );
}

async function assertText(page, expectedTexts) {
  const text = await page.bodyText();
  const missing = expectedTexts.filter((expected) => !text.includes(expected));

  if (missing.length > 0) {
    throw new Error(
      `Missing expected text: ${missing.join(", ")}\nCurrent page text:\n${text}`
    );
  }
}

async function clickByText(page, text) {
  const clicked = await page.evaluate(`
    (() => {
      const targetText = ${JSON.stringify(text)};
      const elements = Array.from(document.querySelectorAll("*"));
      const candidates = elements.filter((element) => {
        const renderedText = (element.innerText || element.textContent || "").trim();
        return renderedText === targetText;
      });
      const target =
        candidates.find((element) =>
          !Array.from(element.children).some((child) => {
            const childText = (child.innerText || child.textContent || "").trim();
            return childText === targetText;
          })
        ) ?? candidates[0];

      if (!target) {
        return false;
      }

      target.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      return true;
    })()
  `);

  if (!clicked) {
    throw new Error(`Could not click text: ${text}`);
  }
}

async function isHttpOk(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function chooseBrowserDebugPort() {
  const preferredPort = Number(process.env.WK_SMOKE_DEBUG_PORT ?? 9_344);

  for (let port = preferredPort; port <= preferredPort + 50; port += 1) {
    if (!(await isBrowserDebugEndpointOk(port))) {
      return port;
    }
  }

  throw new Error("Could not find an available browser debugging port.");
}

async function isBrowserDebugEndpointOk(port) {
  try {
    await requestJson(`http://127.0.0.1:${port}/json/version`, {
      timeoutMs: 500
    });
    return true;
  } catch {
    return false;
  }
}

async function requestJson(urlString, options = {}) {
  const url = new URL(urlString);
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: url.hostname,
        method,
        path: `${url.pathname}${url.search}`,
        port: url.port,
        timeout: timeoutMs
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");

          if (!response.statusCode || response.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${response.statusCode ?? "unknown"} from ${urlString}: ${body}`
              )
            );
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out requesting ${urlString}`));
    });
    request.end();
  });
}

function runExecutable(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

function prefixLines(chunk, prefix) {
  return String(chunk)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `[${prefix}] ${line}\n`)
    .join("");
}

function stopExpo() {
  if (expoProcess && !expoProcess.killed) {
    expoProcess.kill();
  }
  expoProcess = null;
}

function cleanup() {
  stopExpo();

  if (browserProcess && !browserProcess.killed) {
    browserProcess.kill();
  }
  browserProcess = null;

  if (browserUserDataDir) {
    try {
      rmSync(browserUserDataDir, { force: true, recursive: true });
    } catch {
      // Temporary browser profiles are best-effort cleanup.
    }
    browserUserDataDir = null;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

await main();
