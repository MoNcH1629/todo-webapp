// フォーム送信時のバリデーション
  const mansionInput = form.querySelector('#mansion-input');
  if (mansionInput) {
    if (!mansionInput.value.trim()) {
      e.preventDefault();
      alert('マンション名を入力してください。');
      mansionInput.focus();
      return false;
    }
  }

  // 同意チェック必須
  const consent = form.querySelector('#consent');
  if (consent && !consent.checked) {
    e.preventDefault();
    alert('個人情報の取り扱いに同意してください。');
    consent.focus();
    return false;
  }
    return false;
  }
  

  const addBtn = document.getElementById('mansion-add');
  if (!select || !addBtn) return;

  const STORAGE_KEY = 'mansionOptions_v1';
  const defaultOptions = ['サンハイツ', 'グリーンコート'];

  // 初期読み込み（ローカルストレージ優先）
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  const options = Array.isArray(saved) && saved.length ? saved : defaultOptions;
  // 再構築（先頭はプレースホルダ）
  select.innerHTML = '<option value="">選択してください</option>';
  options.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  addBtn.addEventListener('click', () => {
    const name = prompt('追加するマンション名を入力してください');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) { alert('有効な名前を入力してください。'); return; }

    const exists = Array.from(select.options).some(o => o.value === trimmed);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = trimmed;
      opt.textContent = trimmed;
      select.appendChild(opt);
      // 保存（先頭プレースホルダを除く）
      const toSave = Array.from(select.options).slice(1).map(o => o.value);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
    select.value = trimmed;
  });
});
