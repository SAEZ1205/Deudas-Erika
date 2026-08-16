(() => {
  function openChat(){
    if(document.querySelector('.chat-backdrop.alucia-owned')) return;
    const backdrop=document.createElement('div');
    backdrop.className='chat-backdrop alucia-owned';
    backdrop.innerHTML='<section class="chat-panel"><header><div><strong>LucIA</strong></div><button type="button" aria-label="Cerrar">✕</button></header></section>';
    backdrop.querySelector('header button').onclick=()=>backdrop.remove();
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});
    document.body.appendChild(backdrop);
  }
  function install(){
    if(document.getElementById('alucia-smart-trigger'))return;
    const b=document.createElement('button');
    b.id='alucia-smart-trigger';b.type='button';b.setAttribute('aria-label','Abrir LucIA');b.title='Hablar con LucIA';
    b.innerHTML='<img src="/lucia/lucia-chat-wave.png" alt="LucIA"><span>LucIA</span>';
    b.onclick=openChat;
    document.body.appendChild(b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
