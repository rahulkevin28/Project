// AI Workflow Console. Talks only to this engine's own JSON API on the same origin.
// Model output and user text are always inserted as text nodes, never parsed as HTML.

const PROMPT_LIMIT = 20000;
const AGENT_PROMPT_LIMIT = 12000;
const NAME_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const NAME_RULE = "Use 2–64 characters: a lowercase letter first, then lowercase letters, numbers, - or _.";
const VIEWS = ["run", "workflows", "agents"];
// Prompts for the "Try an example" menu. The policy questions check that agents use only the
// facts supplied and say when something isn't stated.
const EXAMPLES = [
  {
    group: "Policy questions (checks agents don't invent details)",
    label: "Return within 30 days",
    prompt: "A customer asks whether they can return a product. The policy allows returns within 30 days of purchase.",
  },
  {
    group: "Policy questions (checks agents don't invent details)",
    label: "Refund on an opened item",
    prompt: "A customer opened a pair of headphones 10 days ago and wants a full refund. Our policy says: unopened items can be returned within 30 days for a full refund. What should we tell them?",
  },
  {
    group: "Policy questions (checks agents don't invent details)",
    label: "Late delivery compensation",
    prompt: "A customer's order arrived 5 working days after they placed it, and they want compensation. Our shipping policy says: standard delivery takes 3–5 working days, and we refund the shipping fee if an order takes more than 7 working days. What can we offer?",
  },
  {
    group: "Policy questions (checks agents don't invent details)",
    label: "Warranty after 14 months",
    prompt: "A customer's laptop stopped charging 14 months after purchase. Our warranty covers parts and labour for 12 months from the date of purchase. Is the repair covered?",
  },
  {
    group: "Policy questions (checks agents don't invent details)",
    label: "Question with no policy given",
    prompt: "A customer wants to cancel their annual subscription halfway through the year and asks if they will get money back. We haven't shared our cancellation policy with you. How should we reply?",
  },
  {
    group: "Writing",
    label: "Support hours email",
    prompt: "Write a short, friendly email telling customers that support hours change to 9am–5pm, Monday to Friday, from 1 December.",
  },
  {
    group: "Writing",
    label: "Outage apology",
    prompt: "Write a short apology to customers for a two-hour website outage on 3 November. Orders placed during the outage were not lost. Do not promise any compensation.",
  },
  {
    group: "Writing",
    label: "Feature announcement",
    prompt: "Write a three-sentence announcement that our mobile app now supports dark mode and lets people view saved lists offline.",
  },
  {
    group: "Summaries and decisions",
    label: "Summarise customer reviews",
    prompt: "Summarise these customer reviews into the top three themes, with one short quote for each:\n1. \"Delivery was fast, but the box was damaged.\"\n2. \"Great quality, slow delivery.\"\n3. \"Customer service fixed my issue in minutes.\"\n4. \"It arrived late and the box was crushed.\"\n5. \"Support were friendly and quick.\"",
  },
  {
    group: "Summaries and decisions",
    label: "Recommend a plan",
    prompt: "A customer asks which plan to choose. Basic costs £5 a month for 1 user with email support. Team costs £20 a month for up to 10 users with chat support. They have 4 users and want faster support. Recommend a plan using only these details.",
  },
];

const TOKEN_KEY = "ai-workflow-engine-token";

const state = {
  token: readToken(),
  agents: [],
  workflows: [],
  tools: [],
  info: null,
  runs: [],
  activeRunId: null,
  running: null,
  timer: null,
  online: null,
  loadFailed: false,
  wantedWorkflow: null,
  editingWorkflow: null,
  editingAgent: null,
  workflowTouched: false,
  agentTouched: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// ---------------------------------------------------------------- DOM helpers

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  appendChildren(node, children);
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function flowIcon() {
  return svgEl("svg", {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8",
    "stroke-linecap": "round", "aria-hidden": "true",
  },
  svgEl("circle", { cx: 6, cy: 12, r: 2.5 }),
  svgEl("circle", { cx: 18, cy: 6, r: 2.5 }),
  svgEl("circle", { cx: 18, cy: 18, r: 2.5 }),
  svgEl("path", { d: "M8.5 12h2.5M12.5 10.6l3.2-3.2M12.5 13.4l3.2 3.2" }));
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const seconds = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
const formatCount = (value, limit) => `${value.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function toast(message, kind = "ok") {
  const item = el("div", { class: `toast toast-${kind}`, role: kind === "danger" ? "alert" : "status" }, message);
  $("#toast-region").append(item);
  setTimeout(() => {
    item.classList.add("leaving");
    setTimeout(() => item.remove(), 250);
  }, kind === "danger" ? 6000 : 3200);
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast("Couldn't copy. Select the text and copy it manually.", "danger");
  }
}

function confirmAction({ title, message, confirmLabel }) {
  const dialog = $("#confirm-dialog");
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-ok").textContent = confirmLabel;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
  });
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.replaceChildren(...(busy ? [el("span", { class: "spinner" }), label] : [label]));
}

function showError(selector, message) {
  const box = $(selector);
  box.textContent = message;
  box.hidden = false;
}

function hideError(selector) {
  $(selector).hidden = true;
}

function renderIssues(selector, issues) {
  $(selector).replaceChildren(...issues.map((issue) => el("li", { text: issue })));
}

// Minimal, safe Markdown: paragraphs, headings, bullet and numbered lists, **bold**, `code`.
function renderInline(text) {
  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const match of text.matchAll(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)) {
    if (match.index > last) fragment.append(text.slice(last, match.index));
    const token = match[0];
    fragment.append(token.startsWith("**")
      ? el("strong", { text: token.slice(2, -2) })
      : el("code", { text: token.slice(1, -1) }));
    last = match.index + token.length;
  }
  if (last < text.length) fragment.append(text.slice(last));
  return fragment;
}

function renderMarkdown(text) {
  const root = el("div", { class: "prose" });
  let list = null;
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    const p = el("p");
    paragraph.forEach((line, index) => {
      if (index) p.append(el("br"));
      p.append(renderInline(line));
    });
    root.append(p);
    paragraph = [];
  };
  for (const raw of String(text).replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (!line.trim()) {
      flush();
      list = null;
    } else if (heading) {
      flush();
      list = null;
      root.append(el(`h${heading[1].length + 2}`, {}, renderInline(heading[2])));
    } else if (bullet || numbered) {
      flush();
      const type = bullet ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== type) {
        list = el(type);
        if (numbered && numbered[1] !== "1") list.start = Number(numbered[1]);
        root.append(list);
      }
      list.append(el("li", {}, renderInline(bullet ? bullet[1] : numbered[2])));
    } else {
      list = null;
      paragraph.push(line.trim());
    }
  }
  flush();
  return root;
}

// ---------------------------------------------------------------- API

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// The engine token (ENGINE_API_TOKEN) is kept in sessionStorage, so it lasts for this tab only.
function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(token) {
  state.token = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the token then lasts until reload.
  }
  $("#forget-token").hidden = !token;
}

let tokenRequest = null;

function askForToken(message) {
  if (tokenRequest) return tokenRequest;
  const dialog = $("#token-dialog");
  const input = $("#token-input");
  $("#token-message").textContent = message;
  input.value = "";
  dialog.returnValue = "";
  dialog.showModal();
  input.focus();
  tokenRequest = new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      tokenRequest = null;
      resolve(dialog.returnValue === "save" ? input.value.trim() : "");
    }, { once: true });
  });
  return tokenRequest;
}

function cleanMessage(text) {
  return String(text).replace(/^(['"])([\s\S]*)\1$/, "$2").replace(/^Value error, /, "");
}

function formatDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return cleanMessage(detail);
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const field = (item.loc || []).filter((part) => part !== "body").join(".");
      const message = cleanMessage(item.msg || "Invalid value");
      return field ? `${field}: ${message}` : message;
    }).join("\n");
  }
  return JSON.stringify(detail);
}

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Can't reach the engine. Check that the server is running.", 0);
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    const token = await askForToken(state.token
      ? "That token wasn't accepted. Check ENGINE_API_TOKEN on the server and try again."
      : "This engine only accepts requests that include its access token.");
    if (token) {
      saveToken(token);
      return api(path, { method, body });
    }
    throw new ApiError("This engine needs its access token. Choose Try again to enter it.", 401, data);
  }
  if (!response.ok) {
    throw new ApiError(formatDetail(data?.detail) || `Request failed (${response.status}).`, response.status, data);
  }
  return data;
}

// ---------------------------------------------------------------- Workflow graph

let graphCount = 0;

function layoutGraph(workflow) {
  const entry = workflow.entry_agent;
  const nodes = [...new Set([entry, ...workflow.edges.flatMap((edge) => [edge.source, edge.target])])]
    .filter(Boolean);
  const next = new Map(nodes.map((node) => [node, []]));
  for (const edge of workflow.edges) next.get(edge.source)?.push(edge.target);

  // Depth-first search marks back edges (cycles) so the rest can be layered left to right.
  const back = new Set();
  const mark = new Map();
  const order = [];
  const visit = (node) => {
    mark.set(node, "open");
    for (const target of [...next.get(node)].sort()) {
      if (mark.get(target) === "open") back.add(`${node}>${target}`);
      else if (!mark.has(target)) visit(target);
    }
    mark.set(node, "done");
    order.push(node);
  };
  if (entry) visit(entry);
  const reachable = new Set(order);
  for (const node of [...nodes].sort()) if (!mark.has(node)) visit(node);

  const depth = new Map(nodes.map((node) => [node, 0]));
  for (const node of [...order].reverse()) {
    for (const target of next.get(node)) {
      if (!back.has(`${node}>${target}`)) depth.set(target, Math.max(depth.get(target), depth.get(node) + 1));
    }
  }
  return { nodes, depth, reachable };
}

function renderGraph(workflow, { visited = [], taken = [], pending = null } = {}) {
  const layout = layoutGraph(workflow);
  if (!layout.nodes.length) {
    return el("p", { class: "graph-empty", text: "Choose a starting agent to see the workflow." });
  }
  const id = `graph-${++graphCount}`;
  const W = 116;
  const H = 40;
  const GAP_X = 44;
  const GAP_Y = 18;
  const PAD = 6;
  // Handoffs that skip a column (or loop back) run as rounded brackets above (or below) the
  // boxes, so each arrowhead lands squarely on its target. Each one gets its own lane.
  const LANE_START = 24;
  const LANE_GAP = 12;
  const CORNER = 8;

  const columns = [];
  for (const node of layout.nodes) (columns[layout.depth.get(node)] ||= []).push(node);
  for (let index = 0; index < columns.length; index += 1) columns[index] ||= [];
  for (const column of columns) {
    column.sort((a, b) => (a === workflow.entry_agent ? -1 : b === workflow.entry_agent ? 1 : a.localeCompare(b)));
  }
  const rows = Math.max(...columns.map((column) => column.length));
  const bodyHeight = rows * H + (rows - 1) * GAP_Y;

  const edges = workflow.edges.filter((edge) => edge.source !== edge.target
    && layout.depth.has(edge.source) && layout.depth.has(edge.target));
  const kindOf = (edge) => {
    const from = layout.depth.get(edge.source);
    const to = layout.depth.get(edge.target);
    if (to === from + 1) return "forward";
    return to > from ? "skip" : "back";
  };
  const span = (edge) => Math.abs(layout.depth.get(edge.target) - layout.depth.get(edge.source));
  const lanes = new Map();
  const laneSpace = (kind) => {
    const routed = edges.filter((edge) => kindOf(edge) === kind).sort((a, b) => span(a) - span(b));
    routed.forEach((edge, index) => lanes.set(`${edge.source}>${edge.target}`, index));
    return routed.length ? LANE_START + (routed.length - 1) * LANE_GAP + 4 : 0;
  };
  const top = PAD + laneSpace("skip");
  const bottomSpace = laneSpace("back");
  const width = PAD * 2 + columns.length * W + (columns.length - 1) * GAP_X;
  const height = top + bodyHeight + PAD + bottomSpace;

  const position = new Map();
  columns.forEach((column, columnIndex) => {
    const columnHeight = column.length * H + (column.length - 1) * GAP_Y;
    column.forEach((node, rowIndex) => position.set(node, {
      x: PAD + columnIndex * (W + GAP_X),
      y: top + (bodyHeight - columnHeight) / 2 + rowIndex * (H + GAP_Y),
    }));
  });

  const takenKeys = new Set(taken);
  const visitedNodes = new Set(visited);
  const marker = (variant) => svgEl("marker", {
    // refX below 10 tucks the tip slightly into the box border so it reads as attached.
    id: `${id}-${variant}`, viewBox: "0 0 10 10", refX: 8, refY: 5,
    markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto",
  }, svgEl("path", { d: "M0,0 L10,5 L0,10 z", class: `arrow ${variant}` }));

  const edgePath = (edge) => {
    const a = position.get(edge.source);
    const b = position.get(edge.target);
    const kind = kindOf(edge);
    if (kind === "forward") {
      const x1 = a.x + W;
      const y1 = a.y + H / 2;
      const x2 = b.x;
      const y2 = b.y + H / 2;
      return `M${x1},${y1} C${x1 + GAP_X / 2},${y1} ${x2 - GAP_X / 2},${y2} ${x2},${y2}`;
    }
    const lane = lanes.get(`${edge.source}>${edge.target}`) ?? 0;
    const offset = LANE_START + lane * LANE_GAP;
    if (kind === "skip") {
      // Up from the source, across, then straight down onto the target's top edge.
      const x1 = a.x + W / 2;
      const x2 = b.x + W / 2;
      const y = Math.min(a.y, b.y) - offset;
      return `M${x1},${a.y} V${y + CORNER} Q${x1},${y} ${x1 + CORNER},${y} `
        + `H${x2 - CORNER} Q${x2},${y} ${x2},${y + CORNER} V${b.y}`;
    }
    // Loop back: down from the source, across below the boxes, then up into the target.
    const x1 = a.x + W / 2;
    const x2 = b.x + W / 2;
    const y = Math.max(a.y, b.y) + H + offset;
    return `M${x1},${a.y + H} V${y - CORNER} Q${x1},${y} ${x1 - CORNER},${y} `
      + `H${x2 + CORNER} Q${x2},${y} ${x2},${y - CORNER} V${b.y + H}`;
  };

  const edgeVariant = (edge) => {
    const key = `${edge.source}>${edge.target}`;
    if (key === pending) return "pending";
    return takenKeys.has(key) ? "active" : "base";
  };
  const rank = { base: 0, active: 1, pending: 2 };
  const edgeNodes = edges
    .map((edge) => ({ edge, variant: edgeVariant(edge) }))
    .sort((a, b) => rank[a.variant] - rank[b.variant])
    .map(({ edge, variant }) => svgEl("path", {
      d: edgePath(edge),
      class: `edge ${variant === "base" ? "" : variant}`.trim(),
      "marker-end": `url(#${id}-${variant})`,
    }, svgEl("title", {}, `${edge.source} can hand off to ${edge.target}`)));

  const nodeShapes = layout.nodes.map((node) => {
    const { x, y } = position.get(node);
    const isEntry = node === workflow.entry_agent;
    const classes = ["node", isEntry && "entry", visitedNodes.has(node) && "visited",
      !layout.reachable.has(node) && "unreachable"].filter(Boolean).join(" ");
    const label = node.length > 13 ? `${node.slice(0, 12)}…` : node;
    return svgEl("g", { class: classes },
      svgEl("title", {}, isEntry ? `${node} (starts the workflow)` : node),
      svgEl("rect", { x, y, width: W, height: H, rx: 10 }),
      isEntry ? svgEl("circle", { cx: x + 15, cy: y + H / 2, r: 4, class: "start-dot" }) : null,
      svgEl("text", {
        x: x + W / 2 + (isEntry ? 6 : 0), y: y + H / 2,
        "text-anchor": "middle", "dominant-baseline": "central",
      }, label));
  });

  const summary = edges.length
    ? edges.map((edge) => `${edge.source} to ${edge.target}`).join(", ")
    : "no handoffs";
  return svgEl("svg", {
    class: "graph", viewBox: `0 0 ${width} ${height}`, width, height, role: "img",
    "aria-label": `Workflow graph. Starts with ${workflow.entry_agent}. Handoffs: ${summary}.`,
  },
  svgEl("defs", {}, marker("base"), marker("active"), marker("pending")),
  edgeNodes, nodeShapes);
}

function runPath(response) {
  const history = response?.history || [];
  const taken = [];
  for (let index = 0; index < history.length - 1; index += 1) {
    if (history[index].handoff_to === history[index + 1].agent) {
      taken.push(`${history[index].agent}>${history[index + 1].agent}`);
    }
  }
  const last = history.at(-1);
  const pending = response?.status === "handoff_limit_reached" && last?.handoff_to
    ? `${last.agent}>${last.handoff_to}` : null;
  return { visited: history.map((step) => step.agent), taken, pending };
}

// ---------------------------------------------------------------- Run view

const selectedWorkflow = () => state.workflows.find((workflow) => workflow.name === $("#run-workflow").value);
const activeRun = () => state.runs.find((run) => run.id === state.activeRunId) || null;

function renderRunForm() {
  const select = $("#run-workflow");
  const wanted = state.wantedWorkflow || select.value || "default";
  state.wantedWorkflow = null;
  if (state.workflows.length) {
    select.replaceChildren(...state.workflows.map((workflow) => el("option", { value: workflow.name, text: workflow.name })));
    select.value = state.workflows.some((workflow) => workflow.name === wanted) ? wanted : state.workflows[0].name;
  } else {
    select.replaceChildren(el("option", { value: "", text: "No workflows yet" }));
  }
  select.disabled = !state.workflows.length;
  updateRunPreview();
}

function updateRunPreview() {
  const workflow = selectedWorkflow();
  const description = $("#run-workflow-desc");
  const legend = $("#graph-legend");
  if (!workflow) {
    description.replaceChildren("No workflows are registered. ", el("a", { href: "#workflows", text: "Create one" }), ".");
    $("#run-graph").replaceChildren(el("p", { class: "graph-empty", text: "The workflow graph appears here." }));
    legend.textContent = "";
  } else {
    description.textContent = `${workflow.description} · up to ${plural(workflow.max_handoffs, "handoff")} per run`;
    const run = activeRun();
    const path = run?.response && run.workflow === workflow.name ? runPath(run.response) : {};
    $("#run-graph").replaceChildren(renderGraph(workflow, path));
    legend.textContent = path.visited
      ? "Highlighted: the agents and handoffs this run used"
      : "Arrows are the handoffs each agent may make";
  }
  setRunButton();
}

function setRunButton() {
  const button = $("#run-button");
  button.replaceChildren(...(state.running ? [el("span", { class: "spinner" }), "Running…"] : ["Run workflow"]));
  button.disabled = Boolean(state.running) || !selectedWorkflow();
}

function renderRunResult() {
  const box = $("#run-result");
  clearInterval(state.timer);
  if (state.running) {
    const elapsed = el("span", { class: "elapsed", text: "0.0s" });
    box.replaceChildren(el("div", { class: "loading" },
      el("span", { class: "spinner spinner-lg", "aria-hidden": "true" }),
      el("h3", { text: `Running ${state.running.workflow}…` }),
      el("p", { class: "muted", text: "Each agent makes its own model call, so this can take a little while." }),
      elapsed));
    state.timer = setInterval(() => {
      if (state.running) elapsed.textContent = seconds(Date.now() - state.running.startedAt);
    }, 200);
    return;
  }
  const run = activeRun();
  if (!run) {
    box.replaceChildren(el("div", { class: "empty" },
      el("div", { class: "empty-icon" }, flowIcon()),
      el("h3", { text: "No runs yet" }),
      el("p", { text: "Pick a workflow, write a prompt, and run it. The answer and every agent's step will appear here." })));
    return;
  }
  box.replaceChildren(run.error ? failedRun(run) : finishedRun(run));
}

function promptDetails(prompt) {
  return el("details", { class: "notes prompt-details" },
    el("summary", { text: "Prompt" }),
    el("pre", { class: "prompt-text", text: prompt }));
}

const ERROR_HINTS = {
  model_auth_failed: "The provider rejected the API key. Check the key in .env, then restart the server.",
  model_request_rejected: "The provider rejected the request. Check that LLM_MODEL is a model your key can use.",
  model_rate_limited: "The provider is limiting requests right now. Wait a moment, then try again.",
  model_timeout: "The model took too long to reply. Try again, or raise MODEL_TIMEOUT_SECONDS.",
  run_timeout: "The whole run took too long. Try again, or raise RUN_TIMEOUT_SECONDS.",
  model_unavailable: "The provider couldn't be reached or is overloaded. Try again shortly.",
  model_error: "The model provider returned an error. Check the server terminal for details.",
  agent_tool_limit: "An agent kept calling tools without answering. Raise its max tool rounds or adjust its instructions.",
  internal_error: "Something went wrong inside the engine. Check the server terminal for details.",
};

function formatCost(value) {
  if (value === null || value === undefined) return null;
  return `$${value < 0.01 ? value.toFixed(4) : value.toFixed(2)}`;
}

function usageParts({ durationMs, tokens, cost, retries }) {
  return [
    durationMs === null || durationMs === undefined ? null : seconds(durationMs),
    tokens ? `${tokens.toLocaleString("en-US")} tokens` : null,
    tokens ? formatCost(cost) : null,
    retries ? plural(retries, "retry", "retries") : null,
  ].filter(Boolean);
}

function retryRun(run) {
  if (!state.workflows.some((workflow) => workflow.name === run.workflow)) {
    toast(`The workflow “${run.workflow}” no longer exists.`, "warn");
    return;
  }
  $("#run-workflow").value = run.workflow;
  const prompt = $("#run-prompt");
  prompt.value = run.prompt;
  prompt.dispatchEvent(new Event("input"));
  updateRunPreview();
  runWorkflow();
}

function errorBanner(run) {
  const error = run.response.error || {};
  const hint = ERROR_HINTS[error.code] || "";
  const reference = [error.code, error.agent ? `agent: ${error.agent}` : null].filter(Boolean).join(" · ");
  return el("div", { class: "banner banner-danger" },
    el("div", { text: error.message || "The run failed." }),
    hint ? el("div", { text: hint }) : null,
    reference ? el("div", { class: "error-code", text: reference }) : null,
    error.retryable ? el("div", { class: "banner-actions" },
      el("button", { type: "button", class: "btn btn-sm", onclick: () => retryRun(run) }, "Try again")) : null);
}

function failedRun(run) {
  const hint = run.errorStatus === 0 ? "Start the server, then try again." : "";
  return el("div", {},
    el("div", { class: "result-head" }, el("div", { class: "result-meta" },
      el("span", { class: "badge badge-danger", text: "Failed" }),
      el("strong", { text: run.workflow }),
      el("span", { text: seconds(run.durationMs) }))),
    el("div", { class: "banner banner-danger" }, run.error, hint ? `\n${hint}` : ""),
    promptDetails(run.prompt));
}

function finishedRun(run) {
  const response = run.response;
  const history = response.history || [];
  const failed = response.status === "failed";
  const limited = response.status === "handoff_limit_reached";
  const workflow = state.workflows.find((item) => item.name === response.workflow);
  const answer = (response.result || "").trim();
  const last = history.at(-1);
  const allowed = workflow?.max_handoffs ?? response.handoffs;
  const allowance = allowed === 0
    ? "this workflow doesn't allow any handoffs. "
    : `this workflow allows only ${plural(allowed, "handoff")} per run. `;
  const [badgeClass, badgeText] = failed ? ["badge-danger", "Failed"]
    : limited ? ["badge-warn", "Stopped at handoff limit"] : ["badge-ok", "Completed"];
  const meta = usageParts({
    durationMs: response.duration_ms ?? run.durationMs,
    tokens: response.usage?.total_tokens,
    cost: response.estimated_cost_usd,
    retries: response.usage?.retries,
  });

  return el("div", {},
    el("div", { class: "result-head" },
      el("div", { class: "result-meta" },
        el("span", { class: `badge ${badgeClass}`, text: badgeText }),
        el("strong", { text: response.workflow }),
        failed ? null : el("span", { text: plural(response.handoffs, "handoff") }),
        meta.map((part) => el("span", { text: part }))),
      answer ? el("button", { type: "button", class: "btn btn-sm", onclick: () => copy(answer, "Answer copied.") }, "Copy answer") : null),
    failed ? errorBanner(run) : null,
    limited && last ? el("div", { class: "banner banner-warn" },
      `${last.agent} asked to hand off to ${last.handoff_to}, but ${allowance}`
      + "Raise “Max handoffs” on the workflow to let it finish.") : null,
    failed ? null : [
      el("h3", { class: "section-label", text: "Answer" }),
      el("div", { class: "answer" }, answer
        ? renderMarkdown(answer)
        : el("p", { class: "answer-empty", text: "No answer text. Check the steps below." })),
    ],
    promptDetails(run.prompt),
    history.length ? [
      el("h3", { class: "section-label", text: `Steps (${history.length})` }),
      el("ol", { class: "timeline" }, history.map((step, index) => stepItem(step, index, history.length, limited))),
    ] : null,
    el("div", { class: "run-id" }, "Run ID", el("code", { text: response.run_id }),
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => copy(response.run_id, "Run ID copied.") }, "Copy")));
}

function stepAction(step, pending) {
  if (step.status === "failed") return el("span", { class: "step-action", text: "failed" });
  if (step.status === "cancelled") return el("span", { class: "step-action", text: "was stopped when the run timed out" });
  if (step.handoff_to) {
    return el("span", { class: "step-action" }, pending ? "wanted to hand off to " : "handed off to ",
      el("strong", { text: step.handoff_to }));
  }
  return el("span", { class: "step-action", text: "wrote the answer" });
}

function stepItem(step, index, total, limited) {
  const isLast = index === total - 1;
  const ended = step.status === "failed" || step.status === "cancelled";
  const pending = isLast && limited && step.handoff_to;
  const text = (step.result || "").trim();
  const classes = ["step", step.status === "failed" && "step-failed",
    step.status === "cancelled" && "step-cancelled", !ended && !step.handoff_to && "step-final",
    pending && "step-pending"].filter(Boolean).join(" ");
  const meta = usageParts({
    durationMs: step.duration_ms,
    tokens: step.usage?.total_tokens,
    cost: step.estimated_cost_usd,
    retries: step.retries,
  });
  const toolCalls = step.tool_calls || [];
  return el("li", { class: classes },
    el("span", { class: "step-marker", text: String(index + 1) }),
    el("div", {},
      el("div", { class: "step-head" }, el("span", { class: "agent-name", text: step.agent }), stepAction(step, pending)),
      meta.length ? el("div", { class: "step-meta" }, meta.map((part) => el("span", { text: part }))) : null,
      toolCalls.length ? el("div", { class: "tool-chips" }, toolCalls.map((call) => el("span", {
        class: `tool-chip ${call.status}`,
        title: call.error || `${call.name} finished in ${seconds(call.duration_ms || 0)}`,
        text: call.status === "ok" ? call.name : `${call.name} · ${call.status}`,
      }))) : null,
      text && step.handoff_to ? el("div", { class: "step-text" }, renderMarkdown(text)) : null,
      step.handoff_context ? el("details", { class: "notes" },
        el("summary", { text: `Notes for ${step.handoff_to}` }),
        renderMarkdown(step.handoff_context)) : null));
}

function renderRecent() {
  $("#recent-runs").hidden = state.runs.length < 2;
  $("#recent-list").replaceChildren(...state.runs.map((run) => {
    const status = run.error || run.response.status === "failed" ? "danger"
      : run.response.status === "completed" ? "ok" : "warn";
    const label = { ok: "Completed", warn: "Stopped at handoff limit", danger: "Failed" }[status];
    return el("li", {}, el("button", {
      type: "button", class: "recent-item", "aria-current": String(run.id === state.activeRunId),
      title: label, onclick: () => showRun(run.id),
    },
    el("span", { class: `status-dot ${status}`, "aria-label": label, role: "img" }),
    el("span", { class: "recent-text" }, el("strong", { text: run.workflow }), run.prompt),
    el("span", { class: "recent-time", text: new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })));
  }));
}

function showRun(id) {
  state.activeRunId = id;
  const run = activeRun();
  if (run && state.workflows.some((workflow) => workflow.name === run.workflow)) $("#run-workflow").value = run.workflow;
  renderRunResult();
  renderRecent();
  updateRunPreview();
}

async function runWorkflow(event) {
  event?.preventDefault();
  if (state.running) return;
  const workflow = selectedWorkflow();
  const promptBox = $("#run-prompt");
  const prompt = promptBox.value.trim();
  if (!workflow) {
    toast("Create a workflow first.", "warn");
    return;
  }
  if (!prompt) {
    promptBox.focus();
    toast("Write a prompt first.", "warn");
    return;
  }
  const run = { id: newId(), workflow: workflow.name, prompt, startedAt: Date.now() };
  state.running = { workflow: workflow.name, startedAt: run.startedAt };
  setRunButton();
  renderRunResult();
  if (window.matchMedia("(max-width: 920px)").matches) {
    $("#run-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  try {
    run.response = await api(`/workflows/${encodeURIComponent(workflow.name)}/execute`, {
      method: "POST", body: { prompt },
    });
  } catch (error) {
    if (error.data?.run_id) {
      // Failed runs still return their run record, with an error code and the steps that ran.
      run.response = error.data;
    } else {
      run.error = error.message;
      run.errorStatus = error.status;
    }
  }
  run.durationMs = Date.now() - run.startedAt;
  state.running = null;
  clearInterval(state.timer);
  state.runs = [run, ...state.runs].slice(0, 12);
  state.activeRunId = run.id;
  renderRunResult();
  renderRecent();
  updateRunPreview();
}

// ---------------------------------------------------------------- Workflows view

function usageByAgent() {
  const usage = new Map(state.agents.map((agent) => [agent.name, []]));
  for (const workflow of state.workflows) {
    const names = new Set([workflow.entry_agent, ...workflow.edges.flatMap((edge) => [edge.source, edge.target])]);
    for (const name of names) usage.get(name)?.push(workflow.name);
  }
  return usage;
}

const metaItem = (label, value) => el("div", {}, el("dt", { text: label }), el("dd", { text: String(value) }));

function emptyCard(title, text, actionLabel, onAction) {
  return el("div", { class: "card empty-card" }, el("div", { class: "empty" },
    el("div", { class: "empty-icon" }, flowIcon()),
    el("h3", { text: title }),
    el("p", { text }),
    el("button", { type: "button", class: "btn btn-primary", onclick: onAction }, actionLabel)));
}

function renderWorkflows() {
  const list = $("#workflow-list");
  if (!state.workflows.length) {
    list.replaceChildren(emptyCard("No workflows yet",
      "A workflow connects agents with the handoffs they're allowed to make.",
      "New workflow", () => openWorkflowEditor()));
    return;
  }
  list.replaceChildren(...state.workflows.map((workflow) => el("article", { class: "card entity-card" },
    el("div", { class: "entity-head" },
      el("h3", { class: "card-title", text: workflow.name }),
      el("p", { class: "muted", text: workflow.description })),
    el("div", { class: "graph-box" }, renderGraph(workflow)),
    el("dl", { class: "meta" },
      metaItem("Starts with", workflow.entry_agent),
      metaItem("Handoffs allowed", workflow.edges.length),
      metaItem("Max per run", workflow.max_handoffs)),
    el("div", { class: "card-actions" },
      el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: () => goRun(workflow.name) }, "Run"),
      el("button", { type: "button", class: "btn btn-sm", onclick: () => openWorkflowEditor(workflow) }, "Edit"),
      el("button", { type: "button", class: "btn btn-ghost btn-sm btn-danger-text", onclick: () => deleteWorkflow(workflow) }, "Delete")))));
}

function goRun(name) {
  showView("run");
  $("#run-workflow").value = name;
  updateRunPreview();
  $("#run-prompt").focus();
}

const agentOptions = (selected) => state.agents.map((agent) => el("option", {
  value: agent.name, text: agent.name, selected: agent.name === selected,
}));

function openWorkflowEditor(workflow = null) {
  if (!state.agents.length) {
    toast("Create an agent first. Workflows connect existing agents.", "warn");
    showView("agents");
    return;
  }
  state.editingWorkflow = workflow;
  state.workflowTouched = false;
  $("#workflow-dialog-title").textContent = workflow ? `Edit ${workflow.name}` : "New workflow";
  const name = $("#wf-name");
  name.value = workflow?.name ?? "";
  name.disabled = Boolean(workflow);
  $("#wf-name-hint").textContent = workflow ? "Workflow names can't be changed." : `${NAME_RULE} It can't be changed later.`;
  $("#wf-description").value = workflow?.description ?? "";
  $("#wf-entry").replaceChildren(...agentOptions(workflow?.entry_agent ?? state.agents[0].name));
  $("#wf-max").value = workflow?.max_handoffs ?? 4;
  const [first, second] = state.agents.map((agent) => agent.name);
  const edges = workflow ? workflow.edges : second ? [{ source: first, target: second }] : [];
  $("#wf-edges").replaceChildren(...edges.map(edgeRow));
  hideError("#wf-error");
  updateWorkflowPreview();
  $("#workflow-dialog").showModal();
  (workflow ? $("#wf-description") : name).focus();
}

function edgeRow(edge) {
  const source = el("select", { class: "edge-source", "aria-label": "From agent" }, agentOptions(edge.source));
  const target = el("select", { class: "edge-target", "aria-label": "To agent" }, agentOptions(edge.target));
  const row = el("div", { class: "edge-row" },
    source,
    el("span", { class: "edge-arrow", "aria-hidden": "true", text: "→" }),
    target,
    el("button", {
      type: "button", class: "icon-btn", "aria-label": "Remove this handoff", title: "Remove",
      onclick: () => {
        row.remove();
        updateWorkflowPreview();
      },
    }, "×"));
  source.addEventListener("change", updateWorkflowPreview);
  target.addEventListener("change", updateWorkflowPreview);
  return row;
}

function addEdge() {
  const existing = readEdges();
  const names = state.agents.map((agent) => agent.name);
  const source = existing.at(-1)?.target ?? $("#wf-entry").value;
  const used = new Set(existing.map((edge) => `${edge.source}>${edge.target}`));
  const target = names.find((name) => name !== source && !used.has(`${source}>${name}`))
    ?? names.find((name) => name !== source) ?? source;
  const row = edgeRow({ source, target });
  $("#wf-edges").append(row);
  updateWorkflowPreview();
  $("select", row).focus();
}

function readEdges() {
  return $$("#wf-edges .edge-row").map((row) => ({
    source: $(".edge-source", row).value,
    target: $(".edge-target", row).value,
  }));
}

function readWorkflowForm() {
  const max = $("#wf-max").value;
  return {
    name: $("#wf-name").value.trim(),
    description: $("#wf-description").value.trim(),
    entry_agent: $("#wf-entry").value,
    max_handoffs: max === "" ? Number.NaN : Number(max),
    edges: readEdges(),
  };
}

function unreachableAgents(draft) {
  const reached = new Set([draft.entry_agent]);
  const queue = [draft.entry_agent];
  while (queue.length) {
    const node = queue.shift();
    for (const edge of draft.edges) {
      if (edge.source === node && !reached.has(edge.target)) {
        reached.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  const named = new Set(draft.edges.flatMap((edge) => [edge.source, edge.target]));
  return [...named].filter((name) => !reached.has(name)).sort();
}

function nameIssues(name, existing, kind, requireFilled) {
  if (!name) return requireFilled ? ["Add a name."] : [];
  if (!NAME_PATTERN.test(name)) return [`Name: ${NAME_RULE}`];
  if (existing.some((item) => item.name === name)) return [`There is already ${kind} called “${name}”.`];
  return [];
}

function workflowIssues(draft, requireFilled) {
  const issues = state.editingWorkflow ? [] : nameIssues(draft.name, state.workflows, "a workflow", requireFilled);
  if (!draft.description && requireFilled) issues.push("Add a short description.");
  if (!Number.isInteger(draft.max_handoffs) || draft.max_handoffs < 0 || draft.max_handoffs > 32) {
    issues.push("Max handoffs must be a whole number from 0 to 32.");
  }
  const seen = new Set();
  for (const edge of draft.edges) {
    const key = `${edge.source}>${edge.target}`;
    if (edge.source === edge.target) issues.push(`${edge.source} can't hand off to itself.`);
    else if (seen.has(key)) issues.push(`${edge.source} → ${edge.target} is listed twice.`);
    seen.add(key);
  }
  const unreachable = unreachableAgents(draft);
  if (unreachable.length) {
    issues.push(`${unreachable.join(", ")} can't be reached from ${draft.entry_agent}. `
      + `Add a handoff that leads there, or remove ${unreachable.length === 1 ? "it" : "them"}.`);
  }
  return [...new Set(issues)];
}

function updateWorkflowPreview() {
  const draft = readWorkflowForm();
  $("#wf-preview").replaceChildren(renderGraph(draft));
  renderIssues("#wf-issues", workflowIssues(draft, state.workflowTouched));
}

async function saveWorkflow(event) {
  event.preventDefault();
  state.workflowTouched = true;
  const draft = readWorkflowForm();
  const issues = workflowIssues(draft, true);
  renderIssues("#wf-issues", issues);
  if (issues.length) {
    $("#wf-issues").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  hideError("#wf-error");
  const button = $("#wf-save");
  setBusy(button, true, "Saving…");
  try {
    if (state.editingWorkflow) {
      await api(`/workflows/${encodeURIComponent(state.editingWorkflow.name)}`, { method: "PUT", body: draft });
    } else {
      await api("/workflows", { method: "POST", body: draft });
    }
    $("#workflow-dialog").close();
    toast(`Saved workflow “${draft.name}”.`);
    await loadData();
  } catch (error) {
    showError("#wf-error", error.message);
  } finally {
    setBusy(button, false, "Save workflow");
  }
}

async function deleteWorkflow(workflow) {
  const confirmed = await confirmAction({
    title: `Delete “${workflow.name}”?`,
    message: workflow.name === "default"
      ? "The built-in default workflow comes back the next time the server starts."
      : "It is removed from the running server and can't be restored.",
    confirmLabel: "Delete workflow",
  });
  if (!confirmed) return;
  try {
    await api(`/workflows/${encodeURIComponent(workflow.name)}`, { method: "DELETE" });
    toast(`Deleted workflow “${workflow.name}”.`);
    await loadData();
  } catch (error) {
    toast(error.message, "danger");
  }
}

// ---------------------------------------------------------------- Agents view

function renderAgents() {
  const list = $("#agent-list");
  if (!state.agents.length) {
    list.replaceChildren(emptyCard("No agents yet",
      "Agents are the specialists that a workflow passes work between.",
      "New agent", () => openAgentEditor()));
    return;
  }
  const usage = usageByAgent();
  list.replaceChildren(...state.agents.map((agent) => {
    const usedBy = usage.get(agent.name) || [];
    const tags = (items) => el("div", { class: "tag-list" }, items.map((item) => el("span", { class: "tag", text: item })));
    return el("article", { class: "card entity-card" },
      el("div", { class: "entity-head" },
        el("h3", { class: "card-title", text: agent.name }),
        el("p", { class: "muted", text: agent.description })),
      el("div", { class: "agent-rows" },
        el("div", { class: "agent-row" }, el("span", { class: "hint", text: "Tools" }),
          agent.tools.length ? tags(agent.tools) : el("span", { class: "hint", text: "None approved" })),
        el("div", { class: "agent-row" }, el("span", { class: "hint", text: "Used in" }),
          usedBy.length ? tags(usedBy) : el("span", { class: "hint", text: "No workflows" }))),
      el("div", { class: "card-actions" },
        el("button", { type: "button", class: "btn btn-sm", onclick: () => openAgentEditor(agent.name) }, "Edit"),
        el("button", {
          type: "button", class: "btn btn-ghost btn-sm btn-danger-text", disabled: usedBy.length > 0,
          onclick: () => deleteAgent(agent),
        }, "Delete"),
        usedBy.length ? el("span", { class: "hint", text: "Can't delete while in use" }) : null));
  }));
}

async function openAgentEditor(name = null) {
  let agent = null;
  if (name) {
    try {
      agent = await api(`/agents/${encodeURIComponent(name)}`);
    } catch (error) {
      toast(error.message, "danger");
      return;
    }
  }
  state.editingAgent = agent;
  state.agentTouched = false;
  $("#agent-dialog-title").textContent = agent ? `Edit ${agent.name}` : "New agent";
  const nameInput = $("#ag-name");
  nameInput.value = agent?.name ?? "";
  nameInput.disabled = Boolean(agent);
  $("#ag-name-hint").textContent = agent ? "Agent names can't be changed." : `${NAME_RULE} It can't be changed later.`;
  $("#ag-description").value = agent?.description ?? "";
  $("#ag-prompt").value = agent?.system_prompt ?? "";
  $("#ag-rounds").value = agent?.max_tool_rounds ?? 5;
  $("#ag-grounding").textContent = state.info?.grounding_rules
    ?? "The engine adds its grounding rules to every agent's instructions.";
  if (state.tools.length) {
    $("#ag-tools").replaceChildren(...state.tools.map((tool) => el("label", { class: "check" },
      el("input", { type: "checkbox", value: tool, checked: Boolean(agent?.tools.includes(tool)) }),
      el("span", { text: tool }))));
  } else {
    $("#ag-tools").replaceChildren(el("p", {
      class: "hint",
      text: "No tools are registered in this service yet. Tools are added in code with ToolRegistry and then appear here.",
    }));
  }
  hideError("#ag-error");
  updateAgentForm();
  $("#agent-dialog").showModal();
  (agent ? $("#ag-description") : nameInput).focus();
}

function readAgentForm() {
  const rounds = $("#ag-rounds").value;
  return {
    name: $("#ag-name").value.trim(),
    description: $("#ag-description").value.trim(),
    system_prompt: $("#ag-prompt").value.trim(),
    tool_names: $$("#ag-tools input:checked").map((input) => input.value),
    max_tool_rounds: rounds === "" ? Number.NaN : Number(rounds),
  };
}

function agentIssues(draft, requireFilled) {
  const issues = state.editingAgent ? [] : nameIssues(draft.name, state.agents, "an agent", requireFilled);
  if (!draft.description && requireFilled) issues.push("Add a short description.");
  if (!draft.system_prompt && requireFilled) issues.push("Write the agent's instructions.");
  if (!Number.isInteger(draft.max_tool_rounds) || draft.max_tool_rounds < 0 || draft.max_tool_rounds > 10) {
    issues.push("Max tool rounds must be a whole number from 0 to 10.");
  }
  return issues;
}

function updateAgentForm() {
  $("#ag-prompt-count").textContent = formatCount($("#ag-prompt").value.length, AGENT_PROMPT_LIMIT);
  renderIssues("#ag-issues", agentIssues(readAgentForm(), state.agentTouched));
}

async function saveAgent(event) {
  event.preventDefault();
  state.agentTouched = true;
  const draft = readAgentForm();
  const issues = agentIssues(draft, true);
  renderIssues("#ag-issues", issues);
  if (issues.length) {
    $("#ag-issues").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  hideError("#ag-error");
  const button = $("#ag-save");
  setBusy(button, true, "Saving…");
  try {
    if (state.editingAgent) {
      await api(`/agents/${encodeURIComponent(state.editingAgent.name)}`, { method: "PUT", body: draft });
    } else {
      await api("/agents", { method: "POST", body: draft });
    }
    $("#agent-dialog").close();
    toast(`Saved agent “${draft.name}”.`);
    await loadData();
  } catch (error) {
    showError("#ag-error", error.message);
  } finally {
    setBusy(button, false, "Save agent");
  }
}

async function deleteAgent(agent) {
  const confirmed = await confirmAction({
    title: `Delete “${agent.name}”?`,
    message: ["planner", "researcher", "writer"].includes(agent.name)
      ? "This built-in agent comes back the next time the server starts."
      : "It is removed from the running server and can't be restored.",
    confirmLabel: "Delete agent",
  });
  if (!confirmed) return;
  try {
    await api(`/agents/${encodeURIComponent(agent.name)}`, { method: "DELETE" });
    toast(`Deleted agent “${agent.name}”.`);
    await loadData();
  } catch (error) {
    toast(error.message, "danger");
  }
}

// ---------------------------------------------------------------- Shell

function showView(name) {
  const view = VIEWS.includes(name) ? name : "run";
  for (const item of VIEWS) {
    $(`#view-${item}`).hidden = item !== view;
    const tab = $(`#tab-${item}`);
    tab.setAttribute("aria-selected", String(item === view));
    tab.tabIndex = item === view ? 0 : -1;
  }
  if (location.hash.slice(1) !== view) history.replaceState(null, "", `#${view}`);
}

async function refreshHealth() {
  let online = false;
  try {
    online = (await fetch("/health", { cache: "no-store" })).ok;
  } catch {
    online = false;
  }
  const pill = $("#health-pill");
  pill.dataset.state = online ? "ok" : "down";
  $(".pill-label", pill).textContent = online ? "Engine online" : "Engine offline";
  if (online && state.online === false && state.loadFailed) loadData();
  if (online && !state.info) loadInfo();
  state.online = online;
}

async function loadInfo() {
  try {
    state.info = await api("/info");
  } catch {
    return;
  }
  const label = [state.info.provider, state.info.model].filter(Boolean).join(" · ");
  const pill = $("#model-pill");
  pill.textContent = label;
  pill.hidden = !label;
}

async function loadData() {
  try {
    const [agents, workflows, tools] = await Promise.all([api("/agents"), api("/workflows"), api("/tools")]);
    Object.assign(state, { agents, workflows, tools, loadFailed: false });
    $("#load-error").hidden = true;
  } catch (error) {
    state.loadFailed = true;
    $("#load-error-text").textContent = `Couldn't load agents and workflows. ${error.message}`;
    $("#load-error").hidden = false;
  }
  renderAll();
}

function renderAll() {
  $("#count-workflows").textContent = state.workflows.length || "";
  $("#count-agents").textContent = state.agents.length || "";
  renderRunForm();
  renderRunResult();
  renderRecent();
  renderWorkflows();
  renderAgents();
}

function init() {
  for (const tab of $$(".tab")) tab.addEventListener("click", () => showView(tab.dataset.view));
  $(".tabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const current = VIEWS.findIndex((view) => $(`#tab-${view}`).getAttribute("aria-selected") === "true");
    const step = event.key === "ArrowRight" ? 1 : -1;
    const index = event.key === "Home" ? 0
      : event.key === "End" ? VIEWS.length - 1
        : (current + step + VIEWS.length) % VIEWS.length;
    showView(VIEWS[index]);
    $(`#tab-${VIEWS[index]}`).focus();
    event.preventDefault();
  });
  window.addEventListener("hashchange", () => showView(location.hash.slice(1)));

  const prompt = $("#run-prompt");
  const updatePromptCount = () => {
    $("#prompt-count").textContent = formatCount(prompt.value.length, PROMPT_LIMIT);
  };
  $("#run-form").addEventListener("submit", runWorkflow);
  $("#run-workflow").addEventListener("change", updateRunPreview);
  prompt.addEventListener("input", updatePromptCount);
  prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) runWorkflow(event);
  });
  const exampleMenu = $("#run-example");
  const groups = new Map();
  EXAMPLES.forEach((example, index) => {
    if (!groups.has(example.group)) {
      groups.set(example.group, el("optgroup", { label: example.group }));
      exampleMenu.append(groups.get(example.group));
    }
    groups.get(example.group).append(el("option", { value: String(index), text: example.label }));
  });
  exampleMenu.firstElementChild.textContent = `Choose one of ${EXAMPLES.length} examples…`;
  exampleMenu.addEventListener("change", () => {
    const example = EXAMPLES[Number(exampleMenu.value)];
    exampleMenu.value = "";
    if (!example) return;
    prompt.value = example.prompt;
    updatePromptCount();
    prompt.focus();
  });

  $("#new-workflow").addEventListener("click", () => openWorkflowEditor());
  $("#workflow-form").addEventListener("submit", saveWorkflow);
  $("#wf-add-edge").addEventListener("click", addEdge);
  for (const id of ["#wf-name", "#wf-description", "#wf-max"]) $(id).addEventListener("input", updateWorkflowPreview);
  $("#wf-entry").addEventListener("change", updateWorkflowPreview);

  $("#new-agent").addEventListener("click", () => openAgentEditor());
  $("#agent-form").addEventListener("submit", saveAgent);
  $("#agent-form").addEventListener("input", updateAgentForm);

  for (const button of $$("[data-close]")) {
    button.addEventListener("click", () => button.closest("dialog").close());
  }
  $("#load-retry").addEventListener("click", loadData);
  $("#forget-token").addEventListener("click", () => {
    saveToken("");
    toast("Token removed from this tab.");
  });
  saveToken(state.token);

  showView(location.hash.slice(1));
  updatePromptCount();
  renderAll();
  loadInfo();
  loadData();
  refreshHealth();
  setInterval(refreshHealth, 15000);
}

init();
