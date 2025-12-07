document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab");
  const taskListEl = document.getElementById("task-list");
  const taskNameInput = document.getElementById("task-name-input");
  const addTaskBtn = document.getElementById("add-task-btn");

  // filter elements
  const sortSelect = document.getElementById("sort-select");
  const assigneeFilter = document.getElementById("assignee-filter");
  const searchInput = document.getElementById("search-input");
  const dateFilterLabel = document.getElementById("date-filter-label");

  // calendar & today
  const calendarEl = document.getElementById("calendar");
  const calendarTitleEl = document.getElementById("calendar-title");
  const todayListEl = document.getElementById("today-list");

  // list & gantt view
  const listAreaEl = document.getElementById("list-area");
  const ganttMonthSection = document.getElementById("gantt-month-section");
  const ganttMonthGrid = document.getElementById("gantt-month-grid");
  const ganttCurrentMonthLabel = document.getElementById("gantt-current-month");
  const ganttPrevBtn = document.getElementById("gantt-prev-month");
  const ganttNextBtn = document.getElementById("gantt-next-month");

  // modal elements
  const modal = document.getElementById("task-modal");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalSaveBtn = document.getElementById("modal-save-btn");

  const modalTitle = document.getElementById("modal-title");
  const modalTaskName = document.getElementById("modal-task-name");
  const modalAssignee = document.getElementById("modal-assignee");
  const modalDeadline = document.getElementById("modal-deadline");
  const modalEstimate = document.getElementById("modal-estimate");
  const modalMemo = document.getElementById("modal-memo");

  const STORAGE_KEY = "todoAppState_v1";

  let currentTab = "tasks"; // "tasks" | "completed" | "deleted" | "gantt"
  let nextId = 1;

  // モーダル
  let modalMode = "create"; // "create" or "edit"
  let editingTaskId = null;

  // フィルタ状態
  let currentSort = "dateAsc";
  let currentSearch = "";
  let currentAssignee = "all";
  let currentDateFilter = ""; // "YYYY.MM.DD" or ""

  // 月ガントの基準年月（初期は今月）
  let ganttYear = new Date().getFullYear();
  let ganttMonth = new Date().getMonth(); // 0 = 1月

  // データ
  const tasks = [];
  const completedTasks = [];
  const deletedTasks = [];

  // 担当者カラー割り当て
  const assigneeColors = {};
  const colorPalette = ["#b48c7c", "#c1a46b", "#7c9c8c", "#8c7cb4", "#c07c8f"];

  function getAssigneeColor(name) {
    if (!name) return "#aaa";
    if (!assigneeColors[name]) {
      const idx = Object.keys(assigneeColors).length % colorPalette.length;
      assigneeColors[name] = colorPalette[idx];
    }
    return assigneeColors[name];
  }

  // ---------- localStorage 保存/読み込み ----------

  function saveState() {
    const data = {
      tasks,
      completedTasks,
      deletedTasks,
      nextId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("保存に失敗しました", e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      if (Array.isArray(data.tasks)) {
        tasks.push(...data.tasks);
      }
      if (Array.isArray(data.completedTasks)) {
        completedTasks.push(...data.completedTasks);
      }
      if (Array.isArray(data.deletedTasks)) {
        deletedTasks.push(...data.deletedTasks);
      }
      if (typeof data.nextId === "number") {
        nextId = data.nextId;
      }
      return true;
    } catch (e) {
      console.warn("読み込みに失敗したので、新規状態から開始します", e);
      return false;
    }
  }

  // ---------- 初期データ（localStorage が空のときだけ） ----------

  const loaded = loadState();

  if (!loaded && tasks.length === 0 && completedTasks.length === 0 && deletedTasks.length === 0) {
    const today = new Date();
    const todayDisplay = formatDisplayDate(today);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDisplay = formatDisplayDate(tomorrow);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekDisplay = formatDisplayDate(nextWeek);

    addTask("日次レポート確認", "藤本", todayDisplay, "GA4 / Looker Studioを確認", "30min");
    addTask("明日の資料作成", "佐藤", tomorrowDisplay, "ドメイン変更リスク資料", "2h");
    addTask("週次DXミーティング", "鈴木", nextWeekDisplay, "進捗共有", "1h");
  }

  // ---------- データ操作 ----------

  function addTask(
    name,
    assignee = "Assignee",
    dueDate = "",
    memo = "",
    estimate = ""
  ) {
    tasks.push({
      id: nextId++,
      name,
      assignee,
      dueDate, // "YYYY.MM.DD"
      memo,
      estimate,
      createdAt: Date.now(),
    });
    render();
  }

  function moveTask(id, fromArr, toArr) {
    const idx = fromArr.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const [task] = fromArr.splice(idx, 1);
    toArr.push(task);
  }

  // ---------- Render ----------

  function render() {
    // 左側：カレンダー & 今日のタスク
    renderCalendar();
    renderTodayList();

    // GANTTタブの場合は、リストを隠してガントだけ表示
    if (currentTab === "gantt") {
      if (listAreaEl) listAreaEl.style.display = "none";
      if (ganttMonthSection) ganttMonthSection.style.display = "block";

      renderGanttMonth();
      saveState();
      return;
    } else {
      if (listAreaEl) listAreaEl.style.display = "block";
      if (ganttMonthSection) ganttMonthSection.style.display = "none";
    }

    // ここからは TASKS / COMPLETED / DELETED 用の描画

    // 日付フィルタラベル
    if (currentDateFilter) {
      dateFilterLabel.textContent = `日付フィルタ: ${currentDateFilter}`;
    } else {
      dateFilterLabel.textContent = "";
    }

    // 担当者フィルタ更新
    updateAssigneeFilterOptions();

    // メインリスト描画
    taskListEl.innerHTML = "";

    let source;
    if (currentTab === "tasks") {
      source = getFilteredTasks();
    } else if (currentTab === "completed") {
      source = completedTasks.slice();
    } else {
      source = deletedTasks.slice();
    }

    if (source.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No tasks.";
      empty.style.margin = "16px 4px";
      empty.style.color = "#8b7e6d";
      taskListEl.appendChild(empty);
    } else {
      source.forEach((task) => {
        const card = document.createElement("div");
        card.className = "task-card";
        if (currentTab === "completed") {
          card.classList.add("task-card--completed");
        }
        card.dataset.id = task.id;

        const remainingText = getRemainingText(task.dueDate);
        const actionsHtml = getActionsHtml(currentTab);
        const color = getAssigneeColor(task.assignee || "Assignee");

        card.innerHTML = `
          <div class="task-left">
            <button class="task-checkbox" data-action="complete"></button>
            <div class="task-texts">
              <div class="task-title" data-action="edit">${escapeHtml(task.name)}</div>
              <div class="task-assignee">
                <span class="assignee-color" style="background-color:${color};"></span>
                <span>${escapeHtml(task.assignee || "Assignee")}</span>
              </div>
            </div>
          </div>
          <div class="task-right">
            <div class="task-date-row">
              <span class="task-date">${task.dueDate || ""}</span>
              <span class="task-remaining">${remainingText}</span>
            </div>
            <div class="task-actions">
              ${actionsHtml}
            </div>
          </div>
        `;
        taskListEl.appendChild(card);
      });
    }

    saveState();
  }

  function getActionsHtml(tab) {
    if (tab === "tasks") {
      return `
        <button class="task-btn" data-action="complete">完了</button>
        <button class="task-btn task-btn--delete" data-action="delete">削除</button>
      `;
    } else if (tab === "completed") {
      return `
        <button class="task-btn" data-action="restore">戻す</button>
        <button class="task-btn task-btn--delete" data-action="delete">削除</button>
      `;
    } else {
      // deleted
      return `
        <button class="task-btn" data-action="restore">戻す</button>
        <button class="task-btn task-btn--delete" data-action="permanent-delete">完全削除</button>
      `;
    }
  }

  // ---------- Filters ----------

  function getFilteredTasks() {
    let list = tasks.slice();

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }

    if (currentAssignee !== "all") {
      list = list.filter(
        (t) => (t.assignee || "Assignee") === currentAssignee
      );
    }

    if (currentDateFilter) {
      list = list.filter((t) => t.dueDate === currentDateFilter);
    }

    list.sort((a, b) => {
      if (currentSort === "dateAsc" || currentSort === "dateDesc") {
        const da = parseDate(a.dueDate);
        const db = parseDate(b.dueDate);
        const va = da ? da.getTime() : Infinity;
        const vb = db ? db.getTime() : Infinity;
        if (va === vb) return a.id - b.id;
        return currentSort === "dateAsc" ? va - vb : vb - va;
      } else {
        return b.createdAt - a.createdAt;
      }
    });

    return list;
  }

  function updateAssigneeFilterOptions() {
    const names = Array.from(
      new Set(tasks.map((t) => t.assignee || "Assignee"))
    );
    const current = assigneeFilter.value || "all";
    assigneeFilter.innerHTML = `<option value="all">すべて</option>`;
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      assigneeFilter.appendChild(opt);
    });
    if ([...assigneeFilter.options].some((o) => o.value === current)) {
      assigneeFilter.value = current;
    }
  }

  // 残り日数
  function getRemainingText(dueStr) {
    if (!dueStr) return "";
    const due = parseDate(dueStr);
    if (!due) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `残り${diffDays}日`;
    if (diffDays === 0) return "今日まで";
    return "期限切れ";
  }

  // ---------- Calendar & Today ----------

  function renderCalendar() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-index

    calendarTitleEl.textContent = `${year} / ${month + 1}`;

    calendarEl.innerHTML = "";

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    weekdays.forEach((w) => {
      const el = document.createElement("div");
      el.className = "calendar-weekday";
      el.textContent = w;
      calendarEl.appendChild(el);
    });

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const firstDow = first.getDay();
    const daysInMonth = last.getDate();

    const counts = {};
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      counts[t.dueDate] = (counts[t.dueDate] || 0) + 1;
    });

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement("div");
      calendarEl.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = formatDisplayDate(dateObj); // "YYYY.MM.DD"

      const cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.dataset.date = dateStr;
      cell.textContent = d;

      const todayStr = formatDisplayDate(today);
      if (dateStr === todayStr) {
        cell.classList.add("calendar-day--today");
      }

      if (counts[dateStr]) {
        cell.classList.add("calendar-day--with-tasks");
        const badge = document.createElement("span");
        badge.className = "calendar-day-count";
        badge.textContent = counts[dateStr];
        cell.appendChild(badge);
      }

      calendarEl.appendChild(cell);
    }
  }

  function renderTodayList() {
    todayListEl.innerHTML = "";
    const todayStr = formatDisplayDate(new Date());
    const todayTasks = tasks.filter((t) => t.dueDate === todayStr);

    if (todayTasks.length === 0) {
      todayListEl.textContent = "本日のタスクはありません。";
      return;
    }

    todayTasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "today-item";
      row.innerHTML = `
        <span>${escapeHtml(t.name)}</span>
        <span>${escapeHtml(t.assignee || "")}</span>
      `;
      todayListEl.appendChild(row);
    });
  }

  calendarEl.addEventListener("click", (e) => {
    const date =
      e.target.dataset.date ||
      e.target.closest(".calendar-day")?.dataset.date;
    if (!date) return;
    if (currentDateFilter === date) {
      currentDateFilter = "";
    } else {
      currentDateFilter = date;
    }
    render();
  });

  // ---------- Gantt（月単位） ----------

  function renderGanttMonth() {
    if (!ganttMonthGrid) return;
    ganttMonthGrid.innerHTML = "";

    const labelDate = new Date(ganttYear, ganttMonth, 1);
    ganttCurrentMonthLabel.textContent =
      `${labelDate.getFullYear()}年 ${ganttMonth + 1}月`;

    const daysInMonth = new Date(ganttYear, ganttMonth + 1, 0).getDate();

    // ヘッダー（日にち）
    const headerRow = document.createElement("div");
    headerRow.className = "gantt-month-header";
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.className = "gantt-month-day";
      cell.textContent = d;
      headerRow.appendChild(cell);
    }
    ganttMonthGrid.appendChild(headerRow);

    // 対象月のタスク
    const monthTasks = tasks.filter((t) => {
      const date = parseDate(t.dueDate);
      if (!date) return false;
      return (
        date.getFullYear() === ganttYear &&
        date.getMonth() === ganttMonth
      );
    });

    if (monthTasks.length === 0) {
      const msg = document.createElement("div");
      msg.className = "gantt-month-empty";
      msg.textContent = "この月のタスクはありません。";
      ganttMonthGrid.appendChild(msg);
      return;
    }

    monthTasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "gantt-month-row";

      const label = document.createElement("div");
      label.className = "gantt-month-label";
      label.textContent = task.name;

      const barWrap = document.createElement("div");
      barWrap.className = "gantt-month-bar-wrap";

      const date = parseDate(task.dueDate);
      const dayIndex = date.getDate() - 1;
      const leftPercent = (dayIndex / daysInMonth) * 100;
      const widthPercent = 100 / daysInMonth; // 1日ぶん

      const bar = document.createElement("div");
      bar.className = "gantt-month-bar";
      bar.style.left = `${leftPercent}%`;
      bar.style.width = `${widthPercent}%`;

      barWrap.appendChild(bar);
      row.appendChild(label);
      row.appendChild(barWrap);
      ganttMonthGrid.appendChild(row);
    });
  }

  // 月送りボタン
  ganttPrevBtn.addEventListener("click", () => {
    ganttMonth--;
    if (ganttMonth < 0) {
      ganttMonth = 11;
      ganttYear--;
    }
    renderGanttMonth();
  });

  ganttNextBtn.addEventListener("click", () => {
    ganttMonth++;
    if (ganttMonth > 11) {
      ganttMonth = 0;
      ganttYear++;
    }
    renderGanttMonth();
  });

  // ---------- Tabs ----------

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("tab--active"));
      tab.classList.add("tab--active");
      currentTab = tab.dataset.tab;
      render();
    });
  });

  // ---------- Add / Modal ----------

  addTaskBtn.addEventListener("click", () => {
    const nameFromInput = taskNameInput.value.trim();
    openModalForCreate(nameFromInput);
  });

  taskNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addTaskBtn.click();
    }
  });

  function openModalForCreate(defaultName = "") {
    modalMode = "create";
    editingTaskId = null;
    modalTitle.textContent = "タスクを追加";
    modalTaskName.value = defaultName;
    modalAssignee.value = "";

    // 今日の日付をデフォルトにセット
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    modalDeadline.value = `${y}-${m}-${d}`;

    modalEstimate.value = "";
    modalMemo.value = "";
    openModal();
  }

  function openModalForEdit(task) {
    modalMode = "edit";
    editingTaskId = task.id;
    modalTitle.textContent = "タスクを編集";
    modalTaskName.value = task.name || "";
    modalAssignee.value = task.assignee || "";
    modalEstimate.value = task.estimate || "";
    modalMemo.value = task.memo || "";
    modalDeadline.value = formatForInputDate(task.dueDate);
    openModal();
  }

  function openModal() {
    modal.classList.add("modal--open");
    modalTaskName.focus();
  }

  function closeModal() {
    modal.classList.remove("modal--open");
  }

  modalBackdrop.addEventListener("click", closeModal);
  modalCloseBtn.addEventListener("click", closeModal);
  modalCancelBtn.addEventListener("click", closeModal);

  modalSaveBtn.addEventListener("click", () => {
    const name = modalTaskName.value.trim();
    if (!name) {
      alert("タスク名を入力してください");
      return;
    }
    const assignee = modalAssignee.value;
    const deadlineRaw = modalDeadline.value; // "YYYY-MM-DD"
    const estimate = modalEstimate.value.trim();
    const memo = modalMemo.value.trim();

    let dueDate = "";
    if (deadlineRaw) {
      const [y, m, d] = deadlineRaw.split("-");
      dueDate = `${y}.${m}.${d}`;
    }

    if (modalMode === "create") {
      addTask(name, assignee || "Assignee", dueDate, memo, estimate);
      taskNameInput.value = "";
    } else if (modalMode === "edit" && editingTaskId != null) {
      const t = tasks.find((task) => task.id === editingTaskId);
      if (t) {
        t.name = name;
        t.assignee = assignee || "Assignee";
        t.dueDate = dueDate;
        t.estimate = estimate;
        t.memo = memo;
        render();
      }
    }

    closeModal();
  });

  // ---------- Task Card Events ----------

  taskListEl.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    const card = e.target.closest(".task-card");
    if (!card) return;
    const id = Number(card.dataset.id);

    if (action === "edit") {
      if (currentTab !== "tasks") return; // 完了・削除では編集不可
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      openModalForEdit(task);
      return;
    }

    if (action === "complete") {
      if (currentTab === "tasks") {
        moveTask(id, tasks, completedTasks);
      }
    }

    if (action === "delete") {
      if (currentTab === "tasks") {
        moveTask(id, tasks, deletedTasks);
      } else if (currentTab === "completed") {
        moveTask(id, completedTasks, deletedTasks);
      }
    }

    if (action === "restore") {
      if (currentTab === "completed") {
        moveTask(id, completedTasks, tasks);
      } else if (currentTab === "deleted") {
        moveTask(id, deletedTasks, tasks);
      }
    }

    if (action === "permanent-delete") {
      if (currentTab === "deleted") {
        const ok = window.confirm(
          "このタスクを完全に削除しますか？この操作は元に戻せません。"
        );
        if (!ok) return;
        const idx = deletedTasks.findIndex((t) => t.id === id);
        if (idx !== -1) deletedTasks.splice(idx, 1);
      }
    }

    render();
  });

  // ---------- Filter events ----------

  sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    render();
  });

  assigneeFilter.addEventListener("change", () => {
    currentAssignee = assigneeFilter.value;
    render();
  });

  searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value.trim();
    render();
  });

  // ---------- Utils ----------

  function parseDate(str) {
    if (!str) return null;
    const parts = str.split(".");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function formatDisplayDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
  }

  function formatForInputDate(displayDate) {
    if (!displayDate) return "";
    const parts = displayDate.split(".");
    if (parts.length !== 3) return "";
    const [y, m, d] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[c];
    });
  }

  // 初期描画
  render();
});
