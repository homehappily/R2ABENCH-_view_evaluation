const dimensionsFallback = [
  { id: "completeness", label: "Completeness", description: "Covers requirements, ASRs, and quality scenarios." },
  { id: "faithfulness", label: "Faithfulness", description: "Avoids hallucinated architecture claims." },
  { id: "architectural_rationality", label: "Architectural Rationality", description: "Checks responsibilities, dependencies, boundaries, and quality-attribute handling." },
  { id: "traceability", label: "Traceability", description: "Checks links to requirements or evidence." },
  { id: "readability", label: "Readability", description: "Checks whether the diagram is reviewable." },
];

const demoData = {
  schema_version: "ma4sa-review-samples-v2",
  generated_at: new Date().toISOString(),
  sampling: { strategy: "demo", actual_n: 1 },
  dimensions: dimensionsFallback,
  samples: [
    {
      sample_id: "demo-sample",
      candidate_id: "direct/gpt-5",
      dataset_id: "DEMO",
      workflow: "direct",
      model_id: "gpt-5",
      title: "demo-sample / direct/gpt-5",
      ground_truth_image: "",
      candidate_image: "",
      project_context: {
        introduction: "This demo sample represents a requirements-to-architecture review target.",
        functional_requirements: "FR-001 The system shall present architecture candidates for human review.\nFR-002 The system shall export completed review records for later comparison.",
        asr: "NFR-001 Traceability: architecture elements should be linked to requirements evidence.\nC-001 Static review frontend: the annotation workflow runs without a backend.",
      },
      pred_source: "@startuml\ncomponent Web\ncomponent API\nWeb --> API\n@enduml",
      gt_source: "@startuml\ncomponent Client\ncomponent Service\nClient --> Service\n@enduml",
      metrics: {
        l0_valid: "True",
        l1_node_f1: "0.72",
        l1_edge_f1: "0.61",
        l2_status: "completed",
      },
      model_scores: {
        completeness: { score: "3", reasoning: "The candidate covers the main services but misses one ASR-related data flow." },
        faithfulness: { score: "4", reasoning: "Most elements are supported, with one inferred cache that needs evidence." },
        architectural_rationality: { score: "3", reasoning: "The topology is plausible, but quality-attribute handling is under-specified." },
        traceability: { score: "2", reasoning: "Several key edges do not cite requirement evidence." },
        readability: { score: "4", reasoning: "The diagram is grouped clearly and labels are readable." },
      },
      raw_result: { sample_id: "demo-sample", candidate_id: "direct/gpt-5" },
    },
  ],
};

const els = {
  reviewerInput: document.querySelector("#reviewerInput"),
  sessionInput: document.querySelector("#sessionInput"),
  autosaveText: document.querySelector("#autosaveText"),
  sampleUpload: document.querySelector("#sampleUpload"),
  reviewUpload: document.querySelector("#reviewUpload"),
  searchInput: document.querySelector("#searchInput"),
  datasetFilter: document.querySelector("#datasetFilter"),
  candidateFilter: document.querySelector("#candidateFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  queueStats: document.querySelector("#queueStats"),
  progressStats: document.querySelector("#progressStats"),
  progressBar: document.querySelector("#progressBar"),
  sampleList: document.querySelector("#sampleList"),
  exportCsv: document.querySelector("#exportCsv"),
  exportJson: document.querySelector("#exportJson"),
  clearLocal: document.querySelector("#clearLocal"),
  sampleCounter: document.querySelector("#sampleCounter"),
  sampleTitle: document.querySelector("#sampleTitle"),
  sampleMeta: document.querySelector("#sampleMeta"),
  candidateTabs: document.querySelector("#candidateTabs"),
  referenceSubtitle: document.querySelector("#referenceSubtitle"),
  candidateTitle: document.querySelector("#candidateTitle"),
  candidateSubtitle: document.querySelector("#candidateSubtitle"),
  referenceFrame: document.querySelector("#referenceFrame"),
  candidateFrame: document.querySelector("#candidateFrame"),
  introductionText: document.querySelector("#introductionText"),
  asrText: document.querySelector("#asrText"),
  prevCandidate: document.querySelector("#prevCandidate"),
  nextCandidate: document.querySelector("#nextCandidate"),
  overallStatus: document.querySelector("#overallStatus"),
  reviewSummary: document.querySelector("#reviewSummary"),
  reviewForm: document.querySelector("#reviewForm"),
  overallNote: document.querySelector("#overallNote"),
  imageDialog: document.querySelector("#imageDialog"),
  imageDialogTitle: document.querySelector("#imageDialogTitle"),
  imageDialogImg: document.querySelector("#imageDialogImg"),
  closeImageDialog: document.querySelector("#closeImageDialog"),
  zoomOutImage: document.querySelector("#zoomOutImage"),
  resetImageZoom: document.querySelector("#resetImageZoom"),
  zoomInImage: document.querySelector("#zoomInImage"),
};

const query = new URLSearchParams(window.location.search);
const requestedView = query.get("view");
let data = demoData;
let grouped = new Map();
let sampleKeys = [];
let filteredSampleKeys = [];
let currentSampleKey = "";
let currentCandidateIndex = 0;
let currentView = ["images", "source"].includes(requestedView) ? requestedView : "images";
let reviewerId = query.get("reviewer") || localStorage.getItem("ma4sa-evalstudio-reviewer") || "";
let sessionId = query.get("session") || localStorage.getItem("ma4sa-evalstudio-session") || defaultSessionId();
let reviews = {};
let activeStoreKey = "";
let imageZoom = 1;
let filters = {
  search: "",
  dataset: "all",
  candidate: "all",
  status: "all",
};

init();

async function init() {
  wireEvents();
  els.reviewerInput.value = reviewerId;
  els.sessionInput.value = sessionId;
  await loadInitialSamples();
  normalizeData();
  loadActiveReviews();
  render();
}

async function loadInitialSamples() {
  const source = query.get("samples") || "./samples.json";
  try {
    const response = await fetch(source, { cache: "no-store" });
    if (response.ok) {
      data = await response.json();
      return;
    }
  } catch {
    data = demoData;
  }
}

function wireEvents() {
  els.sampleUpload.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    data = JSON.parse(await file.text());
    normalizeData();
    loadActiveReviews();
    render();
    flashAutosave(`Loaded ${data.samples?.length || 0} candidates`);
  });

  els.reviewUpload.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const payload = JSON.parse(await file.text());
    const imported = mergeImportedReviews(payload);
    saveReviews();
    render();
    flashAutosave(`Imported ${imported} review records`);
  });

  els.reviewerInput.addEventListener("change", () => {
    reviewerId = cleanId(els.reviewerInput.value) || "anonymous";
    els.reviewerInput.value = reviewerId;
    localStorage.setItem("ma4sa-evalstudio-reviewer", reviewerId);
    loadActiveReviews();
    render();
  });

  els.sessionInput.addEventListener("change", () => {
    sessionId = cleanId(els.sessionInput.value) || defaultSessionId();
    els.sessionInput.value = sessionId;
    localStorage.setItem("ma4sa-evalstudio-session", sessionId);
    loadActiveReviews();
    render();
  });

  els.searchInput.addEventListener("input", (event) => {
    filters.search = event.target.value.trim().toLowerCase();
    applyFilters();
    renderSampleList();
    renderProgress();
  });

  els.datasetFilter.addEventListener("change", (event) => {
    filters.dataset = event.target.value;
    applyFilters();
    renderSampleList();
    renderProgress();
  });

  els.candidateFilter.addEventListener("change", (event) => {
    filters.candidate = event.target.value;
    applyFilters();
    renderSampleList();
    renderProgress();
  });

  els.statusFilter.addEventListener("change", (event) => {
    filters.status = event.target.value;
    applyFilters();
    renderSampleList();
    renderProgress();
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      renderViewButtons();
      renderCurrentSample();
    });
  });

  els.prevCandidate.addEventListener("click", () => moveCandidate(-1));
  els.nextCandidate.addEventListener("click", () => moveCandidate(1));
  els.overallStatus.addEventListener("change", () => updateCurrentReview({ status: els.overallStatus.value }));
  els.overallNote.addEventListener("input", () => updateCurrentReview({ overall_note: els.overallNote.value }, false));
  els.exportJson.addEventListener("click", exportJson);
  els.exportCsv.addEventListener("click", exportCsv);
  els.clearLocal.addEventListener("click", clearLocalReviews);
  els.closeImageDialog.addEventListener("click", closeImageViewer);
  els.zoomOutImage.addEventListener("click", () => setImageZoom(imageZoom - 0.25));
  els.resetImageZoom.addEventListener("click", () => setImageZoom(1));
  els.zoomInImage.addEventListener("click", () => setImageZoom(imageZoom + 0.25));
  els.imageDialog.addEventListener("click", (event) => {
    if (event.target === els.imageDialog) closeImageViewer();
  });
}

function normalizeData() {
  data.dimensions = data.dimensions && data.dimensions.length ? data.dimensions : dimensionsFallback;
  data.samples = data.samples || [];
  assignCandidateLabels();
  grouped = new Map();

  for (const sample of data.samples) {
    const key = sample.sample_id || sample.title || "sample";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(sample);
  }

  for (const candidates of grouped.values()) {
    candidates.sort((a, b) => candidateLabel(a).localeCompare(candidateLabel(b), undefined, { numeric: true }));
  }

  sampleKeys = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  currentSampleKey = sampleKeys[0] || "";
  currentCandidateIndex = 0;
  populateFilters();
  applyFilters();
}

function assignCandidateLabels() {
  const width = Math.max(3, String(data.samples.length || 1).length);
  data.samples.forEach((sample, index) => {
    sample.review_label = `Candidate ${String(index + 1).padStart(width, "0")}`;
  });
}

function populateFilters() {
  fillSelect(els.datasetFilter, "All datasets", uniqueValues(data.samples.map((sample) => sample.dataset_id || "Unspecified")));
  fillSelect(els.candidateFilter, "All candidate numbers", uniqueValues(data.samples.map((sample) => candidateLabel(sample))));
  els.datasetFilter.value = filters.dataset;
  els.candidateFilter.value = filters.candidate;
}

function fillSelect(select, label, values) {
  select.innerHTML = `<option value="all">${label}</option>`;
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function applyFilters() {
  filteredSampleKeys = sampleKeys.filter((key) => {
    const candidates = grouped.get(key) || [];
    return candidates.some((sample) => candidateMatchesFilters(sample, key));
  });
  if (!filteredSampleKeys.includes(currentSampleKey)) {
    currentSampleKey = filteredSampleKeys[0] || sampleKeys[0] || "";
    currentCandidateIndex = 0;
  }
}

function candidateMatchesFilters(sample, key) {
  const haystack = [
    key,
    sample.sample_id,
    sample.dataset_id,
    candidateLabel(sample),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (filters.search && !haystack.includes(filters.search)) return false;
  if (filters.dataset !== "all" && (sample.dataset_id || "Unspecified") !== filters.dataset) return false;
  if (filters.candidate !== "all" && candidateLabel(sample) !== filters.candidate) return false;
  if (filters.status !== "all" && reviewStatus(sample) !== filters.status) return false;
  return true;
}

function render() {
  renderViewButtons();
  renderProgress();
  renderSampleList();
  renderCandidateTabs();
  renderCurrentSample();
}

function renderViewButtons() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });
}

function renderProgress() {
  const candidates = data.samples || [];
  const visibleCandidates = candidates.filter((sample) => candidateMatchesFilters(sample, sample.sample_id || ""));
  const complete = candidates.filter((sample) => reviewStatus(sample) === "complete").length;
  const percent = candidates.length ? Math.round((complete / candidates.length) * 100) : 0;
  els.queueStats.textContent = `${visibleCandidates.length} shown / ${candidates.length} total`;
  els.progressStats.textContent = `${complete}/${candidates.length} complete`;
  els.progressBar.style.width = `${percent}%`;
}

function renderSampleList() {
  els.sampleList.innerHTML = "";
  if (!filteredSampleKeys.length) {
    const empty = document.createElement("div");
    empty.className = "list-empty";
    empty.textContent = "No samples match the current filters.";
    els.sampleList.appendChild(empty);
    return;
  }

  for (const key of filteredSampleKeys) {
    const candidates = grouped.get(key) || [];
    const statusCounts = countStatuses(candidates);
    const button = document.createElement("button");
    button.className = `sample-item ${key === currentSampleKey ? "active" : ""}`;
    button.type = "button";
    button.title = key;
    button.innerHTML = `
      <span class="sample-item-title">${escapeHtml(key)}</span>
      <span class="sample-item-meta">${candidates.length} variants | ${statusCounts.complete} done</span>
    `;
    button.addEventListener("click", () => {
      currentSampleKey = key;
      currentCandidateIndex = firstVisibleCandidateIndex(key);
      render();
    });
    els.sampleList.appendChild(button);
  }
}

function renderCandidateTabs() {
  els.candidateTabs.innerHTML = "";
  const candidates = currentCandidates();
  candidates.forEach((sample, index) => {
    const status = reviewStatus(sample);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `candidate-tab ${index === currentCandidateIndex ? "active" : ""} ${status}`;
    button.textContent = candidateLabel(sample);
    button.title = `${candidateLabel(sample)} (${status.replace("_", " ")})`;
    button.addEventListener("click", () => {
      currentCandidateIndex = index;
      renderCandidateTabs();
      renderCurrentSample();
    });
    els.candidateTabs.appendChild(button);
  });
}

function renderCurrentSample() {
  const sample = currentSample();
  if (!sample) {
    els.sampleCounter.textContent = "No sample loaded";
    els.sampleTitle.textContent = "Load samples JSON to begin";
    els.sampleMeta.textContent = "";
    els.candidateTabs.innerHTML = "";
    els.referenceFrame.textContent = "No sample data.";
    els.candidateFrame.textContent = "No candidate data.";
    els.introductionText.textContent = "";
    els.asrText.textContent = "";
    els.reviewForm.innerHTML = "";
    return;
  }

  const candidates = currentCandidates();
  const samplePosition = filteredSampleKeys.indexOf(currentSampleKey) + 1;
  els.sampleCounter.textContent = `Sample ${samplePosition || 1} of ${filteredSampleKeys.length || sampleKeys.length}`;
  els.sampleTitle.textContent = sample.sample_id || "Untitled sample";
  els.sampleMeta.innerHTML = [
    sample.dataset_id,
    candidateLabel(sample),
  ]
    .filter(Boolean)
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");
  els.candidateTitle.textContent = candidateLabel(sample);
  els.referenceSubtitle.textContent = sample.gt_path ? shortPath(sample.gt_path) : "";
  els.candidateSubtitle.textContent = sample.candidate_image ? "Rendered candidate diagram" : "Candidate source only";
  els.prevCandidate.disabled = samplePosition <= 1 && currentCandidateIndex <= 0;
  els.nextCandidate.disabled = samplePosition >= filteredSampleKeys.length && currentCandidateIndex >= candidates.length - 1;

  renderFrames(sample);
  renderProjectContext(sample);
  renderReviewForm(sample);
}

function renderMetrics(sample) {
  return sample;
}

function renderFrames(sample) {
  if (currentView === "source") {
    renderCode(els.referenceFrame, sample.gt_source, "No reference PlantUML source was included.");
    renderCode(els.candidateFrame, sample.pred_source, "No candidate PlantUML source was included.");
    return;
  }
  renderImage(els.referenceFrame, sample.ground_truth_image, "No reference image. Use --dataset-dir or --gt-image-dir when preparing samples.", "Reference");
  renderImage(els.candidateFrame, sample.candidate_image, sample.pred_source ? "No rendered candidate image. Switch to PlantUML view." : "No candidate image or source included.", candidateLabel(sample));
}

function publicRawResult(sample) {
  const hiddenFields = new Set([
    "candidate_id",
    "workflow",
    "model_id",
    "pred_path",
    "prediction_path",
    "candidate_path",
  ]);
  const raw = sample.raw_result || {};
  const visible = {
    review_candidate: candidateLabel(sample),
  };
  for (const [key, value] of Object.entries(raw)) {
    if (hiddenFields.has(key)) continue;
    visible[key] = value;
  }
  return visible;
}

function renderImage(container, src, fallbackText, label) {
  container.innerHTML = "";
  if (src) {
    const card = document.createElement("div");
    card.className = "image-card";
    const tools = document.createElement("div");
    tools.className = "image-tools";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Enlarge";
    button.addEventListener("click", () => openImageViewer(src, label));
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${label} architecture diagram`;
    img.addEventListener("dblclick", () => openImageViewer(src, label));
    tools.appendChild(button);
    card.appendChild(tools);
    card.appendChild(img);
    container.classList.remove("empty-state", "code-state");
    container.appendChild(card);
  } else {
    container.classList.add("empty-state");
    container.classList.remove("code-state");
    container.textContent = fallbackText;
  }
}

function renderProjectContext(sample) {
  const context = sample.project_context || {};
  const functionalRequirements = context.functional_requirements || context.requirements || context.asr;
  els.introductionText.textContent = cleanContextText(context.introduction) || "No introduction was included for this project.";
  els.asrText.textContent = cleanContextText(functionalRequirements) || "No functional requirements were included for this project.";
}

function cleanContextText(value) {
  return String(value || "").trim();
}

function openImageViewer(src, title) {
  imageZoom = 1;
  els.imageDialogTitle.textContent = title || "Architecture diagram";
  els.imageDialogImg.src = src;
  els.imageDialogImg.alt = `${title || "Expanded"} architecture diagram`;
  applyImageZoom();
  els.imageDialog.showModal();
}

function closeImageViewer() {
  els.imageDialog.close();
}

function setImageZoom(value) {
  imageZoom = Math.min(3, Math.max(0.5, value));
  applyImageZoom();
}

function applyImageZoom() {
  els.imageDialogImg.style.width = `${Math.round(imageZoom * 100)}%`;
  els.imageDialogImg.style.maxWidth = imageZoom === 1 ? "100%" : "none";
}

function renderCode(container, source, fallbackText) {
  container.innerHTML = "";
  container.classList.remove("empty-state");
  container.classList.add("code-state");
  const pre = document.createElement("pre");
  pre.textContent = source || fallbackText;
  container.appendChild(pre);
}

function renderReviewForm(sample) {
  const review = ensureReview(sample);
  els.overallStatus.value = review.status || computedStatus(sample);
  els.overallNote.value = review.overall_note || "";

  const completedDimensions = data.dimensions.filter((dimension) => isDecisionComplete(review.decisions?.[dimension.id])).length;
  els.reviewSummary.innerHTML = `
    <div class="review-progress">
      <span>${completedDimensions}/${data.dimensions.length} dimensions completed</span>
      <span>${escapeHtml(reviewerId || "anonymous")} | ${escapeHtml(sessionId)}</span>
    </div>
  `;

  els.reviewForm.innerHTML = "";
  data.dimensions.forEach((dimension, index) => {
    const saved = review.decisions?.[dimension.id] || {};
    const card = document.createElement("section");
    card.className = `dimension-card ${isDecisionComplete(saved) ? "complete" : ""}`;
    card.innerHTML = `
      <div class="dimension-head">
        <div class="dimension-title">${index + 1}. ${escapeHtml(dimension.label)}</div>
        <div class="dimension-description">${escapeHtml(dimension.description || "")}</div>
      </div>
      <div class="decision-row">
        <select class="score-select" aria-label="Human score">
          <option value="">Human score</option>
          ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${String(saved.human_score || "") === String(value) ? "selected" : ""}>${value}</option>`).join("")}
        </select>
        <select class="confidence-select" aria-label="Reviewer confidence">
          <option value="">Confidence</option>
          ${["low", "medium", "high"].map((value) => `<option value="${value}" ${String(saved.confidence || "") === value ? "selected" : ""}>${titleCase(value)}</option>`).join("")}
        </select>
      </div>
      <textarea class="justification" placeholder="Evidence or rationale for the human score.">${escapeHtml(saved.justification || "")}</textarea>
    `;
    card.querySelector(".score-select").addEventListener("change", (event) => updateDecision(sample, dimension.id, { human_score: event.target.value }));
    card.querySelector(".confidence-select").addEventListener("change", (event) => updateDecision(sample, dimension.id, { confidence: event.target.value }));
    card.querySelector(".justification").addEventListener("input", (event) => updateDecision(sample, dimension.id, { justification: event.target.value }, false));
    els.reviewForm.appendChild(card);
  });
}

function currentCandidates() {
  return grouped.get(currentSampleKey) || [];
}

function currentSample() {
  return currentCandidates()[currentCandidateIndex] || null;
}

function firstVisibleCandidateIndex(key) {
  const candidates = grouped.get(key) || [];
  const index = candidates.findIndex((sample) => candidateMatchesFilters(sample, key));
  return index >= 0 ? index : 0;
}

function moveCandidate(delta) {
  const candidates = currentCandidates();
  let nextIndex = currentCandidateIndex + delta;
  let nextSamplePosition = filteredSampleKeys.indexOf(currentSampleKey);

  if (nextIndex < 0) {
    nextSamplePosition -= 1;
    if (nextSamplePosition >= 0) {
      currentSampleKey = filteredSampleKeys[nextSamplePosition];
      nextIndex = currentCandidates().length - 1;
    } else {
      return;
    }
  } else if (nextIndex >= candidates.length) {
    nextSamplePosition += 1;
    if (nextSamplePosition < filteredSampleKeys.length) {
      currentSampleKey = filteredSampleKeys[nextSamplePosition];
      nextIndex = 0;
    } else {
      return;
    }
  }

  currentCandidateIndex = nextIndex;
  render();
}

function ensureReview(sample) {
  const key = reviewKey(sample);
  if (!reviews[key]) {
    reviews[key] = {
      annotator_id: reviewerId || "anonymous",
      session_id: sessionId,
      dataset_id: sample.dataset_id || "",
      sample_id: sample.sample_id,
      candidate_id: sample.candidate_id,
      workflow: sample.workflow || "",
      model_id: sample.model_id || "",
      title: sample.title,
      status: "not_started",
      decisions: {},
      overall_note: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return reviews[key];
}

function getReview(sample) {
  return reviews[reviewKey(sample)];
}

function reviewKey(sample, annotator = reviewerId || "anonymous") {
  return `${annotator}::${sample.sample_id || "sample"}::${sample.candidate_id || "candidate"}`;
}

function updateDecision(sample, dimensionId, patch, rerender = true) {
  const review = ensureReview(sample);
  const current = review.decisions[dimensionId] || {};
  review.decisions[dimensionId] = {
    ...current,
    ...patch,
    model_score: sample.model_scores?.[dimensionId]?.score || "",
    model_reasoning: sample.model_scores?.[dimensionId]?.reasoning || "",
  };
  review.status = nextStatus(review);
  review.updated_at = new Date().toISOString();
  saveReviews();
  if (rerender) {
    renderCandidateTabs();
    renderProgress();
    renderReviewForm(sample);
  } else {
    flashAutosave("Autosaved");
  }
}

function updateCurrentReview(patch, rerender = true) {
  const sample = currentSample();
  if (!sample) return;
  const review = ensureReview(sample);
  Object.assign(review, patch, { updated_at: new Date().toISOString() });
  saveReviews();
  if (rerender) {
    renderCandidateTabs();
    renderProgress();
    renderReviewForm(sample);
  } else {
    flashAutosave("Autosaved");
  }
}

function nextStatus(review) {
  if (review.status === "skipped") return "skipped";
  const decisions = review.decisions || {};
  const complete = data.dimensions.every((dimension) => isDecisionComplete(decisions[dimension.id]));
  if (complete) return "complete";
  const touched = Object.values(decisions).some((decision) => Object.values(decision).some((value) => value !== "" && value !== undefined));
  return touched ? "in_progress" : "not_started";
}

function computedStatus(sample) {
  const review = getReview(sample);
  return review ? nextStatus(review) : "not_started";
}

function reviewStatus(sample) {
  const review = getReview(sample);
  return review?.status || computedStatus(sample);
}

function isDecisionComplete(decision) {
  return Boolean(decision && decision.human_score);
}

function countStatuses(candidates) {
  return candidates.reduce(
    (acc, sample) => {
      const status = reviewStatus(sample);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { not_started: 0, in_progress: 0, complete: 0, skipped: 0 },
  );
}

function loadActiveReviews() {
  activeStoreKey = storageKey();
  reviews = loadReviews(activeStoreKey);
  flashAutosave("Autosave ready");
}

function loadReviews(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveReviews() {
  localStorage.setItem(activeStoreKey, JSON.stringify(reviews));
  flashAutosave("Autosaved");
}

function mergeImportedReviews(payload) {
  const importedReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  let count = 0;
  for (const review of importedReviews) {
    const annotator = review.annotator_id || payload.annotator_id || reviewerId || "anonymous";
    const key = `${annotator}::${review.sample_id || "sample"}::${review.candidate_id || "candidate"}`;
    reviews[key] = { ...review, annotator_id: annotator, session_id: review.session_id || payload.session_id || sessionId };
    count += 1;
  }
  return count;
}

function storageKey() {
  return `ma4sa-evalstudio:${manifestFingerprint()}:${reviewerId || "anonymous"}:${sessionId}`;
}

function manifestFingerprint() {
  const basis = [
    data.schema_version || "v1",
    data.generated_at || "",
    data.samples?.length || 0,
    data.samples?.[0]?.sample_id || "",
    data.samples?.[data.samples.length - 1]?.candidate_id || "",
  ].join("|");
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function clearLocalReviews() {
  const activeCount = Object.keys(reviews).length;
  if (!activeCount) return;
  reviews = {};
  localStorage.removeItem(activeStoreKey);
  render();
  flashAutosave("Local reviewer data cleared");
}

function exportJson() {
  const payload = {
    schema_version: "ma4sa-human-review-v2",
    exported_at: new Date().toISOString(),
    annotator_id: reviewerId || "anonymous",
    session_id: sessionId,
    source_manifest: {
      schema_version: data.schema_version || "",
      generated_at: data.generated_at || "",
      candidate_count: data.samples?.length || 0,
      dimensions: data.dimensions,
    },
    reviews: Object.values(reviews),
  };
  download(`${safeFilePart(reviewerId || "anonymous")}_${safeFilePart(sessionId)}_human_reviews.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportCsv() {
  const rows = [[
    "annotator_id",
    "session_id",
    "dataset_id",
    "sample_id",
    "candidate_id",
    "workflow",
    "model_id",
    "status",
    "dimension",
    "agree",
    "model_score",
    "human_score",
    "confidence",
    "justification",
    "overall_note",
    "updated_at",
  ]];
  for (const review of Object.values(reviews)) {
    for (const dimension of data.dimensions) {
      const item = review.decisions?.[dimension.id] || {};
      rows.push([
        review.annotator_id || reviewerId || "anonymous",
        review.session_id || sessionId,
        review.dataset_id || "",
        review.sample_id || "",
        review.candidate_id || "",
        review.workflow || "",
        review.model_id || "",
        review.status || "",
        dimension.id,
        item.agree === true ? "agree" : item.agree === false ? "disagree" : "",
        item.model_score || "",
        item.human_score || "",
        item.confidence || "",
        item.justification || "",
        review.overall_note || "",
        review.updated_at || "",
      ]);
    }
  }
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  download(`${safeFilePart(reviewerId || "anonymous")}_${safeFilePart(sessionId)}_human_reviews.csv`, csv, "text/csv");
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function scoreLabel(score) {
  const numeric = Number(score);
  if (!score) return "No score";
  if (numeric >= 5) return "Strong";
  if (numeric >= 3) return "Partial";
  return "Weak";
}

function candidateLabel(sample) {
  return sample.review_label || "Candidate";
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function formatNumber(value) {
  if (value === undefined || value === null || value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

function shortPath(path) {
  return String(path).split(/[\\/]/).slice(-4).join("/");
}

function titleCase(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function defaultSessionId() {
  return `session-${new Date().toISOString().slice(0, 10)}`;
}

function cleanId(value) {
  return String(value || "").trim().replace(/\s+/g, "-");
}

function safeFilePart(value) {
  return cleanId(value).replace(/[^A-Za-z0-9_.-]+/g, "_") || "review";
}

function flashAutosave(message) {
  els.autosaveText.textContent = message;
  els.autosaveText.classList.add("active");
  window.clearTimeout(flashAutosave.timer);
  flashAutosave.timer = window.setTimeout(() => els.autosaveText.classList.remove("active"), 900);
}

function csvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
