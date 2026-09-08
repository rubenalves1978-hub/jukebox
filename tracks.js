const ALBUM_MAP = {
  album_01: {
    title: "Álbum 01",
    artist: "Artista",
    cover: "", // coloca "covers/album01.jpg" quando tiveres a capa
    tracks: [
      { title: "Cinema", src: "audio/Cinema.mp3" },
      { title: "Atende", src: "audio/Atende.mp3" },
      { title: "Medo de ser", src: "audio/Medo de ser.mp3" },
      { title: "Mensagem Vista", src: "audio/Mensagem Vista.mp3" },
      { title: "Ninguém ensinou", src: "audio/Ninguém ensinou.mp3" },
      { title: "Não devo nada", src: "audio/Não devo nada.mp3" }
    ]
  }
};

// Compatibilidade com o sistema antigo (TRACK_MAP)
// Mantemos a variável global TRACK_MAP para que código mais antigo
// continue a funcionar caso ainda a refira.
const TRACK_MAP = {
  musica_01: {
    title: "Cinema",
    artist: "",
    src: "audio/Cinema.mp3",
    cover: ""
  }
};

// Expor globalmente (scripts carregados via <script> esperam variáveis globais)
window.ALBUM_MAP = ALBUM_MAP;
window.TRACK_MAP = TRACK_MAP;
