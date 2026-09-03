/**
 * app.js
 * ---------------------------------------------------------
 * Jukebox NFC — lógica principal
 *
 * Estrutura:
 *   1. Referências de DOM
 *   2. Gestor de áudio (AudioManager)
 *   3. Gestor de interface (UI)
 *   4. Gestor de NFC (NfcManager)
 *   5. Arranque da aplicação
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
  };

  /* =========================================================
     2. Gestor de áudio
     ---------------------------------------------------------
     Responsável por: carregar uma faixa nova, parar a
     anterior sem sobreposição de som, e manter a UI
     (barra de progresso, tempos, animação do disco)
     sincronizada com o estado real do <audio>.
     ========================================================= */

  const AudioManager = {
    currentTrackId: null,
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

      els.seek.addEventListener("input", () => { this.isSeeking = true; });
      els.seek.addEventListener("change", () => {
        const pct = Number(els.seek.value) / 100;
        if (els.audio.duration) {
          els.audio.currentTime = pct * els.audio.duration;
        }
        this.isSeeking = false;
      });
    },

    /**
     * Carrega e reproduz uma faixa nova.
     * Se já houver algo a tocar, pára e substitui de forma limpa
     * — evita sobreposição de duas faixas em simultâneo.
     */
    loadAndPlay(trackId, track) {
      const isSameTrack = trackId === this.currentTrackId;

      // Pára sempre a reprodução anterior antes de trocar de fonte.
      if (!els.audio.paused) {
        els.audio.pause();
      }

      if (!isSameTrack) {
        els.audio.setAttribute("src", track.src);
        els.audio.load();
        this.currentTrackId = trackId;
      }

      // currentTime = 0 garante que o "disco" recomeça do início
      // sempre que a tag é lida de novo, mesmo que seja a mesma faixa.
      els.audio.currentTime = 0;

      const playPromise = els.audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          // Em Android/Chrome, autoplay sem gesto do utilizador pode
          // ser bloqueado na primeiríssima leitura da sessão.
          logLine(
            "Reprodução bloqueada pelo navegador — toca em ▶ para iniciar.",
            "error"
          );
          console.warn("Falha ao iniciar reprodução:", err);
        });
      }

      UI.showTrack(trackId, track);
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
      if (!els.audio.src) return;
      els.audio.pause();
      els.audio.currentTime = 0;
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
      UI.setPlayingState(false);
      els.seek.value = "0";
      els.timeCurrent.textContent = "0:00";
    },

    onError() {
      logLine("Não foi possível carregar o ficheiro de áudio da faixa.", "error");
      UI.setPlayingState(false);
    },
  };

  /* =========================================================
     3. Gestor de interface
     ========================================================= */

  const UI = {
    showTrack(trackId, track) {
      els.trackEyebrow.textContent = "Agora a tocar";
      els.trackTitle.textContent = track.title;
      els.trackArtist.textContent = track.artist;

      if (track.cover) {
        els.discArt.style.backgroundImage = `url("${track.cover}")`;
      } else {
        els.discArt.style.backgroundImage = "none";
      }

      showToast(`${track.title} — ${track.artist}`);
    },

    showUnknownTag(rawId) {
      els.trackEyebrow.textContent = "Tag não reconhecida";
      els.trackTitle.textContent = "Sem correspondência";
      els.trackArtist.textContent = rawId ? `ID lido: ${rawId}` : "Verifica o mapeamento em tracks.js";
      showToast("Esta tag ainda não está associada a nenhuma faixa.");
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
     4. Gestor de NFC
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
        logLine(
          "Este dispositivo/navegador não suporta Web NFC. Usa o Chrome no Android.",
          "error"
        );
        els.btnScan.disabled = true;
        return;
      }

      UI.setNfcState("idle", "Toca no ícone NFC para ativar a leitura");
      logLine("Web NFC disponível. Toca no botão de leitura para começar.");

      els.btnScan.addEventListener("click", () => this.startScan());
    },

    /**
     * O scan() tem de ser chamado a partir de um gesto direto do
     * utilizador (clique/toque) na primeira vez, por regra de
     * segurança do navegador — por isso está ligado ao botão.
     */
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

      const tagId = this.resolveTagId(event);

      // Pequeno atraso apenas estético, para o estado "reading" ser visível.
      setTimeout(() => {
        UI.setNfcState("ready", "Leitor ativo — encosta uma tag");

        if (!tagId) {
          logLine("A tag não contém texto NDEF reconhecível.", "error");
          UI.showUnknownTag(null);
          return;
        }

        const track = TRACK_MAP[tagId];
        if (track) {
          logLine(`Identificador "${tagId}" corresponde a: ${track.title}.`, "ok");
          AudioManager.loadAndPlay(tagId, track);
        } else {
          logLine(`Identificador "${tagId}" não existe em tracks.js.`, "error");
          UI.showUnknownTag(tagId);
        }
      }, 250);
    },

    /**
     * Extrai o identificador da tag a partir dos registos NDEF.
     *
     * Prioridade:
     *  1. Primeiro registo de texto ("text") gravado na tag
     *     — é isto que deves gravar como "musica_01", etc.
     *  2. Registo de URL, caso prefiras gravar um URI tipo
     *     "jukebox://musica_01" (extrai o último segmento).
     *  3. Como alternativa (fallback), usa o serialNumber da
     *     própria tag — útil se não quiseres gravar nada e só
     *     associares o número de série de cada NTAG213 a uma
     *     faixa em tracks.js.
     */
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

      // Fallback: usar o número de série físico da tag.
      // Para usares este modo, define as chaves em tracks.js
      // com o valor de event.serialNumber (ex.: "04:a2:3c:...").
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
     5. Arranque da aplicação
     ========================================================= */

  document.addEventListener("DOMContentLoaded", () => {
    AudioManager.init();
    NfcManager.init();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Falha ao registar service worker:", err);
      });
    }
  });
})();
