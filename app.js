/**
 * app.js
 * ---------------------------------------------------------
 * Jukebox NFC — lógica principal (V2: album-based)
 */
(() => {
  "use strict";

  /* =========================================================
     1. Referências de DOM
     ========================================================= */

  const els = {
    audio: document.getElementById("audioPlayer"),
    disc: document.getElementById("disc"),
    discWrap: document.querySelector(".disc-wrap"),
    discArt: document.getElementById("discArt"),
    trackEyebrow: document.getElementById("trackEyebrow"),
    trackTitle: document.getElementById("trackTitle"),
    trackArtist: document.getElementById("trackArtist"),
    seek: document.getElementById("seek"),
    timeCurrent: document.getElementById("timeCurrent"),
    timeTotal: document.getElementById("timeTotal"),
    btnPlay: document.getElementById("btnPlay"),
    btnStop: document.getElementById("btnStop"),
    btnScan: document.getElementById("btnScan"),
    iconPlay: document.getElementById("iconPlay"),
    iconPause: document.getElementById("iconPause"),
    nfcStatus: document.getElementById("nfcStatus"),
    log: document.getElementById("log"),
    toast: document.getElementById("toast"),

    // New controls
    btnPrev: null,
    btnNext: null,
    btnRepeat: null,
    volume: null,
    trackList: null,
  };

  /* =========================================================
     2. Estado da App
     ========================================================= */

  const STORAGE_KEYS = {
    VOLUME: "jukebox-volume-v2",
    REPEAT: "jukebox-repeat-v2",
    LAST_ALBUM: "jukebox-last-album-v2",
  };

  const AppState = {
    albumId: null,
    album: null,
    currentIndex: null, // integer index in album.tracks
    repeat: false,
    volume: 1,
    sessionId: 0, // para evitar condições de corrida entre carregamentos
  };

  /* =========================================================
     3. Gestor de áudio (AudioManager)
     ========================================================= */

  const AudioManager = {
    init() {
      els.audio.addEventListener("timeupdate", () => this.onTimeUpdate());
      els.audio.addEventListener("loadedmetadata", () => this.onLoadedMetadata());
      els.audio.addEventListener("ended", () => this.onEnded());
      els.audio.addEventListener("play", () => this.onPlayStateChange(true));
      els.audio.addEventListener("pause", () => this.onPlayStateChange(false));
      els.audio.addEventListener("error", () => this.onError());

      els.btnPlay.addEventListener("click", () => AlbumController.togglePlayPause());
      els.btnStop.addEventListener("click", () => AlbumController.stop());

      els.seek.addEventListener("input", () => { this.isSeeking = true; });
      els.seek.addEventListener("change", () => {
        const pct = Number(els.seek.value) / 100;
        if (els.audio.duration) {
          els.audio.currentTime = pct * els.audio.duration;
        }
        this.isSeeking = false;
      });
    },

    isSeeking: false,

    // Carrega uma fonte e tenta reproduzir. sessionId ajuda a ignorar eventos antigos.
    loadAndPlay(track, sessionId) {
      if (!track || !track.src) {
        logLine("Faixa indisponível (sem ficheiro).", "error");
        return Promise.resolve(false);
      }

      // interrompe qualquer reprodução anterior
      if (!els.audio.paused) {
        els.audio.pause();
      }

      els.audio.src = track.src;
      els.audio.load();
      els.audio.currentTime = 0;

      // tentar play() e tratar bloqueio de autoplay
      const p = els.audio.play();
      if (p && typeof p.catch === "function") {
        return p.then(() => true).catch((err) => {
          logLine("Reprodução bloqueada pelo navegador — toca em ▶ para iniciar.", "error");
          console.warn("Falha ao iniciar reprodução:", err);
          return false;
        });
      }

      return Promise.resolve(true);
    },

    togglePlay() {
      if (!els.audio.src) return;
      if (els.audio.paused) {
        els.audio.play().catch((err) => console.warn(err));
      } else {
        els.audio.pause();
      }
    },

    onPlayStateChange(isPlaying) {
      UI.setPlayingState(isPlaying);
    },

    onTimeUpdate() {
      if (this.isSeeking || !els.audio.duration) return;
      const pct = (els.audio.currentTime / els.audio.duration) * 100;
      els.seek.value = String(pct);
      els.timeCurrent.textContent = formatTime(els.audio.currentTime);
    },

    onLoadedMetadata() {
      els.timeTotal.textContent = formatTime(els.audio.duration);
    },

    onEnded() {
      // delega ao AlbumController para decidir o que fazer em modo album
      AlbumController.onTrackEnded();
    },

    onError() {
      logLine("Não foi possível carregar o ficheiro de áudio da faixa.", "error");
      UI.setPlayingState(false);
    },

    setVolume(v) {
      els.audio.volume = v;
    }
  };

  /* =========================================================
     4. Gestor da reprodução por álbum (AlbumController)
     ========================================================= */

  const AlbumController = {
    loadAlbum(albumId, restart = true) {
      const map = window.ALBUM_MAP || {};
      const album = map[albumId];

      if (!album) {
        // fallback to TRACK_MAP for compatibility
        const track = (window.TRACK_MAP || {})[albumId];
        if (track) {
          // play legacy single track
          AppState.albumId = null;
          AppState.album = null;
          AppState.currentIndex = null;
          UI.showTrack(albumId, track);
          AudioManager.loadAndPlay(track, ++AppState.sessionId);
          return;
        }

        UI.showUnknownTag(albumId);
        logLine(`Identificador "${albumId}" não encontrado em ALBUM_MAP nem em TRACK_MAP.`, "error");
        return;
      }

      AppState.albumId = albumId;
      AppState.album = album;
      // render track list
      UI.renderTrackList(album);

      // show album info
      UI.showAlbum(albumId, album);

      // select first available track
      const first = this.findNextAvailableIndex(-1);
      if (first === -1) {
        logLine("Álbum não tem faixas disponíveis.", "error");
        return;
      }

      if (restart) {
        this.playIndex(first);
      } else {
        // keep current index if present
        if (AppState.currentIndex == null) {
          this.playIndex(first);
        }
      }

      // persist last album
      try { localStorage.setItem(STORAGE_KEYS.LAST_ALBUM, albumId); } catch (e) {}
    },

    playIndex(index) {
      const album = AppState.album;
      if (!album || !album.tracks || index == null) return;

      const track = album.tracks[index];
      if (!track || !track.src) {
        logLine("A faixa seleccionada não tem ficheiro de áudio.", "error");
        return;
      }

      AppState.currentIndex = index;
      AppState.sessionId++;
      const sid = AppState.sessionId;

      // Update UI
      UI.highlightTrack(index);
      UI.showTrack(`${AppState.albumId}:${index}`, Object.assign({}, track, { artist: album.artist || track.artist || "" }));

      // load and play; guard against race with sid
      AudioManager.loadAndPlay(track, sid).then((started) => {
        // nothing extra here; ended event will call AlbumController.onTrackEnded
      });
    },

    stop() {
      if (els.audio.src) {
        els.audio.pause();
        els.audio.currentTime = 0;
        AppState.currentIndex = null;
        UI.setPlayingState(false);
      }
    },

    togglePlayPause() {
      if (!els.audio.src) {
        // if nothing loaded but album present, start first
        if (AppState.album && AppState.currentIndex == null) {
          const first = this.findNextAvailableIndex(-1);
          if (first !== -1) this.playIndex(first);
        }
        return;
      }
      AudioManager.togglePlay();
    },

    onTrackEnded() {
      // Only proceed if we have an album loaded
      const album = AppState.album;
      if (!album) {
        UI.setPlayingState(false);
        els.seek.value = "0";
        els.timeCurrent.textContent = "0:00";
        return;
      }

      const next = this.findNextAvailableIndex(AppState.currentIndex);
      if (next !== -1) {
        this.playIndex(next);
      } else {
        // end of album
        if (AppState.repeat) {
          const first = this.findNextAvailableIndex(-1);
          if (first !== -1) this.playIndex(first);
        } else {
          UI.setPlayingState(false);
          els.seek.value = "0";
          els.timeCurrent.textContent = "0:00";
        }
      }
    },

    findNextAvailableIndex(fromIndex) {
      const tracks = (AppState.album && AppState.album.tracks) || [];
      for (let i = fromIndex + 1; i < tracks.length; i++) {
        if (tracks[i] && tracks[i].src) return i;
      }
      return -1;
    },

    findPrevAvailableIndex(fromIndex) {
      const tracks = (AppState.album && AppState.album.tracks) || [];
      for (let i = fromIndex - 1; i >= 0; i--) {
        if (tracks[i] && tracks[i].src) return i;
      }
      return -1;
    },

    previousButtonBehavior() {
      if (!els.audio.src) return;
      if (els.audio.currentTime > 3) {
        els.audio.currentTime = 0;
      } else {
        const prev = this.findPrevAvailableIndex(AppState.currentIndex);
        if (prev !== -1) this.playIndex(prev);
      }
    },

    nextButtonBehavior() {
      const next = this.findNextAvailableIndex(AppState.currentIndex);
      if (next !== -1) this.playIndex(next);
    },

    toggleRepeat() {
      AppState.repeat = !AppState.repeat;
      try { localStorage.setItem(STORAGE_KEYS.REPEAT, AppState.repeat ? "1" : "0"); } catch (e) {}
      UI.setRepeatState(AppState.repeat);
    },

    setVolume(v) {
      AppState.volume = v;
      AudioManager.setVolume(v);
      try { localStorage.setItem(STORAGE_KEYS.VOLUME, String(v)); } catch (e) {}
    }
  };

  /* =========================================================
     5. UI Helpers
     ========================================================= */

  const UI = {
    initControls() {
      // attach new controls in DOM if present
      els.btnPrev = document.getElementById("btnPrev");
      els.btnNext = document.getElementById("btnNext");
      els.btnRepeat = document.getElementById("btnRepeat");
      els.volume = document.getElementById("volume");
      els.trackList = document.getElementById("trackList");

      if (els.btnPrev) els.btnPrev.addEventListener("click", () => AlbumController.previousButtonBehavior());
      if (els.btnNext) els.btnNext.addEventListener("click", () => AlbumController.nextButtonBehavior());
      if (els.btnRepeat) els.btnRepeat.addEventListener("click", () => AlbumController.toggleRepeat());
      if (els.volume) {
        els.volume.addEventListener("input", (e) => {
          const v = Number(e.target.value);
          AlbumController.setVolume(v);
        });
      }

      // restore persisted values
      try {
        const vol = parseFloat(localStorage.getItem(STORAGE_KEYS.VOLUME));
        if (!Number.isNaN(vol)) {
          AppState.volume = vol;
          AudioManager.setVolume(vol);
          if (els.volume) els.volume.value = vol;
        }
        const rep = localStorage.getItem(STORAGE_KEYS.REPEAT);
        AppState.repeat = rep === "1";
        UI.setRepeatState(AppState.repeat);
      } catch (e) {}
    },

    renderTrackList(album) {
      if (!els.trackList) return;
      els.trackList.innerHTML = "";
      album.tracks.forEach((t, i) => {
        const li = document.createElement("li");
        li.className = "track-list__item" + (t.src ? "" : " track-list__item--disabled");
        li.dataset.index = String(i);

        const idx = document.createElement("span");
        idx.className = "track-list__num";
        idx.textContent = String(i + 1) + ".";

        const title = document.createElement("button");
        title.className = "track-list__title";
        title.type = "button";
        title.textContent = t.title || "—";
        if (!t.src) {
          title.disabled = true;
          const note = document.createElement("span");
          note.className = "track-list__note";
          note.textContent = "A aguardar ficheiro";
          li.appendChild(idx);
          li.appendChild(title);
          li.appendChild(note);
        } else {
          title.addEventListener("click", () => {
            const idx = Number(li.dataset.index);
            AlbumController.playIndex(idx);
          });
          li.appendChild(idx);
          li.appendChild(title);
        }

        els.trackList.appendChild(li);
      });

      // highlight current if any
      this.highlightTrack(AppState.currentIndex);
    },

    highlightTrack(index) {
      if (!els.trackList) return;
      Array.from(els.trackList.children).forEach((li) => {
        li.classList.remove("track-list__item--active");
      });
      if (index == null) return;
      const sel = els.trackList.querySelector(`li[data-index=\"${index}\"]`);
      if (sel) sel.classList.add("track-list__item--active");
    },

    showTrack(trackId, track) {
      els.trackEyebrow.textContent = "Agora a tocar";
      els.trackTitle.textContent = track.title;
      els.trackArtist.textContent = track.artist || "";

      if (track.cover) {
        els.discArt.style.backgroundImage = `url("${track.cover}")`;
      } else {
        els.discArt.style.backgroundImage = "none";
      }

      showToast(`${track.title} — ${track.artist || ""}`);
    },

    showAlbum(albumId, album) {
      els.trackEyebrow.textContent = "Álbum";
      els.trackTitle.textContent = album.title || "Álbum";
      els.trackArtist.textContent = album.artist || "";

      if (album.cover) {
        els.discArt.style.backgroundImage = `url("${album.cover}")`;
      } else {
        els.discArt.style.backgroundImage = "none";
      }
    },

    showUnknownTag(rawId) {
      els.trackEyebrow.textContent = "Tag não reconhecida";
      els.trackTitle.textContent = "Sem correspondência";
      els.trackArtist.textContent = rawId ? `ID lido: ${rawId}` : "Verifica o mapeamento em tracks.js";
      showToast("Esta tag ainda não está associada a nenhum álbum/faixa.");
    },

    setPlayingState(isPlaying) {
      els.iconPlay.hidden = isPlaying;
      els.iconPause.hidden = !isPlaying;
      els.disc.classList.toggle("is-spinning", isPlaying);
      els.discWrap.classList.toggle("is-playing", isPlaying);
    },

    setNfcState(state, text) {
      els.nfcStatus.dataset.state = state;
      els.nfcStatus.querySelector(".status-text").textContent = text;
    },

    setScanButtonActive(active) {
      els.btnScan.classList.toggle("is-active", active);
    },

    setRepeatState(active) {
      if (!els.btnRepeat) return;
      els.btnRepeat.classList.toggle("is-active", active);
    }
  };

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function logLine(text, type = "normal") {
    const p = document.createElement("p");
    p.className = "log-line" + (type === "error" ? " log-line--error" : type === "ok" ? " log-line--ok" : "");
    const time = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    p.textContent = `${time}  ${text}`;
    els.log.prepend(p);
    while (els.log.children.length > 12) {
      els.log.removeChild(els.log.lastChild);
    }
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  }

  /* =========================================================
     6. Gestor de NFC (NfcManager)
     ========================================================= */

  const NfcManager = {
    reader: null,
    isSupported: "NDEFReader" in window,
    scanActive: false,

    async init() {
      if (!this.isSupported) {
        UI.setNfcState("error", "Web NFC não suportada neste navegador");
        logLine("Este dispositivo/navegador não suporta Web NFC. Usa o Chrome no Android.", "error");
        els.btnScan.disabled = true;
        return;
      }

      UI.setNfcState("idle", "Toca no ícone NFC para ativar a leitura");
      logLine("Web NFC disponível. Toca no botão de leitura para começar.");

      els.btnScan.addEventListener("click", () => this.startScan());
    },

    async startScan() {
      if (!this.isSupported) return;
      if (this.scanActive) return; // evita múltiplos leitores

      try {
        this.reader = new NDEFReader();
        await this.reader.scan();

        this.scanActive = true;
        UI.setNfcState("ready", "Leitor ativo — encosta uma tag");
        UI.setScanButtonActive(true);
        logLine("Leitura NFC ativada. Aguardando tag…", "ok");

        this.reader.addEventListener("reading", (event) => this.onReading(event));
        this.reader.addEventListener("readingerror", () => {
          UI.setNfcState("error", "Erro ao ler a tag — tenta novamente");
          logLine("Não foi possível ler os dados da tag (readingerror).", "error");
        });
      } catch (err) {
        this.handleScanError(err);
      }
    },

    onReading(event) {
      UI.setNfcState("reading", "Tag detetada!");
      logLine(`Tag detetada (serialNumber: ${event.serialNumber || "desconhecido"}).`);

      const tagId = this.resolveTagId(event);

      setTimeout(() => {
        UI.setNfcState("ready", "Leitor ativo — encosta uma tag");

        if (!tagId) {
          logLine("A tag não contém texto NDEF reconhecível.", "error");
          UI.showUnknownTag(null);
          return;
        }

        // Preferir ALBUM_MAP (novo modelo)
        if (window.ALBUM_MAP && window.ALBUM_MAP[tagId]) {
          logLine(`Identificador "${tagId}" corresponde a um álbum.`, "ok");
          AlbumController.loadAlbum(tagId, true);
          return;
        }

        // Fallback para TRACK_MAP (compatibilidade retro)
        const track = (window.TRACK_MAP || {})[tagId];
        if (track) {
          logLine(`Identificador "${tagId}" corresponde a uma faixa (legacy).`, "ok");
          AlbumController.playIndex(null); // ensure state
          // play single legacy track
          AppState.albumId = null;
          AppState.album = null;
          AppState.currentIndex = null;
          UI.showTrack(tagId, track);
          AudioManager.loadAndPlay(track, ++AppState.sessionId);
          return;
        }

        logLine(`Identificador "${tagId}" não existe em tracks.js.`, "error");
        UI.showUnknownTag(tagId);
      }, 250);
    },

    resolveTagId(event) {
      const decoder = new TextDecoder();

      if (event.message && event.message.records) {
        for (const record of event.message.records) {
          if (record.recordType === "text") {
            try {
              return decoder.decode(record.data).trim();
            } catch (e) {
              console.warn("Erro a descodificar registo de texto:", e);
            }
          }
        }

        for (const record of event.message.records) {
          if (record.recordType === "url") {
            try {
              const url = decoder.decode(record.data).trim();
              const segments = url.split(/[/:]/).filter(Boolean);
              return segments[segments.length - 1];
            } catch (e) {
              console.warn("Erro a descodificar registo de URL:", e);
            }
          }
        }
      }

      if (event.serialNumber) return event.serialNumber;
      return null;
    },

    handleScanError(err) {
      console.error("Erro ao iniciar NDEFReader.scan():", err);

      if (err.name === "NotAllowedError") {
        UI.setNfcState("error", "Permissão de NFC recusada");
        logLine("Permissão NFC negada. Ativa o NFC no telemóvel e permite o acesso.", "error");
      } else if (err.name === "NotSupportedError") {
        UI.setNfcState("error", "NFC não suportado neste dispositivo");
        logLine("O hardware NFC não está disponível ou está desligado.", "error");
      } else if (location.protocol !== "https:" && location.hostname !== "localhost") {
        UI.setNfcState("error", "Web NFC exige HTTPS");
        logLine("A Web NFC só funciona em contexto seguro (HTTPS ou localhost).", "error");
      } else {
        UI.setNfcState("error", "Não foi possível iniciar a leitura NFC");
        logLine(`Erro ao iniciar leitura: ${err.message || err}`, "error");
      }
    }
  };

  /* =========================================================
     7. Arranque da aplicação
     ========================================================= */

  document.addEventListener("DOMContentLoaded", () => {
    // attach new DOM nodes ids that were added in index.html (if present)
    UI.initControls();

    AudioManager.init();
    NfcManager.init();

    // register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Falha ao registar service worker:", err);
      });
    }
  });
})();
