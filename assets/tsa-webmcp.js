/* ============================================================
   TrueScale Atlas — WebMCP engine (shared, data-driven)
   Hosted at: https://truescaleatlas.com/assets/tsa-webmcp.js
   Version: 1.1.0
   Loaded by each comparison page via:
     <script type="module" src="https://truescaleatlas.com/assets/tsa-webmcp.js"></script>
   Per-page data: window.__TSA_WEBMCP_DATA__ (Head injection).
   Runtime: native document.modelContext (Chrome 149+),
   fallback navigator.modelContext, else MCP-B global runtime
   (polyfill + Rook/MCP-B extension transport) via jsDelivr.
   ============================================================ */
(async () => {
  "use strict";
  const VERSION = "1.1.0";
  const D = window.__TSA_WEBMCP_DATA__;
  if (!D || window.__TSA_WEBMCP_LOADED__) return;
  window.__TSA_WEBMCP_LOADED__ = true;
  const log = (...a) => { if (D.debug) console.info("[TSA-WebMCP]", ...a); };

  const P = D.page || {};
  const M = D.metadata || {};
  const C = D.comparison || {};
  const regions = C.regions || {};
  const keys = Object.keys(regions);
  if (!C.subject || !keys.length) { log("DATA.comparison incomplete; tools not registered."); return; }
  const primary = regions[keys[0]].label;

  let mc = document.modelContext ?? navigator.modelContext ?? null;
  let runtime = mc ? "native" : null;
  const wantPolyfill = D.polyfill === "always" || (!mc && D.polyfill !== "never");
  if (wantPolyfill) {
    try {
      await import("https://cdn.jsdelivr.net/npm/@mcp-b/global@6.2.0/+esm");
      mc = document.modelContext ?? navigator.modelContext ?? null;
      runtime = mc ? "mcp-b" : null;
      log("MCP-B runtime loaded");
    } catch (e) { console.warn("[TSA-WebMCP] polyfill load failed; page unaffected.", e); }
  }
  if (!mc || typeof mc.registerTool !== "function") { log("No WebMCP surface; tools not registered."); return; }

  const ctrl = new AbortController();
  window.addEventListener("pagehide", () => ctrl.abort(), { once: true });
  const reg = (t) => mc.registerTool(t, { signal: ctrl.signal })
    .catch((e) => console.warn("[TSA-WebMCP] register failed:", t.name, e));
  const READ = { readOnlyHint: true, untrustedContentHint: false, consequentialHint: false };

  // 1) Structured size comparison — correct summary + directional ratio + metadata
  await reg({
    name: "get_size_comparison",
    title: C.subject + " vs " + primary + " — true size",
    description: "Compare the true land area of the " + C.subject + " against " + keys.map((k) => regions[k].label).join(", ") + ". Returns areas, ratio, difference, population and density. Use for any 'is X bigger than Y' question this page covers.",
    inputSchema: {
      type: "object",
      properties: { region: { type: "string", enum: keys, description: "Region to compare the " + C.subject + " against. Defaults to " + keys[0] + "." } }
    },
    outputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" }, region: { type: "string" },
        subjectAreaKm2: { type: "number" }, regionAreaKm2: { type: "number" },
        ratio: { type: "number", description: "Larger area divided by smaller area. Always >= 1." },
        regionToSubjectRatio: { type: "number", description: "Region area divided by subject area. May be < 1." },
        differenceKm2: { type: "number" }, differencePercent: { type: "number" },
        summary: { type: "string" }
      }
    },
    annotations: READ,
    execute: async ({ region } = {}) => {
      const key = region || keys[0];
      const r = regions[key];
      if (!r) return { error: "Unknown region. Use one of: " + keys.join(", ") };
      const sA = C.subjectAreaKm2, rA = r.areaKm2;
      const larger = rA >= sA ? r.label : C.subject;
      const smaller = rA >= sA ? C.subject : r.label;
      const ratio = Math.max(sA, rA) / Math.min(sA, rA);
      const diff = rA - sA;
      const pct = (diff / sA) * 100;
      return {
        subject: C.subject, region: r.label,
        subjectAreaKm2: sA, regionAreaKm2: rA,
        subjectAreaSqMi: C.subjectAreaSqMi ?? null, regionAreaSqMi: r.areaSqMi ?? null,
        larger: larger,
        ratio: +ratio.toFixed(3),
        regionToSubjectRatio: +(rA / sA).toFixed(3),
        differenceKm2: diff, differencePercent: +pct.toFixed(1),
        subjectPopulation: C.subjectPopulation ?? null, regionPopulation: r.population ?? null,
        subjectDensityPerSqMi: C.subjectDensityPerSqMi ?? null, regionDensityPerSqMi: r.densityPerSqMi ?? null,
        summary: larger + " is about " + ratio.toFixed(2) + "× the area of " + smaller + ". Difference vs " + C.subject + ": " + (diff >= 0 ? "+" : "") + diff.toLocaleString("en-US") + " km² (" + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%).",
        areaDefinition: M.areaDefinition ?? null,
        populationReferenceYear: M.populationReferenceYear ?? null,
        dataLastVerified: M.lastVerified ?? null,
        source: P.canonical
      };
    }
  });

  // 2) Mercator inflation calculator
  await reg({
    name: "calculate_mercator_inflation",
    title: "Mercator area inflation",
    description: "Compute how much the Mercator projection inflates area at a latitude: inflation = 1 / cos²(latitude). Optionally compare two latitudes. Explains why high-latitude regions look bigger than they really are.",
    inputSchema: {
      type: "object",
      properties: {
        latitude: { type: "number", minimum: -85, maximum: 85, description: "Latitude in degrees (-85 to 85)." },
        compareLatitude: { type: "number", minimum: -85, maximum: 85, description: "Optional second latitude to compare against." }
      },
      required: ["latitude"]
    },
    annotations: READ,
    execute: async ({ latitude, compareLatitude }) => {
      const infl = (lat) => 1 / Math.pow(Math.cos(lat * Math.PI / 180), 2);
      if (typeof latitude !== "number" || latitude < -85 || latitude > 85) return { error: "latitude must be a number between -85 and 85." };
      const a = infl(latitude);
      const out = { latitude: latitude, inflationFactor: +a.toFixed(3), formula: "inflation = 1 / cos²(latitude)", explanation: "At " + latitude + "°, Mercator shows area " + a.toFixed(2) + "× larger than true area." };
      if (typeof compareLatitude === "number" && compareLatitude >= -85 && compareLatitude <= 85) {
        const b = infl(compareLatitude);
        out.compareLatitude = compareLatitude;
        out.compareInflationFactor = +b.toFixed(3);
        out.relativeRatio = +(a / b).toFixed(3);
      }
      return out;
    }
  });

  // 3) FAQ
  await reg({ name: "get_article_faq", title: "Article FAQ", description: "Return this page's questions and answers about " + C.subject + " vs " + primary + " size.", inputSchema: { type: "object", properties: {} }, annotations: READ, execute: async () => ({ faq: D.faq || [], source: P.canonical }) });

  // 4) Sources + methodology metadata
  await reg({ name: "get_article_sources", title: "Article sources & methodology", description: "Return the cited data sources (publisher + URL) and the methodology metadata behind the figures on this page.", inputSchema: { type: "object", properties: {} }, annotations: READ, execute: async () => ({
    sources: D.sources || [],
    note: P.dataNote ?? null,
    figuresSources: M.figuresSources ?? null,
    geometrySource: M.geometrySource ?? null,
    areaUnit: M.areaUnit ?? "km2",
    areaDefinition: M.areaDefinition ?? null,
    methodology: M.methodology ?? null,
    methodologyUrl: M.methodologyUrl ?? null,
    dataVersion: M.dataVersion ?? null,
    lastVerified: M.lastVerified ?? null
  }) });

  // 5) Citation
  await reg({ name: "get_citation", title: "Cite this article", description: "Return a ready-to-use citation and the canonical URL for this article.", inputSchema: { type: "object", properties: {} }, annotations: READ, execute: async () => ({ citation: P.citation, canonical: P.canonical, author: P.author, published: P.published, modified: P.modified, dataVersion: M.dataVersion ?? null, lastVerified: M.lastVerified ?? null }) });

  // 6) Navigation action — open the interactive map
  await reg({
    name: "open_true_size_map",
    title: "Open the interactive true-size map",
    description: "Navigate the current tab to the TrueScale Atlas interactive map where the user can drag countries across the globe and watch Mercator distortion disappear. Use when the user wants to see or try the comparison visually.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: false, consequentialHint: false },
    execute: async () => { const url = P.mapUrl || P.baseUrl || "https://truescaleatlas.com/"; location.assign(url); return "Opening the interactive true-size map: " + url; }
  });

  if (typeof mc.addEventListener === "function") mc.addEventListener("toolactivated", (e) => log("tool activated:", e.toolName));

  window.__TSA_WEBMCP__ = {
    version: VERSION, runtime: runtime, data: D,
    unregister: () => ctrl.abort(),
    test: async () => {
      const latA = regions[keys[0]].meanLat ?? 48;
      const latB = C.subjectMeanLat ?? 39;
      const tools = await mc.getTools();
      const out = [];
      for (const t of tools) {
        if (t.name === "open_true_size_map") { out.push({ tool: t.name, skipped: "navigation tool — not run in test" }); continue; }
        const input = t.name === "calculate_mercator_inflation" ? { latitude: latA, compareLatitude: latB } : {};
        const raw = await mc.executeTool(t, input);
        let result = raw; try { result = JSON.parse(raw); } catch (e) {}
        out.push({ tool: t.name, result: result });
      }
      return out;
    }
  };
  log("Registered 6 tools · runtime:", runtime, "· engine v" + VERSION);
})();