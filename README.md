# Denner Barbearia — Sistema de Agendamento

Site mobile-first (HTML + CSS + JavaScript puro) com backend em Firebase
(Authentication + Firestore). Três áreas: **Cliente** (`index.html`),
**Painel Admin** (`admin.html`) e **Painel do Barbeiro** (`barbeiro.html`).

Nenhuma etapa aqui exige linha de comando — tudo é feito pelo navegador,
no Firebase Console e no GitHub.

---

## 1. Projeto Firebase

✅ Já conectado ao projeto **barbearia-b244b** — as chaves já estão em
`firebase-config.js`, não precisa mexer nisso.

Falta ativar os serviços (gratuito, plano Spark):

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → abra o projeto **barbearia-b244b**.
2. **Build → Authentication → Get started**.
   - Aba "Sign-in method" → ative **E-mail/senha**.
   - Ative também **Anônimo** (é como os clientes usam "Meus agendamentos" sem precisar criar conta).
3. **Build → Firestore Database → Create database** → modo **produção** → escolha a região mais próxima (ex: `southamerica-east1`).

> **Sobre fotos**: este projeto usa **link de imagem** (cole a URL de uma foto) em vez de upload de arquivo — assim você não precisa ativar o Firebase Storage nem cadastrar cartão. Veja a seção "Fotos" mais abaixo.

## 2. (já feito) Conectar o código ao seu projeto

Isso já está pronto em `firebase-config.js` — pule para o passo 3.

## 3. Publicar as regras de segurança

1. **Firestore Database → Regras** → apague o conteúdo → cole o conteúdo de `firestore.rules` → **Publicar**.

## 4. Criar o PIN do Administrador (direto pelo site, sem Firebase Console)

1. Abra `admin.html` (local ou já publicado).
2. Como ainda não existe nenhum administrador, vai aparecer a tela **"Primeiro acesso"** automaticamente.
3. Escolha o PIN que você vai usar (mínimo 6 dígitos), confirme, e toque em **CRIAR PIN E ENTRAR**.
4. Pronto — já entra direto no painel com esse PIN a partir de agora.

> ⚠️ **Importante — faça isso assim que publicar o site**: essa tela de
> "Primeiro acesso" fica disponível pra **qualquer pessoa que abrir
> `admin.html` antes de você**, já que o site é público. Depois que o
> primeiro PIN é criado (por você ou por outra pessoa), essa porta se
> fecha sozinha e não abre mais. Então: assim que subir os arquivos pro
> GitHub Pages, entre em `admin.html` e crie seu PIN **antes** de
> divulgar o link do site pra qualquer pessoa. Se por acaso alguém criar
> antes de você, me avise que ajudo a resetar pelo Firebase Console.

Depois de criado, você pode trocar o PIN quando quiser em **Painel Admin
→ Configurações → Administrador**, sem precisar do Firebase Console.

## 5. Popular dados iniciais (serviços e horários)

1. Abra `admin.html` no navegador (localmente ou já publicado) e entre com o PIN.
2. Abra o Console do navegador (F12) → cole o conteúdo de `seed.js` → Enter.
3. Isso cria os 4 serviços iniciais e os horários de funcionamento padrão.
   Depois disso, ajuste tudo pela própria aba **Configurações** e **Serviços** do painel.

## 6. Cadastrar os barbeiros (direto pelo painel)

1. No painel admin → aba **Barbeiros** → **＋ NOVO BARBEIRO**.
2. Preencha nome, telefone, foto (opcional) e o **e-mail e senha de login** que esse barbeiro vai usar.
3. Toque em **SALVAR**.

O login já é criado automaticamente e o barbeiro já consegue entrar em
`barbeiro.html` com esse e-mail e senha, enxergando só a própria agenda.
Se ele esquecer a senha, tem um botão "Esqueci minha senha" na tela de
login dele, que envia um link de redefinição por e-mail — nada disso
passa pelo Firebase Console.

## 7. Fotos (logo, capa, barbeiros, serviços, galeria)

Fotos são enviadas direto do celular e guardadas **dentro do seu próprio
Firestore** — o site comprime a imagem no celular antes de salvar, então
não precisa de Firebase Storage, cartão, nem conta em nenhum serviço
externo. É só tocar em "escolher foto" em qualquer lugar do painel admin
que peça imagem, e pronto.

Único detalhe técnico: por ficar guardada como texto dentro do banco
(em vez de um arquivo separado), cada foto é comprimida automaticamente
para caber no limite do Firestore (a qualidade fica ótima para o uso no
site — telas de celular — mas não é indicada para imprensa/impressão em
alta resolução).

## 8. Publicar no GitHub Pages (pelo celular)

Todos os arquivos ficam soltos, sem pastas — é só selecionar tudo de uma vez:

1. No app ou site do GitHub, crie um repositório novo (ex: `denner-barbearia`) — pode marcar como **Public**.
2. Abra o repositório → toque em **Add file → Upload files**.
3. Toque em "escolher seus arquivos", navegue até a pasta onde estão os arquivos deste projeto no seu celular e **selecione todos de uma vez** (toque e segure no primeiro, depois toque nos outros para marcar vários — ou use "Selecionar tudo" do gerenciador de arquivos).
4. Envie. Como não há nenhuma subpasta, o GitHub aceita tudo junto, sem erro.
5. Role até "Commit changes" → toque em **Commit changes** para confirmar.
6. Vá em **Settings → Pages** → em "Source" escolha a branch `main` e a pasta `/ (root)` → **Save**.
7. Em alguns minutos o site estará em `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.
8. Volte no Firebase: **Authentication → Settings → Authorized domains → Add domain** → adicione esse domínio do GitHub Pages (senão o login trava por segurança).

---

## Estrutura de dados (Firestore)

| Coleção | Descrição |
|---|---|
| `services` | serviços (nome, preço, duração, foto, ativo) |
| `barbers` | barbeiros — **ID do documento = UID do login no Auth** |
| `appointments` | agendamentos (cliente, serviço, barbeiro, data, hora, status) |
| `businessSettings/general` | nome, contatos, endereço, redes sociais, horário de funcionamento |
| `blockedTimes` | bloqueios pontuais (dia inteiro ou intervalo) |
| `daysOff` | folgas fixas (dia da semana) ou pontuais (data) de cada barbeiro |
| `gallery` | fotos da galeria/home/sobre |
| `admins` | UIDs com acesso ao painel administrativo |
| `clients` | nome/telefone salvos de cada cliente (perfil) |
| `notifications` | estrutura pronta para uso futuro (lembretes, etc.) |

## O que foi simplificado nesta primeira versão

- **WhatsApp**: o botão "Confirmar no WhatsApp" abre uma conversa já com a
  mensagem pronta (`wa.me`). Não é um envio automático via API — para isso
  seria necessário o WhatsApp Business API (serviço pago à parte).
- **Criação de login de barbeiro/admin**: feita manualmente pelo Firebase
  Console (não existe um servidor próprio criando contas). Para automatizar
  isso completamente no futuro, dá para adicionar o **Firebase Functions**
  (plano Blaze) e um formulário que cria o usuário via Admin SDK.
- **Conflito de horário**: o sistema revalida no momento da confirmação
  (evita a maioria das corridas entre dois clientes agendando ao mesmo
  tempo), mas uma garantia 100% atômica exigiria uma Cloud Function/transação
  no servidor.
- **Fotos como texto no banco**: simples, gratuito e 100% dentro do seu
  Firebase, mas cada documento do Firestore tem um limite de ~1MB — por
  isso as fotos são comprimidas antes de salvar (ótimas para tela de
  celular, não para impressão). Se um dia quiser fotos em alta resolução
  separadas do banco, o arquivo `storage.rules` já vem pronto para quando
  você migrar para o Firebase Storage (que hoje exige o plano Blaze).

## Testando localmente antes de publicar

Não dá para abrir `index.html` direto com duplo clique (o navegador bloqueia
alguns recursos por segurança). Rode um servidor local simples, por exemplo:
- VS Code → extensão "Live Server" → botão direito em `index.html` → "Open with Live Server", ou
- Python: `python3 -m http.server 8000` na pasta do projeto e acesse `http://localhost:8000`.
