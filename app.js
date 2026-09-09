/**
 * app.js
 * ---------------------------------------------------------
 * Jukebox NFC — lógica principal
 *
 * Modelo de dados: cada tag NFC corresponde a um ÁLBUM
 * (ver ALBUM_MAP em tracks.js), que contém uma lista de
 * faixas. Ao ler uma tag, o álbum é carregado e mostrado
 * na íntegra; o utilizador escolhe a faixa a tocar na lista,
 * ou usa os controlos anterior/seguinte para navegar dentro
 * do álbum atual.
 *
 * Estrutura:
 *   1. Referências de DOM
 *   2. Estado da aplicação
 *   3. Gestor de áudio (AudioManager)
 *   4. Gestor de interface (UI)
 *   5. Gestor de NFC (NfcManager)
 *   6. Arranque da aplicação
 * ---------------------------------------------------------
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
    btnSettings: document.getElementById("btnSettings"),
    iconPlay: document.getElementById("iconPlay"),
    iconPause: document.getElementById("iconPause"),
    nfcStatus: document.getElementById("nfcStatus"),
    statusText: document.getElementById("statusText"),
    log: document.getElementById("log"),
    toast: document.getElementById("toast"),
  };

  /* =========================================================
     2. Estado da aplicação
     ========================================================= */

  const state = {
    albumId: null,
    album: null,
    trackIndex: -1,
    repeat: false,
  };

  /* =========================================================
     3. Gestor de áudio
     ---------------------------------------------------------
     Responsável por: carregar uma faixa nova, parar a
     anterior sem sobreposição de som, navegar entre faixas
     do álbum atual, e manter a UI sincronizada com o estado
     real do <audio>.
     ========================================================= */

  const AudioManager = {
    isSeeking: false,

    init() {
      els.audio.addEventListener("timeupdate", () => this.onTimeUpdate());
      els.audio.addEventListener("loadedmetadata", () => this.onLoadedMetadata());
      els.audio.addEventListener("ended", () => this.onEnded());
      els.audio.addEventListener("play", () => this.onPlayStateChange(true));
      els.audio.addEventListener("pause", () => this.onPlayStateChange(false));
      els.audio.addEventListener("error", () => this.onError());

      els.btnPlay.addEventListener("click", () => this.togglePlay());
      els.btnStop.addEventListener("click", () => this.stop());
      els.btnPrev.addEventListener("click", () => this.playRelative(-1));
      els.btnNext.addEventListener("click", () => this.playRelative(1));
      els.btnRepeat.addEventListener("click", () => this.toggleRepeat());

      els.seek.addEventListener("input", () => { this.isSeeking = true; });
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
    },

    /**
     * Carrega o álbum completo (chamado quando uma tag é lida).
     * Não inicia reprodução automaticamente até o utilizador
     * escolher uma faixa — evita autoplay bloqueado e dá
     * controlo ao utilizador sobre por onde começar.
     */
    loadAlbum(albumId, album) {
      state.albumId = albumId;
      state.album = album;
      state.trackIndex = -1;

      this.stop();
      UI.showAlbum(album);
      UI.renderTracklist(album);

      // Toca automaticamente a primeira faixa disponível.
      const firstPlayableIndex = album.tracks.findIndex((t) => !!t.src);
      if (firstPlayableIndex !== -1) {
        this.playTrack(firstPlayableIndex);
      } else {
        logLine("Nenhuma faixa deste álbum tem ficheiro de áudio ainda.", "error");
      }
    },

    /**
     * Reproduz a faixa no índice indicado dentro do álbum atual.
     * Pára sempre a faixa anterior antes de trocar de fonte,
     * para nunca haver duas faixas a tocar em simultâneo.
     */
    playTrack(index) {
      if (!state.album) return;
      const track = state.album.tracks[index];
      if (!track) return;

      if (!track.src) {
        logLine(`"${track.title}" ainda não tem ficheiro associado.`, "error");
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
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          logLine("Reprodução bloqueada pelo navegador — toca em ▶ para iniciar.", "error");
          console.warn("Falha ao iniciar reprodução:", err);
        });
      }

      UI.highlightCurrentTrack();
    },

    playRelative(offset) {
      if (!state.album) return;
      const total = state.album.tracks.length;
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
        els.audio.play().catch((err) => console.warn(err));
      } else {
        els.audio.pause();
      }
    },

    stop() {
      els.audio.pause();
      els.audio.currentTime = 0;
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
      els.btnRepeat.classList.toggle("is-active", state.repeat);
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
      if (state.repeat) return; // loop nativo trata disto
      // Avança automaticamente para a faixa seguinte disponível.
      this.playRelative(1);
    },

    onError() {
      if (!els.audio.getAttribute("src")) return; // stop() limpa o src; ignora esse erro esperado
      logLine("Não foi possível carregar o ficheiro de áudio da faixa.", "error");
      UI.setPlayingState(false);
    },
  };

  /* =========================================================
     4. Gestor de interface
     ========================================================= */

  const UI = {
    showAlbum(album) {
      els.albumEyebrow.textContent = "Álbum";
      els.albumTitle.textContent = album.title;
      els.albumArtist.textContent = album.artist;

      const total = album.tracks.length;
      const available = album.tracks.filter((t) => !!t.src).length;
      els.albumCount.textContent =
        available === total
          ? `${total} faixa${total !== 1 ? "s" : ""}`
          : `${total} faixas · ${available} disponível${available !== 1 ? "eis" : ""}`;

      if (album.cover) {
        els.discArt.style.backgroundImage = `url("${album.cover}")`;
        els.discArt.classList.remove("is-empty");
      } else {
        els.discArt.style.backgroundImage = "none";
        els.discArt.classList.add("is-empty");
      }

      showToast(`${album.title} — ${album.artist}`);
    },

    showUnknownTag(rawId) {
      els.albumEyebrow.textContent = "Tag não reconhecida";
      els.albumTitle.textContent = "Sem correspondência";
      els.albumArtist.textContent = rawId ? `ID lido: ${rawId}` : "Verifica o mapeamento em tracks.js";
      els.albumCount.textContent = "";
      els.tracklist.innerHTML = "";
      showToast("Esta tag ainda não está associada a nenhum álbum.");
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
        if (!hasFile) row.disabled = true;

        row.innerHTML = `
          <span class="track-marker ${hasFile ? "" : "is-empty"}">
            ${hasFile ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' : ""}
          </span>
          <span class="track-num">${String(index + 1).padStart(2, "0")}</span>
          <span class="track-name">${escapeHtml(track.title)}</span>
          <span class="track-meta">${hasFile ? "" : "A aguardar ficheiro"}</span>
        `;

        row.addEventListener("click", () => AudioManager.playTrack(index));

        li.appendChild(row);
        els.tracklist.appendChild(li);
      });
    },

    highlightCurrentTrack() {
      const rows = els.tracklist.querySelectorAll(".track-row");
      rows.forEach((row) => {
        const isCurrent = Number(row.dataset.index) === state.trackIndex;
        row.classList.toggle("is-current", isCurrent);

        const meta = row.querySelector(".track-meta");
        const track = state.album?.tracks[Number(row.dataset.index)];
        if (track?.src && meta) {
          meta.textContent = isCurrent ? formatTime(els.audio.duration) : "";
        }
      });
    },

    setPlayingState(isPlaying) {
      els.iconPlay.hidden = isPlaying;
      els.iconPause.hidden = !isPlaying;
      els.disc.classList.toggle("is-spinning", isPlaying);
      els.discWrap.classList.toggle("is-playing", isPlaying);
    },

    setNfcState(stateName, text) {
      els.nfcStatus.dataset.state = stateName;
      els.statusText.textContent = text;
    },

    setScanButtonActive(active) {
      els.btnScan.parentElement.classList.toggle("is-active", active);
    },
  };

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

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
     5. Gestor de NFC
     ---------------------------------------------------------
     Usa a Web NFC API (NDEFReader), disponível apenas em
     Chrome para Android, servido por HTTPS (ou localhost),
     e requer interação do utilizador para o primeiro scan().
     ========================================================= */

  const NfcManager = {
    reader: null,
    isSupported: "NDEFReader" in window,

    async init() {
      if (!this.isSupported) {
        UI.setNfcState("error", "Web NFC não suportada neste navegador");
        logLine("Este dispositivo/navegador não suporta Web NFC. Usa o Chrome no Android.", "error");
        els.btnScan.disabled = true;
        return;
      }

      logLine("Web NFC disponível. Toca no ícone NFC para começar.");
      els.btnScan.addEventListener("click", () => this.startScan());
    },

    async startScan() {
      if (!this.isSupported) return;

      try {
        this.reader = new NDEFReader();
        await this.reader.scan();

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

      const albumId = this.resolveTagId(event);

      setTimeout(() => {
        UI.setNfcState("ready", "Leitor ativo — encosta uma tag");

        if (!albumId) {
          logLine("A tag não contém texto NDEF reconhecível.", "error");
          UI.showUnknownTag(null);
          return;
        }

        const album = ALBUM_MAP[albumId];
        if (album) {
          logLine(`Identificador "${albumId}" corresponde a: ${album.title}.`, "ok");
          AudioManager.loadAlbum(albumId, album);
        } else {
          logLine(`Identificador "${albumId}" não existe em tracks.js.`, "error");
          UI.showUnknownTag(albumId);
        }
      }, 250);
    },

    resolveTagId(event) {
      const decoder = new TextDecoder();

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

      if (event.serialNumber) {
        return event.serialNumber;
      }

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
    },
  };

  /* =========================================================
     6. Arranque da aplicação
     ========================================================= */

  document.addEventListener("DOMContentLoaded", () => {
    AudioManager.init();
    NfcManager.init();

    els.btnSettings.addEventListener("click", () => {
      els.log.hidden = !els.log.hidden;
      els.btnSettings.classList.toggle("is-active", !els.log.hidden);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Falha ao registar service worker:", err);
      });
    }
  });
})();
