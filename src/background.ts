// Types
interface Reviewer {
  login: string;
  avatarUrl: string;
}

interface CacheEntry {
  timestamp: number;
  data: Record<string, Reviewer[]>;
}

interface ReviewerRequest {
  type: "GET_REVIEWERS";
  owner: string;
  repo: string;
  prNumbers: number[];
}

interface ReviewerResponse {
  success: boolean;
  data?: Record<string, Reviewer[]>;
  error?: string;
  fromCache?: boolean;
}

// Constants
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

// Generate cache key
function getCacheKey(owner: string, repo: string): string {
  return `reviewers:${owner}/${repo}`;
}

// Get cached data
async function getCachedData(
  owner: string,
  repo: string
): Promise<CacheEntry | null> {
  const key = getCacheKey(owner, repo);
  const result = await chrome.storage.local.get(key);
  const entry = result[key];
  if (
    entry &&
    typeof entry === "object" &&
    "timestamp" in entry &&
    "data" in entry
  ) {
    return entry as CacheEntry;
  }
  return null;
}

// Set cached data
async function setCachedData(
  owner: string,
  repo: string,
  data: Record<string, Reviewer[]>
): Promise<void> {
  const key = getCacheKey(owner, repo);
  const entry: CacheEntry = {
    timestamp: Date.now(),
    data,
  };
  await chrome.storage.local.set({ [key]: entry });
}

// Check if cache is stale
function isCacheStale(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

// Get GitHub token from storage
async function getGitHubToken(): Promise<string | null> {
  const result = await chrome.storage.sync.get("githubToken");
  const token = result.githubToken;
  if (typeof token === "string" && token.length > 0) {
    return token;
  }
  return null;
}

// Build GraphQL query for fetching reviewers
function buildGraphQLQuery(prNumbers: number[]): string {
  const prQueries = prNumbers
    .map(
      (num, index) => `
    pr${index}: pullRequest(number: ${num}) {
      number
      reviewRequests(first: 10) {
        nodes {
          requestedReviewer {
            ... on User {
              login
              avatarUrl
            }
          }
        }
      }
    }
  `
    )
    .join("\n");

  return `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        ${prQueries}
      }
    }
  `;
}

// Fetch reviewers from GitHub GraphQL API
async function fetchReviewersFromAPI(
  owner: string,
  repo: string,
  prNumbers: number[]
): Promise<Record<string, Reviewer[]>> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("GitHub token not configured");
  }

  const query = buildGraphQLQuery(prNumbers);
  const variables = { owner, repo };

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL error: ${json.errors[0].message}`);
  }

  // Parse response into our format
  const result: Record<string, Reviewer[]> = {};
  const repoData = json.data?.repository;

  if (repoData) {
    prNumbers.forEach((num, index) => {
      const prData = repoData[`pr${index}`];
      if (prData) {
        const reviewers: Reviewer[] = [];
        prData.reviewRequests?.nodes?.forEach(
          (node: {
            requestedReviewer?: { login?: string; avatarUrl?: string };
          }) => {
            const reviewer = node.requestedReviewer;
            if (reviewer && reviewer.login) {
              reviewers.push({
                login: reviewer.login,
                avatarUrl: reviewer.avatarUrl || "",
              });
            }
          }
        );
        result[String(num)] = reviewers;
      }
    });
  }

  return result;
}

// Main handler for getting reviewers (implements Stale-While-Revalidate)
async function getReviewers(
  owner: string,
  repo: string,
  prNumbers: number[]
): Promise<ReviewerResponse> {
  // Try to get cached data first
  const cachedEntry = await getCachedData(owner, repo);

  if (cachedEntry) {
    // Filter cached data to only include requested PR numbers
    const filteredCache: Record<string, Reviewer[]> = {};
    let hasAllData = true;

    for (const num of prNumbers) {
      const key = String(num);
      if (cachedEntry.data[key]) {
        filteredCache[key] = cachedEntry.data[key];
      } else {
        hasAllData = false;
      }
    }

    if (hasAllData && !isCacheStale(cachedEntry)) {
      // Cache is fresh and has all data
      return { success: true, data: filteredCache, fromCache: true };
    }

    // Stale-While-Revalidate: Return stale data immediately, then update in background
    if (hasAllData) {
      // Fire off background update (don't await)
      fetchReviewersFromAPI(owner, repo, prNumbers)
        .then(async (newData) => {
          // Merge with existing cache
          const merged = { ...cachedEntry.data, ...newData };
          await setCachedData(owner, repo, merged);
        })
        .catch(console.error);

      return { success: true, data: filteredCache, fromCache: true };
    }
  }

  // No cache or missing data - fetch from API
  try {
    const data = await fetchReviewersFromAPI(owner, repo, prNumbers);

    // Update cache with new data (merge with existing)
    const existingData = cachedEntry?.data || {};
    await setCachedData(owner, repo, { ...existingData, ...data });

    return { success: true, data, fromCache: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Message listener
chrome.runtime.onMessage.addListener(
  (message: ReviewerRequest, _sender, sendResponse) => {
    if (message.type === "GET_REVIEWERS") {
      getReviewers(message.owner, message.repo, message.prNumbers)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });
      return true; // Indicates we will send a response asynchronously
    }
  }
);
