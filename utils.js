/* ============================================================
   UTILITÁRIOS COMPARTILHADOS — Denner Barbearia
   ============================================================ */

const WEEKDAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const WEEKDAY_LABEL = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
const WEEKDAY_LABEL_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTH_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_LABEL_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function pad2(n){ return String(n).padStart(2,'0'); }

/** Retorna 'YYYY-MM-DD' a partir de um objeto Date (horário local) */
function dateKey(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function dateFromKey(key){
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y, m-1, d);
}
function formatDateBR(key){
  const d = dateFromKey(key);
  return `${WEEKDAY_LABEL_FULL[d.getDay()]}, ${pad2(d.getDate())} de ${MONTH_LABEL_FULL[d.getMonth()]}`;
}
function formatCurrency(v){
  return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function timeToMinutes(t){
  const [h,m] = t.split(':').map(Number);
  return h*60+m;
}
function minutesToTime(min){
  const h = Math.floor(min/60), m = min%60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Gera os slots possíveis (a cada 30min) entre abertura e fechamento */
function generateSlots(openTime, closeTime, stepMin=30){
  const slots = [];
  let t = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);
  while (t + stepMin <= end){
    slots.push(minutesToTime(t));
    t += stepMin;
  }
  return slots;
}

/**
 * Remove da lista de slots os horários que colidem com agendamentos
 * já existentes, considerando a duração do serviço selecionado.
 * existingAppointments: [{startTime, durationMin}]
 */
function filterAvailableSlots(slots, serviceDurationMin, closeTime, existingAppointments){
  const closeMin = timeToMinutes(closeTime);
  const busyRanges = existingAppointments.map(a => ({
    start: timeToMinutes(a.startTime),
    end: timeToMinutes(a.startTime) + Number(a.durationMin)
  }));
  return slots.filter(slot => {
    const start = timeToMinutes(slot);
    const end = start + Number(serviceDurationMin);
    if (end > closeMin) return false; // não cabe até o fechamento
    return !busyRanges.some(b => start < b.end && end > b.start); // sobreposição
  });
}

function buildWhatsAppLink(phone, message){
  const digits = String(phone).replace(/\D/g,'');
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

function buildConfirmationMessage({serviceName, barberName, date, startTime, price}){
  return `✂️ DENNER BARBEARIA\n\nSeu horário foi confirmado!\n\n📅 Data: ${formatDateBR(date)}\n⏰ Horário: ${startTime}\n✂️ Serviço: ${serviceName}\n👤 Barbeiro: ${barberName}\n\n💰 Valor: ${formatCurrency(price)}\n\nTe esperamos! 💈`;
}

/**
 * Monta o link do Google Calendar para o cliente adicionar o agendamento
 * na própria agenda. O horário de término é calculado a partir da
 * duração do serviço (durationMin).
 */
function buildGoogleCalendarLink({serviceName, barberName, date, startTime, durationMin, address}){
  const d = dateFromKey(date);
  const [h,m] = startTime.split(':').map(Number);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  const end = new Date(start.getTime() + Number(durationMin||30)*60000);
  const fmt = (dt)=> `${dt.getFullYear()}${pad2(dt.getMonth()+1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${serviceName} — Denner Barbearia`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Agendamento na Denner Barbearia\nServiço: ${serviceName}\nBarbeiro: ${barberName}`,
    location: address || 'Denner Barbearia',
    ctz: 'America/Sao_Paulo',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ---------------- TOAST ---------------- */
function showToast(msg, type=''){
  let host = document.getElementById('toast-host');
  if(!host){
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .25s'; t.style.opacity='0'; setTimeout(()=>t.remove(),250); }, 2600);
}

/* ---------------- SVG ICON SET (inline, sem dependências externas) ---------------- */
const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  scissors: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8.5L19 19M8.5 15.5L19 5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7L18.2 21 12 17.3 5.8 21l1.6-6.1L2 9.2l7.1-.6z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>`,
  gift: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-5.4A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 10.5c.5 3 2.5 5 5.5 5.5"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9h3V6h-3a3 3 0 0 0-3 3v2H8v3h3v7h3v-7h3l1-3h-4V9a1 1 0 0 1 1-1z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 21c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><circle cx="17.5" cy="8.5" r="2.6"/><path d="M15.5 15.7c2.7.3 4.5 2 4.5 5.3"/></svg>`,
  cash: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  block: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
};
function icon(name){ return ICONS[name] || ''; }

/* ---------------- FOTOS DIRETO NO FIRESTORE ----------------
   Em vez de subir a foto para um serviço externo, a gente redimensiona
   e comprime ela no próprio celular (usando um <canvas>) e guarda o
   resultado como texto dentro do documento no Firestore. Fica tudo
   100% dentro do seu projeto Firebase, sem contas externas e sem
   precisar do plano pago do Firebase Storage.
   maxWidth/quality controlam o tamanho final do arquivo. */
function compressImageToDataUrl(file, maxWidth=600, quality=0.75){
  return new Promise((resolve, reject)=>{
    if(!file.type || !file.type.startsWith('image/')){
      reject(new Error('Escolha um arquivo de imagem (jpg, png, etc).')); return;
    }
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error('Esse arquivo não é uma imagem válida.'));
      img.onload = ()=>{
        let { width, height } = img;
        if(width > maxWidth){ height = Math.round(height * (maxWidth/width)); width = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // o Firestore aceita até ~1MB por documento inteiro; deixamos uma margem segura
        if(dataUrl.length > 700000){
          reject(new Error('Essa foto ainda ficou grande demais mesmo comprimida. Tente uma foto mais simples.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
