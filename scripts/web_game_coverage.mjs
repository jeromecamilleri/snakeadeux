import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    url: `file://${path.resolve("index.html")}`,
    actions: null,
    out: "output/coverage/summary.json",
    headless: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url" && next) {
      args.url = next;
      i++;
    } else if (arg === "--actions" && next) {
      args.actions = next.split(",").map((s) => s.trim()).filter(Boolean);
      i++;
    } else if (arg === "--out" && next) {
      args.out = next;
      i++;
    } else if (arg === "--headless" && next) {
      args.headless = next !== "0" && next !== "false";
      i++;
    }
  }

  if (!args.actions || args.actions.length === 0) {
    args.actions = fs.readdirSync(".")
      .filter((f) => /^actions_.*\.json$/.test(f))
      .sort();
  }

  if (args.actions.length === 0) {
    throw new Error("No action files found. Pass --actions file1.json,file2.json");
  }

  return args;
}

const buttonNameToKey = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  enter: "Enter",
  space: "Space",
  a: "KeyA",
  b: "KeyB",
  r: "KeyR",
};

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

function intervalsLength(intervals) {
  return intervals.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
}

async function advanceFrames(page, frames) {
  const ms = Math.max(0, Math.round((frames || 0) * (1000 / 60)));
  await page.evaluate(async (t) => {
    if (typeof window.advanceTime === "function") {
      await window.advanceTime(t);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, t));
  }, ms);
}

async function runStep(page, step) {
  const buttons = new Set(step.buttons || []);

  for (const button of buttons) {
    if (button === "left_mouse_button") {
      await page.mouse.down({ button: "left" });
      continue;
    }
    const key = buttonNameToKey[button];
    if (key) await page.keyboard.down(key);
  }

  if (Number.isFinite(step.mouse_x) && Number.isFinite(step.mouse_y)) {
    await page.mouse.move(step.mouse_x, step.mouse_y);
  }

  await advanceFrames(page, step.frames || 1);

  for (const button of buttons) {
    if (button === "left_mouse_button") {
      await page.mouse.up({ button: "left" });
      continue;
    }
    const key = buttonNameToKey[button];
    if (key) await page.keyboard.up(key);
  }
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function toPct(covered, total) {
  if (!total) return 0;
  return (covered / total) * 100;
}

function isTargetScript(scriptUrl, pageUrl) {
  if (!scriptUrl) return false;
  if (scriptUrl === pageUrl) return true;
  if (pageUrl.startsWith("file://") && scriptUrl.endsWith("/index.html")) return true;
  if (pageUrl.includes("index.html") && scriptUrl.includes("index.html")) return true;
  return false;
}

async function collectCoverageForScenario(browser, baseUrl, actionFile) {
  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);

  await client.send("Profiler.enable");
  await client.send("Profiler.startPreciseCoverage", {
    callCount: false,
    detailed: true,
    allowTriggeredUpdates: false,
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const canvas = await page.$("canvas");
  if (canvas) {
    await canvas.click();
  } else {
    await page.mouse.click(20, 20);
  }

  const payload = JSON.parse(fs.readFileSync(actionFile, "utf8"));
  for (const step of payload.steps || []) {
    await runStep(page, step);
  }

  const taken = await client.send("Profiler.takePreciseCoverage");
  await client.send("Profiler.stopPreciseCoverage");
  await client.send("Profiler.disable");

  await page.close();
  return taken.result || [];
}

function buildCoverageSummary(coverageEntries, pageUrl, actionFiles) {
  const scripts = new Map();

  for (const entry of coverageEntries) {
    if (!isTargetScript(entry.url, pageUrl)) continue;
    const key = entry.url;
    if (!scripts.has(key)) {
      scripts.set(key, { url: entry.url, all: [], covered: [] });
    }
    const acc = scripts.get(key);

    for (const fn of entry.functions || []) {
      for (const range of fn.ranges || []) {
        acc.all.push([range.startOffset, range.endOffset]);
        if (range.count > 0) {
          acc.covered.push([range.startOffset, range.endOffset]);
        }
      }
    }
  }

  const perScript = [];
  let totalAll = 0;
  let totalCovered = 0;

  for (const script of scripts.values()) {
    const allMerged = mergeIntervals(script.all);
    const coveredMerged = mergeIntervals(script.covered);
    const totalBytes = intervalsLength(allMerged);
    const coveredBytes = intervalsLength(coveredMerged);
    totalAll += totalBytes;
    totalCovered += coveredBytes;

    perScript.push({
      url: script.url,
      totalBytes,
      coveredBytes,
      coveragePct: Number(toPct(coveredBytes, totalBytes).toFixed(2)),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    actionFiles,
    overall: {
      totalBytes: totalAll,
      coveredBytes: totalCovered,
      coveragePct: Number(toPct(totalCovered, totalAll).toFixed(2)),
    },
    perScript,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const browser = await chromium.launch({ headless: args.headless });

  try {
    const allEntries = [];
    for (const actionFile of args.actions) {
      if (!fs.existsSync(actionFile)) {
        throw new Error(`Action file not found: ${actionFile}`);
      }
      const scenarioEntries = await collectCoverageForScenario(browser, args.url, actionFile);
      allEntries.push(...scenarioEntries);
    }

    const summary = buildCoverageSummary(allEntries, args.url, args.actions);
    ensureDirFor(args.out);
    fs.writeFileSync(args.out, JSON.stringify(summary, null, 2));

    console.log(`Coverage written to ${args.out}`);
    console.log(`Overall JS coverage: ${summary.overall.coveragePct}% (${summary.overall.coveredBytes}/${summary.overall.totalBytes} bytes)`);
    for (const script of summary.perScript) {
      console.log(`- ${script.url}: ${script.coveragePct}%`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
