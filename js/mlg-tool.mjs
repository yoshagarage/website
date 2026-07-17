import { getMslFilename } from "./mlg-converter.mjs";

const fileInput = document.getElementById("mlgFile");
const dropZone = document.getElementById("dropZone");
const statusPanel = document.getElementById("conversionStatus");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusStats = document.getElementById("statusStats");
const downloadLink = document.getElementById("downloadLink");
const resetButton = document.getElementById("resetConverter");
const chooseFileButton = document.getElementById("chooseMlgFile");
const worker = new Worker(new URL("./mlg-worker.mjs", import.meta.url), { type: "module" });

let activeFilename = "converted.msl";
let downloadUrl = "";
let activeJobId = 0;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeDownload() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = "";
  }
}

function setState(state, title, message) {
  statusPanel.dataset.state = state;
  statusPanel.hidden = false;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  statusStats.replaceChildren();
  downloadLink.hidden = true;
  resetButton.hidden = state === "working";
  dropZone.setAttribute("aria-busy", state === "working" ? "true" : "false");
}

function addStat(label, value) {
  const item = document.createElement("div");
  const number = document.createElement("strong");
  const caption = document.createElement("span");
  number.textContent = value;
  caption.textContent = label;
  item.append(number, caption);
  statusStats.appendChild(item);
}

async function convertFile(file) {
  if (!file) return;
  if (!/\.mlg$/i.test(file.name)) {
    setState("error", "That doesn’t look like an MLG log", "Choose a TunerStudio .mlg file and try again.");
    return;
  }

  revokeDownload();
  activeJobId += 1;
  const jobId = activeJobId;
  activeFilename = getMslFilename(file.name);
  setState("working", "Converting locally…", `${file.name} · ${formatBytes(file.size)}`);
  try {
    const buffer = await file.arrayBuffer();
    worker.postMessage({ buffer, jobId }, [buffer]);
  } catch (error) {
    setState("error", "The file could not be read", error instanceof Error ? error.message : "Try choosing the log again.");
  }
}

worker.addEventListener("message", (event) => {
  if (event.data.jobId !== activeJobId) return;
  if (event.data.error) {
    setState("error", "Conversion failed", event.data.error);
    return;
  }

  const { output, stats } = event.data;
  const blob = new Blob([output], { type: "text/tab-separated-values;charset=utf-8" });
  downloadUrl = URL.createObjectURL(blob);
  setState("success", "Your MSL is ready", "Download the converted log below.");
  addStat("records", stats.recordCount.toLocaleString("en-AU"));
  addStat("channels", stats.channelCount.toLocaleString("en-AU"));
  addStat("output", formatBytes(blob.size));

  const warnings = [];
  if (stats.badCrcCount) warnings.push(`${stats.badCrcCount} checksum failure${stats.badCrcCount === 1 ? "" : "s"}`);
  if (stats.counterGapCount) warnings.push(`${stats.counterGapCount} record gap${stats.counterGapCount === 1 ? "" : "s"}`);
  if (warnings.length) {
    statusMessage.textContent += ` Warning: ${warnings.join("; ")}.`;
  }

  downloadLink.href = downloadUrl;
  downloadLink.download = activeFilename;
  downloadLink.textContent = `DOWNLOAD ${activeFilename.toUpperCase()}`;
  downloadLink.hidden = false;
  resetButton.hidden = false;
  downloadLink.focus();
});

worker.addEventListener("error", () => {
  setState("error", "The converter stopped unexpectedly", "Reload the page and try the log again.");
});

fileInput.addEventListener("change", () => convertFile(fileInput.files[0]));

chooseFileButton.addEventListener("click", () => fileInput.click());

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => convertFile(event.dataTransfer.files[0]));

resetButton.addEventListener("click", () => {
  activeJobId += 1;
  revokeDownload();
  fileInput.value = "";
  statusPanel.hidden = true;
  dropZone.setAttribute("aria-busy", "false");
  chooseFileButton.focus();
});

window.addEventListener("pagehide", () => {
  revokeDownload();
  worker.terminate();
});
