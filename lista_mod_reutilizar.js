/* Módulo de reutilização. Carregar como script clássico após o script principal. */
(function () {
  'use strict';
  if (document.getElementById('reutilizarListas')) return;

  const section = document.createElement('section');
  section.id = 'reutilizarListas';
  section.className = 'bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3';
  section.setAttribute('aria-label', 'Gerenciar listas');
  const heading = document.createElement('h2');
  heading.className = 'font-bold text-base';
  heading.textContent = 'Suas listas';
  const hint = document.createElement('p');
  hint.className = 'text-xs text-slate-500 dark:text-slate-400';
  hint.textContent = 'Abra, crie, renomeie ou duplique uma lista para reutilizar seus itens.';
  const controls = document.createElement('div');
  controls.className = 'flex flex-wrap gap-2';
  const chooser = document.createElement('div');
  chooser.id = 'reutilizarEscolhaLista';
  chooser.className = 'hidden flex flex-wrap gap-2';
  chooser.setAttribute('aria-label', 'Listas disponíveis');

  function makeButton(text, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.className = className;
    button.addEventListener('click', onClick);
    controls.appendChild(button);
    return button;
  }
  const normal = 'px-3 py-2 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100';
  const openButton = makeButton('📂 Abrir minhas listas', 'px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white', openLists);
  openButton.setAttribute('aria-controls', chooser.id);
  openButton.setAttribute('aria-expanded', 'false');
  makeButton('＋ Nova lista vazia', normal, createEmpty);
  makeButton('Renomear lista atual', normal, renameCurrent);
  makeButton('Duplicar lista atual', normal, duplicateCurrent);
  makeButton('Limpar itens', 'px-3 py-2 rounded-xl text-sm font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100', clearCurrent);
  section.append(heading, hint, controls, chooser);
  const main = document.querySelector('main');
  if (!main) return;
  main.prepend(section);

  function refresh() {
    // Evita deixar aberta uma escolha com nomes ou lista ativa desatualizados.
    chooser.classList.add('hidden');
    openButton.setAttribute('aria-expanded', 'false');
    renderListSelector();
    renderApp();
  }
  function persistOrRollback(rollback) {
    let saved = false;
    try {
      saveState(); // A função original informa erros, mas não os propaga.
      saved = localStorage.getItem(STORAGE_KEY) === JSON.stringify(appState);
    } catch (_) {}
    if (!saved) {
      rollback();
      refresh();
      window.alert('Não foi possível confirmar o salvamento. A alteração foi desfeita na tela, mas pode ter sido salva. Confira os dados ao recarregar; verifique espaço e permissões.');
      return false;
    }
    refresh();
    return true;
  }
  function uniqueId(prefix, used) {
    let id;
    do {
      const random = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      id = prefix + random;
    } while (used.has(id));
    used.add(id);
    return id;
  }
  function commitNewList(list) {
    const previousId = appState.activeListId;
    appState.lists[list.id] = list;
    appState.activeListId = list.id;
    return persistOrRollback(function () {
      delete appState.lists[list.id];
      appState.activeListId = previousId;
    });
  }
  function openLists() {
    const selector = document.getElementById('listSelector');
    if (!selector) return;
    // showPicker precisa ser chamado diretamente pelo gesto do usuário.
    if (typeof selector.showPicker === 'function') {
      try {
        selector.showPicker();
        chooser.classList.add('hidden');
        openButton.setAttribute('aria-expanded', 'false');
        return;
      } catch (_) { /* fallback explícito abaixo */ }
    }
    selector.focus();
    chooser.replaceChildren();
    Object.values(appState.lists).forEach(function (list) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = normal;
      option.textContent = list.name + (list.id === appState.activeListId ? ' (atual)' : '');
      option.addEventListener('click', function () {
        const previousId = appState.activeListId;
        appState.activeListId = list.id;
        if (persistOrRollback(function () { appState.activeListId = previousId; })) {
          chooser.classList.add('hidden');
          openButton.setAttribute('aria-expanded', 'false');
        }
      });
      chooser.appendChild(option);
    });
    chooser.classList.remove('hidden');
    openButton.setAttribute('aria-expanded', 'true');
  }
  function createEmpty() {
    openNewListModal();
    // O modal original oferece exclusão sem confirmação; escondê-la neste fluxo.
    document.getElementById('genericModalExtra').classList.add('hidden');
    document.getElementById('genericModalDesc').textContent = 'A lista atual será preservada. A nova lista começará vazia.';
    document.getElementById('genericModalConfirmBtn').onclick = function () {
      const name = document.getElementById('genericModalInput').value.trim();
      if (!name) { window.alert('Informe um nome para a lista.'); return; }
      const id = uniqueId('list-', new Set(Object.keys(appState.lists)));
      if (commitNewList({ id: id, name: name, budget: 0, items: [] })) {
        closeGenericModal();
        showToast('Lista vazia criada. A lista anterior foi preservada.');
      }
    };
  }
  function renameCurrent() {
    const list = getActiveList();
    if (!list || typeof list.name !== 'string') { window.alert('Não foi possível identificar a lista atual.'); return; }
    const entered = window.prompt('Novo nome da lista “' + list.name + '”. Os itens serão preservados.', list.name);
    if (entered === null) return;
    const name = entered.trim();
    if (!name) { window.alert('Informe um nome para a lista.'); return; }
    if (name === list.name) return;
    const previousName = list.name;
    list.name = name;
    if (persistOrRollback(function () { list.name = previousName; })) {
      // Fechar a escolha alternativa para evitar nomes antigos visíveis.
      chooser.classList.add('hidden');
      openButton.setAttribute('aria-expanded', 'false');
      showToast('Lista renomeada. Todos os itens foram preservados.');
    }
  }
  function duplicateCurrent() {
    const source = getActiveList();
    if (!source || !Array.isArray(source.items)) { window.alert('Não foi possível identificar a lista atual.'); return; }
    const entered = window.prompt('Nome da cópia de “' + source.name + '”: os itens serão desmarcados e os preços mantidos.', source.name + ' (cópia)');
    if (entered === null) return;
    const name = entered.trim();
    if (!name) { window.alert('Informe um nome para a cópia.'); return; }
    let clone;
    try { clone = JSON.parse(JSON.stringify(source)); }
    catch (_) { window.alert('Não foi possível copiar esta lista. Nenhuma alteração foi feita.'); return; }
    clone.id = uniqueId('list-', new Set(Object.keys(appState.lists)));
    clone.name = name;
    const itemIds = new Set(source.items.map(function (item) { return item.id; }));
    clone.items.forEach(function (item) {
      item.id = uniqueId('item-', itemIds);
      item.checked = false;
    });
    if (commitNewList(clone)) showToast('Cópia criada com itens desmarcados e preços mantidos.');
  }
  function clearCurrent() {
    const list = getActiveList();
    if (!list || !Array.isArray(list.items)) { window.alert('Não foi possível identificar a lista atual.'); return; }
    if (!list.items.length) { window.alert('Esta lista já está vazia.'); return; }
    const count = list.items.length;
    if (!window.confirm('Limpar todos os ' + count + ' itens da lista “' + list.name + '”?\n\nOs itens e preços serão removidos desta lista. Esta ação não pode ser desfeita. Outras listas serão preservadas.')) return;
    const previousItems = list.items;
    list.items = [];
    if (persistOrRollback(function () { list.items = previousItems; })) showToast('Itens da lista removidos.');
  }

  // O botão antigo de excluir lista também não pode apagar silenciosamente.
  if (typeof deleteCurrentList === 'function') {
    const originalDelete = deleteCurrentList;
    deleteCurrentList = function () {
      const list = getActiveList();
      if (!list || Object.keys(appState.lists).length <= 1) return originalDelete();
      if (window.confirm('Excluir a lista “' + list.name + '” e todos os seus itens? Esta ação não pode ser desfeita.')) return originalDelete();
    };
  }
})();
