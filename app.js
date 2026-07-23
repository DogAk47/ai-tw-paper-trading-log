"use strict";

const DATA_URL = "data/latest.json";
const SUPPORTED_SCHEMA_VERSION = "public-daily-snapshot-v1";

function byId(id) {
  return document.getElementById(id);
}

function appendTextElement(parent, tag, value, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? "—";
  parent.appendChild(element);
  return element;
}

function appendDefinition(parent, label, value, code = false) {
  const wrapper = document.createElement("div");
  appendTextElement(wrapper, "dt", label);
  const dd = document.createElement("dd");
  appendTextElement(dd, code ? "code" : "span", value ?? "—");
  wrapper.appendChild(dd);
  parent.appendChild(wrapper);
}

function formatDateTime(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(parsed);
}

function formatList(values) {
  return Array.isArray(values) && values.length ? values.join("；") : "—";
}

function securityLabel(item) {
  const label =
    typeof item?.security_label === "string" ? item.security_label.trim() : "";
  return label || item?.symbol || "—";
}

function appendCell(row, label, value, kind, action) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  if (kind) cell.dataset.kind = kind;
  if (action) cell.dataset.action = action;
  cell.textContent = value ?? "—";
  row.appendChild(cell);
}

function renderMetadata(snapshot) {
  const metadata = byId("metadata");
  metadata.replaceChildren();
  appendDefinition(metadata, "產品版本", `v${snapshot.metadata.product_version}`, true);
  appendDefinition(metadata, "Prompt", snapshot.metadata.prompt_version, true);
  appendDefinition(metadata, "策略", snapshot.metadata.strategy_version, true);
  appendDefinition(metadata, "模型", snapshot.metadata.model_label, true);
  appendDefinition(metadata, "公開範圍", "隱私版（精確金額與 EPS 數值已隱藏）");
  appendDefinition(
    metadata,
    "資料日期",
    formatList(snapshot.metadata.source_data_dates),
    true,
  );
}

function renderActions(decision) {
  const body = byId("actions-body");
  body.replaceChildren();
  const actions = Array.isArray(decision.actions) ? decision.actions : [];
  byId("actions-empty").hidden = actions.length !== 0;
  for (const action of actions) {
    const row = document.createElement("tr");
    appendCell(row, "標的", securityLabel(action), "symbol");
    appendCell(row, "動作", action.action, "action", action.action);
    appendCell(row, "張數", String(action.target_lots));
    appendCell(row, "信心", `${Math.round(action.confidence * 100)}%`);
    appendCell(row, "理由", action.thesis);
    body.appendChild(row);
  }
}

function renderAnalysis(analysis) {
  const grid = byId("analysis-grid");
  grid.replaceChildren();
  const fields = [
    ["市場", analysis.market],
    ["投資組合", analysis.portfolio],
    ["財務", analysis.financial],
    ["風險", analysis.risk],
    ["下一交易日", analysis.next_session_plan],
  ];
  for (const [label, value] of fields) appendDefinition(grid, label, value);
}

function renderWatchCandidates(candidates) {
  const body = byId("watch-body");
  body.replaceChildren();
  const rows = Array.isArray(candidates) ? candidates : [];
  byId("watch-count").textContent = `${rows.length} 檔`;
  byId("watch-empty").hidden = rows.length !== 0;
  for (const candidate of rows) {
    const row = document.createElement("tr");
    appendCell(row, "排名", String(candidate.rank));
    appendCell(row, "標的", securityLabel(candidate), "symbol");
    appendCell(row, "觀望理由", candidate.observation_reason);
    appendCell(row, "尚缺條件", formatList(candidate.missing_buy_conditions));
    appendCell(row, "風險", formatList(candidate.risk_flags));
    body.appendChild(row);
  }
}

function renderDataGaps(gaps) {
  const list = byId("data-gaps");
  list.replaceChildren();
  const rows = Array.isArray(gaps) ? gaps : [];
  byId("gaps-empty").hidden = rows.length !== 0;
  for (const gap of rows) appendTextElement(list, "li", gap);
}

function renderSnapshot(snapshot) {
  byId("run-status").textContent = snapshot.run_status;
  byId("run-status").dataset.status = snapshot.run_status;
  byId("market-date").textContent = snapshot.market_date;
  byId("market-date").dateTime = snapshot.market_date;
  byId("status-message").textContent = snapshot.status_message;
  byId("generated-at").textContent = `更新時間 ${formatDateTime(snapshot.generated_at)}`;
  renderMetadata(snapshot);

  const completed = snapshot.run_status === "COMPLETED";
  byId("completed-content").hidden = !completed;
  const noTrade = byId("no-trade-reason");
  noTrade.hidden = !completed || !snapshot.decision?.no_trade_reason;
  noTrade.textContent = snapshot.decision?.no_trade_reason
    ? `無交易理由：${snapshot.decision.no_trade_reason}`
    : "";
  if (!completed) return;

  byId("portfolio-view").textContent = snapshot.decision.portfolio_view;
  byId("portfolio-summary").textContent = snapshot.decision.portfolio_summary;
  renderActions(snapshot.decision);
  renderAnalysis(snapshot.analysis);
  renderWatchCandidates(snapshot.watch_candidates);
  renderDataGaps(snapshot.analysis.data_gaps);
}

async function loadSnapshot() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = await response.json();
    if (snapshot?.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      throw new Error("Unsupported public snapshot schema");
    }
    renderSnapshot(snapshot);
  } catch (error) {
    console.error("Public snapshot could not be loaded", error);
    byId("load-error").hidden = false;
    byId("completed-content").hidden = true;
    byId("run-status").textContent = "UNAVAILABLE";
    byId("run-status").dataset.status = "FAILED";
    byId("status-message").textContent = "最新公開資料無法載入。";
  }
}

loadSnapshot();
