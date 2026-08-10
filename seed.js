/* ============================================================
   SEED — dados iniciais da Denner Barbearia
   ------------------------------------------------------------
   COMO USAR:
   1) Abra admin.html no navegador e faça login com o PIN de admin.
   2) Abra o Console do navegador (F12 → aba "Console").
   3) Copie e cole todo o conteúdo deste arquivo e aperte Enter.
   4) Aguarde a mensagem "✅ Seed concluído".
   Rode apenas UMA VEZ (rodar de novo duplica os serviços).
   ============================================================ */

(async function seed(){
  const services = [
    { name:'Corte Masculino', durationMin:30, price:40, description:'', active:true, order:0, photoUrl:null },
    { name:'Corte + Barba', durationMin:50, price:65, description:'', active:true, order:1, photoUrl:null },
    { name:'Barba', durationMin:20, price:30, description:'', active:true, order:2, photoUrl:null },
    { name:'Corte + Sobrancelha', durationMin:40, price:50, description:'', active:true, order:3, photoUrl:null },
  ];
  for(const s of services){ await db.collection('services').add(s); }

  await db.collection('businessSettings').doc('general').set({
    name:'DENNER BARBEARIA',
    phone:'(62) 99432-2452',
    whatsapp:'62994322452',
    address:'R. Psj 5 Q 6, 23 - Parque São Jerônimo, Anápolis - GO, 75097-035',
    instagram:'@denner.barbearia',
    facebook:'',
    logoUrl:'', coverPhotoUrl:'',
    hours:{
      sunday:{closed:true, open:'09:00', close:'19:30'},
      monday:{closed:false, open:'09:00', close:'19:30'},
      tuesday:{closed:false, open:'09:00', close:'19:30'},
      wednesday:{closed:false, open:'09:00', close:'19:30'},
      thursday:{closed:false, open:'09:00', close:'19:30'},
      friday:{closed:false, open:'09:00', close:'19:30'},
      saturday:{closed:false, open:'08:00', close:'19:30'},
    }
  }, {merge:true});

  console.log('✅ Seed concluído. Agora cadastre os barbeiros na aba "Barbeiros" do painel.');
})();
