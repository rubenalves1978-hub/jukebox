# Jukebox NFC

PWA que reproduz músicas ao ler tags NFC (NTAG213) usando a Web NFC API.

## Estrutura de ficheiros

```
nfc-jukebox/
├── index.html      → estrutura da interface
├── styles.css      → estilos (leitor estilo toca-discos)
├── tracks.js       → mapeamento tag → música (edita este ficheiro)
├── app.js          → lógica de NFC + áudio + interface
├── manifest.json   → configuração da PWA
├── sw.js           → service worker (cache offline)
├── audio/          → coloca aqui os teus ficheiros .mp3
└── icons/          → ícones da app e capas dos álbuns
```

## Requisitos obrigatórios (Web NFC)

A Web NFC API só funciona se **todas** estas condições forem cumpridas:

1. **Chrome para Android** (versão 89+). Não funciona em iOS, nem em desktop, nem noutros navegadores.
2. **HTTPS obrigatório** — ou `localhost` durante testes. Não funciona em `file://` nem em HTTP simples.
3. **NFC ativado** nas definições do telemóvel.
4. **Gesto do utilizador** para o primeiro `scan()` — por isso a app tem um botão de "ativar leitura" em vez de arrancar sozinha.
5. O ecrã tem de estar **ligado e desbloqueado**, e o Chrome tem de estar em primeiro plano.

## Como testar localmente

```bash
# Qualquer servidor HTTPS simples serve. Exemplo com Node:
npx http-server -S -C cert.pem -K key.pem .

# Ou publica num serviço com HTTPS automático (GitHub Pages,
# Netlify, Vercel, etc.) — é o caminho mais simples.
```

Depois abre o URL no Chrome do telemóvel Android.

## Como gravar as tags NTAG213

Usa uma app como **NFC Tools** (Android, grátis) para gravar um registo **NDEF de texto** em cada tag:

1. Abre o NFC Tools → "Escrever"
2. Adiciona um registo do tipo **Texto**
3. Escreve exatamente o identificador que usaste em `tracks.js`, ex.: `musica_01`
4. Grava na tag NTAG213
5. Repete para cada música, com o identificador correspondente

> Alternativa: se preferires não gravar nada nas tags, podes usar o **número de série de fábrica** de cada tag como identificador. O código já trata disso automaticamente (ver `resolveTagId()` em `app.js`) — só precisas de ler o `serialNumber` de cada tag uma vez (aparece no registo/log da app) e usá-lo como chave em `tracks.js`.

## Como adicionar uma música nova

1. Copia o `.mp3` para a pasta `audio/`
2. Abre `tracks.js` e acrescenta uma entrada:

```js
musica_04: {
  title: "Título da Faixa",
  artist: "Nome do Artista",
  src: "audio/musica_04.mp3",
  cover: "icons/capa_04.jpg" // ou "" se não tiveres capa
},
```

3. Grava uma tag nova com o texto `musica_04`

Não é preciso tocar em `app.js`.

## Limitações conhecidas

- **iOS não é suportado.** A Web NFC API não existe no Safari nem em nenhum navegador iOS (a Apple restringe o acesso NFC a apps nativas). Se precisares de suporte iOS, a alternativa seria uma app nativa/Capacitor com o plugin de NFC correspondente.
- O **autoplay pode ser bloqueado** na primeiríssima leitura de uma sessão nova, mesmo com o `scan()` ativo — o Chrome por vezes exige um segundo toque no botão ▶. O código já trata este caso e mostra um aviso.
- O `NDEFReader.scan()` fica ativo até a página ser fechada/recarregada; não há necessidade de o reativar entre leituras da mesma sessão — apenas na primeira vez.
