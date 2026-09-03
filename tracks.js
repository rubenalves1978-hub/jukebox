/**
 * tracks.js
 * ---------------------------------------------------------
 * Mapeamento entre o identificador gravado na tag NFC
 * e a faixa correspondente.
 *
 * Cada tag NTAG213 deve conter um registo NDEF de texto
 * com um destes identificadores (ex.: "musica_01").
 * Se preferires usar o número de série da tag em vez de
 * texto gravado, usa o serialNumber como chave — ver
 * comentário em app.js na função resolveTagId().
 *
 * Para adicionar uma faixa nova:
 *   1. Coloca o ficheiro .mp3 na pasta /audio
 *   2. Acrescenta uma entrada aqui com o mesmo identificador
 *      que vais gravar na tag
 * ---------------------------------------------------------
 */

const TRACK_MAP = {
  musica_01: {
    title: "Amor de Verão",
    artist: "Banda Atlântico",
    src: "audio/musica_01.mp3",
    cover: "icons/capa_01.jpg" // opcional — deixa "" se não tiveres capa
  },
  musica_02: {
    title: "Estrada Fora",
    artist: "Rui Cardoso",
    src: "audio/musica_02.mp3",
    cover: "icons/capa_02.jpg"
  },
  musica_03: {
    title: "Noite de Fado",
    artist: "Inês Marques",
    src: "audio/musica_03.mp3",
    cover: ""
  }

  // Acrescenta mais entradas conforme necessário:
  // musica_04: { title: "...", artist: "...", src: "audio/musica_04.mp3", cover: "" },
};
