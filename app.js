(() => {
  "use strict";

  const STORAGE_KEY = "tenYearDiary.v1";
  const YEARS = 10;
  const MOODS = ["😀", "🙂", "😐", "😢", "😠", "😴", "🥰"];
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  // ---------- 저장소 ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && typeof data === "object" && data.entries) return data;
      }
    } catch (e) { /* 손상되었거나 접근 불가 */ }
    return { startYear: new Date().getFullYear(), theme: "auto", entries: {} };
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast("저장하지 못했습니다. 저장 공간을 확인해 주세요.");
      return false;
    }
  }

  // ---------- 날짜 도우미 ----------
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const todayDate = () => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  };
  const toInputValue = (d) => keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const dayOfYear = (m, d) => {
    // 윤년 기준(366일)으로 계산해 해마다 같은 월/일에 같은 질문이 나오게 함
    const cum = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
    return cum[m - 1] + d - 1;
  };

  let current = todayDate();          // 하루 페이지에서 보고 있는 날짜
  let calMonth = new Date(current.getFullYear(), current.getMonth(), 1);

  // ---------- 화면 요소 ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    dateLabel: $("date-label"),
    datePicker: $("date-picker"),
    question: $("question"),
    years: $("years"),
    monthLabel: $("month-label"),
    grid: $("calendar-grid"),
    stats: $("stats"),
    searchInput: $("search-input"),
    searchResults: $("search-results"),
    startYear: $("start-year"),
    theme: $("theme"),
    toast: $("toast"),
  };

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  // ---------- 탭 ----------
  function showView(name) {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.view === name));
    document.querySelectorAll(".view").forEach((v) =>
      v.classList.toggle("active", v.id === `view-${name}`));
    if (name === "day") renderDay();
    if (name === "calendar") renderCalendar();
    if (name === "search") { renderSearch(); els.searchInput.focus(); }
    if (name === "settings") els.startYear.value = state.startYear;
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => showView(t.dataset.view)));

  // ---------- 하루 페이지 (같은 날짜의 10년) ----------
  function renderDay() {
    const m = current.getMonth() + 1;
    const d = current.getDate();
    const today = todayDate();

    els.dateLabel.textContent = `${m}월 ${d}일`;
    els.datePicker.value = toInputValue(current);
    const qs = window.DIARY_QUESTIONS || [];
    els.question.textContent = qs.length ? `Q. ${qs[dayOfYear(m, d) % qs.length]}` : "";

    els.years.innerHTML = "";
    for (let i = 0; i < YEARS; i++) {
      const y = state.startYear + i;
      const li = document.createElement("li");
      li.className = "year";

      const head = document.createElement("div");
      head.className = "year-head";
      const yl = document.createElement("span");
      yl.className = "year-label";
      yl.textContent = `${y}`;
      head.appendChild(yl);

      if (m === 2 && d === 29 && !isLeap(y)) {
        li.classList.add("disabled");
        const note = document.createElement("span");
        note.className = "year-note";
        note.textContent = "윤년이 아닌 해";
        head.appendChild(note);
        li.appendChild(head);
        els.years.appendChild(li);
        continue;
      }

      const date = new Date(y, m - 1, d);
      const wd = document.createElement("span");
      wd.className = "year-weekday";
      wd.textContent = `(${WEEKDAYS[date.getDay()]})`;
      head.appendChild(wd);

      const key = keyOf(y, m, d);
      const entry = state.entries[key] || { text: "", mood: "" };
      const isFuture = date > today;
      const isToday = date.getTime() === today.getTime();
      if (isToday) li.classList.add("today");

      if (isFuture) {
        li.classList.add("future");
        const note = document.createElement("span");
        note.className = "year-note";
        note.textContent = "아직 오지 않은 날";
        head.appendChild(note);
        li.appendChild(head);
        els.years.appendChild(li);
        continue;
      }

      // 기분 선택
      const moods = document.createElement("div");
      moods.className = "moods";
      MOODS.forEach((emo) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mood" + (entry.mood === emo ? " selected" : "");
        b.textContent = emo;
        b.setAttribute("aria-label", `기분 ${emo}`);
        b.addEventListener("click", () => {
          const e = state.entries[key] || { text: "", mood: "" };
          e.mood = e.mood === emo ? "" : emo;
          setEntry(key, e);
          moods.querySelectorAll(".mood").forEach((x) =>
            x.classList.toggle("selected", x.textContent === e.mood));
        });
        moods.appendChild(b);
      });
      head.appendChild(moods);

      const ta = document.createElement("textarea");
      ta.className = "entry";
      ta.rows = 3;
      ta.maxLength = 2000;
      ta.placeholder = isToday ? "오늘의 이야기를 적어보세요" : "이날을 기억하나요?";
      ta.value = entry.text;
      let t;
      ta.addEventListener("input", () => {
        autoGrow(ta);
        clearTimeout(t);
        t = setTimeout(() => {
          const e = state.entries[key] || { text: "", mood: "" };
          e.text = ta.value;
          setEntry(key, e);
          status.textContent = "저장됨";
        }, 400);
        status.textContent = "…";
      });
      const status = document.createElement("span");
      status.className = "status";

      li.appendChild(head);
      li.appendChild(ta);
      li.appendChild(status);
      els.years.appendChild(li);
      autoGrow(ta);
    }
  }

  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.max(ta.scrollHeight, 72) + "px";
  }

  function setEntry(key, e) {
    if (!e.text.trim() && !e.mood) delete state.entries[key];
    else state.entries[key] = { text: e.text, mood: e.mood, updated: Date.now() };
    save();
  }

  function moveDay(delta) {
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta);
    renderDay();
  }
  $("prev-day").addEventListener("click", () => moveDay(-1));
  $("next-day").addEventListener("click", () => moveDay(1));
  $("go-today").addEventListener("click", () => { current = todayDate(); renderDay(); });
  els.datePicker.addEventListener("change", () => {
    const [y, m, d] = els.datePicker.value.split("-").map(Number);
    if (y && m && d) { current = new Date(y, m - 1, d); renderDay(); }
  });

  // ---------- 달력 ----------
  function renderCalendar() {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth() + 1;
    els.monthLabel.textContent = `${y}년 ${m}월`;

    // 월/일별로 몇 개 해에 기록이 있는지
    const counts = {};
    for (const k of Object.keys(state.entries)) {
      const md = k.slice(5);
      counts[md] = (counts[md] || 0) + 1;
    }

    els.grid.innerHTML = "";
    const firstDow = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    for (let i = 0; i < firstDow; i++) {
      const s = document.createElement("span");
      s.className = "cell empty";
      els.grid.appendChild(s);
    }
    const today = todayDate();
    for (let d = 1; d <= days; d++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cell";
      const date = new Date(y, m - 1, d);
      if (date.getTime() === today.getTime()) b.classList.add("today");
      if (state.entries[keyOf(y, m, d)]) b.classList.add("written");
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = d;
      b.appendChild(num);
      const c = counts[`${pad(m)}-${pad(d)}`] || 0;
      const dots = document.createElement("span");
      dots.className = "dots";
      dots.textContent = "•".repeat(Math.min(c, YEARS));
      b.appendChild(dots);
      b.addEventListener("click", () => { current = date; showView("day"); });
      els.grid.appendChild(b);
    }
    renderStats();
  }

  function renderStats() {
    const keys = Object.keys(state.entries);
    const thisYear = todayDate().getFullYear();
    const yearCount = keys.filter((k) => k.startsWith(`${thisYear}-`)).length;

    // 연속 기록: 오늘(또는 어제)부터 거꾸로
    let streak = 0;
    const d = todayDate();
    if (!state.entries[toInputValue(d)]) d.setDate(d.getDate() - 1);
    while (state.entries[toInputValue(d)]) { streak++; d.setDate(d.getDate() - 1); }

    els.stats.innerHTML = "";
    [["전체 기록", keys.length], [`${thisYear}년 기록`, yearCount], ["연속 기록", `${streak}일`]]
      .forEach(([label, val]) => {
        const div = document.createElement("div");
        div.className = "stat";
        const v = document.createElement("strong");
        v.textContent = val;
        const l = document.createElement("span");
        l.textContent = label;
        div.append(v, l);
        els.stats.appendChild(div);
      });
  }

  $("prev-month").addEventListener("click", () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar();
  });
  $("next-month").addEventListener("click", () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar();
  });

  // ---------- 검색 ----------
  function renderSearch() {
    const q = els.searchInput.value.trim().toLowerCase();
    els.searchResults.innerHTML = "";
    const keys = Object.keys(state.entries).sort().reverse();
    const hits = q ? keys.filter((k) => state.entries[k].text.toLowerCase().includes(q)) : keys.slice(0, 30);

    if (!hits.length) {
      const li = document.createElement("li");
      li.className = "empty-msg";
      li.textContent = q ? "검색 결과가 없습니다." : "아직 쓴 일기가 없습니다.";
      els.searchResults.appendChild(li);
      return;
    }
    if (!q) {
      const li = document.createElement("li");
      li.className = "empty-msg";
      li.textContent = "최근 일기";
      els.searchResults.appendChild(li);
    }
    hits.forEach((k) => {
      const e = state.entries[k];
      const [y, m, d] = k.split("-").map(Number);
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "result";
      const h = document.createElement("div");
      h.className = "result-date";
      h.textContent = `${y}년 ${m}월 ${d}일 ${e.mood || ""}`;
      const p = document.createElement("div");
      p.className = "result-text";
      p.textContent = e.text.length > 140 ? e.text.slice(0, 140) + "…" : e.text;
      b.append(h, p);
      b.addEventListener("click", () => { current = new Date(y, m - 1, d); showView("day"); });
      li.appendChild(b);
      els.searchResults.appendChild(li);
    });
  }
  els.searchInput.addEventListener("input", renderSearch);

  // ---------- 설정 ----------
  $("save-start-year").addEventListener("click", () => {
    const y = parseInt(els.startYear.value, 10);
    if (!(y >= 1900 && y <= 2999)) { toast("올바른 연도를 입력해 주세요."); return; }
    state.startYear = y;
    save();
    toast(`${y}년 ~ ${y + YEARS - 1}년 일기장으로 설정했습니다.`);
  });

  function applyTheme() {
    const t = state.theme || "auto";
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    els.theme.value = t;
  }
  els.theme.addEventListener("change", () => {
    state.theme = els.theme.value; save(); applyTheme();
  });

  $("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `10년일기-백업-${toInputValue(todayDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("import").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data.entries !== "object") throw new Error("형식 오류");
      const n = Object.keys(data.entries).length;
      if (!confirm(`${n}개의 일기를 가져옵니다. 같은 날짜의 기존 일기는 덮어씁니다. 계속할까요?`)) return;
      for (const [k, e] of Object.entries(data.entries)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && e && typeof e.text === "string") {
          state.entries[k] = { text: e.text, mood: typeof e.mood === "string" ? e.mood : "", updated: e.updated || Date.now() };
        }
      }
      if (Number.isInteger(data.startYear)) state.startYear = data.startYear;
      save();
      toast("가져오기를 완료했습니다.");
    } catch (e) {
      toast("백업 파일을 읽을 수 없습니다.");
    }
  });

  $("clear-all").addEventListener("click", () => {
    if (!confirm("정말 모든 일기를 삭제할까요? 되돌릴 수 없습니다.")) return;
    state.entries = {};
    save();
    toast("모든 일기를 삭제했습니다.");
  });

  // ---------- PWA ----------
  let deferredPrompt = null;
  const installBtn = $("install-btn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // 다른 탭에서 수정했을 때 동기화
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) { state = load(); applyTheme(); renderDay(); }
  });

  // 시작
  applyTheme();
  renderDay();
})();
