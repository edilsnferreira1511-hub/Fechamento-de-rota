/* ============================================================
   DENNER BARBEARIA — APP DO CLIENTE
   ============================================================ */

const state = {
  uid: null,
  businessSettings: null,
  services: [],
  barbers: [],
  myAppointments: [],
  booking: { service:null, barber:null, dateKey:null, time:null },
  calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  barberDaysOff: [],      // docs da barbearia p/ o barbeiro selecionado
  barberBlocked: [],      // bloqueios (dia inteiro ou parcial)
  appointmentsTab: 'proximos',
  pendingCancelId: null,
};

/* ---------------- ÍCONES ---------------- */
function paintIcons(root=document){
  root.querySelectorAll('[data-icon]').forEach(el=>{
    if(!el.dataset.painted){ el.innerHTML = icon(el.dataset.icon); el.dataset.painted='1'; }
  });
}

/* ---------------- NAVEGAÇÃO ---------------- */
const VIEWS = ['home','services','booking','appointments','profile'];
function showView(name){
  VIEWS.forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('hidden', v!==name);
  });
  document.querySelectorAll('.nav-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.nav===name);
  });
  window.scrollTo({top:0});
  if(name==='booking' && !state.booking.service) resetBookingFlow();
  if(name==='appointments') renderAppointments();
  if(name==='profile') renderProfile();
}
document.addEventListener('click', (e)=>{
  const nav = e.target.closest('[data-nav]');
  if(nav){ showView(nav.dataset.nav); }
});

/* ---------------- AUTENTICAÇÃO ANÔNIMA DO CLIENTE ----------------
   Cada visitante recebe uma identidade anônima estável (persistida
   pelo próprio Firebase no navegador). É isso que permite que
   "Meus agendamentos" mostre só os agendamentos daquele aparelho,
   com segurança garantida pelas regras do Firestore. */
auth.onAuthStateChanged(user=>{
  if(user){
    state.uid = user.uid;
    loadClientProfileLocal();
    listenMyAppointments();
  } else {
    auth.signInAnonymously().catch(err=>{
      console.error(err);
      showToast('Não foi possível conectar. Verifique sua internet.','error');
    });
  }
});

/* ---------------- CONFIGURAÇÕES DA BARBEARIA ---------------- */
function listenBusinessSettings(){
  db.collection('businessSettings').doc('general').onSnapshot(doc=>{
    const data = doc.exists ? doc.data() : {};
    state.businessSettings = Object.assign({
      name:'DENNER BARBEARIA',
      phone:'(62) 99432-2452',
      whatsapp:'62994322452',
      address:'R. Psj 5 Q 6, 23 - Parque São Jerônimo, Anápolis - GO, 75097-035',
      instagram:'@denner.barbearia',
      facebook:'', logoUrl:'', coverPhotoUrl:'',
      hours: defaultHours(),
    }, data);
    renderBusinessSettings();
  }, err=>console.error(err));
}
function defaultHours(){
  const h = {};
  WEEKDAY_KEYS.forEach((k,i)=>{
    h[k] = (i===0) ? {closed:true,open:'09:00',close:'19:30'}
         : (i===6) ? {closed:false,open:'08:00',close:'19:30'}
         : {closed:false,open:'09:00',close:'19:30'};
  });
  return h;
}
function renderBusinessSettings(){
  const b = state.businessSettings;
  document.getElementById('biz-name').textContent = b.name;
  document.getElementById('biz-address').textContent = b.address;
  document.getElementById('biz-phone').textContent = b.phone;
  document.getElementById('about-location').textContent = b.addressShort || 'Parque São Jerônimo — Anápolis - GO';
  document.getElementById('social-handle').textContent = b.instagram || '@denner.barbearia';
  if(b.logoUrl){ document.getElementById('home-logo').src = b.logoUrl; }
  if(b.coverPhotoUrl){
    document.getElementById('hero-bg').style.backgroundImage =
      `linear-gradient(180deg, rgba(4,6,12,.15) 0%, rgba(4,6,12,.6) 55%, var(--navy-950) 96%), url('${b.coverPhotoUrl}')`;
    document.getElementById('hero-bg').style.backgroundSize = 'cover';
    document.getElementById('hero-bg').style.backgroundPosition = 'center';
  }
  // horários
  const hoursHtml = WEEKDAY_KEYS.map((k,i)=>{
    const d = b.hours[k] || {closed:true};
    return `<div class="hours-row"><span>${WEEKDAY_LABEL_FULL[i]}</span><span>${d.closed?'Fechado':`${d.open} — ${d.close}`}</span></div>`;
  }).join('');
  document.getElementById('hours-list').innerHTML = hoursHtml;
  // redes sociais
  let social = '';
  if(b.instagram) social += `<a href="https://instagram.com/${String(b.instagram).replace('@','')}" target="_blank" rel="noopener"><span data-icon="instagram"></span></a>`;
  if(b.whatsapp) social += `<a href="${buildWhatsAppLink(b.whatsapp,'Olá! Vim pelo site da Denner Barbearia.')}" target="_blank" rel="noopener"><span data-icon="whatsapp"></span></a>`;
  if(b.facebook) social += `<a href="${b.facebook}" target="_blank" rel="noopener"><span data-icon="facebook"></span></a>`;
  document.getElementById('social-links').innerHTML = social;
  paintIcons();
  document.getElementById('btn-como-chegar').onclick = ()=>{
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`, '_blank');
  };
}

/* ---------------- SERVIÇOS ---------------- */
function listenServices(){
  db.collection('services').where('active','==',true).onSnapshot(snap=>{
    state.services = snap.docs.map(d=>({id:d.id, ...d.data()}))
      .sort((a,b)=>(a.order??0)-(b.order??0));
    renderServicesList();
    renderBookingServices();
    if(state.booking.service){
      const fresh = state.services.find(s=>s.id===state.booking.service.id);
      if(fresh) state.booking.service = fresh; // preço/duração sempre atualizados
    }
  }, err=>{
    console.error(err);
    const msg = emptyState('Não foi possível carregar os serviços. Puxe a tela para atualizar ou tente novamente em instantes.');
    document.getElementById('services-list').innerHTML = msg;
    document.getElementById('booking-services-list').innerHTML = msg;
  });
}
function renderServicesList(){
  const el = document.getElementById('services-list');
  if(!state.services.length){ el.innerHTML = emptyState('Nenhum serviço disponível no momento.'); return; }
  el.innerHTML = state.services.map(s=>`
    <div class="list-card">
      <img class="thumb" src="${s.photoUrl || placeholderImg()}" alt="${s.name}">
      <div class="info">
        <div class="title">${s.name}</div>
        <div class="meta"><span data-icon="clock" style="width:13px;height:13px;display:inline-flex;"></span> ${s.durationMin} min</div>
      </div>
      <div class="price">${formatCurrency(s.price)}</div>
    </div>`).join('');
  paintIcons(el);
}
function renderBookingServices(){
  const el = document.getElementById('booking-services-list');
  if(!state.services.length){ el.innerHTML = emptyState('Nenhum serviço disponível.'); return; }
  el.innerHTML = state.services.map(s=>`
    <div class="list-card selectable" data-id="${s.id}">
      <img class="thumb" src="${s.photoUrl || placeholderImg()}" alt="${s.name}">
      <div class="info">
        <div class="title">${s.name}</div>
        <div class="meta">${s.durationMin} min · <span class="price" style="font-size:12.5px;">${formatCurrency(s.price)}</span></div>
      </div>
      <div class="radio-dot" data-radio></div>
    </div>`).join('');
  el.querySelectorAll('.list-card').forEach(card=>{
    card.onclick = ()=>{
      const s = state.services.find(x=>x.id===card.dataset.id);
      state.booking.service = s;
      el.querySelectorAll('.list-card').forEach(c=>{
        c.classList.toggle('selected', c.dataset.id===s.id);
        c.querySelector('[data-radio]').classList.toggle('checked', c.dataset.id===s.id);
      });
      document.getElementById('btn-step1-continue').disabled = false;
    };
  });
}

/* ---------------- BARBEIROS ---------------- */
function listenBarbers(){
  db.collection('barbers').where('active','==',true).onSnapshot(snap=>{
    state.barbers = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderBookingBarbers();
  }, err=>console.error(err));
}
function renderBookingBarbers(){
  const el = document.getElementById('booking-barbers-list');
  if(!state.barbers.length){ el.innerHTML = emptyState('Nenhum barbeiro disponível.'); return; }
  el.innerHTML = state.barbers.map(b=>`
    <div class="list-card selectable" data-id="${b.id}">
      <img class="thumb" style="border-radius:50%;" src="${b.photoUrl || placeholderImg()}" alt="${b.name}">
      <div class="info"><div class="title">${b.name.toUpperCase()}</div></div>
      <div class="radio-dot" data-radio></div>
    </div>`).join('');
  el.querySelectorAll('.list-card').forEach(card=>{
    card.onclick = ()=>{
      const b = state.barbers.find(x=>x.id===card.dataset.id);
      state.booking.barber = b;
      el.querySelectorAll('.list-card').forEach(c=>{
        c.classList.toggle('selected', c.dataset.id===b.id);
        c.querySelector('[data-radio]').classList.toggle('checked', c.dataset.id===b.id);
      });
      document.getElementById('btn-step2-continue').disabled = false;
    };
  });
}

/* ---------------- FLUXO DE AGENDAMENTO ---------------- */
function resetBookingFlow(){
  state.booking = { service:null, barber:null, dateKey:null, time:null };
  document.getElementById('input-client-name').value = '';
  document.getElementById('input-client-phone').value = '';
  goToStep(1);
}
function goToStep(n){
  for(let i=1;i<=5;i++) document.getElementById('step-'+i).classList.toggle('hidden', i!==n);
  document.getElementById('step-success').classList.add('hidden');
  renderStepsIndicator(n);
  if(n===3) initDateStep();
  if(n===4) initTimeStep();
  if(n===5) initConfirmStep();
}
function renderStepsIndicator(current){
  let html = '';
  for(let i=1;i<=5;i++){
    const cls = i<current ? 'done' : (i===current ? 'current' : '');
    html += `<div class="step-circle ${cls}">${i<current?'✓':i}</div>`;
    if(i<5) html += `<div class="step-line"></div>`;
  }
  document.getElementById('steps-indicator').innerHTML = html;
}
document.getElementById('btn-step1-continue').onclick = ()=> goToStep(2);
document.getElementById('btn-step2-continue').onclick = ()=> goToStep(3);
document.getElementById('btn-step3-continue').onclick = ()=> goToStep(4);
document.getElementById('btn-step4-continue').onclick = ()=> goToStep(5);
document.getElementById('booking-back').onclick = ()=>{
  const visible = [1,2,3,4,5].find(i=>!document.getElementById('step-'+i).classList.contains('hidden'));
  const successVisible = !document.getElementById('step-success').classList.contains('hidden');
  if(successVisible){ showView('home'); return; }
  if(visible>1) goToStep(visible-1); else showView('home');
};

/* --- Prefill (usado por "Repita seu último corte" e "Alterar") --- */
function prefillBooking(serviceId, barberId){
  const s = state.services.find(x=>x.id===serviceId);
  const b = state.barbers.find(x=>x.id===barberId);
  if(!s || !b){ showToast('Serviço ou barbeiro indisponível no momento.','error'); return; }
  state.booking.service = s;
  state.booking.barber = b;
  state.booking.dateKey = null;
  state.booking.time = null;
  showView('booking');
  goToStep(3);
}

/* ---------------- ETAPA 3 — DATA ---------------- */
async function initDateStep(){
  document.getElementById('btn-step3-continue').disabled = true;
  const barberId = state.booking.barber.id;
  const [daysOffSnap, blockedSnap] = await Promise.all([
    db.collection('daysOff').where('barberId','in',[barberId,'all']).get(),
    db.collection('blockedTimes').where('barberId','in',[barberId,'all']).get(),
  ]);
  state.barberDaysOff = daysOffSnap.docs.map(d=>d.data());
  state.barberBlocked = blockedSnap.docs.map(d=>d.data());
  renderDayChips();
  renderCalendar();
}
function isDateAvailable(d){
  const key = dateKey(d);
  const today = new Date(); today.setHours(0,0,0,0);
  if(d < today) return false;
  const hours = state.businessSettings.hours[WEEKDAY_KEYS[d.getDay()]];
  if(!hours || hours.closed) return false;
  const weeklyOff = state.barberDaysOff.some(o => o.type==='weekly' && Number(o.weekday)===d.getDay());
  if(weeklyOff) return false;
  const dateOff = state.barberDaysOff.some(o => o.type==='date' && o.date===key);
  if(dateOff) return false;
  const fullBlocked = state.barberBlocked.some(bl => bl.date===key && bl.fullDay);
  if(fullBlocked) return false;
  return true;
}
function renderDayChips(){
  const days = [];
  let cursor = new Date();
  for(let i=0; days.length<4 && i<45; i++){
    const d = new Date(cursor); d.setDate(cursor.getDate()+i);
    if(isDateAvailable(d)) days.push(d);
  }
  const row = document.getElementById('day-chip-row');
  row.innerHTML = days.map(d=>{
    const key = dateKey(d);
    return `<div class="day-chip" data-key="${key}">
      <div class="dow">${WEEKDAY_LABEL[d.getDay()]}</div>
      <div class="num">${pad2(d.getDate())}</div>
      <div class="mon">${MONTH_LABEL[d.getMonth()]}</div>
    </div>`;
  }).join('');
  row.querySelectorAll('.day-chip').forEach(chip=>{
    chip.onclick = ()=> selectDate(chip.dataset.key);
  });
  if(days.length) syncChipSelection();
}
function syncChipSelection(){
  document.querySelectorAll('#day-chip-row .day-chip').forEach(c=>{
    c.classList.toggle('selected', c.dataset.key===state.booking.dateKey);
  });
}
function renderCalendar(){
  const monthDate = state.calMonth;
  document.getElementById('cal-month-label').textContent = `${MONTH_LABEL_FULL[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const firstDow = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();
  let html = WEEKDAY_LABEL.map(l=>`<div class="cal-dow">${l}</div>`).join('');
  for(let i=0;i<firstDow;i++) html += `<div class="cal-day empty"></div>`;
  const today = new Date(); today.setHours(0,0,0,0);
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const key = dateKey(d);
    const avail = isDateAvailable(d);
    const isToday = dateKey(today)===key;
    const isSelected = state.booking.dateKey===key;
    html += `<div class="cal-day ${avail?'':'disabled'} ${isToday?'today':''} ${isSelected?'selected':''}" data-key="${key}" data-avail="${avail}">${day}</div>`;
  }
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day[data-avail="true"]').forEach(cell=>{
    cell.onclick = ()=> selectDate(cell.dataset.key);
  });
}
document.getElementById('cal-prev').onclick = ()=>{
  state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth()-1, 1);
  renderCalendar();
};
document.getElementById('cal-next').onclick = ()=>{
  state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth()+1, 1);
  renderCalendar();
};
function selectDate(key){
  state.booking.dateKey = key;
  state.booking.time = null;
  syncChipSelection();
  renderCalendar();
  document.getElementById('btn-step3-continue').disabled = false;
}

/* ---------------- ETAPA 4 — HORÁRIO ---------------- */
async function initTimeStep(){
  document.getElementById('btn-step4-continue').disabled = true;
  const wrap = document.getElementById('slots-wrap');
  wrap.innerHTML = '<div class="loader"></div>';
  const { barber, service, dateKey:dk } = state.booking;
  const hours = state.businessSettings.hours[WEEKDAY_KEYS[dateFromKey(dk).getDay()]];
  try{
    const [apptsSnap, blockedSnap] = await Promise.all([
      db.collection('appointments').where('barberId','==',barber.id).get(),
      db.collection('blockedTimes').where('barberId','in',[barber.id,'all']).get(),
    ]);
    const busy = apptsSnap.docs.map(d=>d.data())
      .filter(a => a.date===dk && (a.status==='confirmed' || a.status==='completed'))
      .map(a=>({startTime:a.startTime, durationMin:a.serviceDuration}));
    blockedSnap.docs.map(d=>d.data()).filter(b=>b.date===dk).forEach(b=>{
      if(!b.fullDay) busy.push({startTime:b.startTime, durationMin: timeToMinutes(b.endTime)-timeToMinutes(b.startTime)});
    });
    const allSlots = generateSlots(hours.open, hours.close, 30);
    const available = filterAvailableSlots(allSlots, service.durationMin, hours.close, busy);
    if(!allSlots.length){ wrap.innerHTML = emptyState('Barbearia fechada nesse dia.'); return; }
    wrap.innerHTML = `<div class="slot-grid">${allSlots.map(s=>{
      const ok = available.includes(s);
      return `<div class="slot-btn ${ok?'':'disabled'}" data-time="${s}">${s}</div>`;
    }).join('')}</div>`;
    wrap.querySelectorAll('.slot-btn:not(.disabled)').forEach(btn=>{
      btn.onclick = ()=>{
        state.booking.time = btn.dataset.time;
        wrap.querySelectorAll('.slot-btn').forEach(b=>b.classList.toggle('selected', b===btn));
        document.getElementById('btn-step4-continue').disabled = false;
      };
    });
  }catch(err){
    console.error(err);
    wrap.innerHTML = emptyState('Não foi possível carregar os horários. Volte e tente novamente.');
  }
}

/* ---------------- ETAPA 5 — CONFIRMAÇÃO ---------------- */
function initConfirmStep(){
  const { service, barber, dateKey:dk, time } = state.booking;
  document.getElementById('booking-summary').innerHTML = summaryRows(service, barber, dk, time);
  paintIcons(document.getElementById('booking-summary'));
  const savedName = localStorage.getItem('denner_client_name');
  const savedPhone = localStorage.getItem('denner_client_phone');
  if(savedName) document.getElementById('input-client-name').value = savedName;
  if(savedPhone) document.getElementById('input-client-phone').value = savedPhone;
}
function summaryRows(service, barber, dk, time){
  return `
    <div class="summary-row"><span data-icon="scissors"></span><div><div class="k">Serviço</div><div class="v">${service.name}</div></div></div>
    <div class="summary-row"><span data-icon="user"></span><div><div class="k">Barbeiro</div><div class="v">${barber.name}</div></div></div>
    <div class="summary-row"><span data-icon="calendar"></span><div><div class="k">Data</div><div class="v">${formatDateBR(dk)}</div></div></div>
    <div class="summary-row"><span data-icon="clock"></span><div><div class="k">Horário</div><div class="v">${time}</div></div></div>
    <div class="summary-row"><span data-icon="cash"></span><div><div class="k">Valor</div><div class="v price">${formatCurrency(service.price)}</div></div></div>`;
}

document.getElementById('btn-confirm-booking').onclick = async ()=>{
  const name = document.getElementById('input-client-name').value.trim();
  const phone = document.getElementById('input-client-phone').value.trim();
  if(!name || !phone){ showToast('Preencha nome e telefone.','error'); return; }
  const btn = document.getElementById('btn-confirm-booking');
  btn.disabled = true; btn.textContent = 'CONFIRMANDO...';
  try{
    const { service, barber, dateKey:dk, time } = state.booking;
    // revalidação de conflito no momento da confirmação (evita corrida entre dois clientes)
    const conflictSnap = await db.collection('appointments').where('barberId','==',barber.id).get();
    const busy = conflictSnap.docs.map(d=>d.data())
      .filter(a => a.date===dk && (a.status==='confirmed' || a.status==='completed'))
      .map(a=>({startTime:a.startTime, durationMin:a.serviceDuration}));
    const start = timeToMinutes(time), end = start + Number(service.durationMin);
    const conflict = busy.some(b=>{
      const bs = timeToMinutes(b.startTime), be = bs + Number(b.durationMin);
      return start < be && end > bs;
    });
    if(conflict){
      showToast('Esse horário acabou de ser reservado. Escolha outro.','error');
      goToStep(4); initTimeStep();
      return;
    }
    localStorage.setItem('denner_client_name', name);
    localStorage.setItem('denner_client_phone', phone);
    await db.collection('clients').doc(state.uid).set({ name, phone, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
    const docRef = await db.collection('appointments').add({
      clientUid: state.uid, clientName:name, clientPhone:phone,
      serviceId: service.id, serviceName: service.name, servicePrice: service.price, serviceDuration: service.durationMin,
      barberId: barber.id, barberName: barber.name,
      date: dk, startTime: time,
      status:'confirmed', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById('success-summary').innerHTML = summaryRows(service, barber, dk, time);
    paintIcons(document.getElementById('success-summary'));
    document.getElementById('btn-whatsapp-confirm').onclick = ()=>{
      const msg = buildConfirmationMessage({serviceName:service.name, barberName:barber.name, date:dk, startTime:time, price:service.price});
      window.open(buildWhatsAppLink(state.businessSettings.whatsapp, msg), '_blank');
    };
    document.getElementById('btn-add-calendar').onclick = ()=>{
      const link = buildGoogleCalendarLink({
        serviceName: service.name, barberName: barber.name, date: dk, startTime: time,
        durationMin: service.durationMin, address: state.businessSettings.address,
      });
      window.open(link, '_blank');
    };
    for(let i=1;i<=5;i++) document.getElementById('step-'+i).classList.add('hidden');
    document.getElementById('step-success').classList.remove('hidden');
    document.getElementById('steps-indicator').innerHTML = '';
  }catch(err){
    console.error(err);
    showToast('Não foi possível confirmar. Tente novamente.','error');
  }finally{
    btn.disabled = false; btn.textContent = 'CONFIRMAR AGENDAMENTO';
  }
};

/* ---------------- MEUS AGENDAMENTOS ---------------- */
function listenMyAppointments(){
  db.collection('appointments').where('clientUid','==',state.uid).onSnapshot(snap=>{
    state.myAppointments = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAppointments();
    renderProfile();
  }, err=>console.error(err));
}
document.querySelectorAll('.tab').forEach(t=>{
  t.onclick = ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    state.appointmentsTab = t.dataset.tab;
    renderAppointments();
  };
});
function nowKey(){ return dateKey(new Date()); }
function isUpcoming(a){
  if(a.status==='cancelled') return false;
  if(a.date > nowKey()) return true;
  if(a.date === nowKey() && a.status==='confirmed') return true;
  return false;
}
function renderAppointments(){
  const el = document.getElementById('appointments-list');
  if(!el) return;
  const list = state.myAppointments
    .filter(a => state.appointmentsTab==='proximos' ? isUpcoming(a) : !isUpcoming(a))
    .sort((a,b)=> state.appointmentsTab==='proximos'
      ? (a.date+a.startTime).localeCompare(b.date+b.startTime)
      : (b.date+b.startTime).localeCompare(a.date+a.startTime));

  let html = '';
  if(state.appointmentsTab==='proximos'){
    const completed = state.myAppointments.filter(a=>a.status==='completed');
    const lastDone = [...completed].sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime))[0];
    if(lastDone){
      html += `<div class="loyalty-card" style="margin-bottom:12px;" id="repeat-last-cut">
        <div class="ico"><span data-icon="repeat"></span></div>
        <div style="flex:1;"><b>REPITA SEU ÚLTIMO CORTE</b><span>Agende novamente com apenas 1 clique</span></div>
        <span data-icon="chevronRight"></span>
      </div>`;
    }
  }
  html += list.length ? list.map(a=>apptCardHtml(a, state.appointmentsTab==='proximos')).join('') : emptyState(state.appointmentsTab==='proximos' ? 'Você ainda não tem agendamentos futuros.' : 'Nenhum agendamento no histórico.');
  el.innerHTML = html;

  const repeatCard = document.getElementById('repeat-last-cut');
  if(repeatCard){
    const completed = state.myAppointments.filter(a=>a.status==='completed');
    const lastDone = [...completed].sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime))[0];
    repeatCard.onclick = ()=> prefillBooking(lastDone.serviceId, lastDone.barberId);
  }
  el.querySelectorAll('[data-cancel]').forEach(b=> b.onclick = ()=> openCancelModal(b.dataset.cancel));
  el.querySelectorAll('[data-alter]').forEach(b=> b.onclick = ()=> {
    openCancelModal(b.dataset.alter, true);
  });
  paintIcons(el);
}
function apptCardHtml(a, showActions){
  return `
    <div class="list-card" style="align-items:flex-start;">
      <div class="thumb" style="display:flex;align-items:center;justify-content:center;"><span data-icon="scissors" style="width:22px;height:22px;"></span></div>
      <div class="info">
        <div class="title">${a.serviceName}</div>
        <div class="meta"><span data-icon="user" style="width:12px;height:12px;display:inline-flex;"></span>${a.barberName}</div>
        <div class="meta"><span data-icon="calendar" style="width:12px;height:12px;display:inline-flex;"></span>${formatDateBR(a.date)} · ${a.startTime}</div>
        <div class="meta"><span class="status-pill ${a.status}">${statusLabel(a.status)}</span> <span class="price">${formatCurrency(a.servicePrice)}</span></div>
        ${showActions ? `<div class="actions">
          <button class="btn btn-secondary btn-sm" data-alter="${a.id}">ALTERAR</button>
          <button class="btn btn-danger btn-sm" data-cancel="${a.id}">CANCELAR</button>
        </div>` : ''}
      </div>
    </div>`;
}
function statusLabel(s){ return {confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado'}[s] || s; }

function openCancelModal(id, isAlter=false){
  state.pendingCancelId = id;
  const modal = document.getElementById('cancel-modal');
  document.getElementById('cancel-modal-detail').textContent = isAlter
    ? 'Para alterar, vamos cancelar este horário e você escolhe um novo.'
    : 'Esta ação não pode ser desfeita.';
  modal.classList.remove('hidden');
}
document.getElementById('btn-cancel-dismiss').onclick = ()=> document.getElementById('cancel-modal').classList.add('hidden');
document.getElementById('btn-cancel-confirm').onclick = async ()=>{
  if(!state.pendingCancelId) return;
  try{
    const appt = state.myAppointments.find(a=>a.id===state.pendingCancelId);
    await db.collection('appointments').doc(state.pendingCancelId).update({status:'cancelled'});
    document.getElementById('cancel-modal').classList.add('hidden');
    showToast('Agendamento cancelado.','success');
    if(appt) prefillBooking(appt.serviceId, appt.barberId);
  }catch(err){
    console.error(err);
    showToast('Não foi possível cancelar. Tente novamente.','error');
  }
};

/* ---------------- PERFIL ---------------- */
function loadClientProfileLocal(){
  const name = localStorage.getItem('denner_client_name') || '';
  const phone = localStorage.getItem('denner_client_phone') || '';
  document.getElementById('profile-name').value = name;
  document.getElementById('profile-phone').value = phone;
}
document.getElementById('btn-save-profile').onclick = async ()=>{
  const name = document.getElementById('profile-name').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  if(!name || !phone){ showToast('Preencha nome e telefone.','error'); return; }
  localStorage.setItem('denner_client_name', name);
  localStorage.setItem('denner_client_phone', phone);
  await db.collection('clients').doc(state.uid).set({name,phone,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  showToast('Perfil salvo!','success');
};
function renderProfile(){
  const nextEl = document.getElementById('profile-next');
  const statsEl = document.getElementById('profile-stats');
  const histEl = document.getElementById('profile-history');
  if(!nextEl) return;
  const upcoming = state.myAppointments.filter(isUpcoming).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
  const completed = state.myAppointments.filter(a=>a.status==='completed');
  nextEl.innerHTML = upcoming.length ? apptCardHtml(upcoming[0], false) : emptyState('Nenhum agendamento futuro.');
  const rem = completed.length % 5;
  const missingForFree = rem===0 ? (completed.length>0?0:5) : (5-rem);
  statsEl.innerHTML = `<div class="stat-grid" style="margin-bottom:0;">
    <div class="stat-card"><div class="num">${completed.length}</div><div class="lbl">Cortes realizados</div></div>
    <div class="stat-card"><div class="num">${missingForFree}</div><div class="lbl">Faltam p/ fidelidade</div></div>
  </div>`;
  const lastDone = [...completed].sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime))[0];
  histEl.innerHTML = completed.length ? completed
    .sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime))
    .slice(0,10).map(a=>apptCardHtml(a,false)).join('') : emptyState('Nenhum corte no histórico ainda.');
  paintIcons(nextEl); paintIcons(histEl);
}

/* ---------------- ADMIN PIN ---------------- */
document.getElementById('btn-admin-access').onclick = ()=> document.getElementById('admin-pin-modal').classList.remove('hidden');
document.getElementById('btn-admin-cancel').onclick = ()=> document.getElementById('admin-pin-modal').classList.add('hidden');
document.getElementById('btn-admin-submit').onclick = async ()=>{
  const pin = document.getElementById('admin-pin-input').value.trim();
  if(!pin){ showToast('Digite o PIN.','error'); return; }
  const btn = document.getElementById('btn-admin-submit');
  btn.disabled = true;
  try{
    await auth.signInWithEmailAndPassword(ADMIN_INTERNAL_EMAIL, pin);
    window.location.href = 'admin.html';
  }catch(err){
    showToast('PIN incorreto.','error');
    await auth.signInAnonymously(); // volta a sessão do cliente
  }finally{
    btn.disabled = false;
  }
};

/* ---------------- HELPERS DE UI ---------------- */
function emptyState(msg){
  return `<div class="empty-state"><span data-icon="calendar"></span><p>${msg}</p></div>`;
}
function placeholderImg(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#141b2e"/><text x="50" y="56" font-size="34" text-anchor="middle" fill="#cea23f" font-family="Georgia">D</text></svg>`);
}

/* ---------------- INICIALIZAÇÃO ---------------- */
paintIcons();
listenBusinessSettings();
listenServices();
listenBarbers();
