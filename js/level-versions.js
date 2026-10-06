/*
 * Livelli del gioco e versioni (level_editor.html)
 *
 *   Apri       → elenco dei livelli in data/level/ (quelli che il gioco usa davvero): apri nell'editor
 *   Salva      → riscrive data/level/<id>.json; ogni salvataggio diventa una versione in
 *                data/level-versions/<id>/ (il primo salvataggio conserva anche l'originale)
 *   Versioni   → cronologia del livello: apri una versione nell'editor o ripristinala nel gioco
 *
 * Server: /api/levels (server.js in locale, api/levels/index.php sul sito).
 * Usa window.LevelEditorAPI (js/level-editor.js) e EditorLayout (js/editor-layout.js).
 */
(function () {
  "use strict";

  const API = "api/levels/";
  const CURRENT_KEY = "bh-editor-game-level";
  const editorApi = () => window.LevelEditorAPI || null;
  const layout = () => window.EditorLayout || null;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const status = (msg, isError = false) => { try { editorApi()?.setStatus?.(msg, isError); } catch (e) { } };

  async function call(query = "", options) {
    const res = await fetch(`${API}${query}`, { cache: "no-store", ...(options || {}) });
    let body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok || !body || body.ok === false) {
      throw new Error(body?.error || `HTTP ${res.status} (serve server.js o PHP: il file aperto da disco non può leggere/salvare i livelli)`);
    }
    return body;
  }

  // ------------------------------------------------------------ livello corrente
  const LevelVersions = {
    current: null, // { id, version, note }

    loadCurrent() {
      try { this.current = JSON.parse(localStorage.getItem(CURRENT_KEY) || "null"); } catch (e) { this.current = null; }
    },
    setCurrent(cur) {
      this.current = cur;
      try { cur ? localStorage.setItem(CURRENT_KEY, JSON.stringify(cur)) : localStorage.removeItem(CURRENT_KEY); } catch (e) { }
      this.refreshBadge();
    },
    refreshBadge() {
      const b = document.getElementById("gameLevelBadge");
      if (!b) return;
      b.hidden = !this.current;
      if (this.current) {
        b.textContent = `🎮 ${this.current.id}${this.current.version ? " · v" + shortVersion(this.current.version) : ""}`;
        b.title = `Livello del gioco: data/level/${this.current.id}.json · clic = versioni`;
      }
    },

    suggestedId() {
      if (this.current?.id) return this.current.id;
      const raw = String(document.getElementById("levelId")?.value || "").trim();
      const m = raw.match(/^(\d+)\.(\d+)$/);
      if (m) return `level${m[1]}${m[2]}`;
      return raw.replace(/[^a-z0-9_-]/gi, "") || "level";
    },

    // -------------------------------------------------------- APRI
    async openDialog() {
      const L = layout();
      if (!L) return;
      L.modal("Livelli del gioco", `<p class="hint">Caricamento dei livelli da <code>data/level/</code>…</p>`, { wide: true });
      let items = [];
      try { items = (await call("")).items || []; }
      catch (e) {
        L.modal("Livelli del gioco", `<p class="lv-error">Impossibile leggere i livelli: ${esc(e.message)}</p>
          <div class="lv-actions"><button type="button" data-lv="import">⇪ Importa un file JSON…</button></div>`, { wide: true });
        bindBody({ import: () => { L.closeModal(); document.getElementById("importTopBtn")?.click(); } });
        return;
      }
      const cur = this.current?.id;
      const rows = items.map((it) => `
        <tr class="${it.id === cur ? "lv-current" : ""}">
          <td><b>${esc(it.id)}</b>${it.id === cur ? ' <span class="lv-tag">aperto</span>' : ""}</td>
          <td>${esc(it.levelId || "")}</td>
          <td>${it.invalid ? '<span class="lv-error">JSON non valido</span>' : `${esc(it.cols)}×${esc(it.rows)}`}</td>
          <td>${esc(formatDate(it.modified))}</td>
          <td>${it.versions ? `<button type="button" class="lv-link" data-lv="versions" data-id="${esc(it.id)}">${esc(it.versions)} 🕘</button>` : '<span class="hint">—</span>'}</td>
          <td class="lv-row-actions"><button type="button" data-lv="open" data-id="${esc(it.id)}" ${it.invalid ? "disabled" : ""}>Apri</button></td>
        </tr>`).join("");
      L.modal("Livelli del gioco", `
        <p class="hint">Sono i livelli che il gioco usa (<code>data/level/</code>). Aprine uno, modificalo e usa
        <b>💾 Salva nel gioco</b>: ogni salvataggio viene conservato come versione, così puoi sempre tornare indietro.</p>
        <div class="lv-table-wrap"><table class="asset-table lv-table">
          <thead><tr><th>File</th><th>ID</th><th>Griglia</th><th>Modificato</th><th>Versioni</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="hint">Nessun livello trovato.</td></tr>'}</tbody>
        </table></div>
        <div class="lv-actions">
          <button type="button" data-lv="import">⇪ Importa un file JSON…</button>
          <span class="spacer"></span>
          ${cur ? `<button type="button" data-lv="versions" data-id="${esc(cur)}">🕘 Versioni di ${esc(cur)}</button>` : ""}
        </div>`, { wide: true });
      bindBody({
        open: (btn) => this.openLevel(btn.dataset.id),
        versions: (btn) => this.versionsDialog(btn.dataset.id),
        import: () => { L.closeModal(); document.getElementById("importTopBtn")?.click(); }
      });
    },

    async openLevel(id, version = null) {
      const api = editorApi();
      if (!api) return;
      if (!window.confirm(`Aprire ${id}${version ? " (versione " + shortVersion(version) + ")" : ""} nell'editor?\nLe modifiche non salvate del livello attuale andranno perse.`)) return;
      try {
        const body = version ? await call(`?id=${encodeURIComponent(id)}&version=${encodeURIComponent(version)}`) : await call(`?id=${encodeURIComponent(id)}`);
        api.importLevelFromText(JSON.stringify(body.data), `data/level/${id}.json`);
        this.setCurrent({ id, version: version || null });
        layout()?.closeModal();
        status(version
          ? `Aperta la versione ${shortVersion(version)} di ${id}. Per riportarla nel gioco usa 💾 Salva nel gioco (o Ripristina dalle versioni).`
          : `Aperto data/level/${id}.json. Le modifiche vanno nel gioco con 💾 Salva nel gioco.`);
      } catch (e) {
        status(`Impossibile aprire ${id}: ${e.message}`, true);
      }
    },

    // -------------------------------------------------------- SALVA
    saveDialog() {
      const L = layout();
      if (!L) return;
      const id = this.suggestedId();
      L.modal("Salva nel gioco", `
        <p>Il livello viene scritto in <code>data/level/<span id="lvSaveFile">${esc(id)}</span>.json</code> e conservato come nuova versione.</p>
        <label class="lv-field">File del livello
          <input type="text" id="lvSaveId" value="${esc(id)}" spellcheck="false" pattern="[A-Za-z0-9_-]+"></label>
        <label class="lv-field">Nota della versione (facoltativa)
          <input type="text" id="lvSaveNote" maxlength="200" placeholder="es. spostate le gemme, nuovo nemico…"></label>
        <p class="hint" id="lvSaveWarn"></p>
        <div class="lv-actions"><span class="spacer"></span>
          <button type="button" data-lv="cancel">Annulla</button>
          <button type="button" class="primary" data-lv="save">💾 Salva</button></div>`);
      const idInput = document.getElementById("lvSaveId");
      const warn = () => {
        const v = idInput.value.trim();
        document.getElementById("lvSaveFile").textContent = v;
        const w = document.getElementById("lvSaveWarn");
        w.textContent = !/^[a-z0-9_-]+$/i.test(v) ? "Solo lettere, numeri, - e _."
          : (this.current?.id && v !== this.current.id ? `Attenzione: il livello aperto è ${this.current.id}, lo salvi con un altro nome.` : "");
      };
      idInput.addEventListener("input", warn);
      warn();
      const note = document.getElementById("lvSaveNote");
      note.focus();
      note.addEventListener("keydown", (e) => { if (e.key === "Enter") document.querySelector('[data-lv="save"]')?.click(); });
      bindBody({
        cancel: () => L.closeModal(),
        save: () => this.save(idInput.value.trim(), note.value.trim())
      });
    },

    async save(id, note, dataOverride = null) {
      const api = editorApi();
      if (!api) return false;
      if (!/^[a-z0-9_-]+$/i.test(id || "")) { status("Nome del file non valido (solo lettere, numeri, - e _)", true); return false; }
      let data = dataOverride;
      if (!data) {
        try { data = api.readLevelFromForm(); } catch (e) { status(`Livello non valido: ${e.message}`, true); return false; }
      }
      try {
        const body = await call(`?id=${encodeURIComponent(id)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, note })
        });
        if (!dataOverride || this.current?.id === id) this.setCurrent({ id, version: body.version });
        layout()?.closeModal();
        status(`Salvato nel gioco: ${body.file} · versione ${shortVersion(body.version)}${note ? " · " + note : ""}`);
        return true;
      } catch (e) {
        status(`Salvataggio non riuscito: ${e.message}`, true);
        return false;
      }
    },

    // -------------------------------------------------------- VERSIONI
    async versionsDialog(id) {
      const L = layout();
      if (!L) return;
      id = id || this.current?.id;
      if (!id) { this.openDialog(); return; }
      L.modal(`Versioni di ${id}`, `<p class="hint">Caricamento…</p>`, { wide: true });
      let items = [];
      try { items = (await call(`?id=${encodeURIComponent(id)}&versions=1`)).items || []; }
      catch (e) { L.modal(`Versioni di ${id}`, `<p class="lv-error">${esc(e.message)}</p>`, { wide: true }); return; }
      const curV = this.current?.id === id ? this.current.version : null;
      const rows = items.map((v, i) => `
        <tr class="${v.version === curV ? "lv-current" : ""}">
          <td><b>${esc(shortVersion(v.version))}</b>${i === 0 ? ' <span class="lv-tag">nel gioco</span>' : ""}${v.version === curV ? ' <span class="lv-tag">nell\'editor</span>' : ""}</td>
          <td>${esc(formatDate(v.savedAt))}</td>
          <td>${v.invalid ? '<span class="lv-error">non leggibile</span>' : `${esc(v.cols)}×${esc(v.rows)}`}</td>
          <td class="lv-note">${esc(v.note || "")}</td>
          <td class="lv-row-actions">
            <button type="button" data-lv="openv" data-v="${esc(v.version)}" ${v.invalid ? "disabled" : ""} title="Carica questa versione nell'editor (il gioco non cambia)">Apri</button>
            ${i === 0 ? "" : `<button type="button" data-lv="restore" data-v="${esc(v.version)}" ${v.invalid ? "disabled" : ""} title="Rimetti questa versione nel gioco (diventa una nuova versione)">↺ Ripristina</button>`}
          </td>
        </tr>`).join("");
      L.modal(`Versioni di ${id}`, `
        <p class="hint">La prima riga è quella che il gioco usa adesso. <b>Apri</b> carica una versione nell'editor per
        guardarla o ripararla; <b>Ripristina</b> la rimette subito nel gioco. Nessuna versione viene mai cancellata.</p>
        <div class="lv-table-wrap"><table class="asset-table lv-table">
          <thead><tr><th>Versione</th><th>Salvata</th><th>Griglia</th><th>Nota</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="hint">Ancora nessuna versione: nascono al primo 💾 Salva nel gioco.</td></tr>'}</tbody>
        </table></div>
        <div class="lv-actions"><button type="button" data-lv="back">← Tutti i livelli</button></div>`, { wide: true });
      bindBody({
        back: () => this.openDialog(),
        openv: (btn) => this.openLevel(id, btn.dataset.v),
        restore: async (btn) => {
          const v = btn.dataset.v;
          if (!window.confirm(`Rimettere nel gioco la versione ${shortVersion(v)} di ${id}?\nLa versione attuale resta nella cronologia.`)) return;
          try {
            const body = await call(`?id=${encodeURIComponent(id)}&version=${encodeURIComponent(v)}`);
            const ok = await this.save(id, `Ripristino della versione ${shortVersion(v)}`, body.data);
            if (!ok) return;
            if (this.current?.id === id && window.confirm("Versione ripristinata nel gioco. Caricarla anche nell'editor?")) {
              editorApi()?.importLevelFromText(JSON.stringify(body.data), `data/level/${id}.json`);
            }
            this.versionsDialog(id);
          } catch (e) { status(`Ripristino non riuscito: ${e.message}`, true); }
        }
      });
    }
  };

  function bindBody(handlers) {
    const body = document.querySelector(".modal-overlay .modal-body");
    if (!body) return;
    body.onclick = (e) => {
      const btn = e.target.closest("[data-lv]");
      if (!btn || btn.disabled) return;
      const fn = handlers[btn.dataset.lv];
      if (fn) fn(btn);
    };
  }

  function shortVersion(v) {
    const m = String(v || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
    return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}:${m[6]}` : String(v || "");
  }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // a level imported from a file is not a game level anymore
  document.addEventListener("change", (e) => {
    if (e.target && (e.target.id === "importTopFile" || e.target.id === "importJsonFile") && LevelVersions.current) LevelVersions.setCurrent(null);
  }, true);

  LevelVersions.loadCurrent();
  window.LevelVersions = LevelVersions;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => LevelVersions.refreshBadge());
  else LevelVersions.refreshBadge();
})();
