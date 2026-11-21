(() => {
  'use strict';
  let deferredPrompt = null;
  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  const standalone = () => standaloneMedia.matches || window.navigator.standalone === true;
  let installed = standalone();
  const button = document.getElementById('instalar-app');
  const area = button.parentElement;
  const dialog = document.getElementById('instalar-dialogo');
  const instructions = document.getElementById('instalar-instrucoes');
  const close = document.getElementById('instalar-fechar');
  const sync = () => { area.hidden = installed || standalone(); };
  const showHelp = () => {
    const ua = navigator.userAgent;
    const apple = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    instructions.textContent = apple
      ? 'Atenção: no iPhone ou iPad, as listas salvas no Safari não são copiadas automaticamente para o aplicativo instalado. Elas continuam no Safari.\n\nNo Safari, toque em Compartilhar (quadrado com seta) e depois em “Adicionar à Tela de Início”. Confirme em “Adicionar”. Se não aparecer, procure a opção na lista de ações.'
      : android
      ? 'Abra o menu do navegador (⋮) e toque em “Instalar aplicativo” ou “Adicionar à tela inicial”. O nome da opção pode variar conforme o navegador.'
      : 'Abra o menu do navegador e procure “Instalar aplicativo” ou “Adicionar à tela inicial”. No computador, procure também o ícone de instalação na barra de endereço. O nome da opção pode variar conforme o navegador.';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); }
  };
  window.addEventListener('beforeinstallprompt', event => {
    if (standalone() || installed) return;
    event.preventDefault();
    deferredPrompt = event;
    sync();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    if (dialog.open) dialog.close();
    sync();
  });
  button.addEventListener('click', async () => {
    if (!deferredPrompt) { showHelp(); return; }
    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (_) { showHelp(); }
  });
  close.addEventListener('click', () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  });
  if (standaloneMedia.addEventListener) standaloneMedia.addEventListener('change', sync);
  else if (standaloneMedia.addListener) standaloneMedia.addListener(sync);
  sync();
})();
