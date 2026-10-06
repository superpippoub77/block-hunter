"use strict";
/* ============ Block Hunter · Level Editor — layout in stile SpikeCut ============
 *
 *   ┌ topbar ──────────────────────────────────────────────────────────────────┐
 *   │ ☰  ▦BlockHunter Editor  [ID] ✓Pronto      ⇪ ?  File▾ Mappa▾ Vista▾ ⋯   │
 *   ├ barra schede: Disegna · Zone ────────────────────────────────────────────┤
 *   │ rail + palette │            mappa             │  pannello a schede       │
 *   ├ status bar ──────────────────────────────────────────────────────────────┤
 *
 * Stessa struttura di SpikeCut, Fucina Sprite e SpikeCoach. Topbar, rail e menu si
 * configurano qui sotto (LAYOUT); i comandi cliccano i controlli veri dell'editor
 * (stessi id usati da js/level-editor.js), quindi la logica dell'editor non cambia.
 * Va caricato prima di js/level-editor.js.
 */

// Versione e mese di rilascio: da aggiornare a ogni rilascio.
const APP_VERSION = "2.0";
const APP_RELEASE = "Ott 2026";

// Icone in stile SpikeCut (viewBox 22, tratto 1.6)
const SC_ICON = (d, extra = "") =>
  `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${extra}<path d="${d}"/></svg>`;

const LAYOUT_ICONS = {
  menu: `<svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h14M4 11h14M4 16h14"/></svg>`,
  grid: SC_ICON("M3 3h16v16H3z M3 8.3h16 M3 13.7h16 M8.3 3v16 M13.7 3v16"),
  clear: SC_ICON("M4 6h14 M8 6V4h6v2 M6 6l1 13h8l1-13 M10 10v6 M12 10v6"),
  autoTiles: SC_ICON("M3 4h16v14H3z M3 14l5-5 4 4 2-2 5 5 M14 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"),
  autoSpawn: SC_ICON("M4 18c3-6 6-2 8-7s4-6 6-7 M4 18h3 M15 4h3v3", `<circle cx="11" cy="11" r="1.6"/>`),
  zones: SC_ICON("M4 4h14v14H4z M4 4l14 14"),
  zonesClear: SC_ICON("M4 4h14v14H4z M8 8l6 6 M14 8l-6 6"),
  zoomIn: SC_ICON("M9.5 4a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z M14 14l5 5 M7 9.5h5 M9.5 7v5"),
  zoomOut: SC_ICON("M9.5 4a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z M14 14l5 5 M7 9.5h5"),
  oneToOne: SC_ICON("M3 5h16v12H3z M7 9v4 M15 9v4 M11 9.5v.01 M11 12.5v.01"),
  open: SC_ICON("M3 6h6l2 2h8v10H3z M11 11v5 M8.5 13.5L11 11l2.5 2.5"),
  save: SC_ICON("M4 3h11l3 3v13H4z M7 3v5h7V3 M7 19v-6h8v6"),
  json: SC_ICON("M8 4c-2 0-2 1.5-2 3s-1 3-2.5 4c1.5 1 2.5 2 2.5 4s0 3 2 3 M14 4c2 0 2 1.5 2 3s1 3 2.5 4c-1.5 1-2.5 2-2.5 4s0 3-2 3"),
  play: SC_ICON("M6 4l12 7-12 7z"),
  package: SC_ICON("M11 2l8 4.5v9L11 20l-8-4.5v-9z M3 6.5l8 4.5 8-4.5 M11 11v9 M7 4.3l8 4.4"),
  screens: SC_ICON("M3 5h16v11H3z M8 19h6 M11 16v3 M9 8.5l4 2.5-4 2.5z"),
  select: SC_ICON("M5 3l11 7-5 1.2 3 5.8-2.2 1.1-3-5.9L5 16z"),
  layers: SC_ICON("M11 3l8 4-8 4-8-4z M3 11l8 4 8-4 M3 15l8 4 8-4"),
  panel: SC_ICON("M3 4h16v14H3z M13 4v14")
};

const $q = (s) => document.querySelector(s);
const clickEl = (s) => { const el = $q(s); if (el && !el.disabled) el.click(); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
const api = () => window.LevelEditorAPI || null;
const scene = () => api()?.getScene?.() || window.__levelEditorScene || null;

function toast(msg) {
  const t = $q("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

const LAYOUT = {
  // ------------------------------------------------------------ TOPBAR
  topbar: [
    [{ type: "button", id: "btnSidebar", cls: "sidebar-btn", html: LAYOUT_ICONS.menu, title: "Comprimi o espandi la barra degli strumenti", onClick: () => EditorLayout.toggleRailExpanded() }],
    [{ type: "brand", html: `<span class="brand-mark">▦</span><span class="brand-name">Block<b>Hunter</b> <span class="brand-sub">Editor</span></span>` }],
    [{ type: "input", id: "topLevelId", value: "", title: "ID del livello (es. 1.0): è anche il nome del file esportato" }],
    [{ type: "button", id: "btnReady", text: "● Livello vuoto", title: "Stato del livello · clic per esportare il file JSON (Ctrl+S)", onClick: () => clickEl("#exportBtn") }],
    "spacer",
    [
      { type: "button", id: "btnPlayTest", cls: "play", text: "▶ Prova livello", title: "Gioca subito il livello che stai creando (F5)", onClick: () => api()?.playTestLevel?.() },
      { type: "button", id: "btnOpenTop", text: "⇪ Apri", title: "Importa un livello JSON (Ctrl+O)", onClick: () => clickEl("#importTopBtn") },
      { type: "button", id: "btnHelpTop", text: "?", title: "Guida e scorciatoie (F1)", onClick: () => EditorLayout.showHelp() }
    ]
  ],

  // -------------------------------------------- MENU A TENDINA (topbar)
  menus: [
    {
      label: "File ▾", pill: true, items: [
        { icon: "⇪", label: "Importa livello JSON…", shortcut: "Ctrl+O", onClick: () => clickEl("#importTopBtn") },
        { icon: "⬇", label: "Esporta file JSON", shortcut: "Ctrl+S", onClick: () => clickEl("#exportBtn") },
        { icon: "⧉", label: "Copia JSON negli appunti", onClick: () => clickEl("#copyJsonBtn") },
        { separator: true },
        { icon: "💾", label: "Salva nel browser", onClick: () => clickEl("#saveLocalBtn") },
        { icon: "📂", label: "Carica dal browser", onClick: () => clickEl("#loadLocalBtn") },
        { separator: true },
        { icon: "▶", label: "Prova il livello nel gioco", shortcut: "F5", onClick: () => api()?.playTestLevel?.() },
        { icon: "📦", label: "Crea pacchetto per… (web, Windows, Linux, Android)", onClick: () => window.SpikePackager?.open() },
        { icon: "🎮", label: "Apri il gioco", onClick: () => window.open("index.html", "_blank", "noopener") },
        { separator: true },
        { icon: "🎬", label: "Editor delle schermate (attract, top ten…)", onClick: () => { window.location.href = "screen_editor.html"; } }
      ]
    },
    {
      label: "Mappa ▾", pill: true, items: [
        { icon: "▦", label: "Applica dimensioni griglia", onClick: () => EditorLayout.runInPanel("map", "#applyGridBtn") },
        { icon: "🗑", label: "Svuota la mappa", onClick: () => EditorLayout.confirmClick("Svuotare tutta la mappa?", "#clearGridBtn") },
        { separator: true },
        { icon: "✦", label: "Auto tiles da immagine", onClick: () => EditorLayout.runInPanel("map", "#autoPopulateFromImageBtn") },
        { icon: "↯", label: "Auto spawn da percorso", onClick: () => EditorLayout.runInPanel("map", "#autoPopulatePathSpawnsBtn") },
        { separator: true },
        { icon: "🚫", label: "Strumento zone", shortcut: "2", onClick: () => EditorLayout.setMode("zones") },
        { icon: "🖼", label: "Sposta e trasforma layer", shortcut: "3", onClick: () => EditorLayout.setMode("layers") },
        { icon: "➚", label: "Seleziona e trasforma oggetti", shortcut: "4", onClick: () => EditorLayout.setMode("select") },
        { icon: "✕", label: "Cancella zone del tipo attivo", onClick: () => clickEl("#clearActiveZones") },
        { icon: "✕", label: "Cancella tutte le zone", onClick: () => EditorLayout.confirmClick("Cancellare tutte le zone?", "#clearAllZones") }
      ]
    },
    {
      label: "Vista ▾", pill: true, items: [
        { icon: "+", label: "Ingrandisci", shortcut: "+", onClick: () => EditorLayout.zoomBy(0.25) },
        { icon: "−", label: "Riduci", shortcut: "−", onClick: () => EditorLayout.zoomBy(-0.25) },
        { icon: "1:1", label: "Scala di gioco (1 cella = 1 tile)", shortcut: "0", onClick: () => EditorLayout.zoomGame() },
        { separator: true },
        { icon: "◫", label: "Mostra/nascondi background", onClick: () => EditorLayout.toggleCheck("#showBackground") },
        { icon: "◫", label: "Mostra/nascondi foreground", onClick: () => EditorLayout.toggleCheck("#showForeground") },
        { separator: true },
        { icon: "◧", label: "Mostra/nascondi strumenti", shortcut: "[", onClick: () => EditorLayout.toggleSide("left") },
        { icon: "◨", label: "Mostra/nascondi pannello", shortcut: "]", onClick: () => EditorLayout.toggleSide("right") }
      ]
    },
    {
      label: "⋯", more: true, items: [
        { icon: "🖼", label: "Gestione asset (immagini e musiche)", onClick: () => clickEl("#openAssetsDialogBtn") },
        { icon: "🌐", label: "Dizionari (traduzioni)", onClick: () => clickEl("#openDictionaryDialogBtn") },
        { icon: "🧩", label: "Mapping Studio", onClick: () => clickEl("#openMappingsDialogBtn") },
        { icon: "⚙", label: "Configurazione del gioco", onClick: () => clickEl("#openConfigDialogBtn") },
        { separator: true },
        { icon: "📖", label: "Guida e scorciatoie", shortcut: "F1", onClick: () => EditorLayout.showHelp() },
        { icon: "ℹ️", label: "Informazioni", onClick: () => EditorLayout.showAbout() }
      ]
    }
  ],

  // --------------------------------------- RAIL SINISTRA (come SpikeCut)
  rail: [
    { section: "Mappa" },
    { id: "railApplyGrid", icon: "grid", label: "Applica griglia", title: "Applica colonne e righe impostate nel pannello", onClick: () => EditorLayout.runInPanel("map", "#applyGridBtn") },
    { id: "railAutoTiles", icon: "autoTiles", label: "Auto tiles", title: "Crea muri, acqua e fango leggendo i colori del background", onClick: () => EditorLayout.runInPanel("map", "#autoPopulateFromImageBtn") },
    { id: "railAutoSpawn", icon: "autoSpawn", label: "Auto spawn", title: "Piazza gemme e nemici sul percorso raggiungibile dal player", onClick: () => EditorLayout.runInPanel("map", "#autoPopulatePathSpawnsBtn") },
    { id: "railClear", icon: "clear", label: "Svuota mappa", title: "Svuota tutta la mappa", onClick: () => EditorLayout.confirmClick("Svuotare tutta la mappa?", "#clearGridBtn") },

    { section: "Oggetti" },
    { id: "railSelect", icon: "select", label: "Seleziona", key: "4", title: "Seleziona un oggetto della mappa per ruotarlo, ridimensionarlo, specchiarlo o eliminarlo", pressed: false, onClick: () => EditorLayout.setMode(EditorLayout.mode === "select" ? "paint" : "select") },

    { section: "Zone" },
    { id: "railZones", icon: "zones", label: "Strumento zone", key: "2", title: "Disegna zone invisibili", pressed: false, onClick: () => EditorLayout.setMode(EditorLayout.mode === "zones" ? "paint" : "zones") },
    { id: "railZonesClear", icon: "zonesClear", label: "Cancella zone", title: "Cancella le zone del tipo attivo", onClick: () => clickEl("#clearActiveZones") },

    { section: "Layer" },
    { id: "railLayers", icon: "layers", label: "Sposta layer", key: "3", title: "Sposta, ridimensiona, ruota e specchia background e foreground", pressed: false, onClick: () => EditorLayout.setMode(EditorLayout.mode === "layers" ? "paint" : "layers") },

    { section: "Vista" },
    { id: "railZoomIn", icon: "zoomIn", label: "Ingrandisci", key: "+", title: "Ingrandisci la mappa", onClick: () => EditorLayout.zoomBy(0.25) },
    { id: "railZoomOut", icon: "zoomOut", label: "Riduci", key: "−", title: "Riduci la mappa", onClick: () => EditorLayout.zoomBy(-0.25) },
    { id: "railZoomGame", icon: "oneToOne", label: "Scala di gioco", key: "0", title: "1 cella = 1 tile del gioco", onClick: () => EditorLayout.zoomGame() },

    { section: "File" },
    { id: "railImport", icon: "open", label: "Importa JSON", key: "Ctrl+O", title: "Importa un livello JSON", onClick: () => clickEl("#importTopBtn") },
    { id: "railExport", icon: "json", label: "Esporta JSON", key: "Ctrl+S", title: "Scarica il livello come file JSON", onClick: () => clickEl("#exportBtn") },
    { id: "railSaveLocal", icon: "save", label: "Salva nel browser", title: "Salva il livello nel browser (localStorage)", onClick: () => clickEl("#saveLocalBtn") },
    { id: "railPlay", icon: "play", label: "Prova livello", key: "F5", title: "Gioca subito il livello che stai creando", onClick: () => api()?.playTestLevel?.() },
    { id: "railPackage", icon: "package", label: "Crea pacchetto", title: "Crea il gioco per web, Windows, Linux, Android", onClick: () => window.SpikePackager?.open() },
    { id: "railScreens", icon: "screens", label: "Schermate", title: "Editor delle schermate: attract, istruzioni, top ten, selezione livello", onClick: () => { window.location.href = "screen_editor.html"; } },
    { id: "railPanel", icon: "panel", label: "Pannello", key: "]", title: "Mostra/nascondi il pannello delle impostazioni", onClick: () => EditorLayout.toggleSide("right") }
  ],

  // Nomi delle modalità (barra schede e status bar)
  modes: { paint: "Disegna", zones: "Zone invisibili", layers: "Layer (background e foreground)", select: "Seleziona oggetti" }
};

const EditorLayout = {
  RAIL_EXPANDED_MIN: 130,
  mode: "paint",

  // =================================================================
  // COSTRUZIONE (subito, prima di level-editor.js)
  // =================================================================
  build() {
    this.buildTopbar();
    this.buildMenus();
    this.buildRail();
    this.buildPanel();
    this.buildStatus();
    this.buildSideControls();
    this.bindModeTabs();
    this.bindZoomBar();
    this.bindScrollbarReveal();
    this.bindShortcuts();
    this.bindLevelId();
    // level-editor.js è un modulo: parte dopo questo file, quando il DOM è pronto
    window.addEventListener("load", () => this.afterInit());
  },

  /** Dopo level-editor.js: collega gli indicatori allo stato dell'editor */
  afterInit() {
    const obs = (el, fn, opts) => el && new MutationObserver(fn).observe(el, opts);
    obs($q("#selectedCellInfo"), () => this.syncCell(), { childList: true, characterData: true, subtree: true });
    obs($q("#statusText"), () => this.flashStatus(), { childList: true, characterData: true, subtree: true });
    document.addEventListener("leveleditor:zonetool", (e) => this.syncMode(e.detail?.active ? "zones" : (scene()?.layerToolActive ? "layers" : "paint")));
    document.addEventListener("leveleditor:layertool", (e) => this.syncMode(e.detail?.active ? "layers" : (scene()?.zoneToolActive ? "zones" : "paint")));
    document.addEventListener("leveleditor:selecttool", (e) => this.syncMode(e.detail?.active ? "select" : this.liveMode()));
    this.syncCell();
    this.tick();
    setInterval(() => this.tick(), 700);
  },

  // ---------------------------------------------------------- topbar
  buildTopbar() {
    const left = $q("#topbarLeft");
    LAYOUT.topbar.forEach((group) => {
      if (group === "spacer") { left.insertAdjacentHTML("beforeend", `<div class="spacer"></div>`); return; }
      const grp = document.createElement("div");
      grp.className = "grp";
      group.forEach((item) => {
        if (item.type === "brand") { grp.classList.add("brand"); grp.innerHTML = item.html; return; }
        if (item.type === "input") {
          const inp = document.createElement("input");
          inp.type = "text"; inp.id = item.id; inp.value = item.value || ""; inp.title = item.title || "";
          inp.placeholder = "ID livello";
          inp.setAttribute("aria-label", item.title || item.id);
          inp.spellcheck = false;
          grp.appendChild(inp);
          return;
        }
        const b = document.createElement("button");
        b.type = "button"; b.id = item.id; b.className = "iconbtn" + (item.cls ? " " + item.cls : "");
        if (item.html) b.innerHTML = item.html; else b.textContent = item.text;
        b.title = item.title || "";
        b.addEventListener("click", (ev) => item.onClick(ev));
        grp.appendChild(b);
      });
      if (group[0] && group[0].cls === "sidebar-btn") grp.classList.add("sidebar-grp");
      left.appendChild(grp);
    });
  },

  // ----------------------------------------------- menu a tendina
  buildMenus() {
    const bar = $q("#menu");
    LAYOUT.menus.forEach((menu) => {
      const item = document.createElement("div");
      item.className = "menu-item grp" + (menu.pill ? " pill" : "") + (menu.more ? " more" : "");
      const label = document.createElement("button");
      label.type = "button";
      label.className = "menu-label " + (menu.pill ? "btn primary" : "iconbtn");
      label.textContent = menu.label;
      label.setAttribute("aria-haspopup", "true");
      item.appendChild(label);

      const dd = document.createElement("div");
      dd.className = "menu-dropdown";
      dd.setAttribute("role", "menu");
      menu.items.forEach((entry) => {
        if (entry.separator) { dd.insertAdjacentHTML("beforeend", `<div class="menu-dropdown-separator"></div>`); return; }
        const row = document.createElement("button");
        row.type = "button";
        row.className = "menu-dropdown-item";
        row.setAttribute("role", "menuitem");
        row.innerHTML = `<span class="mi-icon">${entry.icon || ""}</span><span class="mi-label"></span>`
          + (entry.shortcut ? `<span class="shortcut">${entry.shortcut}</span>` : "");
        row.querySelector(".mi-label").textContent = entry.label;
        row.addEventListener("click", (e) => { e.stopPropagation(); this.closeMenus(); entry.onClick(); });
        dd.appendChild(row);
      });
      item.appendChild(dd);

      label.addEventListener("click", (e) => {
        e.stopPropagation();
        const was = item.classList.contains("active");
        this.closeMenus();
        if (!was) item.classList.add("active");
      });
      bar.appendChild(item);
    });
    document.addEventListener("click", () => this.closeMenus());
  },

  closeMenus() {
    document.querySelectorAll(".menu-item.active").forEach((m) => m.classList.remove("active"));
  },

  // ------------------------------------------------------------ rail
  buildRail() {
    const rail = $q("#rail");
    LAYOUT.rail.forEach((entry) => {
      if (entry.section) {
        rail.insertAdjacentHTML("beforeend", `<div class="rail-title">${entry.section}</div><div class="rail-sep"></div>`);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.id = entry.id;
      b.className = "tool";
      b.title = entry.title + (entry.key ? ` (${entry.key})` : "");
      b.setAttribute("aria-label", entry.title);
      b.innerHTML = (LAYOUT_ICONS[entry.icon] || "")
        + `<span class="tlabel">${entry.label}</span>`
        + (entry.key ? `<span class="kbd${entry.key.length > 1 ? " kbd-long" : ""}">${entry.key}</span>` : "");
      if (entry.pressed !== undefined) b.setAttribute("aria-pressed", String(entry.pressed));
      if (entry.onClick) b.addEventListener("click", (ev) => entry.onClick(ev));
      rail.appendChild(b);
    });
    this.rail = rail;
    const v = store.get("bh-rail-expanded");
    this.setRailExpanded(v === null ? true : v === "1");
  },

  setRailExpanded(expanded, width) {
    const side = $q("#sidebar");
    this.rail.classList.toggle("expanded", expanded);
    side.classList.toggle("rail-compact", !expanded);
    let w = width;
    if (w == null) {
      const saved = parseInt(store.get("bh-rail-w"), 10) || 0;
      w = expanded ? (saved >= this.RAIL_EXPANDED_MIN ? saved : 220) : 52;
    }
    side.style.width = w + "px";
    $q("#btnSidebar")?.classList.toggle("on", expanded);
    store.set("bh-rail-expanded", expanded ? "1" : "0");
  },

  toggleRailExpanded() {
    if ($q("#sidebar").classList.contains("hidden")) this.toggleSide("left");
    this.setRailExpanded(!this.rail.classList.contains("expanded"));
  },

  // ------------------------------------------- pannello destro a schede
  buildPanel() {
    const tabs = $q("#panelTabs");
    this.pages = [...document.querySelectorAll("#rightSidebar > .tabpage")];
    this.pages.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.tab = p.dataset.tab;
      b.textContent = p.dataset.label;
      b.addEventListener("click", () => this.showPanelTab(p.dataset.tab));
      tabs.appendChild(b);
    });
    const pw = parseInt(store.get("bh-panel-w"), 10);
    if (pw >= 280 && pw <= 600) $q("#rightSidebar").style.width = pw + "px";
    this.showPanelTab(store.get("bh-panel-tab") || "map");
  },

  showPanelTab(id) {
    const page = this.pages.find((p) => p.dataset.tab === id) || this.pages[0];
    if (!page) return;
    // sul telefono il pannello copre la mappa: si apre solo quando lo chiedi
    if ($q("#rightSidebar").classList.contains("hidden") && !window.matchMedia("(max-width: 760px)").matches) this.toggleSide("right");
    this.activeTab = page.dataset.tab;
    this.pages.forEach((p) => p.classList.toggle("active", p === page));
    $q("#panelTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === this.activeTab));
    store.set("bh-panel-tab", this.activeTab);
  },

  /** Esegue un comando del pannello mostrando la sua scheda (così si vede il risultato) */
  runInPanel(tab, selector) {
    this.showPanelTab(tab);
    clickEl(selector);
  },

  confirmClick(question, selector) {
    if (window.confirm(question)) clickEl(selector);
  },

  toggleCheck(selector) {
    const c = $q(selector);
    if (!c) return;
    c.checked = !c.checked;
    c.dispatchEvent(new Event("change", { bubbles: true }));
    c.dispatchEvent(new Event("input", { bubbles: true }));
    toast(`${c.checked ? "Mostro" : "Nascondo"} ${selector === "#showBackground" ? "il background" : "il foreground"}`);
  },

  // ------------------------------------------------------- status bar
  buildStatus() {
    const st = $q("#status");
    st.innerHTML = `
      <span id="statusMode"></span>
      <span id="statusGrid"></span>
      <span class="status" id="statusText"></span>
      <span class="spacer"></span>
      <span class="toggle" id="stRail" title="Mostra/nascondi la barra degli strumenti ([)">◧ Strumenti</span>
      <span class="toggle" id="stPanel" title="Mostra/nascondi il pannello (])">◨ Pannello</span>
      <span class="status-sign"><span class="sign-by">Block Hunter Editor by <a href="https://www.filippomorano.com" target="_blank" rel="noopener">SpikeCode AI</a> · </span>${APP_RELEASE} · Ver: ${APP_VERSION}</span>`;
    st.querySelector("#stRail").addEventListener("click", () => this.toggleSide("left"));
    st.querySelector("#stPanel").addEventListener("click", () => this.toggleSide("right"));
  },

  flashStatus() {
    const t = $q("#statusText");
    if (t) t.title = t.textContent;
  },

  // --------------------------------------------- modalità Disegna / Zone
  bindModeTabs() {
    $q("#modeTabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (b) this.setMode(b.dataset.mode);
    });
    this.syncMode("paint");
  },

  setMode(mode) {
    const s = scene();
    const wantZones = mode === "zones";
    const wantLayers = mode === "layers";
    const wantSelect = mode === "select";
    if (s && !!s.selectToolActive !== wantSelect && !wantSelect) api()?.setSelectTool?.(false);
    if (s && !!s.layerToolActive !== wantLayers) api()?.setLayerTool?.(wantLayers);
    if (s && !!s.zoneToolActive !== wantZones) clickEl("#toggleZoneTool");
    if (s && wantSelect && !s.selectToolActive) api()?.setSelectTool?.(true);
    this.syncMode(mode);
    if (wantZones) this.showPanelTab("map");
    if (wantLayers) this.showPanelTab("level");
  },

  liveMode() {
    const s = scene();
    if (!s) return "paint";
    return s.selectToolActive ? "select" : (s.layerToolActive ? "layers" : (s.zoneToolActive ? "zones" : "paint"));
  },

  syncMode(mode) {
    this.mode = mode;
    document.querySelectorAll("#modeTabs .tab").forEach((t) => {
      const on = t.dataset.mode === mode;
      t.classList.toggle("active", on);
      t.setAttribute("aria-pressed", String(on));
    });
    $q("#railZones")?.setAttribute("aria-pressed", String(mode === "zones"));
    $q("#railLayers")?.setAttribute("aria-pressed", String(mode === "layers"));
    $q("#railSelect")?.setAttribute("aria-pressed", String(mode === "select"));
    const m = $q("#statusMode");
    if (m) m.textContent = LAYOUT.modes[mode];
  },

  // ------------------------------------------------------------ zoom
  bindZoomBar() {
    $q("#zoomInBtn").addEventListener("click", () => this.zoomBy(0.25));
    $q("#zoomOutBtn").addEventListener("click", () => this.zoomBy(-0.25));
    $q("#zoomGameBtn").addEventListener("click", () => this.zoomGame());
  },

  setZoom(z) {
    const s = scene();
    if (!s || typeof s.setZoom !== "function") return;
    s.setZoom(Math.max(0.2, Math.min(4, z)));
    const slider = $q("#zoomSlider");
    if (slider) slider.value = String(s.zoom);
    this.tick();
  },

  zoomBy(delta) {
    const s = scene();
    if (s) this.setZoom((Number(s.zoom) || 1) + delta);
  },

  /** 1 cella dell'editor = 1 tile del gioco: dimensioni e posizioni si vedono come in partita */
  zoomGame() {
    const s = scene();
    const ts = api()?.gameTileSize?.() || 32;
    if (s && s.baseCellSize) this.setZoom(ts / s.baseCellSize);
  },

  // ------------------------------------------------ indicatori (stato)
  bindLevelId() {
    const top = $q("#topLevelId");
    top.addEventListener("input", () => {
      const f = $q("#levelId");
      if (!f) return;
      f.value = top.value;
      f.dispatchEvent(new Event("input", { bubbles: true }));
      f.dispatchEvent(new Event("change", { bubbles: true }));
    });
  },

  syncCell() {
    const src = $q("#selectedCellInfo"), dst = $q("#barCellInfo");
    if (src && dst) dst.textContent = src.textContent.replace(/^Cella selezionata:\s*/i, "Cella: ");
  },

  /** Conteggi della mappa: gemme, nemici, uscita → pulsante di stato e barra in alto */
  tick() {
    const s = scene();
    const idField = $q("#levelId"), top = $q("#topLevelId");
    if (idField && top && document.activeElement !== top && top.value !== idField.value) top.value = idField.value;
    if (!s || !Array.isArray(s.cells)) return;

    // Count like the game does: in "A/B" only A is visible, B is hidden until A is destroyed
    let gems = 0, hiddenGems = 0, enemies = 0, exits = 0, filled = 0, crowded = 0;
    const norm = (part) => part.trim().replace(/\.$/, "").replace(/\(.*$/, "").replace(/\[.*$/, "").toLowerCase();
    for (const row of s.cells) {
      for (const cell of row || []) {
        const base = String(cell?.base || "-");
        if (base !== "-") filled++;
        const parts = base.split("/").map(norm).filter(Boolean);
        if (parts.length > 2) crowded++;
        parts.forEach((t, i) => {
          if (t === "g" || t === "gem") { if (i === 0) gems++; else hiddenGems++; }
          else if (["ghost", "bat", "snake", "spider"].includes(t)) enemies++;
          else if (t === "exit") exits++;
        });
      }
    }
    const b = $q("#btnReady");
    if (b) {
      let text, cls;
      const hidden = hiddenGems ? ` (+${hiddenGems} nascoste)` : "";
      if (!filled) { text = "● Livello vuoto"; cls = ""; }
      else if (!exits) { text = "⚠ Manca l'uscita"; cls = "warn"; }
      else if (!gems) { text = `⚠ Nessuna gemma visibile${hidden}`; cls = "warn"; }
      else if (crowded) { text = `⚠ ${crowded} celle con più di 2 elementi`; cls = "warn"; }
      else { text = `✓ Pronto · ${gems} gemme${hidden} · ${enemies} nemici`; cls = "ready"; }
      b.title = "Stato del livello · clic per esportare il file JSON (Ctrl+S)\n"
        + "Nel gioco \"A/B\" vuol dire che A copre B: B compare solo quando A viene distrutto. "
        + "Il gioco legge al massimo 2 elementi per cella.";
      if (b.textContent !== text) b.textContent = text;
      b.classList.toggle("ready", cls === "ready");
      b.classList.toggle("warn", cls === "warn");
    }
    const id = idField?.value ? `Livello ${idField.value}` : "Livello";
    const cur = $q("#curName");
    const curText = `${id} · ${s.cols}×${s.rows}`;
    if (cur && cur.textContent !== curText) cur.textContent = curText;
    const g = $q("#statusGrid");
    if (g) g.textContent = `${s.cols}×${s.rows} celle`;
    const z = $q("#zoomLabel");
    if (z) z.textContent = `${Math.round((Number(s.zoom) || 1) * 100)}%`;
    const live = this.liveMode();
    if (live !== this.mode) this.syncMode(live);
  },

  // ---------------------------- pannelli laterali (come SpikeCut)
  // Maniglia di 6 px tra barra e mappa e tra mappa e pannello (trascina = larghezza,
  // doppio clic = nascondi); linguette ‹ › attaccate ai bordi della mappa.
  buildSideControls() {
    const main = $q("#mainContent"), side = $q("#sidebar"), panel = $q("#rightSidebar");
    const railR = $q("#railResizer"), panelR = $q("#panelResizer");

    this.makeResizable(railR, side, 52, 360, 1, (w, end) => {
      const expanded = w >= this.RAIL_EXPANDED_MIN;
      if (expanded !== this.rail.classList.contains("expanded")) this.setRailExpanded(expanded, w);
      if (end && expanded) store.set("bh-rail-w", String(Math.round(w)));
    });
    this.makeResizable(panelR, panel, 280, 600, -1, (w, end) => {
      if (end) store.set("bh-panel-w", String(Math.round(w)));
    });
    railR.addEventListener("dblclick", () => this.toggleSide("left"));
    panelR.addEventListener("dblclick", () => this.toggleSide("right"));

    this.switches = {};
    [["left", "Mostra/nascondi la barra degli strumenti"], ["right", "Mostra/nascondi il pannello"]].forEach(([pos, title]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sidetoggle " + pos;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("click", () => this.toggleSide(pos));
      main.appendChild(b);
      this.switches[pos] = b;
    });

    // su schermi stretti il pannello parte chiuso (si sovrappone alla mappa)
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    this.setSide("left", store.get("bh-left-hidden") !== "1");
    this.setSide("right", narrow ? false : store.get("bh-right-hidden") !== "1");
  },

  setSide(pos, visible) {
    const el = pos === "left" ? $q("#sidebar") : $q("#rightSidebar");
    const res = pos === "left" ? $q("#railResizer") : $q("#panelResizer");
    el.classList.toggle("hidden", !visible);
    res.style.display = visible ? "" : "none";
    const sw = this.switches[pos];
    sw.textContent = (pos === "left") === visible ? "‹" : "›";
    $q(pos === "left" ? "#stRail" : "#stPanel")?.classList.toggle("active", visible);
    if (pos === "right") $q("#railPanel")?.classList.toggle("active", visible);
    store.set(`bh-${pos}-hidden`, visible ? "0" : "1");
  },

  toggleSide(pos) {
    const el = pos === "left" ? $q("#sidebar") : $q("#rightSidebar");
    this.setSide(pos, el.classList.contains("hidden"));
  },

  makeResizable(handle, target, minW, maxW, sign, onChange) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX, startW = target.getBoundingClientRect().width;
      handle.classList.add("active");
      document.body.classList.add("resizing-sidebar");
      const onMove = (ev) => {
        const w = Math.max(minW, Math.min(maxW, startW + (ev.clientX - startX) * sign));
        target.style.width = w + "px";
        onChange(w, false);
      };
      const onUp = () => {
        handle.classList.remove("active");
        document.body.classList.remove("resizing-sidebar");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        onChange(parseFloat(target.style.width) || target.getBoundingClientRect().width, true);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  },

  /** Mentre scorri la barra di scorrimento resta visibile per un attimo */
  bindScrollbarReveal() {
    document.addEventListener("scroll", (e) => {
      const t = e.target === document ? document.scrollingElement : e.target;
      if (!t || !t.classList) return;
      t.classList.add("is-scrolling");
      clearTimeout(t._scrollHideT);
      t._scrollHideT = setTimeout(() => t.classList.remove("is-scrolling"), 900);
    }, { capture: true, passive: true });
  },

  // --------------------------------------------- scorciatoie da tastiera
  bindShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeMenus();
        if ($q(".modal-overlay.open")) { this.closeModal(); return; }
      }
      if (e.key === "F1") { e.preventDefault(); this.showHelp(); return; }
      if (e.key === "F5" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); api()?.playTestLevel?.(); return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); clickEl("#exportBtn"); return; }
      if (mod && !e.altKey && e.key.toLowerCase() === "o") { e.preventDefault(); clickEl("#importTopBtn"); return; }
      const t = e.target || {};
      if (t.matches?.("input,select,textarea") || t.isContentEditable) return;
      if (mod || e.altKey) return;
      if ($q(".modal-overlay.open, .config-modal.open")) return;
      const map = {
        "1": () => this.setMode("paint"),
        "2": () => this.setMode("zones"),
        "3": () => this.setMode("layers"),
        "4": () => this.setMode("select"),
        "[": () => this.toggleSide("left"),
        "]": () => this.toggleSide("right"),
        "+": () => this.zoomBy(0.25),
        "=": () => this.zoomBy(0.25),
        "-": () => this.zoomBy(-0.25),
        "0": () => this.zoomGame()
      };
      const fn = map[e.key];
      if (fn) { e.preventDefault(); fn(); }
    });
  },

  // ------------------------------------------- finestre (come .modal-box)
  modal(title, html) {
    let ov = $q(".modal-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "modal-overlay";
      ov.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><h3></h3><button type="button" class="iconbtn" aria-label="Chiudi">✕</button></div><div class="modal-body"></div></div>`;
      ov.addEventListener("click", (e) => { if (e.target === ov) this.closeModal(); });
      ov.querySelector(".modal-head button").addEventListener("click", () => this.closeModal());
      document.body.appendChild(ov);
    }
    ov.querySelector("h3").textContent = title;
    ov.querySelector(".modal-body").innerHTML = html;
    ov.classList.add("open");
    ov.querySelector(".modal-head button").focus();
  },

  closeModal() { $q(".modal-overlay")?.classList.remove("open"); },

  showHelp() {
    const mod = isMac ? "⌘" : "Ctrl";
    const keys = [
      ["1 · 2 · 3 · 4", "Disegna · Zone invisibili · Layer · Seleziona oggetti"],
      ["Seleziona: clic", "Sceglie l'oggetto (clic di nuovo = oggetto sotto, se la cella ne ha due)"],
      ["Q E / ← →", "Ruota l'oggetto selezionato di 90°"], ["H · V", "Specchia orizzontale · verticale"],
      ["PagSu · PagGiù", "Ingrandisci · rimpicciolisci l'oggetto"], ["Canc", "Elimina solo l'oggetto selezionato"],
      ["Layer: trascina", "Sposta il background/foreground selezionato"], ["Layer: maniglie", "Angoli = ridimensiona (Shift libero) · lati = allarga · tonda = ruota (Shift 15°)"], ["Clic / trascina", "Piazza l'elemento scelto nella palette"],
      [". + trascina", "Piazza l'elemento invisibile (noTile)"], ["← →", "Ruota la tile selezionata"],
      ["H · V", "Specchia la tile selezionata"], ["W", "Varianti del muro"], ["Canc", "Svuota la cella selezionata"],
      ["+ · − · 0", "Zoom · scala di gioco 1:1"], ["[  ]", "Mostra/nascondi strumenti e pannello"],
      ["F5", "Prova il livello nel gioco"], [`${mod}+S`, "Esporta il file JSON"], [`${mod}+O`, "Importa un livello JSON"], ["F1", "Questa guida"], ["Esc", "Chiudi menu e finestre"]
    ];
    this.modal("Guida e scorciatoie", `
      <p>Imposta la griglia nella scheda <b>Mappa</b>, aggiungi background e foreground nella scheda
      <b>Livello</b>, poi usa <b>Auto tiles</b> (muri, acqua e fango ricavati dai colori dell'immagine)
      e <b>Auto spawn</b> (gemme e nemici sul percorso raggiungibile dal player). Rifinisci a mano con la
      palette a sinistra ed esporta con <b>File ▾ → Esporta file JSON</b>.</p>
      <p>Con la scala <b>1:1</b> una cella dell'editor è grande come una tile del gioco: posizioni e dimensioni
      di background e foreground si vedono come in partita.</p>
      <table class="keys">${keys.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("")}</table>`);
  },

  showAbout() {
    this.modal("Informazioni", `
      <p><b>Block Hunter · Level Editor ${APP_VERSION}</b> · ${APP_RELEASE}</p>
      <p>Editor dei livelli di Block Hunter: mappa, oggetti, nemici, effetti, zone invisibili e generazione semiautomatica.</p>
      <p class="hint">Block Hunter Editor by <a href="https://www.filippomorano.com" target="_blank" rel="noopener">SpikeCode AI</a>. Interfaccia nello stile di SpikeCut.</p>`);
  }
};

window.EditorLayout = EditorLayout;
EditorLayout.build();
