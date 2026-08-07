/* =========================================================
   CONFERE ROTA — app.js
   Aplicativo 100% client-side (HTML+CSS+JS) para conferência
   de pacotes de rota, com leitura por câmera ou leitor
   Bluetooth (modo teclado), e envio da conferência via WhatsApp.
   ========================================================= */
(function () {
  "use strict";

  /* ------------------------------------------------------
     Helpers
  ------------------------------------------------------ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const STORAGE_KEY = "confereRota:sessao";

  /* ------------------------------------------------------
     Estado da aplicação
  ------------------------------------------------------ */
  const state = {
    placa: "",
    motorista: "",
    rota: "",
    idRota: "",
    pacotes: [], // array de strings (códigos), ordem de leitura
    telaAtual: "inicial", // "inicial" | "scanner"
  };

  function salvarEstado() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* localStorage indisponível — segue sem persistência */
    }
  }

  function carregarEstado() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const salvo = JSON.parse(raw);
      if (salvo && typeof salvo === "object") {
        Object.assign(state, salvo);
      }
    } catch (e) {
      /* ignora estado corrompido */
    }
  }

  /* ------------------------------------------------------
     Elementos
  ------------------------------------------------------ */
  const els = {
    telaInicial: $("#tela-inicial"),
    telaScanner: $("#tela-scanner"),
    form: $("#form-rota"),
    inputPlaca: $("#input-placa"),
    inputMotorista: $("#input-motorista"),
    inputRota: $("#input-rota"),
    inputIdRota: $("#input-id-rota"),

    tituloRota: $("#titulo-rota"),
    subtituloPlaca: $("#subtitulo-placa"),

    btnVoltar: $("#btn-voltar"),
    btnLimpar: $("#btn-limpar"),

    scannerViewport: $("#scanner-viewport"),
    cameraStatus: $("#camera-status"),
    cameraStatusDot: $("#camera-status-dot"),
    cameraStatusTexto: $("#camera-status-texto"),

    contadorWrap: $("#contador-wrap"),
    contadorNumero: $("#contador-numero"),

    inputManual: $("#input-manual"),
    btnAdicionarManual: $("#btn-adicionar-manual"),

    listaBadge: $("#lista-badge"),
    listaPacotes: $("#lista-pacotes"),
    listaVazia: $("#lista-vazia"),

    btnEnviarWhatsapp: $("#btn-enviar-whatsapp"),

    toastContainer: $("#toast-container"),

    modalOverlay: $("#modal-confirmar"),
    modalTitulo: $("#modal-titulo"),
    modalTexto: $("#modal-texto"),
    modalCancelar: $("#modal-cancelar"),
    modalConfirmarBtn: $("#modal-confirmar-btn"),

    btnInstalar: $("#btn-instalar"),
  };

  /* ------------------------------------------------------
     Toast (mensagens rápidas)
  ------------------------------------------------------ */
  let toastAtual = null;
  let toastTimeoutId = null;

  function mostrarToast(mensagem, tipo) {
    // evita empilhamento em leituras muito rápidas (ex: pistola bluetooth):
    // substitui imediatamente o toast anterior em vez de acumular vários.
    if (toastAtual) {
      window.clearTimeout(toastTimeoutId);
      toastAtual.remove();
      toastAtual = null;
    }

    const toast = document.createElement("div");
    toast.className = "toast" + (tipo === "aviso" ? " toast--aviso" : " toast--sucesso");
    toast.textContent = mensagem;
    els.toastContainer.appendChild(toast);
    toastAtual = toast;

    toastTimeoutId = window.setTimeout(() => {
      toast.remove();
      if (toastAtual === toast) toastAtual = null;
    }, 1600);
  }

  /* ------------------------------------------------------
     Modal de confirmação (genérico, baseado em Promise)
  ------------------------------------------------------ */
  function confirmar(titulo, texto, textoBotaoConfirmar) {
    return new Promise((resolve) => {
      els.modalTitulo.textContent = titulo;
      els.modalTexto.textContent = texto;
      els.modalConfirmarBtn.textContent = textoBotaoConfirmar || "Confirmar";
      els.modalOverlay.hidden = false;

      function limpar(resultado) {
        els.modalOverlay.hidden = true;
        els.modalConfirmarBtn.removeEventListener("click", onConfirmar);
        els.modalCancelar.removeEventListener("click", onCancelar);
        els.modalOverlay.removeEventListener("click", onOverlay);
        resolve(resultado);
      }
      function onConfirmar() { limpar(true); }
      function onCancelar() { limpar(false); }
      function onOverlay(ev) { if (ev.target === els.modalOverlay) limpar(false); }

      els.modalConfirmarBtn.addEventListener("click", onConfirmar);
      els.modalCancelar.addEventListener("click", onCancelar);
      els.modalOverlay.addEventListener("click", onOverlay);
    });
  }

  /* ------------------------------------------------------
     Feedback tátil / sonoro
  ------------------------------------------------------ */
  let audioCtx = null;
  function playBeep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1250;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      /* áudio indisponível — segue sem som */
    }
  }

  function vibrarCurto() {
    if (navigator.vibrate) {
      navigator.vibrate(60);
    }
  }
  function vibrarAviso() {
    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }

  /* ------------------------------------------------------
     TELA INICIAL — validação e navegação
  ------------------------------------------------------ */
  function validarCampo(input, erroId) {
    const valor = input.value.trim();
    const campoWrap = input.closest(".campo");
    if (!valor) {
      campoWrap.classList.add("campo--erro");
      input.classList.add("campo--invalido");
      return false;
    }
    campoWrap.classList.remove("campo--erro");
    input.classList.remove("campo--invalido");
    return true;
  }

  function preencherFormularioComEstado() {
    els.inputPlaca.value = state.placa || "";
    els.inputMotorista.value = state.motorista || "";
    els.inputRota.value = state.rota || "";
    els.inputIdRota.value = state.idRota || "";
  }

  els.form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const okPlaca = validarCampo(els.inputPlaca);
    const okMotorista = validarCampo(els.inputMotorista);
    const okRota = validarCampo(els.inputRota);
    const okIdRota = validarCampo(els.inputIdRota);

    if (!(okPlaca && okMotorista && okRota && okIdRota)) {
      const primeiroInvalido = els.form.querySelector(".campo--invalido");
      if (primeiroInvalido) primeiroInvalido.focus();
      return;
    }

    state.placa = els.inputPlaca.value.trim().toUpperCase();
    state.motorista = els.inputMotorista.value.trim();
    state.rota = els.inputRota.value.trim();
    state.idRota = els.inputIdRota.value.trim();
    salvarEstado();

    irParaScanner();
  });

  // remove estado de erro assim que o usuário começa a corrigir
  [els.inputPlaca, els.inputMotorista, els.inputRota, els.inputIdRota].forEach((input) => {
    input.addEventListener("input", () => {
      const campoWrap = input.closest(".campo");
      if (input.value.trim()) {
        campoWrap.classList.remove("campo--erro");
        input.classList.remove("campo--invalido");
      }
    });
  });

  /* ------------------------------------------------------
     Navegação entre telas
  ------------------------------------------------------ */
  function irParaScanner() {
    state.telaAtual = "scanner";
    salvarEstado();

    els.telaInicial.classList.remove("tela--ativa");
    els.telaScanner.classList.add("tela--ativa");

    els.tituloRota.textContent = state.rota + " · ID " + state.idRota;
    els.subtituloPlaca.textContent = "Placa " + state.placa + " · " + state.motorista;

    renderizarLista();
    iniciarScannerCamera();
  }

  async function irParaInicial(pularConfirmacao) {
    if (!pularConfirmacao && state.pacotes.length > 0) {
      const ok = await confirmar(
        "Voltar para os dados da rota?",
        "Seus " + state.pacotes.length + " pacote(s) escaneados serão mantidos e a câmera será desligada.",
        "Voltar"
      );
      if (!ok) return;
    }

    pararScannerCamera();
    state.telaAtual = "inicial";
    salvarEstado();

    els.telaScanner.classList.remove("tela--ativa");
    els.telaInicial.classList.add("tela--ativa");
    preencherFormularioComEstado();
  }

  els.btnVoltar.addEventListener("click", () => irParaInicial(false));

  /* ------------------------------------------------------
     Lista de pacotes
  ------------------------------------------------------ */
  function renderizarLista() {
    els.listaPacotes.innerHTML = "";

    if (state.pacotes.length === 0) {
      const li = document.createElement("li");
      li.className = "lista-vazia";
      li.id = "lista-vazia";
      li.textContent = "Nenhum pacote escaneado ainda.";
      els.listaPacotes.appendChild(li);
    } else {
      state.pacotes.forEach((codigo, index) => {
        const li = document.createElement("li");
        li.className = "pacote-item";

        const numero = document.createElement("span");
        numero.className = "pacote-item__numero";
        numero.textContent = String(index + 1);

        const span = document.createElement("span");
        span.className = "pacote-item__codigo";
        span.textContent = codigo;

        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "pacote-item__remover";
        btnRemover.setAttribute("aria-label", "Remover pacote " + codigo);
        btnRemover.textContent = "✕";
        btnRemover.addEventListener("click", () => removerPacote(codigo));

        li.appendChild(numero);
        li.appendChild(span);
        li.appendChild(btnRemover);
        els.listaPacotes.appendChild(li);
      });
    }

    const total = state.pacotes.length;
    els.contadorNumero.textContent = String(total);
    els.listaBadge.textContent = String(total);
    els.btnEnviarWhatsapp.disabled = total === 0;
  }

  function pulsarContador() {
    els.contadorWrap.classList.add("pulso");
    window.setTimeout(() => els.contadorWrap.classList.remove("pulso"), 180);
  }

  function removerPacote(codigo) {
    state.pacotes = state.pacotes.filter((c) => c !== codigo);
    salvarEstado();
    renderizarLista();
    mostrarToast("Pacote removido.", "aviso");
  }

  els.btnLimpar.addEventListener("click", async () => {
    if (state.pacotes.length === 0) {
      mostrarToast("A lista já está vazia.", "aviso");
      return;
    }
    const ok = await confirmar(
      "Limpar lista de pacotes?",
      "Todos os " + state.pacotes.length + " pacote(s) escaneados nesta rota serão apagados. Esta ação não pode ser desfeita.",
      "Limpar tudo"
    );
    if (!ok) return;
    state.pacotes = [];
    salvarEstado();
    renderizarLista();
    mostrarToast("Lista de pacotes limpa.", "aviso");
  });

  /* ------------------------------------------------------
     Núcleo: adicionar pacote lido (câmera, bluetooth ou manual)
  ------------------------------------------------------ */
  let ultimoCodigoLido = "";
  let ultimoCodigoTimestamp = 0;
  const JANELA_DEBOUNCE_MS = 2000; // evita reprocessar o mesmo código repetidamente

  function processarLeitura(codigoBruto, origem) {
    const codigo = String(codigoBruto || "").trim();
    if (!codigo) return;

    const agora = Date.now();
    if (codigo === ultimoCodigoLido && (agora - ultimoCodigoTimestamp) < JANELA_DEBOUNCE_MS) {
      return; // mesma leitura repetida em sequência muito rápida — ignora silenciosamente
    }
    ultimoCodigoLido = codigo;
    ultimoCodigoTimestamp = agora;

    if (state.pacotes.includes(codigo)) {
      vibrarAviso();
      mostrarToast("Este pacote já foi escaneado.", "aviso");
      return;
    }

    state.pacotes.push(codigo);
    salvarEstado();
    renderizarLista();
    pulsarContador();
    playBeep();
    vibrarCurto();
    mostrarToast("Pacote adicionado com sucesso ✓", "sucesso");
  }

  /* ------------------------------------------------------
     Entrada manual (também serve como campo alvo opcional
     para leitores bluetooth em modo teclado)
  ------------------------------------------------------ */
  function adicionarManual() {
    const valor = els.inputManual.value.trim();
    if (!valor) {
      els.inputManual.focus();
      return;
    }
    // entrada manual ignora a janela de debounce (usuário decide conscientemente)
    ultimoCodigoLido = "";
    processarLeitura(valor, "manual");
    els.inputManual.value = "";
    els.inputManual.focus();
  }

  els.btnAdicionarManual.addEventListener("click", adicionarManual);
  els.inputManual.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      adicionarManual();
    }
  });

  /* ------------------------------------------------------
     Leitor Bluetooth tipo pistola (modo teclado / HID)
     Detecta sequências de teclas digitadas muito rapidamente
     (não vindas do usuário) finalizadas com Enter/Tab, mesmo
     quando nenhum campo de texto está focado.
  ------------------------------------------------------ */
  let bufferLeitor = "";
  let ultimaTeclaTimestamp = 0;
  const INTERVALO_MAX_ENTRE_TECLAS_MS = 45; // scanners disparam bem mais rápido que digitação humana
  const TAMANHO_MINIMO_CODIGO = 3;

  document.addEventListener("keydown", (ev) => {
    if (state.telaAtual !== "scanner") return;

    const alvo = ev.target;
    const estaDigitandoEmCampo =
      alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA") && alvo !== els.inputManual;
    if (estaDigitandoEmCampo) return; // não interfere em outros campos de formulário

    // se o próprio campo manual está focado, deixamos o handler dele (Enter) cuidar do envio
    if (alvo === els.inputManual) return;

    const agora = Date.now();
    const intervalo = agora - ultimaTeclaTimestamp;
    ultimaTeclaTimestamp = agora;

    if (ev.key === "Enter" || ev.key === "Tab") {
      if (bufferLeitor.length >= TAMANHO_MINIMO_CODIGO) {
        ev.preventDefault();
        processarLeitura(bufferLeitor, "bluetooth");
      }
      bufferLeitor = "";
      return;
    }

    if (ev.key.length === 1) {
      // caractere imprimível
      if (intervalo > INTERVALO_MAX_ENTRE_TECLAS_MS) {
        bufferLeitor = ev.key; // reinicia buffer — digitação humana lenta
      } else {
        bufferLeitor += ev.key;
      }
    }
  });

  /* ------------------------------------------------------
     Scanner de câmera (Quagga.js) — códigos 1D
  ------------------------------------------------------ */
  let scannerAtivo = false;

  function definirStatusCamera(estado, texto) {
    els.cameraStatusDot.classList.remove("ativa", "erro");
    if (estado === "ativa") els.cameraStatusDot.classList.add("ativa");
    if (estado === "erro") els.cameraStatusDot.classList.add("erro");
    els.cameraStatusTexto.textContent = texto;
  }

  function iniciarScannerCamera() {
    if (typeof Quagga === "undefined") {
      definirStatusCamera("erro", "Scanner indisponível — use a leitura manual ou bluetooth.");
      return;
    }
    if (scannerAtivo) return;

    definirStatusCamera("iniciando", "Iniciando câmera…");

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: els.scannerViewport,
          constraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2,
        frequency: 10,
        decoder: {
          readers: [
            "code_128_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "codabar_reader",
            "i2of5_reader",
          ],
        },
        locate: true,
      },
      function (err) {
        if (err) {
          console.error("Erro ao iniciar câmera:", err);
          definirStatusCamera("erro", "Câmera indisponível — use a leitura manual ou bluetooth.");
          scannerAtivo = false;
          return;
        }
        Quagga.start();
        scannerAtivo = true;
        definirStatusCamera("ativa", "Câmera ativa");
      }
    );

    Quagga.onDetected(onCodigoDetectado);
  }

  function onCodigoDetectado(resultado) {
    const codigo = resultado && resultado.codeResult && resultado.codeResult.code;
    if (!codigo) return;
    processarLeitura(codigo, "camera");
  }

  function pararScannerCamera() {
    if (!scannerAtivo) return;
    try {
      Quagga.offDetected(onCodigoDetectado);
      Quagga.stop();
    } catch (e) {
      /* ignora erro ao parar */
    }
    scannerAtivo = false;
  }

  // pausa a câmera quando o app vai para segundo plano (economiza bateria)
  document.addEventListener("visibilitychange", () => {
    if (state.telaAtual !== "scanner") return;
    if (document.hidden) {
      pararScannerCamera();
    } else {
      iniciarScannerCamera();
    }
  });

  /* ------------------------------------------------------
     Montagem da mensagem e envio para o WhatsApp
  ------------------------------------------------------ */
  function montarMensagem() {
    const linhas = [];
    linhas.push("📦 CONFERÊNCIA DE PACOTES");
    linhas.push("");
    linhas.push("🚚 Placa:");
    linhas.push(state.placa);
    linhas.push("");
    linhas.push("👤 Motorista:");
    linhas.push(state.motorista);
    linhas.push("");
    linhas.push("🛣️ Rota:");
    linhas.push(state.rota);
    linhas.push("");
    linhas.push("🆔 ID da Rota:");
    linhas.push(state.idRota);
    linhas.push("");
    linhas.push("📦 Pacotes (" + state.pacotes.length + "):");
    linhas.push("");
    state.pacotes.forEach((codigo) => linhas.push("• " + codigo));
    linhas.push("");
    linhas.push("Total de pacotes: " + state.pacotes.length);
    return linhas.join("\n");
  }

  els.btnEnviarWhatsapp.addEventListener("click", () => {
    if (state.pacotes.length === 0) return;
    const mensagem = montarMensagem();
    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(mensagem);
    window.open(url, "_blank", "noopener");
  });

  /* ------------------------------------------------------
     Instalação do app (PWA / "Adicionar à tela inicial")
  ------------------------------------------------------ */
  let eventoInstalacaoAdiado = null;
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    eventoInstalacaoAdiado = ev;
    els.btnInstalar.hidden = false;
  });

  els.btnInstalar.addEventListener("click", async () => {
    if (!eventoInstalacaoAdiado) return;
    eventoInstalacaoAdiado.prompt();
    await eventoInstalacaoAdiado.userChoice;
    eventoInstalacaoAdiado = null;
    els.btnInstalar.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    els.btnInstalar.hidden = true;
  });

  /* ------------------------------------------------------
     Service Worker (PWA offline)
  ------------------------------------------------------ */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => {
        console.warn("Falha ao registrar service worker:", e);
      });
    });
  }

  /* ------------------------------------------------------
     Inicialização
  ------------------------------------------------------ */
  function iniciar() {
    carregarEstado();
    preencherFormularioComEstado();

    if (state.telaAtual === "scanner" && state.placa && state.motorista && state.rota && state.idRota) {
      irParaScanner();
    }
  }

  iniciar();
})();
