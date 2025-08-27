/* ===== 0) Config — MUST be at the top ===== */
const GITHUB_TOKEN = ""; // אופציונלי: הדביקי PAT אם את נתקעת ב-rate limit
const baseHeaders = GITHUB_TOKEN
  ? { Authorization: `Bearer ${GITHUB_TOKEN}` }
  : {};

const USE_TOPICS = true; // לבחור פרויקטים לפי topics
const TOPIC_KEYS = ["portfolio", "featured"]; // אילו topics יופיעו
const GITHUB_ALLOWLIST = []; // [אופציונלי] שמות ריפו מסוימים בלבד

/* ===== 1) Helpers ===== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ===== 2) UI niceties ===== */
$$(".nav-link").forEach((a) => {
  a.addEventListener("click", (e) => {
    const href = a.getAttribute("href");
    if (href?.startsWith("#")) {
      e.preventDefault();
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
  });
});
const y = $("#year");
if (y) y.textContent = new Date().getFullYear();

/* ===== 3) Featured (Images + Link) – ערכי נתיבים/קישורים שלך ===== */
const FEATURED = [
  {
    title: "Bingo Game",
    img: "./assets/Bingo.png",
    url: "https://adimarciano.github.io/bingo/", // ← הוחלף USERNAME
  },
  {
    title: "Vintage store",
    img: "./assets/vintage.png",
    url: "https://vintage-story-2025.netlify.app/", // live demo ב-Netlify
  },
  {
    title: "Banner Editor",
    // אם אין את הקובץ הבא ב-assets, החליפי לתמונה קיימת או הסירי את הכרטיס
    img: "/assets/bannerist.jpeg",
    url: "https://adimarciano.github.io/banner-editor/", // ← הוחלף USERNAME
  },
];
renderFeatured(FEATURED);
function renderFeatured(items) {
  const grid = $("#featured-grid");
  if (!grid) return;
  grid.innerHTML = items
    .map(
      (it) => `
    <article class="featured__card">
      <a href="${it.url}" target="_blank" rel="noreferrer">
        <img class="featured__thumb" src="${it.img}" alt="${escapeHTML(
          it.title
        )} screenshot">
      </a>
      <h3 class="featured__caption">
        <a href="${it.url}" target="_blank" rel="noreferrer">${escapeHTML(
          it.title
        )}</a>
      </h3>
    </article>
  `
    )
    .join("");
}

/* ===== 4) GitHub projects (API) ===== */
const container = $("#github-projects");
if (container) {
  const USER = (container.dataset.username || "").trim();
  if (!USER || USER === "YOUR_GITHUB_USERNAME") {
    container.innerHTML = `<div class="projects__loading">Set your GitHub username in <code>data-username</code> on the <b>#github-projects</b> element.</div>`;
  } else {
    loadGitHub(USER); // <-- baseHeaders כבר מוגדר למעלה
  }
}

async function loadGitHub(user) {
  try {
    // רשימת ריפו
    const res = await fetch(
      `https://api.github.com/users/${user}/repos?per_page=100&sort=updated`,
      {
        headers: { ...baseHeaders, Accept: "application/vnd.github+json" },
      }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const repos = await res.json();

    // בחירה: Allowlist > Topics > ברירת מחדל
    let selection;
    if (GITHUB_ALLOWLIST.length) {
      const set = new Set(GITHUB_ALLOWLIST.map((n) => n.toLowerCase()));
      selection = repos.filter(
        (r) => !r.fork && !r.private && set.has(r.name.toLowerCase())
      );
    } else if (USE_TOPICS) {
      const picked = [];
      for (const r of repos) {
        if (r.fork || r.private) continue;
        try {
          const tRes = await fetch(
            `https://api.github.com/repos/${user}/${r.name}/topics`,
            {
              headers: {
                ...baseHeaders,
                Accept: "application/vnd.github+json",
              },
            }
          );
          if (tRes.ok) {
            const { names = [] } = await tRes.json();
            if (names.some((n) => TOPIC_KEYS.includes(String(n).toLowerCase())))
              picked.push(r);
          }
        } catch (_) {}
      }
      selection = picked.length
        ? picked
        : repos
            .filter((r) => !r.fork && !r.private)
            .sort(
              (a, b) =>
                b.stargazers_count - a.stargazers_count ||
                +new Date(b.pushed_at) - +new Date(a.pushed_at)
            )
            .slice(0, 6);
    } else {
      selection = repos
        .filter((r) => !r.fork && !r.private)
        .sort(
          (a, b) =>
            b.stargazers_count - a.stargazers_count ||
            +new Date(b.pushed_at) - +new Date(a.pushed_at)
        )
        .slice(0, 6);
    }

    // שפות + רינדור
    const cards = await Promise.all(
      selection.map(async (repo) => {
        let langs = [];
        try {
          const lres = await fetch(repo.languages_url, {
            headers: { ...baseHeaders },
          });
          if (lres.ok) {
            const data = await lres.json();
            langs = Object.keys(data).slice(0, 2);
          }
        } catch (_) {}
        return renderRepoCard(repo, langs);
      })
    );

    container.innerHTML = "";
    cards.forEach((c) => container.appendChild(c));
  } catch (err) {
    container.innerHTML = `<div class="projects__loading">Couldn't load GitHub projects. ${escapeHTML(
      err.message
    )}.<br/>You can try again later or add a personal token in <code>index.js</code>.</div>`;
  }
}

function renderRepoCard(repo, langs) {
  const wrap = document.createElement("a");
  wrap.className = "project";
  wrap.href = repo.html_url;
  wrap.target = "_blank";
  wrap.rel = "noreferrer";
  const live =
    repo.homepage && repo.homepage.trim()
      ? `<a href="${repo.homepage}" target="_blank" rel="noreferrer" class="project__link">Live demo ↗</a>`
      : "";
  wrap.innerHTML = `
    <h3 class="project__name">${escapeHTML(repo.name)}</h3>
    <p class="project__desc">${escapeHTML(
      repo.description || "No description yet."
    )}</p>
    <div class="project__meta">
      ${langs.map((l) => `<span class="badge">${escapeHTML(l)}</span>`).join("")}
      <span class="badge">${new Date(repo.pushed_at).toLocaleDateString()}</span>
    </div>
    <span class="project__cta">Open on GitHub →</span>
    ${live}
  `;
  return wrap;
}
