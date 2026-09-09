/**
 * tracks.js
 * ---------------------------------------------------------
 * Mapeamento entre o identificador gravado na tag NFC
 * e o ÁLBUM correspondente (com a respetiva lista de faixas).
 *
 * Cada tag NTAG213 deve conter um registo NDEF de texto
 * com um identificador de ÁLBUM (ex.: "album_01").
 * Ao ler a tag, a app mostra a capa, o título do álbum e
 * a lista completa de faixas.
 *
 * Cada faixa tem:
 *   - title:  nome da faixa
 *   - src:    caminho para o ficheiro .mp3, ou "" se ainda
 *             não tiveres o ficheiro (aparece como
 *             "A aguardar ficheiro" na interface e não é
 *             possível tocar)
 *
 * Para adicionar um álbum novo:
 *   1. Coloca a capa em /icons (ex.: icons/capa_g25vibes.jpg)
 *   2. Coloca os ficheiros .mp3 em /audio
 *   3. Acrescenta uma entrada aqui com o mesmo identificador
 *      que vais gravar na tag
 * ---------------------------------------------------------
 */

const ALBUM_MAP = {
  album_01: {
    title: "G25 Vibes",
    artist: "G25 Music",
    cover: "icons/capa_g25vibes.jpg",
    tracks: [
      { title: "Cinema", src: "audio/Cinema.mp3" },
      { title: "Atende", src: "audio/Atende.mp3" },
      { title: "Medo de ser", src: "audio/Medo de ser.mp3" },
      { title: "Mensagem Vista", src: "audio/Mensagem Vista.mp3" },
      { title: "Ninguém ensinou", src: "audio/Ninguém ensinou.mp3" },
      { title: "Não devo nada", src: "audio/Não devo nada.mp3" },
      { title: "Não te escondas", src: "audio/Não te escondas.mp3" },
      { title: "Poucos... Mas leais (cover)", src: "audio/Poucos... Mas leais.cover.mp3" },
      { title: "Whatever \"cara fechada\"", src: "audio/Whatever \"cara fechada\".mp3" },
    ],
  },

  // Acrescenta mais álbuns conforme necessário:
  // album_02: {
  //   title: "...",
  //   artist: "...",
  //   cover: "icons/....jpg",
  //   tracks: [
  //     { title: "...", src: "audio/....mp3" },
  //   ],
  // },
};
