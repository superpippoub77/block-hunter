"use strict";
/* "📦 Crea pacchetto per…" — shared by the level editor and the screen editor.
 * Asks the server (api/build) to build the game for web, Windows, Linux or Android, shows the
 * progress and the download links. With "npm run start:api" (server.js) every target is
 * available; on PHP hosting only the web package. */
(function () {
    const TARGETS = [
        { id: "web", icon: "🌐", name: "Web e telefoni (PWA)", desc: "Zip da caricare su un sito o su itch.io. Dai telefoni Android e iPhone si installa con \"Aggiungi a schermata Home\" e funziona offline." },
        { id: "windows", icon: "🪟", name: "Windows", desc: "Zip con BlockHunter.exe (64 bit): estrai e avvia, non serve installare nulla." },
        { id: "linux", icon: "🐧", name: "Linux", desc: "Archivio .tar.gz con l'eseguibile (64 bit)." },
        { id: "android", icon: "🤖", name: "Android", desc: "APK se sul computer c'è l'Android SDK, altrimenti il progetto pronto da aprire con Android Studio." }
    ];
    const $ = (s, r = document) => r.querySelector(s);
    let pollTimer = null;
    let caps = null;

    function overlay() {
        let ov = $("#pkgOverlay");
        if (ov) return ov;
        ov = document.createElement("div");
        ov.id = "pkgOverlay";
        ov.className = "modal-overlay";
        ov.innerHTML = `<div class="modal-box pkg-box" role="dialog" aria-modal="true">
            <div class="modal-head"><h3>📦 Crea pacchetto per…</h3><button type="button" class="iconbtn" aria-label="Chiudi">✕</button></div>
            <div class="modal-body">
              <div class="pkg-targets"></div>
              <div class="pkg-progress" hidden><div class="pkg-status"></div><pre class="pkg-log"></pre></div>
              <div class="pkg-files"></div>
              <p class="hint pkg-note"></p>
            </div></div>`;
        ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
        ov.querySelector(".modal-head button").addEventListener("click", close);
        document.body.appendChild(ov);
        return ov;
    }
    function close() { $("#pkgOverlay")?.classList.remove("open"); clearInterval(pollTimer); }

    function renderFiles(files) {
        const box = $("#pkgOverlay .pkg-files");
        if (!files || !files.length) { box.innerHTML = ""; return; }
        box.innerHTML = `<div class="sec-title">Pacchetti pronti</div>` + files.map((f) =>
            `<a class="btn pkg-dl" href="${f}" download>⬇ ${f.replace(/^dist\//, "")}</a>`).join("");
    }

    function renderTargets() {
        const box = $("#pkgOverlay .pkg-targets");
        box.innerHTML = "";
        TARGETS.forEach((t) => {
            const ok = !!(caps && caps.targets && caps.targets[t.id]);
            const card = document.createElement("div");
            card.className = "pkg-card" + (ok ? "" : " off");
            const extra = t.id === "android" && caps && caps.server === "node" ? (caps.androidSdk ? " (SDK trovato: APK)" : " (SDK non trovato: progetto Android Studio)") : "";
            card.innerHTML = `<div class="pkg-icon">${t.icon}</div><div class="pkg-text"><b>${t.name}</b><span>${t.desc}${extra}</span></div>`;
            const b = document.createElement("button");
            b.type = "button"; b.className = "btn primary"; b.textContent = "Crea";
            b.disabled = !ok;
            b.title = ok ? `Crea il pacchetto ${t.name}` : "Disponibile avviando il server del gioco sul computer (npm run start:api)";
            b.addEventListener("click", () => start(t.id));
            card.appendChild(b);
            box.appendChild(card);
        });
        $("#pkgOverlay .pkg-note").textContent = caps && caps.server === "php"
            ? "Su questo sito si può creare solo il pacchetto web. Per Windows, Linux e Android avvia il gioco sul tuo computer con \"npm run start:api\" e apri l'editor da lì."
            : "La prima volta vengono scaricati gli strumenti (Electron, circa 100 MB): può richiedere qualche minuto. iPhone/iPad: usa la versione web (Safari → Condividi → Aggiungi alla schermata Home).";
    }

    function setBusy(busy) {
        document.querySelectorAll("#pkgOverlay .pkg-card button").forEach((b) => { b.disabled = busy || b.closest(".pkg-card").classList.contains("off"); });
    }

    async function start(target) {
        const prog = $("#pkgOverlay .pkg-progress");
        prog.hidden = false;
        $("#pkgOverlay .pkg-status").textContent = `Creo il pacchetto ${target}…`;
        $("#pkgOverlay .pkg-log").textContent = "";
        setBusy(true);
        try {
            const res = await fetch(`api/build/?target=${encodeURIComponent(target)}`, { method: "POST" });
            const data = await res.json();
            if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
            if (!data.job) { finish("done", data.files || []); return; }
            clearInterval(pollTimer);
            pollTimer = setInterval(() => poll(data.job), 1000);
        } catch (e) {
            $("#pkgOverlay .pkg-status").textContent = `Errore: ${e.message}`;
            setBusy(false);
        }
    }

    async function poll(id) {
        try {
            const res = await fetch(`api/build/?job=${encodeURIComponent(id)}`, { cache: "no-store" });
            const { job } = await res.json();
            if (!job) return;
            const log = $("#pkgOverlay .pkg-log");
            log.textContent = job.log.join("\n");
            log.scrollTop = log.scrollHeight;
            if (job.status !== "running") { clearInterval(pollTimer); finish(job.status, job.files); }
        } catch (e) { /* keep polling */ }
    }

    async function finish(status, files) {
        $("#pkgOverlay .pkg-status").textContent = status === "done" ? "✓ Pacchetto pronto" : "✕ Creazione non riuscita: guarda il registro qui sotto";
        setBusy(false);
        await refreshCaps();
        if (files && files.length) renderFiles(files.concat((caps.files || []).filter((f) => !files.includes(f))));
    }

    async function refreshCaps() {
        try {
            const res = await fetch("api/build/", { cache: "no-store" });
            caps = await res.json();
        } catch (e) {
            caps = { server: "static", targets: {}, files: [] };
        }
        if (!caps || caps.ok === false) caps = { server: "static", targets: {}, files: [] };
    }

    async function open() {
        const ov = overlay();
        ov.classList.add("open");
        $("#pkgOverlay .pkg-targets").innerHTML = "<p class=\"hint\">Controllo cosa può creare il server…</p>";
        await refreshCaps();
        renderTargets();
        renderFiles(caps.files || []);
        if (caps.server === "static") $("#pkgOverlay .pkg-note").textContent = "Il server non risponde (api/build): avvia il gioco con \"npm run start:api\" per creare i pacchetti.";
    }

    window.SpikePackager = { open };
})();
