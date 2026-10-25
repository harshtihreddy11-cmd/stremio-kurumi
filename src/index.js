// ============================================================================
//  Stremio addon for cdn.0000456.xyz  ("Kurumi Index")
//  Runs on Deno Deploy (no Cloudflare-to-Cloudflare block)
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
// SCRAPING
// ---------------------------------------------------------------------------
async function fetchSearchResults(query) {
    const url = new URL(CONFIG.indexBase + CONFIG.providerPath);
    url.searchParams.set("q", query);
    url.searchParams.set("page", "1");

    console.log(`[fetchSearch] GET ${url}`);
    const r = await fetch(url.toString(), {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    console.log(`[fetchSearch] status=${r.status} ok=${r.ok}`);
    if (!r.ok) throw new Error(`search HTTP ${r.status}`);
    const html = await r.text();
    console.log(`[fetchSearch] html length=${html.length}`);
    console.log(`[fetchSearch] preview=${html.slice(0, 400)}`);
    const parsed = parseListingHtml(html);
    console.log(`[fetchSearch] parsed ${parsed.length} entries`);
    return parsed;
}

async function fetchFolderListing(folderId) {
    const url = CONFIG.indexBase + CONFIG.providerPath + "/" + folderId;
    console.log(`[fetchFolder] GET ${url}`);
    const r = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
            "Accept": "text/html",
        },
    });
    if (!r.ok) throw new Error(`folder HTTP ${r.status}`);
    const html = await r.text();
    console.log(`[fetchFolder] html length=${html.length}`);
    return parseListingHtml(html);
}

// ROBUST PARSER: does NOT depend on <tr> structure.
// It scans for every occurrence of href="/7/{id}?t=(f|d)"
// and extracts name + size + created from nearby text.
function parseListingHtml(html) {
    const entries = [];
    // Match: <a ... href="/7/ID?t=f|d" ...>INNER</a>
    const anchorRe = /<a\b[^>]*href="\/7\/([A-Za-z0-9_-]+)\?t=([fd])"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = anchorRe.exec(html)) !== null) {
        const [, id, kind, inner] = m;
        let name = "";
        // Try the <span class="truncate..."> inner text
        const spanMatch = inner.match(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([\s\S]*?)<\/span>/);
        if (spanMatch) {
            name = stripTags(decodeHtml(spanMatch[1]));
        } else {
            name = stripTags(decodeHtml(inner));
        }
        name = name.trim();
        if (!name || name.length < 2) continue;

        // Get context around the anchor so we can pull size + created
        const ctxStart = Math.max(0, m.index - 200);
        const ctxEnd = Math.min(html.length, m.index + m[0].length + 800);
        const context = html.slice(ctxStart, ctxEnd);
        const tds = [...context.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(t => stripTags(decodeHtml(t[1])).trim());

        let sizeBytes = 0;
        let created = "";
        // After our name anchor, the next 2 <td>s are size and created
        // Find the anchor's own <td> position first — approximate via regex
        for (let i = 0; i < tds.length; i++) {
            const s = parseSize(tds[i]);
            if (s > 0 || tds[i] === "0 B") {
                sizeBytes = s;
                created = tds[i + 1] || "";
                break;
            }
        }

        // Dedupe (same id appearing in header + row)
        if (entries.some(e => e.id === id)) continue;

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

function decodeHtml(s) {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

// ---------------------------------------------------------------------------
// MATCHING
// ---------------------------------------------------------------------------
function normaliseTitle(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleMatches(filename, title, year) {
    const f = normaliseTitle(filename);
    const t = normaliseTitle(title);
    if (!t) return false;
    if (!f.includes(t)) return false;
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
// MAIN HANDLER
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

    const searchQuery = type === "movie"
        ? `${meta.name} ${meta.year}`
        : `${meta.name}`;
    console.log(`SEARCH QUERY "${searchQuery}"`);

    let results;
    try {
        results = await fetchSearchResults(searchQuery);
    } catch (e) {
        console.error("search failed:", e.message);
        return { streams: [] };
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
        if (candidates.length > 200) break;
    }
    console.log(`CANDIDATES after folders: ${candidates.length}`);

    const filtered = candidates.filter(entry => {
        if (!titleMatches(entry.name, meta.name, type === "movie" ? meta.year : null)) return false;
        if (type === "series" && season && episode) {
            if (!episodeMatches(entry.name, season, episode)) return false;
        }
        return true;
    });
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
// ROUTER (Deno Deploy native — export default { fetch })
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