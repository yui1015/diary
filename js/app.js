(() => {
  const STORAGE_KEY = "natural-diary-entries-v1";
  const CUSTOM_TAGS_KEY = "natural-diary-custom-tags-v1";

  const DEFAULT_TAGS = ["日常", "仕事", "旅行", "健康", "気分", "学び"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    entries: loadEntries(),
    selectedTags: [],
    customTags: loadCustomTags(),
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    selectedDate: null,
    activeEntryId: null,
    filterTags: [],
    selectedIds: new Set(),
  };

  const els = {
    form: $("#entry-form"),
    entryId: $("#entry-id"),
    entryDate: $("#entry-date"),
    entryBody: $("#entry-body"),
    tagPicker: $("#tag-picker"),
    customTag: $("#custom-tag"),
    addTagBtn: $("#add-tag-btn"),
    resetBtn: $("#reset-btn"),
    saveBtn: $("#save-btn"),
    topbarSub: $("#topbar-sub"),
    calPrev: $("#cal-prev"),
    calNext: $("#cal-next"),
    calTitle: $("#cal-title"),
    calGrid: $("#cal-grid"),
    calDayPanel: $("#cal-day-panel"),
    calDayEntries: $("#cal-day-entries"),
    searchInput: $("#search-input"),
    filterFrom: $("#filter-from"),
    filterTo: $("#filter-to"),
    filterTagPicker: $("#filter-tag-picker"),
    clearFiltersBtn: $("#clear-filters-btn"),
    selectAll: $("#select-all"),
    listCount: $("#list-count"),
    entryList: $("#entry-list"),
    listEmpty: $("#list-empty"),
    downloadSelectedBtn: $("#download-selected-btn"),
    downloadAllBtn: $("#download-all-btn"),
    detailDialog: $("#detail-dialog"),
    detailDate: $("#detail-date"),
    detailTags: $("#detail-tags"),
    detailBody: $("#detail-body"),
    detailClose: $("#detail-close"),
    detailDownload: $("#detail-download"),
    detailEdit: $("#detail-edit"),
    detailDelete: $("#detail-delete"),
    toast: $("#toast"),
  };

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadCustomTags() {
    try {
      const raw = localStorage.getItem(CUSTOM_TAGS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  }

  function saveCustomTags() {
    localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(state.customTags));
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatJPDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${y}年${m}月${d}日（${week}）`;
  }

  function allTags() {
    const used = new Set(DEFAULT_TAGS.concat(state.customTags));
    state.entries.forEach((e) => (e.tags || []).forEach((t) => used.add(t)));
    return [...used];
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove("is-show"), 2200);
  }

  function switchView(name) {
    $$(".view").forEach((v) => v.classList.remove("is-active"));
    $(`#view-${name}`).classList.add("is-active");
    $$(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === name);
    });

    const subs = {
      write: "今日のひとこと",
      calendar: "日付から読む",
      list: "さがして読む",
    };
    els.topbarSub.textContent = subs[name] || "";

    if (name === "calendar") renderCalendar();
    if (name === "list") {
      renderFilterTags();
      renderList();
    }
  }

  function renderTagPicker() {
    els.tagPicker.innerHTML = "";
    allTags().forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-chip" + (state.selectedTags.includes(tag) ? " is-selected" : "");
      btn.textContent = tag;
      btn.addEventListener("click", () => {
        if (state.selectedTags.includes(tag)) {
          state.selectedTags = state.selectedTags.filter((t) => t !== tag);
        } else {
          state.selectedTags = [...state.selectedTags, tag];
        }
        renderTagPicker();
      });
      els.tagPicker.appendChild(btn);
    });
  }

  function resetForm(keepDate = true) {
    els.entryId.value = "";
    if (!keepDate) els.entryDate.value = todayISO();
    else if (!els.entryDate.value) els.entryDate.value = todayISO();
    els.entryBody.value = "";
    state.selectedTags = [];
    els.saveBtn.textContent = "保存する";
    renderTagPicker();
  }

  function fillForm(entry) {
    els.entryId.value = entry.id;
    els.entryDate.value = entry.date;
    els.entryBody.value = entry.body;
    state.selectedTags = [...(entry.tags || [])];
    els.saveBtn.textContent = "更新する";
    renderTagPicker();
  }

  function upsertEntry({ id, date, body, tags }) {
    const now = new Date().toISOString();
    if (id) {
      const idx = state.entries.findIndex((e) => e.id === id);
      if (idx >= 0) {
        state.entries[idx] = {
          ...state.entries[idx],
          date,
          body,
          tags,
          updatedAt: now,
        };
        saveEntries();
        return state.entries[idx];
      }
    }
    const entry = {
      id: uid(),
      date,
      body,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    state.entries.unshift(entry);
    saveEntries();
    return entry;
  }

  function deleteEntry(id) {
    state.entries = state.entries.filter((e) => e.id !== id);
    state.selectedIds.delete(id);
    saveEntries();
  }

  function entriesOnDate(iso) {
    return state.entries
      .filter((e) => e.date === iso)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  function entryToText(entry) {
    const tags = (entry.tags || []).length ? `タグ: ${entry.tags.join(", ")}` : "タグ: （なし）";
    return `${formatJPDate(entry.date)}\n${tags}\n\n${entry.body}\n`;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadEntry(entry) {
    const name = `diary-${entry.date}.txt`;
    downloadText(name, entryToText(entry));
    showToast("ダウンロードしました");
  }

  function downloadAll() {
    if (!state.entries.length) {
      showToast("ダウンロードする日記がありません");
      return;
    }
    downloadEntries(state.entries, `diary-all-${todayISO()}.txt`, "すべての日記をダウンロードしました");
  }

  function downloadSelected() {
    const selected = state.entries.filter((e) => state.selectedIds.has(e.id));
    if (!selected.length) {
      showToast("ダウンロードする日記を選択してください");
      return;
    }
    downloadEntries(
      selected,
      `diary-selected-${todayISO()}.txt`,
      `${selected.length} 件をダウンロードしました`
    );
  }

  function downloadEntries(entries, filename, message) {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const text = sorted.map(entryToText).join("\n---\n\n");
    downloadText(filename, text);
    showToast(message);
  }

  function updateSelectionUI() {
    const list = filteredEntries();
    const selectedVisible = list.filter((e) => state.selectedIds.has(e.id)).length;
    els.downloadSelectedBtn.disabled = selectedVisible === 0;
    els.downloadSelectedBtn.textContent =
      selectedVisible > 0 ? `選択をDL（${selectedVisible}）` : "選択をDL";

    if (!list.length) {
      els.selectAll.checked = false;
      els.selectAll.indeterminate = false;
      return;
    }
    const allSelected = list.every((e) => state.selectedIds.has(e.id));
    const someSelected = list.some((e) => state.selectedIds.has(e.id));
    els.selectAll.checked = allSelected;
    els.selectAll.indeterminate = someSelected && !allSelected;
  }

  function createEntryCard(entry, { showDownload = true, selectable = false } = {}) {
    const card = document.createElement("article");
    card.className = "entry-card";
    if (selectable && state.selectedIds.has(entry.id)) {
      card.classList.add("is-checked");
    }

    if (selectable) {
      const checkWrap = document.createElement("label");
      checkWrap.className = "entry-card-check";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = state.selectedIds.has(entry.id);
      check.setAttribute("aria-label", `${formatJPDate(entry.date)} を選択`);
      check.addEventListener("click", (e) => e.stopPropagation());
      check.addEventListener("change", () => {
        if (check.checked) state.selectedIds.add(entry.id);
        else state.selectedIds.delete(entry.id);
        card.classList.toggle("is-checked", check.checked);
        updateSelectionUI();
      });
      checkWrap.appendChild(check);
      card.appendChild(checkWrap);
    }

    const main = document.createElement("div");
    main.className = "entry-card-main";
    main.tabIndex = 0;
    main.setAttribute("role", "button");

    const top = document.createElement("div");
    top.className = "entry-card-top";

    const dateEl = document.createElement("span");
    dateEl.className = "entry-card-date";
    dateEl.textContent = formatJPDate(entry.date);
    top.appendChild(dateEl);

    if (showDownload) {
      const dl = document.createElement("button");
      dl.type = "button";
      dl.className = "entry-card-dl";
      dl.textContent = "DL";
      dl.addEventListener("click", (e) => {
        e.stopPropagation();
        downloadEntry(entry);
      });
      top.appendChild(dl);
    }

    const preview = document.createElement("p");
    preview.className = "entry-card-preview";
    preview.textContent = entry.body;

    const tags = document.createElement("div");
    tags.className = "tag-row";
    (entry.tags || []).forEach((t) => {
      const pill = document.createElement("span");
      pill.className = "tag-pill";
      pill.textContent = t;
      tags.appendChild(pill);
    });

    main.append(top, preview, tags);
    card.appendChild(main);

    const open = () => openDetail(entry.id);
    main.addEventListener("click", open);
    main.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    return card;
  }

  function renderCalendar() {
    const { calYear: y, calMonth: m } = state;
    els.calTitle.textContent = `${y}年${m + 1}月`;
    els.calGrid.innerHTML = "";

    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const today = todayISO();
    const datesWithEntries = new Set(state.entries.map((e) => e.date));

    const cells = [];
    for (let i = startPad - 1; i >= 0; i--) {
      cells.push({ day: prevDays - i, outside: true, monthOffset: -1 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, outside: false, monthOffset: 0 });
    }
    while (cells.length % 7 !== 0) {
      cells.push({
        day: cells.filter((c) => c.monthOffset === 1).length + 1,
        outside: true,
        monthOffset: 1,
      });
    }

    cells.forEach((cell, index) => {
      const month = m + cell.monthOffset;
      const dateObj = new Date(y, month, cell.day);
      const iso = [
        dateObj.getFullYear(),
        String(dateObj.getMonth() + 1).padStart(2, "0"),
        String(dateObj.getDate()).padStart(2, "0"),
      ].join("-");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      if (cell.outside) btn.classList.add("is-outside");
      if (iso === today) btn.classList.add("is-today");
      if (state.selectedDate === iso) btn.classList.add("is-selected");
      if (datesWithEntries.has(iso)) btn.classList.add("has-entry");
      const weekday = index % 7;
      if (weekday === 0) btn.classList.add("is-sun");
      if (weekday === 6) btn.classList.add("is-sat");
      btn.textContent = String(cell.day);
      btn.setAttribute("aria-label", formatJPDate(iso));
      btn.addEventListener("click", () => {
        state.selectedDate = iso;
        renderCalendar();
        renderDayPanel(iso);
      });
      els.calGrid.appendChild(btn);
    });

    if (state.selectedDate) renderDayPanel(state.selectedDate);
  }

  function renderDayPanel(iso) {
    const list = entriesOnDate(iso);
    els.calDayEntries.innerHTML = "";
    if (!list.length) {
      els.calDayPanel.classList.add("is-empty");
      els.calDayEntries.hidden = true;
      $(".day-panel-empty", els.calDayPanel).textContent =
        `${formatJPDate(iso)} の日記はまだありません`;
      return;
    }
    els.calDayPanel.classList.remove("is-empty");
    els.calDayEntries.hidden = false;
    list.forEach((entry) => {
      els.calDayEntries.appendChild(createEntryCard(entry));
    });
  }

  function renderFilterTags() {
    els.filterTagPicker.innerHTML = "";
    const tags = allTags();
    if (!tags.length) {
      const empty = document.createElement("span");
      empty.className = "list-count";
      empty.textContent = "タグはまだありません";
      els.filterTagPicker.appendChild(empty);
      return;
    }
    tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-chip" + (state.filterTags.includes(tag) ? " is-selected" : "");
      btn.textContent = tag;
      btn.addEventListener("click", () => {
        if (state.filterTags.includes(tag)) {
          state.filterTags = state.filterTags.filter((t) => t !== tag);
        } else {
          state.filterTags = [...state.filterTags, tag];
        }
        renderFilterTags();
        renderList();
      });
      els.filterTagPicker.appendChild(btn);
    });
  }

  function filteredEntries() {
    const q = els.searchInput.value.trim().toLowerCase();
    const from = els.filterFrom.value;
    const to = els.filterTo.value;
    let list = [...state.entries];

    if (from) list = list.filter((e) => e.date >= from);
    if (to) list = list.filter((e) => e.date <= to);

    if (state.filterTags.length) {
      list = list.filter((e) =>
        state.filterTags.every((tag) => (e.tags || []).includes(tag))
      );
    }

    if (q) {
      list = list.filter((e) => {
        const inBody = (e.body || "").toLowerCase().includes(q);
        const inTags = (e.tags || []).some((t) => t.toLowerCase().includes(q));
        const inDate = (e.date || "").includes(q) || formatJPDate(e.date).includes(q);
        return inBody || inTags || inDate;
      });
    }

    return list.sort(
      (a, b) => b.date.localeCompare(a.date) || (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
  }

  function clearFilters() {
    els.searchInput.value = "";
    els.filterFrom.value = "";
    els.filterTo.value = "";
    state.filterTags = [];
    renderFilterTags();
    renderList();
    showToast("絞り込みをクリアしました");
  }

  function renderList() {
    const list = filteredEntries();
    const visibleIds = new Set(list.map((e) => e.id));
    state.selectedIds = new Set([...state.selectedIds].filter((id) => visibleIds.has(id)));

    els.entryList.innerHTML = "";
    els.listCount.textContent = `${list.length} 件`;

    if (!list.length) {
      els.listEmpty.hidden = false;
      els.listEmpty.textContent = state.entries.length
        ? "条件に合う日記がありません"
        : "まだ日記がありません";
      updateSelectionUI();
      return;
    }

    els.listEmpty.hidden = true;
    list.forEach((entry) => {
      els.entryList.appendChild(
        createEntryCard(entry, { showDownload: true, selectable: true })
      );
    });
    updateSelectionUI();
  }

  function openDetail(id) {
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return;
    state.activeEntryId = id;
    els.detailDate.textContent = formatJPDate(entry.date);
    els.detailBody.textContent = entry.body;
    els.detailTags.innerHTML = "";
    (entry.tags || []).forEach((t) => {
      const pill = document.createElement("span");
      pill.className = "tag-pill";
      pill.textContent = t;
      els.detailTags.appendChild(pill);
    });
    if (typeof els.detailDialog.showModal === "function") {
      els.detailDialog.showModal();
    } else {
      els.detailDialog.setAttribute("open", "");
    }
  }

  function closeDetail() {
    state.activeEntryId = null;
    if (els.detailDialog.open) els.detailDialog.close();
  }

  function getActiveEntry() {
    return state.entries.find((e) => e.id === state.activeEntryId);
  }

  // Events
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = els.entryDate.value;
    const body = els.entryBody.value.trim();
    if (!date || !body) {
      showToast("日付と本文を入力してください");
      return;
    }
    const isEdit = Boolean(els.entryId.value);
    upsertEntry({
      id: els.entryId.value || null,
      date,
      body,
      tags: [...state.selectedTags],
    });
    resetForm(false);
    showToast(isEdit ? "日記を更新しました" : "日記を保存しました");
  });

  els.resetBtn.addEventListener("click", () => {
    resetForm(false);
    showToast("入力をクリアしました");
  });

  els.addTagBtn.addEventListener("click", () => {
    const tag = els.customTag.value.trim();
    if (!tag) return;
    if (!state.customTags.includes(tag) && !DEFAULT_TAGS.includes(tag)) {
      state.customTags.push(tag);
      saveCustomTags();
    }
    if (!state.selectedTags.includes(tag)) {
      state.selectedTags.push(tag);
    }
    els.customTag.value = "";
    renderTagPicker();
  });

  els.customTag.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.addTagBtn.click();
    }
  });

  els.calPrev.addEventListener("click", () => {
    state.calMonth -= 1;
    if (state.calMonth < 0) {
      state.calMonth = 11;
      state.calYear -= 1;
    }
    renderCalendar();
  });

  els.calNext.addEventListener("click", () => {
    state.calMonth += 1;
    if (state.calMonth > 11) {
      state.calMonth = 0;
      state.calYear += 1;
    }
    renderCalendar();
  });

  els.searchInput.addEventListener("input", () => renderList());
  els.filterFrom.addEventListener("change", () => renderList());
  els.filterTo.addEventListener("change", () => renderList());
  els.clearFiltersBtn.addEventListener("click", clearFilters);
  els.downloadAllBtn.addEventListener("click", downloadAll);
  els.downloadSelectedBtn.addEventListener("click", downloadSelected);

  els.selectAll.addEventListener("change", () => {
    const list = filteredEntries();
    if (els.selectAll.checked) {
      list.forEach((e) => state.selectedIds.add(e.id));
    } else {
      list.forEach((e) => state.selectedIds.delete(e.id));
    }
    renderList();
  });

  els.detailClose.addEventListener("click", closeDetail);
  els.detailDialog.addEventListener("click", (e) => {
    if (e.target === els.detailDialog) closeDetail();
  });

  els.detailDownload.addEventListener("click", () => {
    const entry = getActiveEntry();
    if (entry) downloadEntry(entry);
  });

  els.detailEdit.addEventListener("click", () => {
    const entry = getActiveEntry();
    if (!entry) return;
    closeDetail();
    fillForm(entry);
    switchView("write");
    showToast("編集モードに切り替えました");
  });

  els.detailDelete.addEventListener("click", () => {
    const entry = getActiveEntry();
    if (!entry) return;
    if (!confirm(`${formatJPDate(entry.date)} の日記を削除しますか？`)) return;
    deleteEntry(entry.id);
    closeDetail();
    renderCalendar();
    renderList();
    showToast("日記を削除しました");
  });

  // Init
  els.entryDate.value = todayISO();
  renderTagPicker();
  renderFilterTags();
  renderCalendar();
  renderList();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        /* file:// などでは登録できないので無視 */
      });
    });
  }
})();
