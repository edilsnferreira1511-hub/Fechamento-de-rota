/* ============================================================
   DENNER BARBEARIA — PAINEL ADMINISTRATIVO
   ============================================================ */

const A = {
  isAdmin:false,
  businessSettings:null,
  services:[], barbers:[], appointments:[], gallery:[], blockedTimes:[], daysOff:[],
  pendingFile:{barbeiro:null, servico:null, foto:null},
};

function paintIcons(root=document){
  root.querySelectorAll('[data-icon]').forEach(el=>{
    if(!el.dataset.painted){ el.innerHTML = icon(el.dataset.icon); el.dataset.painted='1'; }
  });
}
/* App Firebase secundário — usado SÓ para criar login de barbeiros sem
   derrubar a sessão do administrador que está logado no app principal. */
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();

/* ---------------- AUTENTICAÇÃO ---------------- */
let setupNeeded = false;

async function checkSetupAndAuth(){
  try{
    const setupDoc = await db.collection('system').doc('setup').get();
    setupNeeded = !setupDoc.exists || setupDoc.data().adminCreated === false;
  }catch(err){ console.error(err); setupNeeded = false; }
  auth.onAuthStateChanged(async user=>{
    if(!user){ setupNeeded ? showSetup() : showLogin(); return; }
    try{
      const doc = await db.collection('admins').doc(user.uid).get();
      if(doc.exists){ showPanel(); initAll(); }
      else { await auth.signOut(); setupNeeded ? showSetup() : showLogin(); }
    }catch(err){ console.error(err); await auth.signOut(); showLogin(); }
  });
}
checkSetupAndAuth();

function showLogin(){
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('admin-shell').classList.add('hidden');
}
function showSetup(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('admin-shell').classList.add('hidden');
}
function showPanel(){
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-shell').classList.remove('hidden');
  paintIcons();
}

/* --- primeiro acesso: criar o PIN --- */
document.getElementById('btn-setup-create').onclick = async ()=>{
  const pin = document.getElementById('setup-pin').value.trim();
  const pin2 = document.getElementById('setup-pin2').value.trim();
  if(pin.length < 6){ showToast('O PIN precisa ter pelo menos 6 dígitos.','error'); return; }
  if(pin !== pin2){ showToast('Os PINs digitados são diferentes.','error'); return; }
  const btn = document.getElementById('btn-setup-create'); btn.disabled = true; btn.textContent = 'CRIANDO...';
  try{
    // garante que o "portão" de primeiro acesso existe antes de tentar abrir
    const setupRef = db.collection('system').doc('setup');
    const setupDoc = await setupRef.get();
    if(!setupDoc.exists) await setupRef.set({ adminCreated:false });
    else if(setupDoc.data().adminCreated === true){
      showToast('Um administrador já foi criado. Recarregue a página.','error');
      return;
    }
    // cria a conta de autenticação do administrador
    const cred = await auth.createUserWithEmailAndPassword(ADMIN_INTERNAL_EMAIL, pin);
    // registra esse UID como administrador (a regra só permite pois adminCreated ainda é false)
    await db.collection('admins').doc(cred.user.uid).set({ name:'Administrador' });
    // fecha a porta de primeiro acesso pra sempre
    await setupRef.update({ adminCreated:true });
    showToast('PIN criado! Bem-vindo.','success');
  }catch(err){
    console.error(err);
    if(err.code === 'auth/email-already-in-use'){
      showToast('Já existe um administrador criado. Recarregue a página e use o PIN normal.','error');
    } else {
      showToast(err.message || 'Erro ao criar o PIN.','error');
    }
  }finally{ btn.disabled = false; btn.textContent = 'CRIAR PIN E ENTRAR'; }
};
document.getElementById('btn-setup-back-site').onclick = ()=> window.location.href='index.html';

document.getElementById('btn-login').onclick = async ()=>{
  const pin = document.getElementById('login-pin').value.trim();
  if(!pin){ showToast('Digite o PIN.','error'); return; }
  try{ await auth.signInWithEmailAndPassword(ADMIN_INTERNAL_EMAIL, pin); }
  catch(err){ showToast('PIN incorreto.','error'); }
};
document.getElementById('btn-back-site').onclick = ()=> window.location.href='index.html';
document.getElementById('btn-logout').onclick = async ()=>{ await auth.signOut(); window.location.href='index.html'; };

/* ---------------- TABS ---------------- */
document.querySelectorAll('#admin-tabs .stab').forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll('#admin-tabs .stab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.add('hidden'));
    document.getElementById('panel-'+tab.dataset.tab).classList.remove('hidden');
    if(tab.dataset.tab==='dashboard') renderDashboard();
  };
});

/* ---------------- CARREGAMENTO INICIAL (realtime) ---------------- */
function initAll(){
  db.collection('businessSettings').doc('general').onSnapshot(doc=>{
    A.businessSettings = doc.exists ? doc.data() : { hours: defaultHours() };
    if(!A.businessSettings.hours) A.businessSettings.hours = defaultHours();
    renderConfigForm();
    renderDashboard();
  });
  db.collection('services').orderBy('order','asc').onSnapshot(snap=>{
    A.services = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderServicos(); fillSelect('ag-servico', A.services, s=>`${s.name} — ${formatCurrency(s.price)}`);
    fillSelect('filter-service', A.services, s=>s.name, true);
    renderDashboard();
  });
  db.collection('barbers').onSnapshot(snap=>{
    A.barbers = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderBarbeiros(); fillSelect('ag-barbeiro', A.barbers, b=>b.name);
    fillSelect('filter-barber', A.barbers, b=>b.name, true);
    fillSelect('bl-barbeiro', A.barbers, b=>b.name, false, 'all', 'Todos os barbeiros');
    fillSelect('fg-barbeiro', A.barbers, b=>b.name);
    renderDashboard();
  });
  db.collection('appointments').onSnapshot(snap=>{
    A.appointments = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAgendamentos(); renderDashboard();
  });
  db.collection('gallery').orderBy('order','asc').onSnapshot(snap=>{
    A.gallery = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderGallery();
  });
  db.collection('blockedTimes').onSnapshot(snap=>{
    A.blockedTimes = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderBlockedList();
  });
  db.collection('daysOff').onSnapshot(snap=>{
    A.daysOff = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderDaysOffList();
  });
}
function defaultHours(){
  const h = {};
  WEEKDAY_KEYS.forEach((k,i)=>{ h[k] = (i===0)?{closed:true,open:'09:00',close:'19:30'}:(i===6)?{closed:false,open:'08:00',close:'19:30'}:{closed:false,open:'09:00',close:'19:30'}; });
  return h;
}
function fillSelect(id, items, labelFn, addAllOption=false, extraValue=null, extraLabel=null){
  const el = document.getElementById(id);
  if(!el) return;
  const current = el.value;
  let html = '';
  if(addAllOption) html += `<option value="">Todos</option>`;
  if(extraValue) html += `<option value="${extraValue}">${extraLabel}</option>`;
  html += items.map(i=>`<option value="${i.id}">${labelFn(i)}</option>`).join('');
  el.innerHTML = html;
  if(current) el.value = current;
}

/* ---------------- DASHBOARD ---------------- */
function renderDashboard(){
  if(!A.businessSettings) return;
  const today = nowKeyA();
  const monthPrefix = today.slice(0,7);
  const activeAppts = A.appointments.filter(a=>a.status!=='cancelled');
  const todayAppts = activeAppts.filter(a=>a.date===today).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const futureAppts = activeAppts.filter(a=>a.date>today);
  const faturamento = A.appointments.filter(a=>a.status==='completed' && a.date.startsWith(monthPrefix)).reduce((s,a)=>s+Number(a.servicePrice||0),0);
  const occupiedToday = todayAppts.length;
  const activeBarbers = A.barbers.filter(b=>b.active);
  let totalSlotsToday = 0;
  const hours = A.businessSettings.hours ? A.businessSettings.hours[WEEKDAY_KEYS[new Date().getDay()]] : null;
  if(hours && !hours.closed){ totalSlotsToday = generateSlots(hours.open, hours.close, 30).length * activeBarbers.length; }
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="num">${todayAppts.length}</div><div class="lbl">Agendamentos hoje</div></div>
    <div class="stat-card"><div class="num">${futureAppts.length}</div><div class="lbl">Agendamentos futuros</div></div>
    <div class="stat-card"><div class="num">${A.barbers.filter(b=>b.active).length}</div><div class="lbl">Barbeiros ativos</div></div>
    <div class="stat-card"><div class="num">${A.services.filter(s=>s.active).length}</div><div class="lbl">Serviços ativos</div></div>
    <div class="stat-card"><div class="num">${formatCurrency(faturamento)}</div><div class="lbl">Faturamento (mês)</div></div>
    <div class="stat-card"><div class="num">${occupiedToday}/${totalSlotsToday||'—'}</div><div class="lbl">Ocupados hoje</div></div>`;
  const list = document.getElementById('dash-today');
  list.innerHTML = todayAppts.length ? todayAppts.map(a=>adminApptCardHtml(a)).join('') : emptyStateA('Nenhum agendamento para hoje.');
  bindApptActions(list);
  paintIcons(list);
}
function nowKeyA(){ return dateKey(new Date()); }
function emptyStateA(msg){ return `<div class="empty-state"><span data-icon="calendar"></span><p>${msg}</p></div>`; }

/* ---------------- AGENDAMENTOS ---------------- */
['filter-date','filter-barber','filter-service'].forEach(id=>{
  document.getElementById(id).addEventListener('change', renderAgendamentos);
});
document.getElementById('btn-clear-filters').onclick = ()=>{
  document.getElementById('filter-date').value='';
  document.getElementById('filter-barber').value='';
  document.getElementById('filter-service').value='';
  renderAgendamentos();
};
function renderAgendamentos(){
  const el = document.getElementById('agendamentos-list');
  if(!el) return;
  const fd = document.getElementById('filter-date').value;
  const fb = document.getElementById('filter-barber').value;
  const fs = document.getElementById('filter-service').value;
  let list = [...A.appointments];
  if(fd) list = list.filter(a=>a.date===fd);
  if(fb) list = list.filter(a=>a.barberId===fb);
  if(fs) list = list.filter(a=>a.serviceId===fs);
  list.sort((a,b)=> (b.date+b.startTime).localeCompare(a.date+a.startTime));
  el.innerHTML = list.length ? list.map(a=>adminApptCardHtml(a,true)).join('') : emptyStateA('Nenhum agendamento encontrado.');
  bindApptActions(el);
  paintIcons(el);
}
function adminApptCardHtml(a, withEdit=false){
  return `
  <div class="appt-card">
    <div class="top-row"><span class="time">${a.startTime}</span><span class="status-pill ${a.status}">${statusLabelA(a.status)}</span></div>
    <div class="client">${a.clientName||'—'}</div>
    <div class="svc">${a.serviceName} · ${a.barberName} · ${formatDateBR(a.date)}</div>
    <div class="svc">${a.clientPhone||''} ${a.clientPhone ? `· ${formatCurrency(a.servicePrice)}`:formatCurrency(a.servicePrice)}</div>
    <div class="actions">
      ${a.status==='confirmed' ? `<button class="btn btn-secondary btn-sm" data-complete="${a.id}">CONCLUIR</button>` : ''}
      ${withEdit && a.status!=='cancelled' ? `<button class="btn btn-secondary btn-sm" data-edit="${a.id}">EDITAR</button>` : ''}
      ${a.status!=='cancelled' ? `<button class="btn btn-danger btn-sm" data-cancelappt="${a.id}">CANCELAR</button>` : ''}
    </div>
  </div>`;
}
function statusLabelA(s){ return {confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado'}[s] || s; }
function bindApptActions(root){
  root.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>db.collection('appointments').doc(b.dataset.complete).update({status:'completed'}).then(()=>showToast('Marcado como concluído.','success')));
  root.querySelectorAll('[data-cancelappt]').forEach(b=>b.onclick=()=>{ if(confirm('Cancelar este agendamento?')) db.collection('appointments').doc(b.dataset.cancelappt).update({status:'cancelled'}).then(()=>showToast('Agendamento cancelado.','success')); });
  root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openAgendamentoModal(A.appointments.find(a=>a.id===b.dataset.edit)));
}

document.getElementById('btn-new-agendamento').onclick = ()=> openAgendamentoModal(null);
function openAgendamentoModal(appt){
  document.getElementById('ag-modal-title').textContent = appt ? 'Editar Agendamento' : 'Novo Agendamento';
  document.getElementById('ag-id').value = appt ? appt.id : '';
  document.getElementById('ag-cliente').value = appt ? appt.clientName : '';
  document.getElementById('ag-telefone').value = appt ? appt.clientPhone : '';
  document.getElementById('ag-servico').value = appt ? appt.serviceId : (A.services[0]?.id||'');
  document.getElementById('ag-barbeiro').value = appt ? appt.barberId : (A.barbers[0]?.id||'');
  document.getElementById('ag-data').value = appt ? appt.date : nowKeyA();
  document.getElementById('ag-horario').value = appt ? appt.startTime : '';
  document.getElementById('modal-agendamento').classList.remove('hidden');
}
document.getElementById('btn-cancel-agendamento').onclick = ()=> document.getElementById('modal-agendamento').classList.add('hidden');
document.getElementById('btn-save-agendamento').onclick = async ()=>{
  const id = document.getElementById('ag-id').value;
  const clientName = document.getElementById('ag-cliente').value.trim();
  const clientPhone = document.getElementById('ag-telefone').value.trim();
  const serviceId = document.getElementById('ag-servico').value;
  const barberId = document.getElementById('ag-barbeiro').value;
  const date = document.getElementById('ag-data').value;
  const startTime = document.getElementById('ag-horario').value;
  if(!clientName || !serviceId || !barberId || !date || !startTime){ showToast('Preencha todos os campos.','error'); return; }
  const service = A.services.find(s=>s.id===serviceId);
  const barber = A.barbers.find(b=>b.id===barberId);
  const start = timeToMinutes(startTime), end = start+Number(service.durationMin);
  const conflict = A.appointments.some(a=> a.id!==id && a.barberId===barberId && a.date===date && a.status!=='cancelled' &&
    start < (timeToMinutes(a.startTime)+Number(a.serviceDuration)) && end > timeToMinutes(a.startTime));
  if(conflict && !confirm('Já existe um agendamento nesse horário para esse barbeiro. Continuar mesmo assim?')) return;
  const payload = {
    clientName, clientPhone, serviceId, serviceName:service.name, servicePrice:service.price, serviceDuration:service.durationMin,
    barberId, barberName:barber.name, date, startTime, status:'confirmed',
  };
  try{
    if(id){ await db.collection('appointments').doc(id).update(payload); showToast('Agendamento atualizado.','success'); }
    else{ payload.clientUid='admin-created'; payload.createdAt=firebase.firestore.FieldValue.serverTimestamp(); await db.collection('appointments').add(payload); showToast('Agendamento criado.','success'); }
    document.getElementById('modal-agendamento').classList.add('hidden');
  }catch(err){ console.error(err); showToast('Erro ao salvar agendamento.','error'); }
};

/* ---------------- BARBEIROS ---------------- */
function renderBarbeiros(){
  const el = document.getElementById('barbeiros-list');
  el.innerHTML = A.barbers.length ? A.barbers.map(b=>`
    <div class="list-card">
      <img class="thumb" style="border-radius:50%;" src="${b.photoUrl||placeholderImgA()}">
      <div class="info">
        <div class="title">${b.name}</div>
        <div class="meta">${b.phone||''} <span class="status-pill ${b.active?'completed':'cancelled'}">${b.active?'Ativo':'Inativo'}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-secondary btn-sm" data-edit-barbeiro="${b.id}">EDITAR</button>
        <button class="btn btn-danger btn-sm" data-del-barbeiro="${b.id}">EXCLUIR</button>
      </div>
    </div>`).join('') : emptyStateA('Nenhum barbeiro cadastrado.');
  el.querySelectorAll('[data-edit-barbeiro]').forEach(b=>b.onclick=()=>openBarbeiroModal(A.barbers.find(x=>x.id===b.dataset.editBarbeiro)));
  el.querySelectorAll('[data-del-barbeiro]').forEach(b=>b.onclick=()=>{ if(confirm('Excluir este barbeiro?')) db.collection('barbers').doc(b.dataset.delBarbeiro).delete().then(()=>showToast('Barbeiro excluído.','success')); });
}
document.getElementById('btn-new-barbeiro').onclick = ()=> openBarbeiroModal(null);
function openBarbeiroModal(b){
  document.getElementById('barbeiro-modal-title').textContent = b ? 'Editar Barbeiro' : 'Novo Barbeiro';
  document.getElementById('barbeiro-id').value = b ? b.id : '';
  document.getElementById('barbeiro-nome').value = b ? b.name : '';
  document.getElementById('barbeiro-telefone').value = b ? (b.phone||'') : '';
  document.getElementById('barbeiro-email').value = '';
  document.getElementById('barbeiro-senha').value = '';
  document.getElementById('barbeiro-login-fields').classList.toggle('hidden', !!b);
  document.getElementById('barbeiro-login-fixed').classList.toggle('hidden', !b);
  document.getElementById('barbeiro-ativo').classList.toggle('on', b ? !!b.active : true);
  const preview = document.getElementById('barbeiro-photo-preview');
  preview.querySelectorAll('img').forEach(i=>i.remove());
  if(b && b.photoUrl){ preview.insertAdjacentHTML('afterbegin', `<img src="${b.photoUrl}">`); }
  A.pendingFile.barbeiro = null;
  document.getElementById('modal-barbeiro').classList.remove('hidden');
}
document.getElementById('barbeiro-ativo').onclick = function(){ this.classList.toggle('on'); };
document.getElementById('barbeiro-photo-file').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  A.pendingFile.barbeiro = file;
  previewFile(file, document.getElementById('barbeiro-photo-preview'));
});
document.getElementById('btn-cancel-barbeiro').onclick = ()=> document.getElementById('modal-barbeiro').classList.add('hidden');
document.getElementById('btn-save-barbeiro').onclick = async ()=>{
  const existingId = document.getElementById('barbeiro-id').value;
  const name = document.getElementById('barbeiro-nome').value.trim();
  if(!name){ showToast('Preencha o nome.','error'); return; }
  const btn = document.getElementById('btn-save-barbeiro'); btn.disabled = true; btn.textContent='SALVANDO...';
  try{
    let uid = existingId;
    if(!uid){
      // criando um barbeiro novo: precisa de e-mail + senha pra gerar o login dele
      const email = document.getElementById('barbeiro-email').value.trim();
      const senha = document.getElementById('barbeiro-senha').value;
      if(!email || senha.length < 6){ showToast('Preencha e-mail e uma senha com pelo menos 6 caracteres.','error'); btn.disabled=false; btn.textContent='SALVAR'; return; }
      btn.textContent = 'CRIANDO LOGIN...';
      // usa o app secundário pra não derrubar a sessão do administrador
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, senha);
      uid = cred.user.uid;
      await secondaryAuth.signOut();
    }
    let photoUrl = null;
    const existing = A.barbers.find(x=>x.id===uid);
    if(existing) photoUrl = existing.photoUrl || null;
    if(A.pendingFile.barbeiro){
      btn.textContent = 'ENVIANDO FOTO...';
      try{ photoUrl = await compressImageToDataUrl(A.pendingFile.barbeiro, 500, 0.75); }
      catch(photoErr){ console.error(photoErr); showToast(photoErr.message || 'Não deu pra processar a foto. O barbeiro foi salvo sem foto.','error'); }
    }
    await db.collection('barbers').doc(uid).set({
      name, phone: document.getElementById('barbeiro-telefone').value.trim(),
      active: document.getElementById('barbeiro-ativo').classList.contains('on'),
      photoUrl: photoUrl || null,
    }, {merge:true});
    showToast('Barbeiro salvo!','success');
    document.getElementById('modal-barbeiro').classList.add('hidden');
  }catch(err){
    console.error(err);
    if(err.code === 'auth/email-already-in-use') showToast('Esse e-mail já está em uso por outro login.','error');
    else showToast(err.message || 'Erro ao salvar barbeiro.','error');
  }
  finally{ btn.disabled=false; btn.textContent='SALVAR'; }
};

/* ---------------- SERVIÇOS ---------------- */
function renderServicos(){
  const el = document.getElementById('servicos-list');
  el.innerHTML = A.services.length ? A.services.map(s=>`
    <div class="list-card">
      <img class="thumb" src="${s.photoUrl||placeholderImgA()}">
      <div class="info">
        <div class="title">${s.name}</div>
        <div class="meta">${s.durationMin}min · ${formatCurrency(s.price)} <span class="status-pill ${s.active?'completed':'cancelled'}">${s.active?'Ativo':'Inativo'}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-secondary btn-sm" data-edit-servico="${s.id}">EDITAR</button>
        <button class="btn btn-danger btn-sm" data-del-servico="${s.id}">EXCLUIR</button>
      </div>
    </div>`).join('') : emptyStateA('Nenhum serviço cadastrado.');
  el.querySelectorAll('[data-edit-servico]').forEach(b=>b.onclick=()=>openServicoModal(A.services.find(x=>x.id===b.dataset.editServico)));
  el.querySelectorAll('[data-del-servico]').forEach(b=>b.onclick=()=>{ if(confirm('Excluir este serviço?')) db.collection('services').doc(b.dataset.delServico).delete().then(()=>showToast('Serviço excluído.','success')); });
}
document.getElementById('btn-new-servico').onclick = ()=> openServicoModal(null);
function openServicoModal(s){
  document.getElementById('servico-modal-title').textContent = s ? 'Editar Serviço' : 'Novo Serviço';
  document.getElementById('servico-id').value = s ? s.id : '';
  document.getElementById('servico-nome').value = s ? s.name : '';
  document.getElementById('servico-preco').value = s ? s.price : '';
  document.getElementById('servico-duracao').value = s ? s.durationMin : '';
  document.getElementById('servico-descricao').value = s ? (s.description||'') : '';
  document.getElementById('servico-ativo').classList.toggle('on', s ? !!s.active : true);
  const preview = document.getElementById('servico-photo-preview');
  preview.querySelectorAll('img').forEach(i=>i.remove());
  if(s && s.photoUrl){ preview.insertAdjacentHTML('afterbegin', `<img src="${s.photoUrl}">`); }
  A.pendingFile.servico = null;
  document.getElementById('modal-servico').classList.remove('hidden');
}
document.getElementById('servico-ativo').onclick = function(){ this.classList.toggle('on'); };
document.getElementById('servico-photo-file').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  A.pendingFile.servico = file;
  previewFile(file, document.getElementById('servico-photo-preview'));
});
document.getElementById('btn-cancel-servico').onclick = ()=> document.getElementById('modal-servico').classList.add('hidden');
document.getElementById('btn-save-servico').onclick = async ()=>{
  const id = document.getElementById('servico-id').value;
  const name = document.getElementById('servico-nome').value.trim();
  const price = Number(document.getElementById('servico-preco').value);
  const durationMin = Number(document.getElementById('servico-duracao').value);
  if(!name || !price || !durationMin){ showToast('Preencha nome, preço e duração.','error'); return; }
  const btn = document.getElementById('btn-save-servico'); btn.disabled = true; btn.textContent='SALVANDO...';
  try{
    let photoUrl = id ? (A.services.find(x=>x.id===id)?.photoUrl||null) : null;
    if(A.pendingFile.servico){
      btn.textContent = 'ENVIANDO FOTO...';
      try{ photoUrl = await compressImageToDataUrl(A.pendingFile.servico, 500, 0.75); }
      catch(photoErr){ console.error(photoErr); showToast(photoErr.message || 'Não deu pra processar a foto. O serviço foi salvo sem foto.','error'); }
    }
    const payload = {
      name, price, durationMin, description: document.getElementById('servico-descricao').value.trim(),
      active: document.getElementById('servico-ativo').classList.contains('on'),
      photoUrl: photoUrl || null,
      order: id ? (A.services.find(x=>x.id===id)?.order ?? A.services.length) : A.services.length,
    };
    if(id) await db.collection('services').doc(id).update(payload);
    else await db.collection('services').add(payload);
    showToast('Serviço salvo!','success');
    document.getElementById('modal-servico').classList.add('hidden');
  }catch(err){ console.error(err); showToast(err.message || 'Erro ao salvar serviço.','error'); }
  finally{ btn.disabled=false; btn.textContent='SALVAR'; }
};

/* ---------------- GALERIA ---------------- */
function renderGallery(){
  const el = document.getElementById('gallery-grid');
  el.innerHTML = A.gallery.map(g=>`
    <div style="position:relative;border-radius:16px;overflow:hidden;aspect-ratio:1;">
      <img src="${g.url}" style="width:100%;height:100%;object-fit:cover;">
      <button data-del-foto="${g.id}" style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);border:none;color:#fff;">✕</button>
    </div>`).join('') || emptyStateA('Nenhuma foto na galeria ainda.');
  el.querySelectorAll('[data-del-foto]').forEach(b=>b.onclick=()=>{ if(confirm('Remover esta foto?')) db.collection('gallery').doc(b.dataset.delFoto).delete(); });
}
document.getElementById('btn-add-photo').onclick = ()=>{
  A.pendingFile.foto = null;
  document.getElementById('foto-preview').querySelectorAll('img').forEach(i=>i.remove());
  document.getElementById('modal-foto').classList.remove('hidden');
};
document.getElementById('foto-file').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  A.pendingFile.foto = file;
  previewFile(file, document.getElementById('foto-preview'));
});
document.getElementById('btn-cancel-foto').onclick = ()=> document.getElementById('modal-foto').classList.add('hidden');
document.getElementById('btn-save-foto').onclick = async ()=>{
  if(!A.pendingFile.foto){ showToast('Escolha uma foto.','error'); return; }
  const btn = document.getElementById('btn-save-foto'); btn.disabled=true; btn.textContent='ENVIANDO...';
  try{
    const url = await compressImageToDataUrl(A.pendingFile.foto, 1000, 0.7);
    await db.collection('gallery').add({ url, section: document.getElementById('foto-secao').value, order: A.gallery.length, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Foto adicionada!','success');
    document.getElementById('modal-foto').classList.add('hidden');
  }catch(err){ console.error(err); showToast(err.message || 'Erro ao adicionar foto.','error'); }
  finally{ btn.disabled=false; btn.textContent='ADICIONAR'; }
};

/* ---------------- CONFIGURAÇÕES ---------------- */
function renderConfigForm(){
  const b = A.businessSettings || {};
  document.getElementById('cfg-name').value = b.name||'DENNER BARBEARIA';
  document.getElementById('cfg-phone').value = b.phone||'';
  document.getElementById('cfg-whatsapp').value = b.whatsapp||'';
  document.getElementById('cfg-address').value = b.address||'';
  document.getElementById('cfg-instagram').value = b.instagram||'';
  document.getElementById('cfg-facebook').value = b.facebook||'';
  document.getElementById('cfg-logo').value = b.logoUrl||'';
  document.getElementById('cfg-cover').value = b.coverPhotoUrl||'';
  setPhotoFieldPreview('cfg-logo','cfg-logo-preview');
  setPhotoFieldPreview('cfg-cover','cfg-cover-preview');
  renderHoursForm(b.hours || defaultHours());
}
function setPhotoFieldPreview(inputId, previewId){
  const val = document.getElementById(inputId).value;
  const el = document.getElementById(previewId);
  el.innerHTML = val ? `<img src="${val}">` : `<span data-icon="camera"></span><span>Nenhuma foto</span>`;
  paintIcons(el);
}
document.getElementById('cfg-logo-file').addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  try{
    const dataUrl = await compressImageToDataUrl(file, 700, 0.72);
    document.getElementById('cfg-logo').value = dataUrl;
    setPhotoFieldPreview('cfg-logo','cfg-logo-preview');
    showToast('Foto da logo pronta — não esqueça de Salvar.','success');
  }catch(err){ showToast(err.message || 'Erro ao processar foto.','error'); }
});
document.getElementById('cfg-cover-file').addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  try{
    const dataUrl = await compressImageToDataUrl(file, 700, 0.72);
    document.getElementById('cfg-cover').value = dataUrl;
    setPhotoFieldPreview('cfg-cover','cfg-cover-preview');
    showToast('Foto de capa pronta — não esqueça de Salvar.','success');
  }catch(err){ showToast(err.message || 'Erro ao processar foto.','error'); }
});
document.getElementById('btn-save-config').onclick = async ()=>{
  const payload = {
    name: document.getElementById('cfg-name').value.trim(),
    logoUrl: document.getElementById('cfg-logo').value.trim(),
    coverPhotoUrl: document.getElementById('cfg-cover').value.trim(),
    phone: document.getElementById('cfg-phone').value.trim(),
    whatsapp: document.getElementById('cfg-whatsapp').value.trim(),
    address: document.getElementById('cfg-address').value.trim(),
    instagram: document.getElementById('cfg-instagram').value.trim(),
    facebook: document.getElementById('cfg-facebook').value.trim(),
  };
  try{ await db.collection('businessSettings').doc('general').set(payload,{merge:true}); showToast('Configurações salvas!','success'); }
  catch(err){ console.error(err); showToast('Erro ao salvar.','error'); }
};

document.getElementById('btn-change-pin').onclick = async ()=>{
  const pin = document.getElementById('cfg-new-pin').value.trim();
  const pin2 = document.getElementById('cfg-new-pin2').value.trim();
  if(pin.length < 6){ showToast('O novo PIN precisa ter pelo menos 6 dígitos.','error'); return; }
  if(pin !== pin2){ showToast('Os PINs digitados são diferentes.','error'); return; }
  const btn = document.getElementById('btn-change-pin'); btn.disabled = true; btn.textContent = 'TROCANDO...';
  try{
    await auth.currentUser.updatePassword(pin);
    document.getElementById('cfg-new-pin').value = '';
    document.getElementById('cfg-new-pin2').value = '';
    showToast('PIN alterado com sucesso!','success');
  }catch(err){
    console.error(err);
    if(err.code === 'auth/requires-recent-login'){
      showToast('Por segurança, saia e entre de novo com o PIN atual antes de trocar.','error');
    } else {
      showToast(err.message || 'Erro ao trocar o PIN.','error');
    }
  }finally{ btn.disabled = false; btn.textContent = 'TROCAR PIN'; }
};
function renderHoursForm(hours){
  const el = document.getElementById('cfg-hours');
  el.innerHTML = WEEKDAY_KEYS.map((k,i)=>{
    const d = hours[k] || {closed:true,open:'09:00',close:'19:00'};
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
      <div class="switch-row" style="border:none;padding:0 0 8px;"><span>${WEEKDAY_LABEL_FULL[i]}</span><div class="switch ${d.closed?'':'on'}" data-hday="${k}"></div></div>
      <div class="field-row" style="${d.closed?'display:none':''}" data-htimes="${k}">
        <div class="field"><input type="time" data-hopen="${k}" value="${d.open||'09:00'}"></div>
        <div class="field"><input type="time" data-hclose="${k}" value="${d.close||'19:00'}"></div>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-hday]').forEach(sw=>{
    sw.onclick = ()=>{
      sw.classList.toggle('on');
      const times = el.querySelector(`[data-htimes="${sw.dataset.hday}"]`);
      times.style.display = sw.classList.contains('on') ? 'flex' : 'none';
    };
  });
}
document.getElementById('btn-save-hours').onclick = async ()=>{
  const hours = {};
  WEEKDAY_KEYS.forEach(k=>{
    const sw = document.querySelector(`[data-hday="${k}"]`);
    const open = document.querySelector(`[data-hopen="${k}"]`).value;
    const close = document.querySelector(`[data-hclose="${k}"]`).value;
    hours[k] = { closed: !sw.classList.contains('on'), open, close };
  });
  try{ await db.collection('businessSettings').doc('general').set({hours},{merge:true}); showToast('Horários salvos!','success'); }
  catch(err){ console.error(err); showToast('Erro ao salvar horários.','error'); }
};

/* ---- bloqueios ---- */
function renderBlockedList(){
  const el = document.getElementById('blocked-list');
  el.innerHTML = A.blockedTimes.length ? A.blockedTimes.map(bl=>{
    const barberName = bl.barberId==='all' ? 'Todos' : (A.barbers.find(b=>b.id===bl.barberId)?.name||'—');
    return `<div class="list-card">
      <div class="info"><div class="title">${barberName} · ${formatDateBR(bl.date)}</div>
      <div class="meta">${bl.fullDay ? 'Dia inteiro bloqueado' : `${bl.startTime} — ${bl.endTime}`} ${bl.reason?('· '+bl.reason):''}</div></div>
      <button class="btn btn-danger btn-sm" data-del-block="${bl.id}">EXCLUIR</button>
    </div>`;
  }).join('') : `<p style="font-size:12.5px;color:var(--white-faint);">Nenhum bloqueio ativo.</p>`;
  el.querySelectorAll('[data-del-block]').forEach(b=>b.onclick=()=>db.collection('blockedTimes').doc(b.dataset.delBlock).delete());
}
document.getElementById('btn-add-block').onclick = ()=> document.getElementById('modal-bloqueio').classList.remove('hidden');
document.getElementById('btn-cancel-bloqueio').onclick = ()=> document.getElementById('modal-bloqueio').classList.add('hidden');
document.getElementById('bl-fullday').onclick = function(){
  this.classList.toggle('on');
  document.getElementById('bl-time-row').style.display = this.classList.contains('on') ? 'none' : 'flex';
};
document.getElementById('btn-save-bloqueio').onclick = async ()=>{
  const fullDay = document.getElementById('bl-fullday').classList.contains('on');
  const payload = {
    barberId: document.getElementById('bl-barbeiro').value,
    date: document.getElementById('bl-data').value,
    fullDay,
    startTime: fullDay ? '00:00' : document.getElementById('bl-inicio').value,
    endTime: fullDay ? '23:59' : document.getElementById('bl-fim').value,
    reason: document.getElementById('bl-motivo').value.trim(),
  };
  if(!payload.date){ showToast('Escolha uma data.','error'); return; }
  try{ await db.collection('blockedTimes').add(payload); showToast('Horário bloqueado.','success'); document.getElementById('modal-bloqueio').classList.add('hidden'); }
  catch(err){ console.error(err); showToast('Erro ao bloquear.','error'); }
};

/* ---- folgas ---- */
function renderDaysOffList(){
  const el = document.getElementById('daysoff-list');
  el.innerHTML = A.daysOff.length ? A.daysOff.map(f=>{
    const barberName = A.barbers.find(b=>b.id===f.barberId)?.name || '—';
    const desc = f.type==='weekly' ? `Toda ${WEEKDAY_LABEL_FULL[f.weekday]}` : formatDateBR(f.date);
    return `<div class="list-card">
      <div class="info"><div class="title">${barberName}</div><div class="meta">${desc}</div></div>
      <button class="btn btn-danger btn-sm" data-del-off="${f.id}">EXCLUIR</button>
    </div>`;
  }).join('') : `<p style="font-size:12.5px;color:var(--white-faint);">Nenhuma folga cadastrada.</p>`;
  el.querySelectorAll('[data-del-off]').forEach(b=>b.onclick=()=>db.collection('daysOff').doc(b.dataset.delOff).delete());
}
document.getElementById('btn-add-dayoff').onclick = ()=> document.getElementById('modal-folga').classList.remove('hidden');
document.getElementById('btn-cancel-folga').onclick = ()=> document.getElementById('modal-folga').classList.add('hidden');
document.getElementById('fg-tipo').addEventListener('change', e=>{
  const weekly = e.target.value==='weekly';
  document.getElementById('fg-weekday-field').classList.toggle('hidden', !weekly);
  document.getElementById('fg-date-field').classList.toggle('hidden', weekly);
});
document.getElementById('btn-save-folga').onclick = async ()=>{
  const type = document.getElementById('fg-tipo').value;
  const barberId = document.getElementById('fg-barbeiro').value;
  if(!barberId){ showToast('Selecione um barbeiro.','error'); return; }
  const payload = { barberId, type };
  if(type==='weekly') payload.weekday = Number(document.getElementById('fg-weekday').value);
  else{
    const d = document.getElementById('fg-date').value;
    if(!d){ showToast('Escolha uma data.','error'); return; }
    payload.date = d;
  }
  try{ await db.collection('daysOff').add(payload); showToast('Folga salva.','success'); document.getElementById('modal-folga').classList.add('hidden'); }
  catch(err){ console.error(err); showToast('Erro ao salvar folga.','error'); }
};

/* ---------------- HELPERS ---------------- */
function previewFile(file, container){
  container.querySelectorAll('img').forEach(i=>i.remove());
  const reader = new FileReader();
  reader.onload = ()=> container.insertAdjacentHTML('afterbegin', `<img src="${reader.result}">`);
  reader.readAsDataURL(file);
}
function placeholderImgA(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#141b2e"/><text x="50" y="56" font-size="34" text-anchor="middle" fill="#cea23f" font-family="Georgia">D</text></svg>`);
}

/* Garante que o campo em edição sempre fique visível quando o teclado
   do celular abre dentro de um modal (evita ficar "preso" sem ver o
   campo ou o botão Salvar). */
document.addEventListener('focusin', (e)=>{
  if(e.target.closest('.modal-sheet')){
    setTimeout(()=> e.target.scrollIntoView({block:'center', behavior:'smooth'}), 250);
  }
});
