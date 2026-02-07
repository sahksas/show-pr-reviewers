// Types
interface Reviewer {
  login: string;
  avatarUrl: string;
}

interface ReviewerResponse {
  success: boolean;
  data?: Record<string, Reviewer[]>;
  error?: string;
}

// Constants
const SELECTORS = {
  prRow:
    '[id^="issue_"]:not([data-reviewer-processed]), .js-issue-row:not([data-reviewer-processed])',
  prLink: 'a[id^="issue_"][href*="/pull/"]',
  rightSection: ".flex-shrink-0.col-4.col-md-3.pt-2.text-right",
  columnSpan: ":scope > span.ml-2.flex-1.flex-shrink-0",
  sortSummary: "summary.btn-link",
} as const;

const DATA_ATTR = {
  processed: "data-reviewer-processed",
  column: "data-reviewer-column",
  header: "data-reviewer-header",
  active: "data-reviewer-active",
  visible: "data-visible",
} as const;

// URL parsing
function parseGitHubUrl(): { owner: string; repo: string } | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls?/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

function getPRNumberFromRow(row: Element): number | null {
  const link = row.querySelector(SELECTORS.prLink);
  if (link) {
    const match = link.getAttribute("href")?.match(/\/pull\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  const dataId = row.getAttribute("data-id");
  return dataId ? parseInt(dataId, 10) : null;
}

// Tooltip text builder
function buildTooltipText(names: string[]): string {
  if (names.length === 1) return `Requested reviewer: ${names[0]}`;
  if (names.length === 2)
    return `Requested reviewers: ${names[0]} and ${names[1]}`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return `Requested reviewers: ${rest} and ${last}`;
}

// Create reviewer cell element
function createReviewerCell(reviewers: Reviewer[]): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "ml-2 flex-1 flex-shrink-0";
  wrapper.setAttribute(DATA_ATTR.column, "true");

  const avatarStack = document.createElement("div");
  const countClass =
    reviewers.length >= 3
      ? "AvatarStack--three-plus"
      : reviewers.length === 2
        ? "AvatarStack--two"
        : "";
  avatarStack.className = `AvatarStack AvatarStack--right ${countClass}`.trim();

  const body = document.createElement("div");
  body.className =
    "AvatarStack-body tooltipped tooltipped-sw tooltipped-multiline tooltipped-align-right-1 mt-1";

  if (reviewers.length > 0) {
    body.setAttribute(
      "aria-label",
      buildTooltipText(reviewers.map((r) => r.login))
    );
    const basePath = window.location.pathname.replace(/\/$/, "");

    reviewers.slice(0, 3).forEach((reviewer) => {
      const link = document.createElement("a");
      link.href = `${basePath}/review-requested/${reviewer.login}`;
      link.className = "avatar avatar-user";
      link.setAttribute("aria-label", reviewer.login);

      const img = document.createElement("img");
      img.className = "from-avatar avatar-user";
      img.src = reviewer.avatarUrl;
      img.alt = `@${reviewer.login}`;
      img.width = 20;
      img.height = 20;

      link.appendChild(img);
      body.appendChild(link);
    });
  }

  avatarStack.appendChild(body);
  wrapper.appendChild(avatarStack);
  return wrapper;
}

// Inject header
function injectReviewerHeader(): HTMLElement | null {
  if (document.querySelector(`[${DATA_ATTR.header}="true"]`)) return null;

  const sortSummary = Array.from(
    document.querySelectorAll(SELECTORS.sortSummary)
  ).find((s) => s.textContent?.trim() === "Sort");
  const sortDetails = sortSummary?.closest("details");
  if (!sortDetails?.parentElement) return null;

  const header = document.createElement("span");
  header.className = "color-fg-muted";
  header.setAttribute(DATA_ATTR.header, "true");
  header.textContent = "Reviewers";

  sortDetails.parentElement.insertBefore(header, sortDetails);
  return header;
}

// Inject column into row
function injectReviewerColumn(
  row: Element,
  reviewers: Reviewer[]
): HTMLElement | null {
  if (row.querySelector(`[${DATA_ATTR.column}="true"]`)) return null;

  const rightSection = row.querySelector(SELECTORS.rightSection);
  if (!rightSection) return null;

  const cell = createReviewerCell(reviewers);
  const spans = rightSection.querySelectorAll(SELECTORS.columnSpan);

  if (spans.length >= 2) {
    rightSection.insertBefore(cell, spans[spans.length - 1]);
  } else {
    rightSection.appendChild(cell);
  }
  return cell;
}

// Main injection function
async function injectReviewers(): Promise<void> {
  const repoInfo = parseGitHubUrl();
  if (!repoInfo) return;

  const prRows = document.querySelectorAll(SELECTORS.prRow);
  if (prRows.length === 0) return;

  // Collect PR numbers and mark rows as processed
  const rowMap = new Map<number, Element>();
  prRows.forEach((row) => {
    const prNumber = getPRNumberFromRow(row);
    if (prNumber) {
      rowMap.set(prNumber, row);
      row.setAttribute(DATA_ATTR.processed, "true");
    }
  });

  if (rowMap.size === 0) return;

  // Fetch reviewer data
  const response: ReviewerResponse = await chrome.runtime.sendMessage({
    type: "GET_REVIEWERS",
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    prNumbers: Array.from(rowMap.keys()),
  });

  if (!response.success || !response.data) {
    if (response.error) console.error("[PR Reviewers]", response.error);
    return;
  }

  // Inject header and columns
  const header = injectReviewerHeader();
  const columns: HTMLElement[] = [];

  for (const [prNumber, reviewers] of Object.entries(response.data)) {
    const row = rowMap.get(parseInt(prNumber, 10));
    if (row) {
      const column = injectReviewerColumn(row, reviewers);
      if (column) columns.push(column);
    }
  }

  // Animate: apply width adjustment and fade in
  requestAnimationFrame(() => {
    document.querySelectorAll(SELECTORS.rightSection).forEach((section) => {
      section.setAttribute(DATA_ATTR.active, "true");
    });

    header?.setAttribute(DATA_ATTR.visible, "true");
    columns.forEach((col) => col.setAttribute(DATA_ATTR.visible, "true"));
  });
}

// Handle navigation (turbo events)
function handleNavigation(): void {
  if (window.location.pathname.includes("/pulls")) {
    setTimeout(injectReviewers, 100);
  }
}

// Initialize
function init(): void {
  // Listen for turbo navigation events (GitHub's SPA navigation)
  document.addEventListener("turbo:render", handleNavigation);

  // Also handle initial page load if we're on a /pulls page
  if (window.location.pathname.includes("/pulls")) {
    injectReviewers();
  }

  // Watch for dynamic DOM changes (pagination, filters, etc.)
  new MutationObserver((mutations) => {
    if (!window.location.pathname.includes("/pulls")) return;
    if (mutations.some((m) => m.addedNodes.length > 0)) {
      setTimeout(injectReviewers, 100);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
