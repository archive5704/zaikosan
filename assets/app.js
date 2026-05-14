(() => {
  'use strict';

  const STOCK_MAIN = ['0','1','2'];
  const STOCK_FRAC = ['1/4','1/2','3/4'];
  const BUY_TARGETS = new Set(['0','1/4']);
  const MAX_HISTORY = 50;
  const $ = id => document.getElementById(id);

  let stockMain = '1';
  let stockFrac = '';
  let confirmAction = null;
  let lastStockTapAt = 0;
  let db = null;
  let state = { categories: [], items: [], history: [], updatedAt: null };

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    bindEvents();
    renderShellDate();
    renderStockButtons();

    try{
      const config = window.ZAIKOSAN_CONFIG || {};
      const missing = !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || config.SUPABASE_URL.includes('YOUR-PROJECT') || config.SUPABASE_ANON_KEY.includes('YOUR-');
      if(missing){
        setStatus('Supabase未設定です。assets/supabase.js にURLとanon keyを入れてください。', 'error');
        renderAll();
        return;
      }
      db = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      await loadData();
      clearStatus();
      setupRealtime();
      setupAutoRefresh();
    }catch(error){
      console.error(error);
      setStatus('接続エラー：Supabase設定・SQL実行状況を確認してください。', 'error');
      toast('接続に失敗しました');
    }

    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  async function loadData(){
    ensureDb();
    const [catRes, itemRes, histRes] = await Promise.all([
      db.from('categories').select('*').order('sort_order', { ascending:true }),
      db.from('items').select('*').order('pinned', { ascending:false }).order('reading', { ascending:true }),
      db.from('history').select('*').order('created_at', { ascending:false }).limit(MAX_HISTORY)
    ]);
    if(catRes.error) throw catRes.error;
    if(itemRes.error) throw itemRes.error;
    if(histRes.error) throw histRes.error;
    state.categories = catRes.data || [];
    state.items = itemRes.data || [];
    state.history = histRes.data || [];
    state.updatedAt = latestUpdatedAt();
    renderAll();
  }

  function setupRealtime(){
    if(!db || !db.channel) return;
    let firstSubscribe = true;
    const reload = debounce(async () => {
      try{
        await loadData();
        if(!firstSubscribe) toast('在庫を最新に更新しました');
      }catch(error){
        console.error(error);
      }
      firstSubscribe = false;
    }, 450);

    db.channel('zaikosan-public-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'items' }, reload)
      .on('postgres_changes', { event:'*', schema:'public', table:'categories' }, reload)
      .on('postgres_changes', { event:'*', schema:'public', table:'history' }, reload)
      .subscribe((status) => {
        if(status === 'SUBSCRIBED') firstSubscribe = false;
      });
  }

  function debounce(fn, wait){
    let timer;
    return () => { clearTimeout(timer); timer = setTimeout(fn, wait); };
  }

  function setupAutoRefresh(){
    // スマホでアプリを開いたままの時、Realtimeが一時的に途切れても追いつける保険。
    // バックグラウンドから戻った時にも最新化する。
    window.addEventListener('focus', () => {
      if(db) loadData().catch(console.error);
    });
    document.addEventListener('visibilitychange', () => {
      if(!document.hidden && db) loadData().catch(console.error);
    });
    setInterval(() => {
      if(!document.hidden && db) loadData().catch(console.error);
    }, 30000);
  }

  function ensureDb(){
    if(!db) throw new Error('Supabase is not configured.');
  }

  function latestUpdatedAt(){
    const times = [];
    state.items.forEach(item => times.push(item.updated_at));
    state.categories.forEach(cat => times.push(cat.updated_at || cat.created_at));
    state.history.forEach(h => times.push(h.created_at));
    return times.filter(Boolean).sort().at(-1) || new Date().toISOString();
  }

  function setStatus(message, type=''){
    $('statusNotice').textContent = message;
    $('statusNotice').className = 'notice ' + type;
  }
  function clearStatus(){
    const el = document.getElementById('statusMessage');
    if(!el) return;
    el.textContent = '';
    el.className = 'notice hidden';
  }

  function safe(value){ return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
  function cleanText(value){ return String(value ?? '').toLowerCase().normalize('NFKC').replaceAll(' ','').replaceAll('　',''); }
  function formatDate(value){ if(!value) return '未更新'; return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
  function stockNumber(value){
    const text = String(value ?? '').trim().normalize('NFKC').replaceAll(' ','').replaceAll('　','');
    if(text.includes('と')){
      const parts = text.split('と');
      return Number(parts[0] || 0) + stockNumber(parts[1] || 0);
    }
    if(text.includes('/')){
      const parts = text.split('/').map(Number);
      return !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[1] ? parts[0] / parts[1] : 999999;
    }
    const n = Number(text);
    return Number.isNaN(n) ? 999999 : n;
  }
  function stockClass(value){
    const n = stockNumber(value);
    if(n === 0) return 's0';
    if(n <= 1/3) return 's13';
    if(n <= 1/2) return 's12';
    if(n <= 3/4) return 's34';
    if(n <= 1) return 's1';
    return 's2';
  }
  function isBuyTarget(item){ return BUY_TARGETS.has(String(item.stock)); }

  function categoryNameById(id){ return state.categories.find(cat => cat.id === id)?.name || '未分類'; }
  function sortedCategories(){ return [...state.categories].sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)); }

  function openModal(id){ $(id).classList.add('show'); $(id).setAttribute('aria-hidden','false'); }
  function closeModal(id){ $(id).classList.remove('show'); $(id).setAttribute('aria-hidden','true'); }
  function toast(message){ if(!message) return; $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 1700); }
  function openConfirm(options){
    $('confirmTitle').textContent = options.title || '確認';
    $('confirmText').textContent = options.text || '';
    $('confirmOk').textContent = options.okText || '実行する';
    $('confirmExtra').innerHTML = options.extra || '';
    confirmAction = options.onOk;
    openModal('confirmModal');
  }

  function parseStockValue(value){
    const text = String(value || '1');
    if(text.includes('と')){
      const parts = text.split('と');
      stockMain = STOCK_MAIN.includes(parts[0]) ? parts[0] : '1';
      stockFrac = STOCK_FRAC.includes(parts[1]) ? parts[1] : '';
      return;
    }
    if(STOCK_FRAC.includes(text)){ stockMain = '0'; stockFrac = text; return; }
    stockMain = STOCK_MAIN.includes(text) ? text : '1';
    stockFrac = '';
  }
  function currentStockValue(){ return stockMain === '0' ? stockFrac || '0' : stockFrac ? stockMain + 'と' + stockFrac : stockMain; }
  function renderStockButtons(){
    const value = currentStockValue();
    $('stock').value = value;
    $('stockMainBtns').innerHTML = STOCK_MAIN.map(v => '<button type="button" class="stockChoice ' + (stockMain === v ? 'active' : '') + '" data-stock-main="' + v + '">' + v + '</button>').join('');
    $('stockFracBtns').innerHTML = STOCK_FRAC.map(v => '<button type="button" class="stockChoice ' + (stockFrac === v ? 'active' : '') + '" data-stock-frac="' + v + '">' + v + '</button>').join('');
    $('stockPreview').textContent = '選択中：' + value;
  }

  function renderAll(){
    renderShellDate(); renderStockButtons(); renderOptions(); renderBuyList(); renderItems(); renderCategories(); renderSummary(); renderHistory();
  }
  function renderShellDate(){
    $('updated').textContent = formatDate(state.updatedAt);
  }
  function renderOptions(){
    const cats = sortedCategories();
    const currentCategory = $('category').value;
    const currentFilter = $('filter').value || 'all';
    $('category').innerHTML = cats.map(cat => '<option value="' + cat.id + '">' + safe(cat.name) + '</option>').join('');
    $('filter').innerHTML = '<option value="all">すべて</option>' + cats.map(cat => '<option value="' + cat.id + '">' + safe(cat.name) + '</option>').join('');
    if(cats.some(cat => cat.id === currentCategory)) $('category').value = currentCategory;
    if(currentFilter === 'all' || cats.some(cat => cat.id === currentFilter)) $('filter').value = currentFilter;
  }
  
  function kanaHeaderFor(reading){
    const first = String(reading || '').trim().charAt(0);
    if('あいうえおぁぃぅぇぉ'.includes(first)) return 'あ行';
    if('かきくけこがぎぐげご'.includes(first)) return 'か行';
    if('さしすせそざじずぜぞ'.includes(first)) return 'さ行';
    if('たちつてとだぢづでど'.includes(first)) return 'た行';
    if('なにぬねの'.includes(first)) return 'な行';
    if('はひふへほばびぶべぼぱぴぷぺぽ'.includes(first)) return 'は行';
    if('まみむめも'.includes(first)) return 'ま行';
    if('やゆよゃゅょ'.includes(first)) return 'や行';
    if('らりるれろ'.includes(first)) return 'ら行';
    if('わをん'.includes(first)) return 'わ行';
    return 'その他';
  }
  function sortByReading(a,b){
    return String(a.reading || '').localeCompare(String(b.reading || ''),'ja') || String(a.name || '').localeCompare(String(b.name || ''),'ja');
  }

  function visibleItems(){
    const query = cleanText($('search').value);
    const categoryId = $('filter').value;
    const sort = $('sort').value;
    const pinOnly = $('pinOnly').checked;
    return [...state.items]
      .filter(item => {
        const categoryName = categoryNameById(item.category_id);
        const target = cleanText(item.name + ' ' + item.reading + ' ' + categoryName + ' ' + (item.memo || '') + ' ' + (item.updated_by || ''));
        return (!query || target.includes(query)) && (categoryId === 'all' || item.category_id === categoryId) && (!pinOnly || item.pinned);
      })
      .sort((a,b) => {
        if(sort === 'pinned'){
          if(a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return sortByReading(a,b);
        }
        if(a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if(sort === 'stock') return stockNumber(a.stock) - stockNumber(b.stock) || sortByReading(a,b);
        
        if(sort === 'category') return categoryNameById(a.category_id).localeCompare(categoryNameById(b.category_id),'ja') || sortByReading(a,b);
        return sortByReading(a,b);
      });
  }
  function renderBuyList(){
    const items = [...state.items].filter(isBuyTarget).sort((a,b) => stockNumber(a.stock) - stockNumber(b.stock) || sortByReading(a,b));
    $('buyCount').textContent = items.length + '件';
    $('buyList').innerHTML = items.length ? items.map(item =>
      '<div class="buyItem">' +
        '<div class="buyName">' + (item.pinned ? '<span class="pinMark">★</span>' : '') + safe(item.name) + '</div>' +
        '<div class="buyMeta">' + safe(categoryNameById(item.category_id)) + '</div>' +
        '<div class="stock ' + stockClass(item.stock) + '">' + safe(item.stock) + '</div>' +
        '<button class="ghost buyEditBtn" type="button" data-action="edit-item" data-id="' + item.id + '">修正</button>' +
      '</div>'
    ).join('') : '<div class="buyEmpty">買うものはありません</div>';
  }

  function renderItems(){
    const items = visibleItems();
    const sort = $('sort').value;
    $('count').textContent = items.length + '件';
    $('empty').style.display = items.length ? 'none' : 'block';
    let lastHeader = '';
    $('list').innerHTML = items.map(item => {
      const row = '<article class="item"><div class="itemInfo"><h3 class="name">' + (item.pinned ? '<span class="pinMark">★</span>' : '') + safe(item.name) + '</h3><div class="catMini">' + safe(categoryNameById(item.category_id)) + '</div><div class="dateMini">' + formatDate(item.updated_at) + '</div></div><div class="rightPack"><div class="stock ' + stockClass(item.stock) + '">' + safe(item.stock) + '</div><div class="miniActions"><button class="ghost miniBtn" type="button" data-action="edit-item" data-id="' + item.id + '">修正</button><button class="danger miniBtn" type="button" data-action="delete-item" data-id="' + item.id + '">削除</button></div></div></article>';
      // 五十音見出しは食材名順の時だけ表示。ピン留め優先では表示しない。
      if((sort !== 'name' && sort !== 'pinned') || item.pinned) return row;
      const header = kanaHeaderFor(item.reading);
      if(header === lastHeader) return row;
      lastHeader = header;
      return '<div class="kanaHeader">' + header + '</div>' + row;
    }).join('');
  }
  function renderSummary(){
    const query = $('search').value.trim();
    const filterId = $('filter').value;
    const category = filterId === 'all' ? '全カテゴリ' : categoryNameById(filterId);
    const sort = $('sort').selectedOptions[0]?.textContent || 'ピン留め優先';
    $('metaCat').textContent = $('pinOnly').checked ? '★ピン留め' : query ? '検索：' + query : category;
    $('metaSort').textContent = sort;
  }
  function renderCategories(){
    const cats = sortedCategories();
    $('catList').innerHTML = cats.map((cat,index) => {
      const count = state.items.filter(item => item.category_id === cat.id).length;
      return '<div class="catRow"><div><div class="catName">' + safe(cat.name) + '</div><div class="catCount">' + count + '件</div></div><button class="ghost" type="button" data-action="cat-up" data-cat-id="' + cat.id + '" ' + (index === 0 ? 'disabled' : '') + '>↑</button><button class="ghost" type="button" data-action="cat-down" data-cat-id="' + cat.id + '" ' + (index === cats.length - 1 ? 'disabled' : '') + '>↓</button><button class="ghost" type="button" data-action="rename-cat" data-cat-id="' + cat.id + '">名称変更</button><button class="danger" type="button" data-action="delete-cat" data-cat-id="' + cat.id + '">削除</button></div>';
    }).join('');
  }
  function renderHistory(){
    $('historyList').innerHTML = state.history.length ? state.history.map(h => '<div class="historyRow"><div class="historyTop"><span>' + safe(h.item_name || h.type) + '</span><span>' + formatDate(h.created_at) + '</span></div><div class="historyMeta">' + safe(h.detail || ((h.before_stock || '') + ' → ' + (h.after_stock || ''))) + ' ／ 更新者：' + safe(h.updated_by || '未記入') + '</div></div>').join('') : '<div class="buyEmpty">まだ更新履歴はありません</div>';
  }

  function resetItemForm(){
    $('editId').value = '';
    $('itemForm').reset();
    parseStockValue('1');
    $('category').value = sortedCategories()[0]?.id || '';
    $('itemModalTitle').textContent = '食材を登録';
    $('deleteFromForm').classList.add('hidden');
    $('pinned').checked = false;
    renderStockButtons();
  }
  function openItemForm(id){
    resetItemForm();
    if(id){
      const item = state.items.find(x => x.id === id);
      if(!item) return toast('対象が見つかりません');
      $('editId').value = item.id;
      $('name').value = item.name;
      $('reading').value = item.reading;
      parseStockValue(item.stock);
      $('category').value = item.category_id;
      $('updatedBy').value = item.updated_by || '';
      $('memo').value = item.memo || '';
      $('pinned').checked = !!item.pinned;
      $('itemModalTitle').textContent = '食材を修正・削除';
      $('deleteFromForm').classList.remove('hidden');
      renderStockButtons();
    }
    openModal('itemModal');
    setTimeout(() => $('name').focus(), 80);
  }
  async function saveItem(){
    ensureDb();
    const editId = $('editId').value;
    const oldItem = state.items.find(item => item.id === editId);
    const payload = { name:$('name').value.trim(), reading:$('reading').value.trim(), stock:$('stock').value.trim(), category_id:$('category').value, memo:$('memo').value.trim(), updated_by:$('updatedBy').value.trim() || '未記入', pinned:$('pinned').checked, updated_at:new Date().toISOString() };
    if(!payload.name || !payload.reading || !payload.stock || !payload.category_id) return toast('食材名・読み・在庫・カテゴリを入力してください');
    const result = editId ? await db.from('items').update(payload).eq('id', editId) : await db.from('items').insert(payload);
    if(result.error) throw result.error;
    await addHistory(editId ? { type:'修正', item_name:payload.name, before_stock:oldItem?.stock || '', after_stock:payload.stock, updated_by:payload.updated_by, detail:'在庫 ' + (oldItem?.stock || '') + ' → ' + payload.stock } : { type:'登録', item_name:payload.name, before_stock:'', after_stock:payload.stock, updated_by:payload.updated_by, detail:'新規登録：在庫 ' + payload.stock });
    closeModal('itemModal'); resetItemForm(); await loadData(); toast(editId ? '修正しました' : '保存しました');
  }
  async function deleteItem(id, fromForm){
    const item = state.items.find(x => x.id === id);
    if(!item) return toast('削除対象が見つかりません');
    openConfirm({ title:'在庫を削除', text:'本当に「' + item.name + '」を削除してよいですか？', okText:'削除する', onOk:async () => { try{ await addHistory({ type:'削除', item_name:item.name, before_stock:item.stock, after_stock:'削除', updated_by:item.updated_by, detail:'在庫を削除' }); const res = await db.from('items').delete().eq('id', id); if(res.error) throw res.error; if(fromForm) closeModal('itemModal'); await loadData(); toast('削除しました'); }catch(e){ console.error(e); toast('削除に失敗しました'); } } });
  }
  async function addHistory(entry){
    if(!db) return;
    await db.from('history').insert({ type:entry.type, item_name:entry.item_name || '', before_stock:entry.before_stock || '', after_stock:entry.after_stock || '', updated_by:entry.updated_by || '未記入', detail:entry.detail || '' });
  }
  async function addCategory(){
    ensureDb();
    const name = $('catName').value.trim();
    if(!name) return toast('カテゴリ名を入力してください');
    if(state.categories.some(cat => cat.name === name)) return toast('同じカテゴリがあります');
    const maxOrder = state.categories.reduce((max, cat) => Math.max(max, cat.sort_order ?? 0), -1);
    const res = await db.from('categories').insert({ name, sort_order:maxOrder + 1 });
    if(res.error) throw res.error;
    await addHistory({ type:'カテゴリ追加', item_name:name, updated_by:'管理', detail:'カテゴリを追加' });
    $('catName').value = ''; await loadData(); toast('カテゴリを追加しました');
  }
  function openRenameCategory(categoryId){
    const cat = state.categories.find(c => c.id === categoryId);
    if(!cat) return toast('カテゴリが見つかりません');
    $('renameCatOld').value = cat.id;
    $('renameCatInput').value = cat.name;
    openModal('renameCatModal');
    setTimeout(() => $('renameCatInput').focus(), 80);
  }
  async function renameCategory(){
    ensureDb();
    const id = $('renameCatOld').value;
    const cat = state.categories.find(c => c.id === id);
    const newName = $('renameCatInput').value.trim();
    if(!cat) return toast('カテゴリが見つかりません');
    if(!newName || newName === cat.name){ closeModal('renameCatModal'); return; }
    if(state.categories.some(c => c.name === newName)) return toast('同じカテゴリがあります');
    const res = await db.from('categories').update({ name:newName, updated_at:new Date().toISOString() }).eq('id', id);
    if(res.error) throw res.error;
    await addHistory({ type:'カテゴリ名称変更', item_name:cat.name, updated_by:'管理', detail:'「' + cat.name + '」→「' + newName + '」' });
    closeModal('renameCatModal'); await loadData(); toast('カテゴリ名を変更しました');
  }
  async function deleteCategory(categoryId){
    const cat = state.categories.find(c => c.id === categoryId);
    if(!cat) return toast('カテゴリが見つかりません');
    if(state.categories.length <= 1) return toast('カテゴリは1つ以上必要です');
    const others = sortedCategories().filter(c => c.id !== categoryId);
    const used = state.items.some(item => item.category_id === categoryId);
    const extra = used ? '<label><span>このカテゴリ内の食材の移動先</span><select id="moveCatSelect">' + others.map(c => '<option value="' + c.id + '">' + safe(c.name) + '</option>').join('') + '</select></label>' : '';
    openConfirm({ title:'カテゴリを削除', text:'本当にカテゴリ「' + cat.name + '」を削除してよいですか？', okText:'削除する', extra, onOk:async () => { try{ const moveTo = used ? $('moveCatSelect').value : null; if(used){ const upd = await db.from('items').update({ category_id:moveTo, updated_at:new Date().toISOString() }).eq('category_id', categoryId); if(upd.error) throw upd.error; } const del = await db.from('categories').delete().eq('id', categoryId); if(del.error) throw del.error; await addHistory({ type:'カテゴリ削除', item_name:cat.name, updated_by:'管理', detail:used ? 'カテゴリ削除・中身を移動' : 'カテゴリ削除' }); await loadData(); toast('カテゴリを削除しました'); }catch(e){ console.error(e); toast('カテゴリ削除に失敗しました'); } } });
  }
  async function moveCategory(categoryId, direction){
    const cats = sortedCategories();
    const index = cats.findIndex(c => c.id === categoryId);
    const next = index + direction;
    if(index < 0 || next < 0 || next >= cats.length) return;
    const a = cats[index], b = cats[next];
    const res1 = await db.from('categories').update({ sort_order:b.sort_order }).eq('id', a.id);
    const res2 = await db.from('categories').update({ sort_order:a.sort_order }).eq('id', b.id);
    if(res1.error || res2.error) return toast('カテゴリ順の変更に失敗しました');
    await loadData(); toast('カテゴリ順を変更しました');
  }

  function handleStockTap(event){
    const now = Date.now();
    if(event.type === 'click' && now - lastStockTapAt < 450) return;
    if(event.type !== 'click') lastStockTapAt = now;

    const mainButton = event.target.closest('[data-stock-main]');
    const fracButton = event.target.closest('[data-stock-frac]');
    if(!mainButton && !fracButton) return;

    event.preventDefault();
    event.stopPropagation();

    if(mainButton){
      stockMain = mainButton.dataset.stockMain;
      renderStockButtons();
      return;
    }
    if(fracButton){
      stockFrac = stockFrac === fracButton.dataset.stockFrac ? '' : fracButton.dataset.stockFrac;
      renderStockButtons();
    }
  }

  function bindEvents(){
    $('openItem').addEventListener('click', () => openItemForm(''));
    $('openFilter').addEventListener('click', () => openModal('filterModal'));
    $('openCategory').addEventListener('click', () => openModal('catModal'));
    $('openHistory').addEventListener('click', () => openModal('historyModal'));
    $('search').addEventListener('input', () => { renderItems(); renderSummary(); });
    $('filter').addEventListener('change', () => { renderItems(); renderSummary(); });
    $('sort').addEventListener('change', () => { renderItems(); renderSummary(); });
    $('pinOnly').addEventListener('change', () => { renderItems(); renderSummary(); });
    $('confirmCancel').addEventListener('click', () => { confirmAction = null; closeModal('confirmModal'); });
    $('confirmOk').addEventListener('click', () => { const action = confirmAction; confirmAction = null; closeModal('confirmModal'); if(typeof action === 'function') action(); });
    const stockTapEvents = window.PointerEvent ? ['pointerup'] : ['touchend','click'];
    stockTapEvents.forEach(eventName => {
      $('stockMainBtns').addEventListener(eventName, handleStockTap, { passive:false });
      $('stockFracBtns').addEventListener(eventName, handleStockTap, { passive:false });
    });
    $('itemForm').addEventListener('submit', async event => { event.preventDefault(); try{ await saveItem(); }catch(e){ console.error(e); toast('保存に失敗しました'); } });
    $('deleteFromForm').addEventListener('click', () => { const id = $('editId').value; if(id) deleteItem(id, true); });
    $('catForm').addEventListener('submit', async event => { event.preventDefault(); try{ await addCategory(); }catch(e){ console.error(e); toast('カテゴリ追加に失敗しました'); } });
    $('addCatBtn').addEventListener('click', async () => { try{ await addCategory(); }catch(e){ console.error(e); toast('カテゴリ追加に失敗しました'); } });
    $('renameCatForm').addEventListener('submit', async event => { event.preventDefault(); try{ await renameCategory(); }catch(e){ console.error(e); toast('名称変更に失敗しました'); } });
    document.addEventListener('click', event => {
      const closeId = event.target.dataset.close;
      if(closeId){ closeModal(closeId); return; }
      const button = event.target.closest('[data-action]');
      if(!button) return;
      const action = button.dataset.action;
      if(action === 'edit-item') openItemForm(button.dataset.id);
      if(action === 'delete-item') deleteItem(button.dataset.id, false);
      if(action === 'rename-cat') openRenameCategory(button.dataset.catId);
      if(action === 'delete-cat') deleteCategory(button.dataset.catId);
      if(action === 'cat-up') moveCategory(button.dataset.catId, -1);
      if(action === 'cat-down') moveCategory(button.dataset.catId, 1);
    });
  }
})();
