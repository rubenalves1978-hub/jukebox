(() => {
  "use strict";

  /* =========================================================
     1. REFERÊNCIAS DE DOM
     ========================================================= */

  const els = {
    audio: document.getElementById("audioPlayer"),
    disc: document.getElementById("disc"),
    discWrap: document.querySelector(".disc-wrap"),
    discArt: document.getElementById("discArt"),

    albumEyebrow: document.getElementById("albumEyebrow"),
    albumTitle: document.getElementById("albumTitle"),
    albumArtist: document.getElementById("albumArtist"),
    albumCount: document.getElementById("albumCount"),

    tracklist: document.getElementById("tracklist"),

    seek: document.getElementById("seek"),
    volume: document.getElementById("volume"),
    timeCurrent: document.getElementById("timeCurrent"),
    timeTotal: document.getElementById("timeTotal"),

    btnPlay: document.getElementById("btnPlay"),
    btnStop: document.getElementById("btnStop"),
    btnPrev: document.getElementById("btnPrev"),
    btnNext: document.getElementById("btnNext"),
    btnRepeat: document.getElementById("btnRepeat"),
    btnScan: document.getElementById("btnScan"),
    btnTheme: document.getElementById("btnTheme"),
    btnSettings: document.getElementById("btnSettings"),

    iconPlay: document.getElementById("iconPlay"),
    iconPause: document.getElementById("iconPause"),
    iconSun: document.getElementById("iconSun"),
    iconMoon: document.getElementById("iconMoon"),

    nfcStatus: document.getElementById("nfcStatus"),

    log: document.getElementById("log"),
    toast: document.getElementById("toast"),
  };

  /* =========================================================
     2. ESTADO
     ========================================================= */

  const savedTheme = localStorage.getItem("theme");

  const state = {
    albumId: null,
    album: null,
    trackIndex: -1,
    repeat: false,
    isDarkMode: savedTheme !== "light",
  };

  /* =========================================================
     3. GESTOR DE ÁUDIO
     ========================================================= */

  const AudioManager = {
    isSeeking: false,

    init() {
      els.audio.addEventListener("timeupdate", () => this.onTimeUpdate());

      els.audio.addEventListener(
        "loadedmetadata",
        () => this.onLoadedMetadata()
      );

      els.audio.addEventListener("ended", () => this.onEnded());

      els.audio.addEventListener(
        "play",
        () => this.onPlayStateChange(true)
      );

      els.audio.addEventListener(
        "pause",
        () => this.onPlayStateChange(false)
      );

      els.audio.addEventListener("error", () => this.onError());

      els.btnPlay.addEventListener("click", () => this.togglePlay());
      els.btnStop.addEventListener("click", () => this.stop());
      els.btnPrev.addEventListener("click", () => this.playRelative(-1));
      els.btnNext.addEventListener("click", () => this.playRelative(1));
      els.btnRepeat.addEventListener("click", () => this.toggleRepeat());

      els.seek.addEventListener("input", () => {
        this.isSeeking = true;

        if (els.audio.duration) {
          const pct = Number(els.seek.value) / 100;
          els.audio.currentTime = pct * els.audio.duration;
          els.timeCurrent.textContent = formatTime(
            els.audio.currentTime
          );
        }
      });

      els.seek.addEventListener("change", () => {
        const pct = Number(els.seek.value) / 100;

        if (els.audio.duration) {
          els.audio.currentTime = pct * els.audio.duration;
        }

        this.isSeeking = false;
      });

      els.volume.addEventListener("input", () => {
        els.audio.volume = Number(els.volume.value) / 100;
      });

      // Volume inicial
      els.audio.volume = Number(els.volume.value) / 100;
    },

    loadAlbum(albumId, album) {
      state.albumId = albumId;
      state.album = album;
      state.trackIndex = -1;

      this.stop();

      UI.showAlbum(album);
      UI.renderTracklist(album);

      // Começa automaticamente na primeira faixa disponível.
      const firstPlayableIndex = album.tracks.findIndex(
        (track) => !!track.src
      );

      if (firstPlayableIndex !== -1) {
        this.playTrack(firstPlayableIndex);
      } else {
        logLine(
          "Nenhuma faixa deste álbum tem ficheiro de áudio ainda.",
          "error"
        );
      }
    },

    playTrack(index) {
      if (!state.album) return;

      const track = state.album.tracks[index];

      if (!track) return;

      if (!track.src) {
        logLine(
          `"${track.title}" ainda não tem ficheiro associado.`,
          "error"
        );

        showToast(`${track.title} — a aguardar ficheiro`);
        return;
      }

      const isSameTrack = index === state.trackIndex;

      if (!els.audio.paused) {
        els.audio.pause();
      }

      if (!isSameTrack) {
        els.audio.setAttribute("src", track.src);
        els.audio.load();
        state.trackIndex = index;
      }

      els.audio.currentTime = 0;

      const playPromise = els.audio.play();

      if (
        playPromise &&
        typeof playPromise.catch === "function"
      ) {
        playPromise.catch((err) => {
          logLine(
            "Reprodução bloqueada pelo navegador — toca em ▶ para iniciar.",
            "error"
          );

          console.warn(
            "Falha ao iniciar reprodução:",
            err
          );
        });
      }

      UI.highlightCurrentTrack();
    },

    playRelative(offset) {
      if (!state.album) return;

      const total = state.album.tracks.length;

      if (!total) return;

      let next = state.trackIndex;

      for (let i = 0; i < total; i++) {
        next = (next + offset + total) % total;

        if (state.album.tracks[next].src) {
          this.playTrack(next);
          return;
        }
      }
    },

    togglePlay() {
      if (!els.audio.src) return;

      if (els.audio.paused) {
        const playPromise = els.audio.play();

        if (
          playPromise &&
          typeof playPromise.catch === "function"
        ) {
          playPromise.catch((err) => {
            console.warn(
              "Falha ao reproduzir:",
              err
            );
          });
        }
      } else {
        els.audio.pause();
      }
    },

    stop() {
      els.audio.pause();

      try {
        els.audio.currentTime = 0;
      } catch (e) {
        // Ignora se ainda não existir uma fonte carregada.
      }

      els.audio.removeAttribute("src");
      els.audio.load();

      state.trackIndex = -1;

      UI.setPlayingState(false);
      UI.highlightCurrentTrack();

      els.seek.value = "0";
      els.timeCurrent.textContent = "0:00";
      els.timeTotal.textContent = "0:00";
    },

    toggleRepeat() {
      state.repeat = !state.repeat;

      els.audio.loop = state.repeat;

      els.btnRepeat.classList.toggle(
        "is-active",
        state.repeat
      );
    },

    onPlayStateChange(isPlaying) {
      UI.setPlayingState(isPlaying);
    },

    onTimeUpdate() {
      if (this.isSeeking || !els.audio.duration) return;

      const pct =
        (els.audio.currentTime / els.audio.duration) * 100;

      els.seek.value = String(pct);

      els.timeCurrent.textContent =
        formatTime(els.audio.currentTime);
    },

    onLoadedMetadata() {
      els.timeTotal.textContent =
        formatTime(els.audio.duration);
    },

    onEnded() {
      if (state.repeat) return;

      this.playRelative(1);
    },

    onError() {
      if (!els.audio.getAttribute("src")) return;

      logLine(
        "Não foi possível carregar o ficheiro de áudio da faixa.",
        "error"
      );

      UI.setPlayingState(false);
    },
  };

  /* =========================================================
     4. GESTOR DE INTERFACE
     ========================================================= */

  const UI = {
    showAlbum(album) {
      els.albumEyebrow.textContent = "Álbum";
      els.albumTitle.textContent = album.title;
      els.albumArtist.textContent = album.artist;

      const total = album.tracks.length;

      const available = album.tracks.filter(
        (track) => !!track.src
      ).length;

      if (available === total) {
        els.albumCount.textContent =
          `${total} faixa${total !== 1 ? "s" : ""}`;
      } else {
        els.albumCount.textContent =
          `${total} faixas · ${available} disponível${available !== 1 ? "eis" : ""}`;
      }

      if (album.cover) {
        els.discArt.style.backgroundImage =
          `url("${album.cover}")`;

        els.discArt.classList.remove("is-empty");
      } else {
        els.discArt.style.backgroundImage = "none";
        els.discArt.classList.add("is-empty");
      }

      showToast(
        `${album.title} — ${album.artist}`
      );
    },

    showUnknownTag(rawId) {
      els.albumEyebrow.textContent =
        "Tag não reconhecida";

      els.albumTitle.textContent =
        "Sem correspondência";

      els.albumArtist.textContent =
        rawId
          ? `ID lido: ${rawId}`
          : "Verifica o mapeamento em tracks.js";

      els.albumCount.textContent = "";

      els.tracklist.innerHTML = "";

      showToast(
        "Esta tag ainda não está associada a nenhum álbum."
      );
    },

    renderTracklist(album) {
      els.tracklist.innerHTML = "";

      album.tracks.forEach((track, index) => {
        const li = document.createElement("li");

        const row = document.createElement("button");

        row.type = "button";
        row.className = "track-row";
        row.dataset.index = String(index);

        const hasFile = !!track.src;

        if (!hasFile) {
          row.disabled = true;
        }

        row.innerHTML = `
          <span class="track-marker ${hasFile ? "" : "is-empty"}">
            ${
              hasFile
                ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
                : ""
            }
          </span>

          <span class="track-num">
            ${String(index + 1).padStart(2, "0")}
          </span>

          <span class="track-name">
            ${escapeHtml(track.title)}
          </span>

          <span class="track-meta"></span>
        `;

        row.addEventListener(
          "click",
          () => AudioManager.playTrack(index)
        );

        li.appendChild(row);
        els.tracklist.appendChild(li);
      });
    },

    highlightCurrentTrack() {
      const rows =
        els.tracklist.querySelectorAll(".track-row");

      rows.forEach((row) => {
        const isCurrent =
          Number(row.dataset.index) === state.trackIndex;

        row.classList.toggle(
          "is-current",
          isCurrent
        );
      });
    },

    setPlayingState(isPlaying) {
      els.iconPlay.hidden = isPlaying;
      els.iconPause.hidden = !isPlaying;

      els.disc.classList.toggle(
        "is-spinning",
        isPlaying
      );

      els.discWrap.classList.toggle(
        "is-playing",
        isPlaying
      );
    },

    /*
     * O estado NFC agora é mostrado apenas pela cor/animação
     * do botão. O antigo #statusText já não existe no HTML.
     */
    setNfcState(stateName) {
      els.nfcStatus.dataset.state = stateName;
    },

    setScanButtonActive(active) {
      els.btnScan.classList.toggle(
        "is-active",
        active
      );
    },

    toggleTheme() {
      state.isDarkMode = !state.isDarkMode;

      const newTheme =
        state.isDarkMode ? "dark" : "light";

      localStorage.setItem(
        "theme",
        newTheme
      );

      document.body.classList.toggle(
        "light-mode",
        !state.isDarkMode
      );

      els.iconSun.hidden =
        !state.isDarkMode;

      els.iconMoon.hidden =
        state.isDarkMode;
    },
  };

  /* =========================================================
     5. FUNÇÕES AUXILIARES
     ========================================================= */

  function escapeHtml(str) {
    const div =
      document.createElement("div");

    div.textContent = str;

    return div.innerHTML;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "0:00";
    }

    const minutes =
      Math.floor(seconds / 60);

    const secs =
      Math.floor(seconds % 60);

    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function logLine(text, type = "normal") {
    const p =
      document.createElement("p");

    p.className =
      "log-line" +
      (
        type === "error"
          ? " log-line--error"
          : type === "ok"
            ? " log-line--ok"
            : ""
      );

    const time =
      new Date().toLocaleTimeString(
        "pt-PT",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      );

    p.textContent =
      `${time}  ${text}`;

    els.log.prepend(p);

    while (els.log.children.length > 12) {
      els.log.removeChild(
        els.log.lastChild
      );
    }
  }

  let toastTimer = null;

  function showToast(message) {
    els.toast.textContent = message;

    els.toast.classList.add(
      "is-visible"
    );

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      els.toast.classList.remove(
        "is-visible"
      );
    }, 2600);
  }

  /* =========================================================
     6. GESTOR DE NFC
     ========================================================= */

  const NfcManager = {
    reader: null,
    isSupported:
      "NDEFReader" in window,

    async init() {
      if (!this.isSupported) {
        UI.setNfcState("error");

        logLine(
          "Este dispositivo/navegador não suporta Web NFC. Usa o Chrome no Android.",
          "error"
        );

        els.btnScan.disabled = true;

        return;
      }

      UI.setNfcState("idle");

      logLine(
        "Web NFC disponível. Toca no ícone NFC para começar."
      );

      els.btnScan.addEventListener(
        "click",
        () => this.startScan()
      );
    },

    async startScan() {
      if (!this.isSupported) return;

      // Evita iniciar vários leitores ao tocar repetidamente.
      if (this.reader) {
        UI.setNfcState("ready");
        return;
      }

      try {
        this.reader =
          new NDEFReader();

        await this.reader.scan();

        UI.setNfcState("ready");

        UI.setScanButtonActive(true);

        logLine(
          "Leitura NFC ativada. Aguardando tag…",
          "ok"
        );

        this.reader.addEventListener(
          "reading",
          (event) => this.onReading(event)
        );

        this.reader.addEventListener(
          "readingerror",
          () => {
            UI.setNfcState("error");

            logLine(
              "Não foi possível ler os dados da tag (readingerror).",
              "error"
            );
          }
        );
      } catch (err) {
        this.reader = null;

        this.handleScanError(err);
      }
    },

    onReading(event) {
      UI.setNfcState("reading");

      logLine(
        `Tag detetada (serialNumber: ${event.serialNumber || "desconhecido"}).`
      );

      const albumId =
        this.resolveTagId(event);

      setTimeout(() => {
        UI.setNfcState("ready");

        if (!albumId) {
          logLine(
            "A tag não contém texto NDEF reconhecível.",
            "error"
          );

          UI.showUnknownTag(null);

          return;
        }

        const album =
          ALBUM_MAP[albumId];

        if (album) {
          logLine(
            `Identificador "${albumId}" corresponde a: ${album.title}.`,
            "ok"
          );

          AudioManager.loadAlbum(
            albumId,
            album
          );
        } else {
          logLine(
            `Identificador "${albumId}" não existe em tracks.js.`,
            "error"
          );

          UI.showUnknownTag(
            albumId
          );
        }
      }, 250);
    },

    resolveTagId(event) {
      const decoder =
        new TextDecoder();

      /*
       * Primeiro procura texto NDEF.
       */
      for (const record of event.message.records) {
        if (record.recordType === "text") {
          try {
            return decoder
              .decode(record.data)
              .trim();
          } catch (e) {
            console.warn(
              "Erro a descodificar registo de texto:",
              e
            );
          }
        }
      }

      /*
       * Depois tenta URL NDEF.
       */
      for (const record of event.message.records) {
        if (record.recordType === "url") {
          try {
            const url =
              decoder
                .decode(record.data)
                .trim();

            const segments =
              url
                .split(/[\/:]/)
                .filter(Boolean);

            return segments[
              segments.length - 1
            ];
          } catch (e) {
            console.warn(
              "Erro a descodificar registo de URL:",
              e
            );
          }
        }
      }

      /*
       * Último recurso: número de série.
       */
      if (event.serialNumber) {
        return event.serialNumber;
      }

      return null;
    },

    handleScanError(err) {
      console.error(
        "Erro ao iniciar NDEFReader.scan():",
        err
      );

      if (err.name === "NotAllowedError") {
        UI.setNfcState("error");

        logLine(
          "Permissão NFC negada. Ativa o NFC no telemóvel e permite o acesso.",
          "error"
        );

      } else if (err.name === "NotSupportedError") {
        UI.setNfcState("error");

        logLine(
          "O hardware NFC não está disponível ou está desligado.",
          "error"
        );

      } else if (
        location.protocol !== "https:" &&
        location.hostname !== "localhost"
      ) {
        UI.setNfcState("error");

        logLine(
          "A Web NFC só funciona em contexto seguro (HTTPS ou localhost).",
          "error"
        );

      } else {
        UI.setNfcState("error");

        logLine(
          `Erro ao iniciar leitura: ${err.message || err}`,
          "error"
        );
      }
    },
  };

  /* =========================================================
     7. ARRANQUE
     ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      /*
       * Aplicar tema guardado.
       */
      document.body.classList.toggle(
        "light-mode",
        !state.isDarkMode
      );

      els.iconSun.hidden =
        !state.isDarkMode;

      els.iconMoon.hidden =
        state.isDarkMode;

      /*
       * Inicializar áudio e NFC.
       */
      AudioManager.init();
      NfcManager.init();

      /*
       * Tema.
       */
      els.btnTheme.addEventListener(
        "click",
        () => UI.toggleTheme()
      );

      /*
       * Registo/eventos.
       */
      els.btnSettings.addEventListener(
        "click",
        () => {
          els.log.hidden =
            !els.log.hidden;

          els.btnSettings.classList.toggle(
            "is-active",
            !els.log.hidden
          );
        }
      );

      /*
       * Service Worker.
       */
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("./sw.js")
          .catch((err) => {
            console.warn(
              "Falha ao registar service worker:",
              err
            );
          });
      }
    }
  );
})();
