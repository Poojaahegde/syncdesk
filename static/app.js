"use strict";
const icons = {
  logo:'<path d="M12 2.5 21.4 8v8L12 21.5 2.6 16V8L12 2.5Z"/><path d="m7.6 14.8 3.1-3.2 2.2 1.7 3.5-4.2"/><path d="M13.7 9h2.8v2.7"/>',
  inbox:'<path d="M4 4h16l2 10v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5L4 4Z"/><path d="M2 14h6l2 3h4l2-3h6"/>',
  book:'<path d="M3 19V5a2 2 0 0 1 2-2h14v17H5a2 2 0 0 1 0-4h14"/><path d="M8 7h7m-7 4h5"/>',
  route:'<circle cx="5" cy="5" r="2"/><path d="M5 7v10a2 2 0 0 0 2 2h12m-4-4 4 4-4 4M9 10h4a4 4 0 0 0 4-4V3m-3 3 3-3 3 3"/>',
  chart:'<path d="M3 3v17h18M8 15v-4m5 4V7m5 8V4"/>',
  user:'<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/><path d="M19 3v4m-2-2h4"/>',
  link:'<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1m2 6a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  check:'<path d="m5 12 4 4L19 6"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1"/>',
  message:'<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1Z"/><path d="M8 9h9m-9 4h6"/>',
  shield:'<path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/>',
  refresh:'<path d="M20 7a8 8 0 1 0 0 10m0-15v5h-5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  external:'<path d="M13 4h7v7m0-7-9 9m7 0v7H4V6h7"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
};
const icon = name => '<svg class="i" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
const readLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { toast("Browser storage is unavailable. Changes will last for this session."); return false; }
}
const state = {
  tickets: [], sources: [], current: null, view: "copilot", page: "workspace",
  handoffs: readLocal("syncdesk.v2.handoffs", []), timings: readLocal("syncdesk.v3.timings", []),
  custom: readLocal("syncdesk.v2.custom", []), trials: null, modelAvailable: false,
  playbooks: readLocal("syncdesk.v2.playbooks", []), useModel: false, cases: new Map(), version: 0, evalResults: null
};
const pageNames = {workspace:"Ticket workspace",sources:"Knowledge base",handoffs:"Handoffs",evaluation:"Evaluation lab"};
const methodNames = {copilot:"Copilot",keyword:"Keyword search",checklist:"Setup checklist"};
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 3200);
}
async function api(path, data) {
  const settings = data === undefined ? {} : {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)};
  const response = await fetch(path, settings);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}
function go(page, refresh = true) {
  state.page = page;
  if (location.hash !== "#" + page) history.replaceState(null, "", "#" + page);
  all(".page").forEach(section => { section.hidden = section.id !== page; });
  all(".nav").forEach(button => {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#page-label").textContent = pageNames[page];
  if (page === "sources") { $("#source-search").value = ""; renderSources(state.sources); }
  if (refresh && page === "workspace" && state.current && state.view === "copilot" && !caseState().result) analyze();
  if (page === "handoffs") renderHandoffs();
  if (page === "evaluation" && !state.evalResults) runEval();
  else if (page === "evaluation") renderEval();
}
function sourceCard(source) {
  return '<div class="source-card"><div class="source-kicker"><span>' + escape(source.publisher) +
    '</span><span class="badge">' + escape(source.product) + '</span></div><h3>' + escape(source.article) +
    '</h3><p class="source-section">' + escape(source.section) +
    '</p><blockquote class="quote">“' + escape(source.passage) + '”</blockquote><a class="source-link" href="' +
    escape(source.url) + '" target="_blank" rel="noopener noreferrer">Open source article ' + icon("external") + '</a></div>';
}
function renderSources(sources) {
  $("#source-grid").innerHTML = sources.length ? sources.map(sourceCard).join("") :
    '<div class="empty"><strong>No matching passages</strong>Try a service name, an error code, or a shorter search.</div>';
}
function renderTickets() {
  $("#ticket-count").textContent = state.tickets.length;
  $("#tickets").innerHTML = state.tickets.map(ticket => '<button class="ticket' +
    (ticket.id === state.current?.id ? ' active" aria-pressed="true' : '" aria-pressed="false') +
    '" data-ticket="' + escape(ticket.id) + '"><span class="avatar ' + escape(ticket.color) + '">' +
    escape(ticket.initials) + '</span><span class="ticket-detail"><span class="ticket-name">' + escape(ticket.name) +
    '</span><span class="ticket-subject">' + escape(ticket.title) + '</span><span class="ticket-time">' +
    escape(ticket.product) + '</span></span></button>').join("");
}
function caseState() {
  if (!state.cases.has(state.current.id)) state.cases.set(state.current.id, {turns:[],result:null,complete:false});
  return state.cases.get(state.current.id);
}
function selectTicket(ticket) {
  $("#start-screen").hidden = true;
  $("#case-grid").hidden = false;
  state.current = ticket;
  renderTickets();
  $("#ticket-title").textContent = ticket.title;
  $("#ticket-message").textContent = ticket.text;
  $("#ticket-meta").innerHTML = "<b>" + escape(ticket.id) + "</b> <span>·</span> " +
    escape(ticket.product === "Unspecified" ? "Service unconfirmed" : ticket.product);
  setView("copilot");
}
function setStatus(label, style = "") {
  const status = $("#ticket-status");
  status.textContent = label;
  status.className = "status " + style;
}
function setView(view) {
  if (!state.current) return;
  state.view = view;
  state.version += 1;
  all(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.view === view);
    tab.setAttribute("aria-pressed", String(tab.dataset.view === view));
  });
  if (view === "copilot") {
    const current = caseState();
    if (current.result) renderResult(current.result);
    else analyze();
    return;
  }
  setStatus("Baseline");
  setEvidence([]);
  if (view === "keyword") renderKeyword();
  else renderChecklist();
}
function setEvidence(sources, loading = false) {
  $("#evidence-content").innerHTML = sources.length ? sources.map(sourceCard).join("") : loading ?
    '<div class="empty">Looking for applicable sources…</div>' :
    '<div class="empty"><strong>No passage selected</strong>Supporting documentation appears here when an applicable source is identified.</div>';
}
function showError(error) {
  $("#case-view").innerHTML = '<p class="error">' + escape(error.message) + '</p><div class="case-actions"><button class="btn secondary" data-action="retry">Try again</button></div>';
  setStatus("Open");
}
async function analyze() {
  const ticket = state.current;
  const current = caseState();
  const version = ++state.version;
  const useModel = state.useModel;
  const phase = useModel ? "Checking guidance and generating a local diagnosis…" : "Checking ticket details against the reviewed guidance…";
  $("#case-view").innerHTML = '<p class="loading">' + phase + '</p>';
  setStatus("Analyzing");
  setEvidence([], true);
  try {
    const result = await api("/api/diagnose", {ticket:ticket.text, turns:current.turns, use_model:useModel, playbooks:state.playbooks});
    if (version !== state.version) return;
    current.result = result;
    renderResult(result);
  } catch (error) { if (version === state.version) showError(error); }
}
const stepsHtml = steps => steps.length ? '<ol class="steps">' + steps.map(step => '<li>' + escape(step) + '</li>').join("") + '</ol>' : "";
const actions = (symbol, label, action, primary = false) => '<button class="btn ' + (primary ? "primary" : "secondary") +
  '" data-action="' + action + '">' + icon(symbol) + ' ' + label + '</button>';
function timerButton() {
  const trial = state.trials;
  if (trial && trial.view === state.view && trial.id === state.current.id) return actions("clock","Finish timed trial","finish-timer");
  return actions("clock", trial ? "Start new trial" : "Time this workflow","start-timer");
}
function renderResult(result) {
  const current = caseState();
  setEvidence(result.sources);
  const reportedProduct = current.turns.find(turn => turn.field === "product")?.answer;
  const knownProduct = state.sources.find(source => source.product.toLowerCase() === reportedProduct?.trim().toLowerCase())?.product;
  const confirmedProduct = result.sources[0]?.product || knownProduct || state.current.product;
  $("#ticket-meta").innerHTML = "<b>" + escape(state.current.id) + "</b> <span>·</span> " +
    escape(confirmedProduct === "Unspecified" ? "Service unconfirmed" : confirmedProduct);
  const queued = state.handoffs.some(packet => packet.id === state.current.id);
  if (queued) setStatus("Queued", "review");
  else if (current.complete) setStatus("Closed", "ready");
  else if (result.status === "resolve") setStatus("Review ready", "ready");
  else if (result.status === "escalate") setStatus("Human review", "review");
  else setStatus("Needs details", "warn");
  const turns = current.turns.map(turn => '<p class="turn"><b>Your answer</b> · ' + escape(turn.answer) + '</p>').join("");
  const modes = {
    generated: "Generated locally with " + result.model,
    abstained: "Model abstained or citation check failed. Showing the rules result.",
    fallback: "Model response unavailable. Showing the rules result.",
    unavailable: "Local model unavailable. Showing the rules result.",
    policy: "Rules handled this decision without calling the model."
  };
  const mode = '<div class="mode">' + (state.modelAvailable ?
    '<label><input type="checkbox" id="use-model"' + (state.useModel ? " checked" : "") + '> Use local LLM</label>' : "") +
    escape(modes[result.rag_state] || "Rules mode") + '</div>';
  const generated = result.diagnosis ?
    '<div class="grounded-diagnosis"><h4>Model diagnosis</h4><p>' + escape(result.diagnosis) + '</p><p class="diagnosis-quote">Ticket detail · “' +
    escape(result.ticket_quote) + '”</p><p class="diagnosis-quote">Source excerpt · “' +
    escape(result.source_quote) + '”</p></div>' : "";
  let content;
  if (result.status === "clarify") {
    content = '<div class="question"><h3>' + escape(result.question) + '</h3><p>' + escape(result.reason) +
      '</p><div class="choices">' + result.choices.map(choice => '<button class="btn secondary" data-answer="' + escape(choice) + '">' +
      escape(choice) + '</button>').join("") + '</div><form class="reply-form" id="reply-form"><input id="reply" required maxlength="500" aria-label="Follow-up answer" placeholder="Or enter the exact detail"><button class="btn primary" type="submit">Send</button></form></div>';
  } else {
    content = '<div class="result"><div class="result-head"><span class="iconbox">' + icon(result.status === "escalate" ? "route" : "spark") +
      '</span><h3>' + escape(result.title) + '</h3></div><div class="result-body"><p>' + escape(result.reason) +
      '</p>' + generated + stepsHtml(result.steps) + (result.queue ? '<p style="margin-top:10px"><strong>Owner</strong> · ' + escape(result.queue) + '</p>' : "") + '</div></div>';
  }
  const handoff = queued ? actions("route","View handoff","see-handoff") : actions("route","Queue handoff","handoff",result.status === "escalate");
  const copy = result.steps.length && result.status === "resolve" ? actions("copy","Copy steps","copy") : "";
  const done = result.status === "resolve" && !current.complete && !queued ? actions("check","Mark resolved","close-case") : "";
  $("#case-view").innerHTML = turns + content + '<div class="case-actions">' + copy + handoff + done + timerButton() + '</div>' + mode;
}
function defaultSearch() {
  return state.current.product === "Unspecified" ? "" : state.current.product;
}
function renderKeyword(previousQuery = "") {
  $("#case-view").innerHTML = '<p class="muted">Search the same evidence library by keyword. Select a result to review its procedure.</p><form id="keyword-form" class="reply-form" style="margin-top:9px"><input id="keyword-query" aria-label="Keyword query" maxlength="300" placeholder="Try HTTP 302 or app approval" value="' +
    escape(previousQuery || defaultSearch()) + '"><button class="btn primary" type="submit">Search</button></form><div id="keyword-results" class="keyword-results"></div><div id="keyword-steps" class="keyword-results"></div><div class="case-actions">' + timerButton() + '</div>';
  searchKeyword($("#keyword-query").value);
}
async function searchKeyword(query) {
  const version = ++state.version;
  $("#keyword-results").innerHTML = '<p class="loading">Searching…</p>';
  $("#keyword-steps").innerHTML = "";
  setEvidence([]);
  try {
    const result = await api("/api/library", {query, playbooks:state.playbooks});
    if (version !== state.version || state.view !== "keyword") return;
    $("#keyword-results").innerHTML = result.matches.length ? result.matches.map(source =>
      '<button class="btn secondary keyword-item" data-source="' + escape(source.id) + '">' + icon("book") + ' ' + escape(source.title) + '</button>').join("") :
      '<p class="empty">No results for this query.</p>';
  } catch (error) {
    if (version === state.version) $("#keyword-results").textContent = error.message;
  }
}
async function renderChecklist() {
  const version = ++state.version;
  $("#case-view").innerHTML = '<p class="loading">Loading checklist…</p>';
  try {
    const result = await api("/api/checklist", {ticket:state.current.text});
    if (version !== state.version) return;
    const items = ["Identify the affected service and integration.", "Capture the exact error and when sync last worked.", ...result.steps];
    $("#case-view").innerHTML = '<div class="result"><div class="result-head"><span class="iconbox">' + icon("list") +
      '</span><h3>First-pass setup checklist</h3></div><div class="result-body"><p>Representative support checklist for comparison. ' + escape(result.reason) + '</p><div class="checklist-items">' +
      items.map(item => '<label><input type="checkbox"> ' + escape(item) + '</label>').join("") +
      '</div></div></div><div class="case-actions">' + timerButton() + '</div>';
    setEvidence(result.sources);
  } catch (error) { if (version === state.version) showError(error); }
}
async function answer(value) {
  const current = caseState();
  if (current.result?.status !== "clarify" || !value.trim()) return;
  current.turns.push({field:current.result.field, answer:value.trim()});
  current.result = null;
  analyze();
}
async function copyText(value, success) {
  try { await navigator.clipboard.writeText(value); toast(success); }
  catch { toast("Clipboard unavailable. You can select and copy the text manually."); }
}
function packetText(packet) {
  const lines = [packet.id + " · " + packet.title, "Owner: " + packet.queue, "Reason: " + packet.reason, "", "Customer message", packet.ticket];
  if (packet.turns.length) lines.push("", "Follow-up details", ...packet.turns.map(turn => "• " + turn.answer));
  if (packet.source) lines.push("", "Supporting evidence: " + packet.source, packet.url || "");
  return lines.join("\n");
}
function updateHandoffCount() { $("#handoff-count").textContent = state.handoffs.length; }
function renderHandoffs() {
  updateHandoffCount();
  $("#handoff-list").innerHTML = state.handoffs.length ? state.handoffs.map(packet =>
    '<article class="panel handoff"><div><span class="badge review">' + escape(packet.queue) + '</span><h2>' +
    escape(packet.id + " · " + packet.title) + '</h2><p class="muted">' + escape(packet.reason) +
    '</p><details><summary>Review handoff packet</summary><pre>' + escape(packetText(packet)) +
    '</pre></details></div><button class="btn secondary" data-copy-packet="' + escape(packet.id) + '">' + icon("copy") +
    ' Copy packet</button></article>').join("") : '<div class="empty"><strong>No queued handoffs</strong>Queue a ticket from the workspace to see its packet here.</div>';
}
async function addHandoff(button) {
  const ticket = state.current;
  const current = caseState();
  button.disabled = true;
  try {
    const result = current.result;
    const reviewSource = result?.mode === "Local RAG" && result.status === "escalate" ? result.sources[0]?.id : undefined;
    const packet = await api("/api/handoff", {ticket:ticket.text, turns:current.turns,
      playbooks:state.playbooks, review_source:reviewSource});
    if (!state.handoffs.some(item => item.id === ticket.id)) {
      state.handoffs.unshift({...packet, id:ticket.id, title:ticket.title});
      saveLocal("syncdesk.v2.handoffs", state.handoffs);
    }
    updateHandoffCount();
    if (state.current.id === ticket.id && state.view === "copilot" && current.result) renderResult(current.result);
    if (state.page === "handoffs") renderHandoffs();
    toast("Handoff queued in this browser.");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}
function startTimer() {
  state.trials = {id:state.current.id, view:state.view, start:performance.now()};
  // Only change the timer button so the rep's checklist/search stays in place.
  const button = $('[data-action="start-timer"]');
  button.outerHTML = timerButton();
  toast("Timer started. Finish when you’ve chosen a next action.");
}
function finishTimer() {
  const trial = state.trials;
  if (!trial || trial.id !== state.current.id || trial.view !== state.view) return;
  const seconds = Math.round((performance.now() - trial.start) / 100) / 10;
  state.timings.push({method:methodNames[trial.view], seconds, ticket:trial.id});
  state.trials = null;
  saveLocal("syncdesk.v3.timings", state.timings);
  $('[data-action="finish-timer"]').outerHTML = timerButton();
  toast("Trial recorded · " + seconds.toFixed(1) + " seconds");
}
const ratio = (actual, total) => actual + " / " + total;
function handling(method) {
  const list = state.timings.filter(item => item.method === method).map(item => item.seconds).sort((a,b) => a-b);
  if (!list.length) return "Awaiting trials";
  const middle = Math.floor(list.length / 2);
  const value = list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
  return value.toFixed(1) + " s (n=" + list.length + ")";
}
async function runEval() {
  const button = $("#run-eval");
  button.disabled = true;
  $("#eval-content").innerHTML = '<p class="loading">Replaying the fictional ticket set…</p>';
  try { state.evalResults = await api("/api/evaluate"); renderEval(); }
  catch (error) { $("#eval-content").innerHTML = '<p class="error">' + escape(error.message) + '</p>'; }
  finally { button.disabled = false; }
}
function renderEval() {
  const result = state.evalResults;
  const copilot = result.summary.Copilot;
  const metrics = [
    ["Correct resolution",ratio(copilot.resolution,copilot.resolution_total),"Resolvable cases only"],
    ["Unsupported guidance",ratio(copilot.unsupported,copilot.total),"Cases with an inapplicable procedure"],
    ["Escalation accuracy",ratio(copilot.escalation,copilot.total),"Correct send-or-keep decision"],
    ["Median handling time",handling("Copilot"),"Timed rep trials in this browser"],
  ];
  const cards = metrics.map(([name,value,detail]) => '<article class="panel metric"><h3>' + name + '</h3><strong>' + value +
    '</strong><p class="muted">' + detail + '</p></article>').join("");
  const table = Object.entries(result.summary).map(([method,row]) => '<tr><td><strong>' + method + '</strong></td><td>' +
    ratio(row.correct,row.total) + '</td><td>' + ratio(row.resolution,row.resolution_total) + '</td><td>' +
    ratio(row.unsupported,row.total) + '</td><td>' + ratio(row.escalation,row.total) + '</td><td>' +
    ratio(...row.escalation_recall) + '</td><td>' + handling(method) + '</td><td>' + row.latency_ms.toFixed(3) + ' ms</td></tr>').join("");
  $("#eval-content").innerHTML = '<div class="eval-grid">' + cards + '</div><div class="panel eval-panel"><h2>Workflow comparison</h2>' +
    '<p class="muted">Offline replay uses the local engine, top keyword result, and first-pass setup checklist. Counted resolutions are correct recommended procedures. The replay uses the built-in library.</p>' +
    (result.model ? '<p class="muted eval-note">Saved replay · ' + escape(result.model) + ' produced validated diagnoses on ' +
      result.rag_outcomes.generated + ' of ' + result.summary["Local RAG"].total + ' tickets. The rules handled remaining outcomes or served as fallback.</p>' : "") +
    '<div class="table-scroll"><table><thead><tr><th>Workflow</th><th>Exact route</th><th>Correct resolution</th><th>Unsupported guidance</th><th>Escalation accuracy</th><th>Escalation recall</th><th>Median handling</th><th>Median compute</th></tr></thead><tbody>' +
    table + '</tbody></table></div><p class="muted eval-note">Compute time is from replay. Use “Time this workflow” in the ticket workspace to record handling time, including reading and deciding.</p></div>' +
    '<div class="panel eval-panel"><div class="eval-tools"><h2>Ticket results</h2><label>Workflow <select id="eval-method">' +
    Object.keys(result.summary).map(name => '<option>' + name + '</option>').join("") +
    '</select></label><label><input id="failures-only" type="checkbox" checked> Show failures only</label></div><div class="table-scroll"><table class="eval-tickets"><thead><tr><th>Ticket</th><th>Expected route</th><th>Actual route</th><th>Result</th></tr></thead><tbody id="eval-rows"></tbody></table></div></div>';
  renderEvalRows();
}
function renderEvalRows() {
  const {rows,cases} = state.evalResults;
  const subset = rows.filter(row => row.method === $("#eval-method").value && (!$("#failures-only").checked || !row.correct));
  const byId = Object.fromEntries(cases.map(item => [item.id,item]));
  $("#eval-rows").innerHTML = subset.length ? subset.map(row => '<tr><td><details><summary>' + escape(row.id + " · " + row.family) +
    '</summary><p>' + escape(byId[row.id].text) + '</p>' + (row.diagnosis ? '<p><strong>Generated</strong> · ' + escape(row.diagnosis) + '</p>' : '') + '</details></td><td>' + escape(row.expected_route) + '</td><td>' +
    escape(row.actual_route) + '</td><td><span class="badge ' + (row.correct ? "ready" : "warn") + '">' +
    (row.correct ? "Pass" : row.unsupported ? "Unsupported" : "Wrong route") + '</span></td></tr>').join("") :
    '<tr><td colspan="4">No failures for this workflow.</td></tr>';
}
function newTicket() {
  go("workspace", false);
  state.version += 1;
  state.current = null;
  $("#case-grid").hidden = true;
  $("#start-screen").hidden = false;
  $("#compose-message").value = "";
  renderTickets();
  $("#compose-message").focus();
}
async function submitPlaybook(form) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const playbooks = [...state.playbooks, Object.fromEntries(new FormData(form))];
    const result = await api("/api/library", {playbooks});
    state.playbooks = playbooks;
    state.sources = result.matches;
    state.cases.forEach(current => { current.result = null; });
    saveLocal("syncdesk.v2.playbooks", playbooks);
    $("#source-search").value = "";
    renderSources(state.sources);
    $("#playbook-dialog").close();
    toast("Playbook saved in this browser.");
  } catch (error) {
    toast(error.message);
  } finally { button.disabled = false; }
}
function submitTicket() {
  const text = $("#compose-message").value.trim();
  if (!text) { toast("Describe the issue to start a diagnosis."); return; }
  const firstLine = text.split(/[\n.!?]/)[0].trim() || "Integration setup issue";
  const title = firstLine.length > 69 ? firstLine.slice(0, 66) + "…" : firstLine;
  const ticket = {id:"SD-" + (2001 + state.custom.length), name:"Custom ticket", title, text, product:"Unspecified",
    initials:"CT", color:"purple", time:new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})};
  state.custom.unshift(ticket);
  state.tickets.unshift(ticket);
  saveLocal("syncdesk.v2.custom", state.custom);
  selectTicket(ticket);
}
function renderExamples(demos) {
  $("#guide-example").dataset.ticket = demos[0].id;
  $("#guide-example").disabled = false;
  const examples = [
    ["search", "Webhook delivery fails", demos[0]],
    ["message", "A setup issue needs more detail", demos[1]],
    ["route", "An app needs admin approval", demos[3]]
  ];
  $("#suggestions").innerHTML = examples.map(([symbol,label,ticket]) =>
    '<button type="button" class="suggestion" data-ticket="' + escape(ticket.id) + '">' + icon(symbol) +
    '<span>' + label + '</span>' + icon("arrow") + '</button>').join("");
}
document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.page) go(target.dataset.page);
  if (target.dataset.ticket) {
    go("workspace", false);
    selectTicket(state.tickets.find(ticket => ticket.id === target.dataset.ticket));
    if (target.id === "guide-example") {
      $("#guide-dialog").close();
      $("#ticket-title").focus();
    }
  }
  if (target.dataset.view) setView(target.dataset.view);
  if (target.dataset.answer) answer(target.dataset.answer);
  if (target.dataset.source) {
    const source = state.sources.find(item => item.id === target.dataset.source);
    if (source) {
      setEvidence([source]);
      all(".keyword-item").forEach(item => item.setAttribute("aria-pressed", String(item === target)));
      $("#keyword-steps").innerHTML = '<div class="result"><div class="result-body"><h3>' +
        escape(source.title) + '</h3>' + stepsHtml(source.steps) + '</div></div>';
    }
  }
  if (target.dataset.copyPacket) {
    const packet = state.handoffs.find(item => item.id === target.dataset.copyPacket);
    if (packet) copyText(packetText(packet), "Handoff packet copied.");
  }
  const action = target.dataset.action;
  if (!action) return;
  if (action === "retry") setView(state.view);
  if (action === "handoff") addHandoff(target);
  if (action === "see-handoff") go("handoffs");
  if (action === "copy") {
    const result = caseState().result;
    const source = result.sources[0];
    copyText([result.title, ...result.steps.map((step,index) => (index + 1) + ". " + step), "", source?.url || ""].join("\n"), "Steps and source copied.");
  }
  if (action === "close-case") {
    caseState().complete = true;
    renderResult(caseState().result);
    toast("Marked resolved for this session.");
  }
  if (action === "start-timer") startTimer();
  if (action === "finish-timer") finishTimer();
});
document.addEventListener("submit", async event => {
  if (!["composer","reply-form","keyword-form","source-form","playbook-form"].includes(event.target.id)) return;
  event.preventDefault();
  if (event.target.id === "composer") submitTicket();
  if (event.target.id === "reply-form") answer($("#reply").value);
  if (event.target.id === "keyword-form") searchKeyword($("#keyword-query").value);
  if (event.target.id === "playbook-form") await submitPlaybook(event.target);
  if (event.target.id === "source-form") {
    try {
      const result = await api("/api/library", {query:$("#source-search").value, playbooks:state.playbooks});
      renderSources(result.matches);
    } catch (error) { toast(error.message); }
  }
});
document.addEventListener("change", event => {
  if (event.target.id === "use-model") {
    state.useModel = event.target.checked;
    caseState().result = null;
    analyze();
  }
  if (["eval-method","failures-only"].includes(event.target.id)) renderEvalRows();
});
$("#add-playbook").addEventListener("click", () => {
  $("#playbook-form").reset();
  $("#playbook-dialog").showModal();
});
["#close-playbook", "#cancel-playbook"].forEach(selector =>
  $(selector).addEventListener("click", () => $("#playbook-dialog").close()));
$("#new-ticket").addEventListener("click", newTicket);
$("#open-guide").addEventListener("click", () => $("#guide-dialog").showModal());
$("#close-guide").addEventListener("click", () => $("#guide-dialog").close());
$("#compose-message").addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    $("#composer").requestSubmit();
  }
});
$("#run-eval").addEventListener("click", runEval);
window.addEventListener("hashchange", () => { const page = location.hash.slice(1); if (pageNames[page]) go(page); });
all("[data-icon]").forEach(element => { element.innerHTML = icon(element.dataset.icon); });
async function init() {
  try {
    const data = await api("/api/bootstrap");
    state.sources = (await api("/api/library", {playbooks:state.playbooks})).matches;
    state.tickets = [...state.custom, ...data.tickets];
    state.modelAvailable = data.model_available;
    state.useModel = state.modelAvailable;
    $("#composer-mode").textContent = state.modelAvailable ? "Local LLM ready · fictional tickets only" : "Rules mode · fictional tickets only";
    updateHandoffCount();
    renderTickets();
    renderExamples(data.tickets);
    const page = location.hash.slice(1);
    go(pageNames[page] ? page : "workspace", false);
  } catch (error) { showError(error); }
}
init();
