/* ============================================================
   DENNER BARBEARIA — PAINEL DO BARBEIRO
   ============================================================ */

const B = { barber:null, selectedDate: dateKey(new Date()), appts:[] };

function paintIcons(root=document){
  root.querySelectorAll('[data-icon]').forEach(el=>{
    if(!el.dataset.painted){ el.innerHTML = icon(el.dataset.icon); el.dataset.painted='1'; }
  });
}

auth.onAuthStateChanged(async user=>{
  if(!user){ showLogin(); return; }
  try{
    const doc = await db.collection('barbers').doc(user.uid).get();
    if(doc.exists){
      B.barber = { id: doc.id, ...doc.data() };
      showPanel();
      initAgenda();
    } else {
      await auth.signOut(); showLogin();
      showToast('Este login não está vinculado a nenhum barbeiro.','error');
    }
  }catch(err){ console.error(err); await auth.signOut(); showLogin(); }
});
function showLogin(){
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('barber-shell').classList.add('hidden');
}
function showPanel(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('barber-shell').classList.remove('hidden');
  document.getElementById('barber-name-label').textContent = B.barber.name;
  paintIcons();
}
document.getElementById('btn-login').onclick = async ()=>{
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if(!email || !senha){ showToast('Preencha login e senha.','error'); return; }
  try{ await auth.signInWithEmailAndPassword(email, senha); }
  catch(err){ showToast('Login ou senha incorretos.','error'); }
};
document.getElementById('btn-back-site').onclick = ()=> window.location.href='index.html';
document.getElementById('btn-forgot-password').onclick = async ()=>{
  const email = document.getElementById('login-email').value.trim();
  if(!email){ showToast('Digite seu e-mail de login no campo acima primeiro.','error'); return; }
  try{
    await auth.sendPasswordResetEmail(email);
    showToast('Enviamos um link de redefinição para seu e-mail.','success');
  }catch(err){ showToast('Não foi possível enviar. Confira o e-mail digitado.','error'); }
};
document.getElementById('btn-logout').onclick = async ()=>{ await auth.signOut(); window.location.href='index.html'; };

/* ---------------- AGENDA ---------------- */
function initAgenda(){
  renderDayTabs();
  listenAgenda();
  listenBlocked();
}
function renderDayTabs(){
  const el = document.getElementById('day-tabs');
  const days = [];
  for(let i=0;i<7;i++){ const d = new Date(); d.setDate(d.getDate()+i); days.push(d); }
  el.innerHTML = days.map(d=>{
    const key = dateKey(d);
    const label = i0(d) ? 'HOJE' : `${WEEKDAY_LABEL[d.getDay()]} ${pad2(d.getDate())}`;
    return `<button class="stab ${key===B.selectedDate?'active':''}" data-day="${key}">${label}</button>`;
  }).join('');
  el.querySelectorAll('[data-day]').forEach(btn=>{
    btn.onclick = ()=>{
      B.selectedDate = btn.dataset.day;
      el.querySelectorAll('.stab').forEach(s=>s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('agenda-heading').textContent = i0(dateFromKey(B.selectedDate)) ? 'AGENDA DE HOJE' : `AGENDA — ${formatDateBR(B.selectedDate).toUpperCase()}`;
      renderAgendaList();
    };
  });
}
function i0(d){ return dateKey(d)===dateKey(new Date()); }

function listenAgenda(){
  db.collection('appointments').where('barberId','==',B.barber.id).onSnapshot(snap=>{
    B.appts = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderAgendaList();
  }, err=>console.error(err));
}
function renderAgendaList(){
  const el = document.getElementById('barber-agenda');
  const list = B.appts
    .filter(a=>a.date===B.selectedDate && a.status!=='cancelled')
    .sort((a,b)=>a.startTime.localeCompare(b.startTime));
  if(!list.length){ el.innerHTML = `<div class="empty-state"><span data-icon="calendar"></span><p>Nenhum atendimento neste dia.</p></div>`; paintIcons(el); return; }
  el.innerHTML = list.map(a=>`
    <div class="appt-card">
      <div class="top-row"><span class="time">${a.startTime}</span><span class="status-pill ${a.status}">${a.status==='completed'?'Concluído':'Confirmado'}</span></div>
      <div class="client">${a.clientName}</div>
      <div class="svc">${a.serviceName} · ${a.serviceDuration} min</div>
      <div class="svc">${a.clientPhone||''}</div>
      ${a.status==='confirmed' ? `<div class="actions">
        <button class="btn btn-secondary btn-sm" data-done="${a.id}">MARCAR CONCLUÍDO</button>
        <button class="btn btn-danger btn-sm" data-absent="${a.id}">AUSÊNCIA/CANCELAR</button>
      </div>` : ''}
    </div>`).join('');
  el.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>db.collection('appointments').doc(b.dataset.done).update({status:'completed'}).then(()=>showToast('Atendimento concluído.','success')));
  el.querySelectorAll('[data-absent]').forEach(b=>b.onclick=()=>{ if(confirm('Marcar como ausência/cancelamento?')) db.collection('appointments').doc(b.dataset.absent).update({status:'cancelled'}).then(()=>showToast('Atualizado.','success')); });
}

/* ---------------- BLOQUEIO DE HORÁRIO / FOLGA ---------------- */
let barberBlocks = [];
function listenBlocked(){
  db.collection('blockedTimes').where('barberId','==',B.barber.id).onSnapshot(snap=>{
    barberBlocks = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderBlockedList();
  }, err=>console.error(err));
}
function renderBlockedList(){
  const el = document.getElementById('barber-blocked-list');
  const upcoming = barberBlocks
    .filter(b=>b.date >= dateKey(new Date()))
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(!upcoming.length){ el.innerHTML = `<p style="font-size:12.5px;color:var(--white-faint);">Nenhum bloqueio cadastrado.</p>`; return; }
  el.innerHTML = upcoming.map(b=>`
    <div class="list-card">
      <div class="info">
        <div class="title">${formatDateBR(b.date)}</div>
        <div class="meta">${b.fullDay ? 'Dia inteiro (folga)' : `${b.startTime} — ${b.endTime}`}${b.reason ? (' · '+b.reason) : ''}</div>
      </div>
      <button class="btn btn-danger btn-sm" data-del-block="${b.id}">EXCLUIR</button>
    </div>`).join('');
  el.querySelectorAll('[data-del-block]').forEach(btn=>{
    btn.onclick = ()=>{ if(confirm('Remover este bloqueio?')) db.collection('blockedTimes').doc(btn.dataset.delBlock).delete().then(()=>showToast('Bloqueio removido.','success')); };
  });
}
document.getElementById('btn-add-block').onclick = ()=>{
  document.getElementById('bl-data').value = '';
  document.getElementById('bl-inicio').value = '';
  document.getElementById('bl-fim').value = '';
  document.getElementById('bl-motivo').value = '';
  document.getElementById('bl-fullday').classList.remove('on');
  document.getElementById('bl-time-row').style.display = 'flex';
  document.getElementById('modal-bloqueio').classList.remove('hidden');
};
document.getElementById('btn-cancel-bloqueio').onclick = ()=> document.getElementById('modal-bloqueio').classList.add('hidden');
document.getElementById('bl-fullday').onclick = function(){
  this.classList.toggle('on');
  document.getElementById('bl-time-row').style.display = this.classList.contains('on') ? 'none' : 'flex';
};
document.getElementById('btn-save-bloqueio').onclick = async ()=>{
  const date = document.getElementById('bl-data').value;
  const fullDay = document.getElementById('bl-fullday').classList.contains('on');
  if(!date){ showToast('Escolha uma data.','error'); return; }
  if(!fullDay && (!document.getElementById('bl-inicio').value || !document.getElementById('bl-fim').value)){
    showToast('Preencha o horário de início e fim, ou marque "dia inteiro".','error'); return;
  }
  const payload = {
    barberId: B.barber.id,
    date,
    fullDay,
    startTime: fullDay ? '00:00' : document.getElementById('bl-inicio').value,
    endTime: fullDay ? '23:59' : document.getElementById('bl-fim').value,
    reason: document.getElementById('bl-motivo').value.trim(),
  };
  const btn = document.getElementById('btn-save-bloqueio'); btn.disabled = true; btn.textContent = 'SALVANDO...';
  try{
    await db.collection('blockedTimes').add(payload);
    showToast('Horário bloqueado!','success');
    document.getElementById('modal-bloqueio').classList.add('hidden');
  }catch(err){ console.error(err); showToast('Erro ao bloquear horário.','error'); }
  finally{ btn.disabled = false; btn.textContent = 'SALVAR'; }
};
