// ============================================================================
//  Stremio addon for cdn.0000456.xyz  ("Kurumi Index")
//  Runs on Deno Deploy.
//
//  ENV VARS (Deno Deploy → Settings → Environment Variables):
//    CF_CLEARANCE  – value of the cf_clearance cookie (from your browser)
//    CF_UA         – exact User-Agent string (Firefox/Chrome, whatever set the cookie)
// ============================================================================

const CONFIG = {
    addonName: "Kurumi",
    indexBase: "https://cdn.0000456.xyz",
    providerPath: "/7",
    dlBase: "https://dl.0000456.xyz",
    proxiedPlayback: false,
    maxFolderDepth: 2,
    maxSearchResults: 40,
    maxStreams: 40,
    maxCandidates: 400,
    resolutions: ["2160p", "1080p", "720p", "480p", "Unknown"],
    qualities: [
        "BluRay REMUX", "BluRay", "WEB-DL", "WEBRip", "HDRip",
        "HC HD-Rip", "DVDRip", "HDTV", "CAM", "TS", "TC", "SCR", "Unknown",
    ],
    visualTags: ["HDR10+", "HDR10", "HDR", "DV", "IMAX", "AI"],
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
// FILENAME PARSING (unchanged)
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

// ---------------------------------------------------------------------------
// CLOUDFLARE-AWARE FETCH (Fix 2 applied here)
// ---------------------------------------------------------------------------
function cfHeaders(extra = {}) {
    const cookie = Deno.env.get("CF_CLEARANCE") || "";
    const ua = Deno.env.get("CF_UA") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0";
    const h = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://cdn.0000456.xyz/",
        ...extra,
    };
    if (cookie) h["Cookie"] = `cf_clearance=${cookie}`;
    return h;
}

// Headers specifically for the /_server-islands/... endpoint
function islandHeaders(referer) {
    return cfHeaders({
        "Referer": referer,
        "Accept": "*/*",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Te": "trailers",
    });
}

async function safeFetch(url, opts = {}) {
    const r = await fetch(url, opts);
    if (!r.ok) {
        const body = await r.text().catch(() => "");
        const snippet = body.slice(0, 300).replace(/\s+/g, " ");
        console.error(`[fetch] ${url} status=${r.status} body=${snippet}`);
    }
    return r;
}

// ---------------------------------------------------------------------------
// METADATA
// ---------------------------------------------------------------------------
async function getMetadata(type, fullId) {
    const id = fullId.split(":")[0];
    try {
        const r = await fetch(ENDPOINTS.CINEMETA.replace("{type}", type).replace("{id}", id));
        if (r.ok) {
            const d = await r.json();
            if (d?.meta?.name) return { name: d.meta.name, year: d.meta.year };
        }
    } catch (e) { console.error("Cinemeta failed", e); }

    try {
        const r = await fetch(ENDPOINTS.IMDB_SUGGEST.replace("{id}", id));
        if (r.ok) {
            const d = await r.json();
            const item = (d?.d || []).find(x => x.id === id);
            if (item?.l) return { name: item.l, year: item.y };
        }
    } catch (e) { console.error("IMDb suggest failed", e); }

    return null;
}

// ---------------------------------------------------------------------------
// SCRAPING (Fix 2, 3, 4 all applied here)
// ---------------------------------------------------------------------------
async function fetchSearchResults(query) {
    const url = new URL(CONFIG.indexBase + CONFIG.providerPath);
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");
    console.log(`[search] GET ${url}`);

    const r = await safeFetch(url.toString(), { headers: cfHeaders() });
    if (!r.ok) throw new Error(`search HTTP ${r.status}`);
    const html = await r.text();
    console.log(`[search] html length=${html.length}`);

    let entries = parseListingHtml(html);
    console.log(`[search] parsed ${entries.length} entries from HTML`);

    // Skeleton fallback: pull the _server-islands URL from the page and fetch it.
    if (entries.length === 0) {
        entries = await fetchIslandEntries(html, url.toString());
        console.log(`[search] parsed ${entries.length} entries from island`);
    }

    return entries;
}

async function fetchFolderListing(folderId) {
    const url = `${CONFIG.indexBase}${CONFIG.providerPath}/${folderId}?t=f`;
    console.log(`[folder] GET ${url}`);
    const r = await safeFetch(url, { headers: cfHeaders() });
    if (!r.ok) throw new Error(`folder HTTP ${r.status}`);
    const html = await r.text();
    console.log(`[folder] html length=${html.length}`);

    let entries = parseListingHtml(html);
    console.log(`[folder] parsed ${entries.length} entries`);

    if (entries.length === 0) {
        entries = await fetchIslandEntries(html, url);
        console.log(`[folder] parsed ${entries.length} entries from island`);
    }

    return entries;
}

async function fetchIslandEntries(html, referer) {
    const islandHref = extractIslandUrl(html);
    if (!islandHref) {
        console.log("[island] no island URL found in page");
        return [];
    }
    let abs;
    try {
        abs = new URL(islandHref, CONFIG.indexBase).toString();
    } catch (e) {
        console.error(`[island] bad URL "${islandHref}": ${e.message}`);
        return [];
    }
    console.log(`[island] GET ${abs}`);
    try {
        const r = await safeFetch(abs, { headers: islandHeaders(referer) });
        if (!r.ok) {
            console.error(`[island] status=${r.status}`);
            return [];
        }
        const frag = await r.text();
        console.log(`[island] fragment length=${frag.length}`);
        return parseListingHtml(frag);
    } catch (e) {
        console.error(`[island] fetch failed: ${e.message}`);
        return [];
    }
}

// Fix 3: full HTML-entity decoding (numeric hex/decimal + named)
function decodeHtml(s) {
    return String(s)
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
            try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ""; }
        })
        .replace(/&#(\d+);/g, (_, d) => {
            try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ""; }
        })
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, " ");
}

function extractIslandUrl(html) {
    // Prefer the preload link
    let m = html.match(/<link[^>]+as="fetch"[^>]+href="([^"]*_server-islands[^"]*)"/i);
    if (m) return decodeHtml(m[1]);

    // Fallback: inside the inline script
    m = html.match(/fetch\(\s*"([^"]*_server-islands[^"]*)"/i);
    if (m) return decodeHtml(m[1]);

    return null;
}

// Robust listing parser (works for the full page and for the island fragment)
function parseListingHtml(html) {
    const entries = [];
    const seen = new Set();
    const anchorRe = /<a\b[^>]*href="\/7\/([A-Za-z0-9_-]+)\?t=([fd])"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = anchorRe.exec(html)) !== null) {
        const [, id, kind, inner] = m;
        if (seen.has(id)) continue;
        seen.add(id);

        let name = "";
        const spanMatch = inner.match(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([\s\S]*?)<\/span>/);
        name = spanMatch ? stripTags(decodeHtml(spanMatch[1])) : stripTags(decodeHtml(inner));
        name = name.trim().replace(/\s+/g, " ");
        if (!name || name.length < 2) continue;

        const ctxStart = Math.max(0, m.index - 300);
        const ctxEnd = Math.min(html.length, m.index + m[0].length + 1000);
        const context = html.slice(ctxStart, ctxEnd);
        const tds = [...context.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)]
            .map(t => stripTags(decodeHtml(t[1])).trim())
            .filter(Boolean);

        let sizeBytes = 0, created = "";
        for (let i = 0; i < tds.length; i++) {
            const s = parseSize(tds[i]);
            if (s > 0 || tds[i] === "0 B") {
                sizeBytes = s;
                created = tds[i + 1] || "";
                break;
            }
        }

        entries.push({
            id,
            name,
            type: kind === "f" ? "folder" : "file",
            sizeBytes,
            created,
        });
    }
    return entries;
}

function stripTags(s) {
    return s.replace(/<[^>]+>/g, "");
}

// ---------------------------------------------------------------------------
// MATCHING
// ---------------------------------------------------------------------------
function normaliseTitle(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleMatches(filename, title, year) {
    const f = normaliseTitle(filename);
    const tokens = normaliseTitle(title).split(" ").filter(Boolean);
    if (!tokens.length) return false;
    if (!tokens.every(t => f.includes(t))) return false;
    if (year && !f.includes(String(year))) return false;
    return true;
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
        `ep${ep}`, `ep ${ep}`, `episode ${e}`,
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
            bingeGroup: `${CONFIG.addonName}|${parsed.resolution}|${parsed.quality}|${parsed.visualTags.join(",")}`,
        },
        ...parsed,
        sizeBytes: entry.sizeBytes,
        fileId: entry.id,
    };
}

// ---------------------------------------------------------------------------
// MAIN HANDLER (Fix 4: try plain title AND dotted, on both page + island)
// ---------------------------------------------------------------------------
async function handleStream(type, fullId, origin) {
    console.log(`>>> handleStream type=${type} fullId=${fullId}`);

    const meta = await getMetadata(type, fullId);
    if (!meta) {
        console.log("!!! no meta");
        return { streams: [] };
    }
    console.log(`META name="${meta.name}" year="${meta.year}"`);

    let season, episode;
    if (type === "series") {
        const parts = fullId.split(":");
        if (parts.length >= 3) {
            season = Number(parts[1]);
            episode = Number(parts[2]);
        }
    }

    const plain = meta.name;
    const dotted = meta.name.replace(/[^A-Za-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
    const queries = [plain, dotted].filter((q, i, a) => q && a.indexOf(q) === i);

    let results = [];
    for (const q of queries) {
        console.log(`SEARCH QUERY "${q}"`);
        try {
            results = await fetchSearchResults(q);
        } catch (e) {
            console.error(`search failed for "${q}": ${e.message}`);
            results = [];
        }
        if (results.length > 0) break;
    }

    results = results.slice(0, CONFIG.maxSearchResults);
    console.log(`RESULTS ${results.length}`);
    results.slice(0, 10).forEach(r => console.log(`  [${r.type}] ${r.name} (${r.sizeBytes}B)`));

    const candidates = [];
    for (const entry of results) {
        if (entry.type === "folder") {
            await expandFolder(entry.id, candidates, 0);
        } else {
            candidates.push(entry);
        }
        if (candidates.length >= CONFIG.maxCandidates) break;
    }
    console.log(`CANDIDATES after folders: ${candidates.length}`);

    const filtered = [];
    for (const entry of candidates) {
        const tMatch = titleMatches(entry.name, meta.name, type === "movie" ? meta.year : null);
        const eMatch = type === "series" && season && episode
            ? episodeMatches(entry.name, season, episode)
            : true;
        if (!tMatch || !eMatch) {
            if (candidates.length <= 30) console.log(`reject: ${entry.name} {title:${tMatch}, ep:${eMatch}}`);
            continue;
        }
        filtered.push(entry);
    }
    console.log(`FILTERED ${filtered.length}`);

    const streams = filtered.map(e => buildStream(e, origin));
    sortStreams(streams);
    return { streams: streams.slice(0, CONFIG.maxStreams) };
}

async function expandFolder(folderId, out, depth) {
    if (depth >= CONFIG.maxFolderDepth) return;
    let entries;
    try {
        entries = await fetchFolderListing(folderId);
    } catch (e) {
        console.error("folder failed:", e.message);
        return;
    }
    for (const entry of entries) {
        if (entry.type === "folder") await expandFolder(entry.id, out, depth + 1);
        else out.push(entry);
        if (out.length >= CONFIG.maxCandidates) break;
    }
}

// ---------------------------------------------------------------------------
// PROXY PLAYBACK (used only if CONFIG.proxiedPlayback === true)
// ---------------------------------------------------------------------------
async function proxyPlayback(fileId, filename, request) {
    const url = `${CONFIG.dlBase}/gd/${fileId}`;
    const headers = cfHeaders();
    const range = request.headers.get("Range");
    if (range) headers["Range"] = range;

    const r = await fetch(url, { headers, redirect: "follow" });
    if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.error(`[play] ${url} status=${r.status} body=${body.slice(0, 200)}`);
        return new Response("Upstream error", { status: r.status });
    }

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

        // Temporary debug route — remove once everything works
        if (url.pathname === "/debug") {
            const q = url.searchParams.get("q") || "Hot Blood";
            const target = new URL(CONFIG.indexBase + CONFIG.providerPath);
            target.searchParams.set("q", q);
            target.searchParams.set("page", "1");
            const out = { query: q, url: target.toString(), env: {
                CF_UA: !!Deno.env.get("CF_UA"),
                CF_CLEARANCE: !!Deno.env.get("CF_CLEARANCE"),
            }};
            try {
                const r1 = await fetch(target.toString(), { headers: cfHeaders() });
                out.searchStatus = r1.status;
                const html = await r1.text();
                out.searchLen = html.length;
                out.searchEntries = parseListingHtml(html).length;
                const islandHref = extractIslandUrl(html);
                out.islandHref = islandHref;
                if (islandHref) {
                    const abs = new URL(islandHref, CONFIG.indexBase).toString();
                    out.islandUrl = abs;
                    const r2 = await fetch(abs, { headers: islandHeaders(target.toString()) });
                    out.islandStatus = r2.status;
                    const frag = await r2.text();
                    out.islandLen = frag.length;
                    out.islandEntries = parseListingHtml(frag).length;
                    out.islandPreview = frag.slice(0, 400);
                }
            } catch (e) { out.error = e.message; }
            return jsonResponse(out);
        }

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