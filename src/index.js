// ============================================================================
//  Stremio addon for cdn.0000456.xyz (Kurumi Index)
//  Handles Astro "server-island" pages + regular pages
// ============================================================================

const CONFIG = {
    addonName: "Kurumi",
    indexBase: "https://cdn.0000456.xyz",
    providerPath: "/7",
    dlBase: "https://dl.0000456.xyz",
    proxiedPlayback: false,
    maxFolderDepth: 2,
    maxSearchResults: 30,
    maxStreams: 30,
    resolutions: ["2160p", "1080p", "720p", "480p", "Unknown"],
    qualities: [
        "BluRay REMUX", "BluRay", "WEB-DL", "WEBRip", "HDRip",
        "HC HD-Rip", "DVDRip", "HDTV", "CAM", "TS", "TC", "SCR", "Unknown",
    ],
    visualTags: ["HDR10+", "HDR10", "HDR", "DV", "IMAX", "AI"],
    audioTags: ["Atmos", "DD+", "DD", "DTS-HD MA", "DTS-HD", "DTS", "TrueHD", "AC3", "AAC"],
    sortBy: ["resolution", "visualTag", "size", "quality"],
    considerHdrTagsAsEqual: true,
};

const MANIFEST = {
    id: "org.kurumi.gdrive",
    version: "1.0.0",
    name: CONFIG.addonName,
    description: "Stream movies & series from the Kurumi Cloud Index (GoogleDrive mirror).",
    catalogs: [],
    resources: [{ name: "stream", types: ["movie", "series"] }],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
};

const HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const ENDPOINTS = {
    CINEMETA: "https://v3-cinemeta.strem.io/meta/{type}/{id}.json",
    IMDB_SUGGEST: "https://v3.sg.media-imdb.com/suggestion/a/{id}.json",
};

// ---------------------------------------------------------------------------
// FILENAME PARSING
// ---------------------------------------------------------------------------
const REGEX = {
    resolutions: {
        "2160p": /(?<![^ [(_\-.])(4k|2160p|uhd)(?=[ \)\]_.-]|$)/i,
        "1080p": /(?<![^ [(_\-.])(1080p|fhd)(?=[ \)\]_.-]|$)/i,
        "720p":  /(?<![^ [(_\-.])(720p|hd)(?=[ \)\]_.-]|$)/i,
        "480p":  /(?<![^ [(_\-.])(480p|sd)(?=[ \)\]_.-]|$)/i,
    },
    qualities: {
        "BluRay REMUX": /(?<![^ [(_\-.])((blu[ .\-_]?ray|bd|br|b|uhd)[ .\-_]?remux)(?=[ \)\]_.-]|$)/i,
        BluRay: /(?<![^ [(_\-.])(blu[ .\-_]?ray|((bd|br|b|uhd)[ .\-_]?(rip|r)?))(?![ .\-_]?remux)(?=[ \)\]_.-]|$)/i,
        "WEB-DL": /(?<![^ [(_\-.])(web[ .\-_]?(dl)?)(?![ .\-_]?DLRip)(?=[ \)\]_.-]|$)/i,
        WEBRip: /(?<![^ [(_\-.])(web[ .\-_]?rip)(?=[ \)\]_.-]|$)/i,
        HDRip: /(?<![^ [(_\-.])(hd[ .\-_]?rip|web[ .\-_]?dl[ .\-_]?rip)(?=[ \)\]_.-]|$)/i,
        "HC HD-Rip": /(?<![^ [(_\-.])(hc|hd[ .\-_]?rip)(?=[ \)\]_.-]|$)/i,
        DVDRip: /(?<![^ [(_\-.])(dvd[ .\-_]?(rip|mux|r|full|5|9))(?=[ \)\]_.-]|$)/i,
        HDTV: /(?<![^ [(_\-.])((hd|pd)tv|tv[ .\-_]?rip|hdtv[ .\-_]?rip|dsr(ip)?|sat[ .\-_]?rip)(?=[ \)\]_.-]|$)/i,
        CAM: /(?<![^ [(_\-.])(cam|hdcam|cam[ .\-_]?rip)(?=[ \)\]_.-]|$)/i,
        TS: /(?<![^ [(_\-.])(telesync|ts|hd[ .\-_]?ts|pdvd|predvd(rip)?)(?=[ \)\]_.-]|$)/i,
        TC: /(?<![^ [(_\-.])(telecine|tc|hd[ .\-_]?tc)(?=[ \)\]_.-]|$)/i,
        SCR: /(?<![^ [(_\-.])(((dvd|bd|web)?[ .\-_]?)?(scr(eener)?))(?=[ \)\]_.-]|$)/i,
    },
    visualTags: {
        "HDR10+": /(?<![^ [(_\-.])(hdr[ .\-_]?(10|ten)[ .\-_]?([+]|plus))(?=[ \)\]_.-]|$)/i,
        HDR10: /(?<![^ [(_\-.])(hdr10)(?=[ \)\]_.-]|$)/i,
        HDR: /(?<![^ [(_\-.])(hdr)(?=[ \)\]_.-]|$)/i,
        DV: /(?<![^ [(_\-.])(dolby[ .\-_]?vision(?:[ .\-_]?atmos)?|dv)(?=[ \)\]_.-]|$)/i,
        IMAX: /(?<![^ [(_\-.])(imax)(?=[ \)\]_.-]|$)/i,
        AI: /(?<![^ [(_\-.])(ai[ .\-_]?(upscale|enhanced|remaster))(?=[ \)\]_.-]|$)/i,
    },
    audioTags: {
        Atmos: /(?<![^ [(_\-.])(atmos)(?=[ \)\]_.-]|$)/i,
        "DD+": /(?<![^ [(_\-.])((?:ddp|dolby[ .\-_]?digital[ .\-_]?plus)(?:[ .\-_]?(5\.1|7\.1))?)(?=[ \)\]_.-]|$)/i,
        DD: /(?<![^ [(_\-.])((?:dd|dolby[ .\-_]?digital)(?:[ .\-_]?(5\.1|7\.1))?)(?=[ \)\]_.-]|$)/i,
        "DTS-HD MA": /(?<![^ [(_\-.])(dts[ .\-_]?hd[ .\-_]?ma)(?=[ \)\]_.-]|$)/i,
        "DTS-HD": /(?<![^ [(_\-.])(dts[ .\-_]?hd)(?![ .\-_]?ma)(?=[ \)\]_.-]|$)/i,
        DTS: /(?<![^ [(_\-.])(dts(?![ .\-_]?hd[ .\-_]?ma|[ .\-_]?hd))(?=[ \)\]_.-]|$)/i,
        TrueHD: /(?<![^ [(_\-.])(true[ .\-_]?hd)(?=[ \)\]_.-]|$)/i,
        AC3: /(?<![^ [(_\-.])(ac[ .\-_]?3)(?=[ \)\]_.-]|$)/i,
        AAC: /(?<![^ [(_\-.])(aac)(?=[ \)\]_.-]|$)/i,
    },
    encodes: {
        HEVC: /(?<![^ [(_\-.])(hevc|x265|h265|h\.265)(?=[ \)\]_.-]|$)/i,
        AVC: /(?<![^ [(_\-.])(avc|x264|h264|h\.264)(?=[ \)\]_.-]|$)/i,
    },
    languages: {
        Multi: /(?<![^ [(_\-.])(multi|multi[ .\-_]?audio)(?=[ \)\]_.-]|$)/i,
        "Dual Audio": /(?<![^ [(_\-.])(dual[ .\-_]?audio)(?=[ \)\]_.-]|$)/i,
        English: /(?<![^ [(_\-.])(english|eng)(?=[ \)\]_.-]|$)/i,
        Japanese: /(?<![^ [(_\-.])(japanese|jap)(?=[ \)\]_.-]|$)/i,
        Hindi: /(?<![^ [(_\-.])(hindi|hin)(?=[ \)\]_.-]|$)/i,
    },
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), { headers: HEADERS, status });
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return "Unknown";
    const k = 1000;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function parseSize(str) {
    if (!str) return 0;
    const m = String(str).trim().match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
    if (!m) return 0;
    const mult = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[m[2].toUpperCase()];
    return Math.round(parseFloat(m[1]) * mult);
}

function parseFilename(name) {
    const resolution = Object.entries(REGEX.resolutions).find(([, re]) => re.test(name))?.[0] || "Unknown";
    const quality = Object.entries(REGEX.qualities).find(([, re]) => re.test(name))?.[0] || "Unknown";
    let visualTags = Object.entries(REGEX.visualTags).filter(([, re]) => re.test(name)).map(([t]) => t);
    const audioTags = Object.entries(REGEX.audioTags).filter(([, re]) => re.test(name)).map(([t]) => t);
    const encode = Object.entries(REGEX.encodes).find(([, re]) => re.test(name))?.[0] || "";
    const languages = Object.entries(REGEX.languages).filter(([, re]) => re.test(name)).map(([t]) => t);

    if (visualTags.includes("HDR10+")) visualTags = visualTags.filter(t => t !== "HDR" && t !== "HDR10");
    else if (visualTags.includes("HDR10")) visualTags = visualTags.filter(t => t !== "HDR");

    return { resolution, quality, visualTags, audioTags, encode, languages };
}

function stripTags(s) {
    return String(s).replace(/<[^>]+>/g, "");
}

function decodeHtml(s) {
    return String(s)
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

// ---------------------------------------------------------------------------
// METADATA
// ---------------------------------------------------------------------------
async function getMetadata(type, fullId) {
    const id = fullId.split(":")[0];
    console.log(`[getMetadata] type=${type} id=${id}`);

    try {
        const r = await fetch(ENDPOINTS.CINEMETA.replace("{type}", type).replace("{id}", id));
        if (r.ok) {
            const d = await r.json();
            if (d?.meta?.name) {
                console.log(`[getMetadata] Cinemeta -> "${d.meta.name}" (${d.meta.year})`);
                return { name: d.meta.name, year: d.meta.year };
            }
        }
        console.log(`[getMetadata] Cinemeta fail status=${r.status}`);
    } catch (e) { console.error("Cinemeta error:", e.message); }

    try {
        const r = await fetch(ENDPOINTS.IMDB_SUGGEST.replace("{id}", id));
        if (r.ok) {
            const d = await r.json();
            const item = (d?.d || []).find(x => x.id === id);
            if (item?.l) {
                console.log(`[getMetadata] IMDb suggest -> "${item.l}" (${item.y})`);
                return { name: item.l, year: item.y };
            }
        }
    } catch (e) { console.error("IMDb suggest error:", e.message); }

    console.log(`[getMetadata] no meta found`);
    return null;
}

// ---------------------------------------------------------------------------
// HTML PARSING
// ---------------------------------------------------------------------------

// Extract all entries from HTML that already has real <a href="/7/ID?t=f|d">.
// Also tries the "no-anchor" fallback: a row with a heading-like name + size
// + "New" badge (used by the site's server-island fragment).
function parseListingHtml(html) {
    const entries = [];
    const seen = new Set();

    // --- Pattern 1: standard <a href="/7/{id}?t=(f|d)">INNER</a> ---
    const anchorRe = /<a\b[^>]*href="\/7\/([A-Za-z0-9_-]+)\?t=([fd])"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = anchorRe.exec(html)) !== null) {
        const [, id, kind, inner] = m;
        if (seen.has(id)) continue;

        let name = "";
        const spanMatch = inner.match(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([\s\S]*?)<\/span>/);
        if (spanMatch) name = stripTags(decodeHtml(spanMatch[1])).trim();
        else name = stripTags(decodeHtml(inner)).trim();
        if (!name || name.length < 2) continue;

        // Surrounding context to find size in a nearby <td>
        const ctxStart = Math.max(0, m.index - 120);
        const ctxEnd = Math.min(html.length, m.index + m[0].length + 600);
        const ctx = html.slice(ctxStart, ctxEnd);
        const tds = [...ctx.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)]
            .map(t => stripTags(decodeHtml(t[1])).trim());

        let sizeBytes = 0;
        let created = "";
        for (let i = 0; i < tds.length; i++) {
            const s = parseSize(tds[i]);
            if (s > 0 || tds[i] === "0 B") {
                sizeBytes = s;
                created = tds[i + 1] || "";
                break;
            }
        }

        seen.add(id);
        entries.push({ id, name, type: kind === "f" ? "folder" : "file", sizeBytes, created });
    }

    return entries;
}

// Extract the server-island fetch tokens from the inline <script>.
// The page has a call like:
//   fetch("/_server-islands/StreamEntries?e=XXXX&p=YYYY&s=", { headers })
// We pull e and p and rebuild the URL. If not present, returns null.
function extractServerIslandTokens(html) {
    // Match fetch("/_server-islands/StreamEntries?e=...&p=...&s=")
    // Tokens are URL-encoded (contain %2F, %3D, etc.), so we allow those chars.
    const re = /\/_server-islands\/StreamEntries\?e=([^&"']+)&p=([^&"']+)&s=([^"']*)/;
    const m = html.match(re);
    if (!m) return null;

    // e and p may be percent-encoded; they need to stay encoded for the URL
    // s is usually empty — leave as-is if missing
    return { e: m[1], p: m[2], s: m[3] || "" };
}

// Fetch the server-island fragment HTML for a page URL.
// Returns the parsed entries, or null if the page has no server-island call.
async function fetchServerIslandEntries(pageUrl, html) {
    const tokens = extractServerIslandTokens(html);
    if (!tokens) {
        console.log(`[island] no server-island tokens found in ${pageUrl}`);
        return null;
    }
    console.log(`[island] tokens found: e=${tokens.e.slice(0, 16)}... p=${tokens.p.slice(0, 16)}...`);

    // Build island URL
    const islandUrl = `${CONFIG.indexBase}/_server-islands/StreamEntries?e=${tokens.e}&p=${tokens.p}&s=${tokens.s}`;
    console.log(`[island] GET ${islandUrl.slice(0, 120)}...`);

    const r = await fetch(islandUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": pageUrl,
        },
    });
    console.log(`[island] status=${r.status} ok=${r.ok}`);
    if (!r.ok) {
        const err = await r.text();
        console.log(`[island] error body: ${err.slice(0, 200)}`);
        return null;
    }
    const body = await r.text();
    console.log(`[island] html length=${body.length}`);
    const entries = parseListingHtml(body);
    console.log(`[island] parsed ${entries.length} entries`);
    return entries;
}

// Full-page fetch that:
//   1. Fetches the page HTML
//   2. Parses entries from the page HTML directly (if any)
//   3. Also extracts server-island tokens and fetches the fragment
//   4. Merges results, dedupes by id
async function fetchPage(pageUrl) {
    console.log(`[fetchPage] GET ${pageUrl}`);
    const r = await fetch(pageUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    console.log(`[fetchPage] status=${r.status} ok=${r.ok}`);
    if (!r.ok) throw new Error(`page HTTP ${r.status} for ${pageUrl}`);
    const html = await r.text();
    console.log(`[fetchPage] html length=${html.length}`);

    const fromPage = parseListingHtml(html);
    console.log(`[fetchPage] parsed ${fromPage.length} entries from page HTML directly`);

    let fromIsland = null;
    try {
        fromIsland = await fetchServerIslandEntries(pageUrl, html);
    } catch (e) {
        console.error(`[island] error: ${e.message}`);
    }

    const merged = [...fromPage];
    const seen = new Set(merged.map(e => e.id));
    if (fromIsland) {
        for (const e of fromIsland) {
            if (!seen.has(e.id)) { merged.push(e); seen.add(e.id); }
        }
    }
    console.log(`[fetchPage] total merged entries: ${merged.length}`);
    return merged;
}

async function fetchSearchResults(query) {
    const url = new URL(CONFIG.indexBase + CONFIG.providerPath);
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    return fetchPage(url.toString());
}

async function fetchFolderListing(folderId) {
    return fetchPage(CONFIG.indexBase + CONFIG.providerPath + "/" + folderId);
}

// ---------------------------------------------------------------------------
// MATCHING
// ---------------------------------------------------------------------------
function normaliseTitle(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Very forgiving: if the title has 2+ words, accept if the LONGEST word (4+ chars)
// appears in the filename. This handles transliterations, articles, etc.
function titleMatches(filename, title, year) {
    const f = normaliseTitle(filename);
    if (!f) return false;

    const tNorm = normaliseTitle(title);
    if (tNorm && f.includes(tNorm)) {
        if (!year || f.includes(String(year))) return true;
    }

    const words = tNorm.split(" ").filter(w => w.length >= 3);
    if (words.length > 0) {
        const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
        if (longest.length >= 4 && f.includes(longest)) {
            if (!year || f.includes(String(year))) return true;
        }
    }
    return false;
}

function episodeMatches(filename, season, episode) {
    const s = Number(season), e = Number(episode);
    const sp = String(s).padStart(2, "0");
    const ep = String(e).padStart(2, "0");
    const candidates = [
        `s${sp}e${ep}`, `s${s}e${e}`,
        `s${sp}.e${ep}`, `s${s}.e${e}`,
        `s${sp} e${ep}`, `s${s} e${e}`,
        `${s}x${ep}`, `${s}x${e}`,
        `season ${s} episode ${e}`, `season ${sp} episode ${ep}`,
        `s${sp}ep${ep}`, `s${s}ep${e}`,
    ];
    const f = filename.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    return candidates.some(c => f.includes(c.toLowerCase()));
}

// ---------------------------------------------------------------------------
// SORTING
// ---------------------------------------------------------------------------
function sortStreams(items) {
    items.sort((a, b) => {
        for (const field of CONFIG.sortBy) {
            let cmp = 0;
            if (field === "resolution") {
                cmp = CONFIG.resolutions.indexOf(a.resolution) - CONFIG.resolutions.indexOf(b.resolution);
            } else if (field === "size") {
                cmp = b.sizeBytes - a.sizeBytes;
            } else if (field === "quality") {
                cmp = CONFIG.qualities.indexOf(a.quality) - CONFIG.qualities.indexOf(b.quality);
            } else if (field === "visualTag") {
                const idx = t => CONFIG.considerHdrTagsAsEqual && t.startsWith("HDR")
                    ? CONFIG.visualTags.indexOf("HDR10+")
                    : CONFIG.visualTags.indexOf(t);
                const ai = a.visualTags.reduce((m, t) => Math.min(m, idx(t)), CONFIG.visualTags.length);
                const bi = b.visualTags.reduce((m, t) => Math.min(m, idx(t)), CONFIG.visualTags.length);
                cmp = ai - bi;
            }
            if (cmp !== 0) return cmp;
        }
        return 0;
    });
}

// ---------------------------------------------------------------------------
// BUILD STREAM
// ---------------------------------------------------------------------------
function buildStream(entry, origin) {
    const parsed = parseFilename(entry.name);
    const sizeStr = formatSize(entry.sizeBytes);

    let name = `${CONFIG.addonName} ${parsed.resolution}`;
    let desc = `🎥 ${parsed.quality}`;
    if (parsed.encode) desc += `   🎞️ ${parsed.encode}`;
    if (parsed.visualTags.length || parsed.audioTags.length) {
        desc += "\n";
        if (parsed.visualTags.length) desc += `📺 ${parsed.visualTags.join(" | ")}   `;
        if (parsed.audioTags.length) desc += `🎧 ${parsed.audioTags.join(" | ")}`;
    }
    desc += `\n📦 ${sizeStr}`;
    if (parsed.languages.length) desc += `\n🔊 ${parsed.languages.join(" | ")}`;
    desc += `\n📄 ${entry.name}`;

    const dlUrl = `${CONFIG.dlBase}/gd/${entry.id}`;
    const url = CONFIG.proxiedPlayback
        ? `${origin}/play/${entry.id}/${encodeURIComponent(entry.name)}`
        : dlUrl;

    return {
        name,
        description: desc,
        url,
        behaviorHints: {
            videoSize: entry.sizeBytes || 0,
            filename: entry.name,
            bingeGroup: `${CONFIG.addonName}|${parsed.resolution}|${parsed.quality}`,
        },
        ...parsed,
        sizeBytes: entry.sizeBytes,
        fileId: entry.id,
    };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
async function handleStream(type, fullId, origin) {
    console.log(`>>> handleStream type=${type} fullId=${fullId}`);

    const meta = await getMetadata(type, fullId);
    if (!meta) {
        console.log("!!! no meta, abort");
        return { streams: [] };
    }

    let season, episode;
    if (type === "series") {
        const parts = fullId.split(":");
        if (parts.length >= 3) {
            season = Number(parts[1]);
            episode = Number(parts[2]);
        }
    }

    const searchQuery = type === "movie"
        ? `${meta.name} ${meta.year}`
        : `${meta.name}`;
    console.log(`[search] query="${searchQuery}"`);

    let results;
    try {
        results = await fetchSearchResults(searchQuery);
    } catch (e) {
        console.error(`[search] failed: ${e.message}`);
        return { streams: [] };
    }

    results = results.slice(0, CONFIG.maxSearchResults);
    console.log(`[search] using ${results.length} results`);
    results.slice(0, 10).forEach(r => console.log(`  [${r.type}] ${r.name} (${r.sizeBytes}B)`));

    const candidates = [];
    for (const entry of results) {
        if (entry.type === "folder") {
            try { await expandFolder(entry.id, candidates, 0); }
            catch (e) { console.error(`[folder] ${entry.id}: ${e.message}`); }
        } else {
            candidates.push(entry);
        }
        if (candidates.length > 200) break;
    }
    console.log(`[search] candidates after folders: ${candidates.length}`);

    const filtered = candidates.filter(entry => {
        if (!titleMatches(entry.name, meta.name, type === "movie" ? meta.year : null)) return false;
        if (type === "series" && season && episode) {
            if (!episodeMatches(entry.name, season, episode)) return false;
        }
        return true;
    });
    console.log(`[search] filtered: ${filtered.length}`);

    const streams = filtered.map(e => buildStream(e, origin));
    sortStreams(streams);
    return { streams: streams.slice(0, CONFIG.maxStreams) };
}

async function expandFolder(folderId, out, depth) {
    if (depth >= CONFIG.maxFolderDepth) return;
    const entries = await fetchFolderListing(folderId);
    for (const entry of entries) {
        if (entry.type === "folder") await expandFolder(entry.id, out, depth + 1);
        else out.push(entry);
        if (out.length > 300) break;
    }
}

// ---------------------------------------------------------------------------
// PROXY PLAYBACK
// ---------------------------------------------------------------------------
async function proxyPlayback(fileId, filename, request) {
    const url = `${CONFIG.dlBase}/gd/${fileId}`;
    const headers = {};
    const range = request.headers.get("Range");
    if (range) headers.Range = range;

    const r = await fetch(url, { headers, redirect: "follow" });
    if (!r.ok) return new Response("Upstream error", { status: r.status });

    const out = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const v = r.headers.get(h);
        if (v) out.set(h, v);
    }
    out.set("Access-Control-Allow-Origin", "*");
    return new Response(r.body, { status: r.status, headers: out });
}

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------
const RE_STREAM = /^\/stream\/(movie|series)\/([^/]+)\.json$/;
const RE_PLAY = /^\/play\/([^/]+)\/(.+)$/;

export default {
    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") return new Response(null, { headers: HEADERS });

        if (url.pathname === "/manifest.json") return jsonResponse(MANIFEST);
        if (url.pathname === "/") return Response.redirect(url.origin + "/manifest.json", 301);

        const playMatch = RE_PLAY.exec(url.pathname);
        if (playMatch) {
            return proxyPlayback(playMatch[1], decodeURIComponent(playMatch[2]), request);
        }

        const streamMatch = RE_STREAM.exec(url.pathname);
        if (streamMatch) {
            const [, type, id] = streamMatch;
            try {
                const data = await handleStream(type, decodeURIComponent(id), url.origin);
                return jsonResponse(data);
            } catch (e) {
                console.error("stream handler error:", e.message);
                return jsonResponse({ streams: [] });
            }
        }

        return new Response("Not Found", { status: 404 });
    },
};