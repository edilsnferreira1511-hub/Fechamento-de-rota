# Confere Rota — Conferência de Pacotes

Aplicativo web (PWA) para motoristas registrarem os pacotes de uma rota via
leitura de código de barras (câmera ou leitor Bluetooth) e enviarem a
conferência pronta pelo WhatsApp. 100% front-end — HTML, CSS e JavaScript
puro, sem backend, pronto para o GitHub Pages.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `confere-rota`).
2. Vá em **Add file → Upload files** e arraste **todos os arquivos desta
   pasta de uma vez** (não tem pasta nenhuma pra se preocupar — é só
   selecionar tudo e soltar).
3. Commit.
4. No repositório, vá em **Settings → Pages**.
5. Em **Source**, selecione a branch `main` (ou `master`) e a pasta `/root`.
6. Salve. Em alguns minutos o app estará disponível em
   `https://SEU-USUARIO.github.io/confere-rota/`.
7. Abra o link no celular pelo Chrome (Android) ou Safari (iOS).

Não é necessário nenhum passo de build — os arquivos já estão prontos para
produção.

## Estrutura de arquivos

Todos os arquivos ficam soltos, direto na raiz do repositório — sem
subpastas:

```
index.html          Estrutura das duas telas (dados da rota e scanner)
style.css             Todo o visual (tema azul-marinho + branco, responsivo)
app.js                 Lógica: formulário, câmera, leitor bluetooth, lista, WhatsApp, PWA
manifest.json          Metadados do app instalável (ícones, cores, nome)
sw.js                   Service worker — cache do app shell para uso offline
icon-192.png            Ícone do app (192px)
icon-512.png            Ícone do app (512px)
icon-maskable-192.png   Ícone "maskable" (192px)
icon-maskable-512.png   Ícone "maskable" (512px)
```

## Funcionalidades

- **Tela inicial**: placa, motorista, rota e ID da rota, com validação.
- **Scanner por câmera**: leitura de códigos 1D (Code 128, Code 39, EAN,
  UPC, Codabar, Interleaved 2 of 5) via [Quagga.js], usando a câmera
  traseira do celular.
- **Leitor Bluetooth (pistola)**: reconhecido automaticamente. O app
  detecta sequências de teclas digitadas muito rápido (padrão de leitores
  HID/teclado) e trata como um código lido, mesmo sem nenhum campo em foco.
- **Feedback de leitura**: som de confirmação (gerado via Web Audio API,
  sem depender de arquivo externo), vibração curta e mensagem de sucesso.
- **Duplicados bloqueados**: tentativa de reler um código já escaneado
  mostra "Este pacote já foi escaneado." e não o adiciona de novo.
- **Lista de pacotes**: contador, lista com opção de remover item por item,
  botão "Limpar lista" com confirmação.
- **Envio para WhatsApp**: monta a mensagem no formato solicitado e abre
  `https://api.whatsapp.com/send?text=...` para o motorista escolher o
  contato/grupo de destino.
- **PWA offline**: depois do primeiro carregamento (que precisa de internet
  para baixar a biblioteca de leitura de código de barras), o app funciona
  sem conexão, graças ao service worker (`sw.js`). Pode ser instalado na
  tela inicial do celular (Android mostra o botão "Instalar aplicativo";
  no iPhone, use Compartilhar → "Adicionar à Tela de Início" no Safari).
- **Sessão preservada**: se o app for fechado no meio de uma rota, os dados
  da rota e os pacotes já escaneados continuam salvos no aparelho
  (localStorage) ao reabrir.

## Observações importantes

- **Permissão de câmera**: o navegador vai pedir permissão de câmera na
  primeira vez. Se for negada ou o aparelho não tiver câmera compatível, o
  app continua funcionando normalmente pela leitura manual/Bluetooth — o
  status "Câmera ativa" no topo do visor avisa quando a câmera está ou não
  disponível.
- **HTTPS obrigatório para câmera**: o GitHub Pages já serve o site em
  HTTPS por padrão, então a câmera funciona normalmente. Se for testar
  localmente, use `https://` ou `http://localhost`, nunca abra o
  `index.html` direto como arquivo (`file://`), pois o navegador bloqueia o
  acesso à câmera nesse caso.
- **Biblioteca de leitura de código de barras**: é carregada de um CDN
  (jsDelivr) na primeira visita e fica em cache pelo service worker para
  uso offline depois disso. Se quiser eliminar totalmente a dependência de
  CDN, baixe o arquivo `quagga.min.js` e referencie-o localmente em
  `quagga.min.js` (arquivo solto, na raiz, como os demais), ajustando o
  `<script>` no `index.html` e a
  lista `ARQUIVOS_EXTERNOS` do `sw.js`.
- **Número de WhatsApp**: como o pedido não especifica um número fixo de
  destino, o app abre o WhatsApp com a mensagem pronta e deixa o motorista
  escolher o contato/grupo. Se quiser enviar sempre para um número fixo,
  troque a URL em `app.js` (função `btnEnviarWhatsapp` → adicione o
  número, ex.: `https://api.whatsapp.com/send?phone=55SEUNUMERO&text=...`).

[Quagga.js]: https://github.com/serratus/quaggaJS
