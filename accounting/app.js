(function () {
  var CATS = {
    out: ["餐飲", "交通", "購物", "居住", "娛樂", "其他"],
    in: ["薪資", "獎金", "其他"]
  };
  var SUPABASE_URL = "https://vpdviztlvzsnpyqcvbdl.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wIMWiltiFxQcOqDdu916Yw_rcIhpQsL";
  var type = "out";
  var items = [];
  var currentUser = null;
  var authInitialized = false;
  var loadVersion = 0;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function today() {
    var date = new Date();
    return date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);
  }

  function money(amount) {
    return "$" + Math.round(amount).toLocaleString("zh-TW");
  }

  function esc(value) {
    return String(value).replace(/[&<>"]/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      }[character];
    });
  }

  function fillCats() {
    $("cat").innerHTML = CATS[type].map(function (category) {
      return '<option value="' + esc(category) + '">' + esc(category) + "</option>";
    }).join("");
  }

  function setType(newType) {
    type = newType;
    $("tOut").setAttribute("aria-pressed", type === "out");
    $("tIn").setAttribute("aria-pressed", type === "in");
    fillCats();
  }

  function render() {
    var month = $("m").value;
    var rows = items.filter(function (item) {
      return item.date.slice(0, 7) === month;
    }).sort(function (a, b) {
      if (a.date !== b.date) {
        return a.date < b.date ? 1 : -1;
      }
      return String(b.created_at || b.id).localeCompare(String(a.created_at || a.id));
    });
    var income = 0;
    var expenses = 0;
    var byCategory = {};

    rows.forEach(function (item) {
      if (item.type === "in") {
        income += item.amount;
      } else {
        expenses += item.amount;
        byCategory[item.category] = (byCategory[item.category] || 0) + item.amount;
      }
    });

    $("bal").textContent = (income - expenses < 0 ? "-" : "") + money(Math.abs(income - expenses));
    $("sin").textContent = money(income);
    $("sout").textContent = money(expenses);

    var categories = Object.keys(byCategory).sort(function (a, b) {
      return byCategory[b] - byCategory[a];
    });
    $("cats").innerHTML = categories.length ? categories.map(function (category) {
      return '<div class="cat"><span>' + esc(category) + '</span><div class="track"><i style="width:' + (byCategory[category] / expenses * 100) + '%"></i></div><span>' + money(byCategory[category]) + "</span></div>";
    }).join("") : '<div class="empty-state"><img class="mascot" src="./images/penguin.jpg" alt="" aria-hidden="true"><span>這個月還沒有支出</span></div>';

    $("list").innerHTML = rows.length ? rows.map(function (item) {
      return '<li><span class="d">' + esc(item.date.slice(5).replace("-", "/")) + '</span><span class="n">' + esc(item.category) + (item.note ? "<small>" + esc(item.note) + "</small>" : "") + '</span><span class="amt ' + (item.type === "in" ? "in" : "out") + '">' + (item.type === "in" ? "+" : "-") + money(item.amount) + '</span><button class="del" data-id="' + esc(item.id) + '" aria-label="刪除這一筆">×</button></li>';
    }).join("") : '<li class="empty empty-state"><img class="mascot" src="./images/penguin.jpg" alt="" aria-hidden="true"><span>還沒有記錄，從上方新增第一筆吧。</span></li>';
  }

  function showError(element, label, error) {
    var detail = error && error.message ? "（" + error.message + "）" : "";
    element.textContent = label + detail;
  }

  function applySession(session) {
    var nextUser = session && session.user ? session.user : null;
    if (authInitialized && ((!currentUser && !nextUser) || (currentUser && nextUser && currentUser.id === nextUser.id))) {
      return;
    }

    authInitialized = true;
    currentUser = nextUser;
    loadVersion += 1;
    $("authPanel").hidden = !!currentUser;
    $("appPanel").hidden = !currentUser;
    $("authMsg").textContent = "";
    $("dataMsg").textContent = "";
    $("msg").textContent = "";

    if (!currentUser) {
      items = [];
      $("accountEmail").textContent = "";
      render();
      return;
    }

    $("accountEmail").textContent = currentUser.email || "";
    items = [];
    render();
    loadTransactions(currentUser, loadVersion);
  }

  async function loadTransactions(user, version) {
    $("dataMsg").textContent = "正在載入雲端紀錄…";
    var result;
    try {
      result = await db.from("transactions")
        .select("id, created_at, user_id, type, amount, category, date, note")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
    } catch (error) {
      if (version === loadVersion && currentUser && currentUser.id === user.id) {
        showError($("dataMsg"), "載入紀錄失敗，請重新整理或稍後再試。", error);
      }
      return;
    }

    if (version !== loadVersion || !currentUser || currentUser.id !== user.id) {
      return;
    }
    if (result.error) {
      showError($("dataMsg"), "載入紀錄失敗，請重新整理或稍後再試。", result.error);
      render();
      return;
    }

    items = (result.data || []).map(function (row) {
      return {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        type: row.type,
        amount: Number(row.amount),
        category: row.category,
        date: row.date,
        note: row.note || ""
      };
    });
    $("dataMsg").textContent = "";
    render();
  }

  $("tOut").onclick = function () {
    setType("out");
  };
  $("tIn").onclick = function () {
    setType("in");
  };
  $("loginForm").onsubmit = async function (event) {
    event.preventDefault();
    $("authMsg").textContent = "";
    $("login").disabled = true;
    try {
      var result = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });
      if (result.error) {
        showError($("authMsg"), "登入失敗，請確認 Email 與密碼後重試。", result.error);
      } else {
        $("password").value = "";
      }
    } catch (error) {
      showError($("authMsg"), "登入失敗，請檢查網路連線後重試。", error);
    } finally {
      $("login").disabled = false;
    }
  };
  $("logout").onclick = async function () {
    $("logout").disabled = true;
    $("dataMsg").textContent = "";
    try {
      var result = await db.auth.signOut();
      if (result.error) {
        showError($("dataMsg"), "登出失敗，請稍後再試。", result.error);
      }
    } catch (error) {
      showError($("dataMsg"), "登出失敗，請檢查網路連線後重試。", error);
    } finally {
      $("logout").disabled = false;
    }
  };
  $("add").onclick = async function () {
    var amount = parseFloat($("amt").value);
    var date = $("date").value;

    if (!(amount > 0)) {
      $("msg").textContent = "請輸入大於 0 的金額。";
      return;
    }
    if (!date) {
      $("msg").textContent = "請選擇日期。";
      return;
    }

    $("msg").textContent = "";
    if (!currentUser) {
      $("msg").textContent = "登入狀態已失效，請重新登入後再新增。";
      return;
    }

    var userId = currentUser.id;
    $("add").disabled = true;
    var result;
    try {
      result = await db.from("transactions").insert({
        user_id: userId,
        type: type,
        amount: amount,
        category: $("cat").value,
        date: date,
        note: $("note").value.trim()
      }).select("id, created_at, user_id, type, amount, category, date, note").single();
    } catch (error) {
      showError($("msg"), "新增紀錄失敗，請檢查網路連線後重試。", error);
      return;
    } finally {
      $("add").disabled = false;
    }

    if (result.error) {
      showError($("msg"), "新增紀錄失敗，請確認資料後重試。", result.error);
      return;
    }
    if (!currentUser || currentUser.id !== userId) {
      return;
    }

    var row = result.data;
    items.push({
      id: row.id,
      created_at: row.created_at,
      user_id: row.user_id,
      type: row.type,
      amount: Number(row.amount),
      category: row.category,
      date: row.date,
      note: row.note || ""
    });
    $("amt").value = "";
    $("note").value = "";
    $("m").value = date.slice(0, 7);
    render();
    $("amt").focus();
  };
  $("amt").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      $("add").click();
    }
  });
  $("list").onclick = async function (event) {
    var button = event.target.closest(".del");
    if (!button) {
      return;
    }
    if (!currentUser) {
      $("dataMsg").textContent = "登入狀態已失效，請重新登入後再刪除。";
      return;
    }
    var id = button.dataset.id;
    var userId = currentUser.id;
    button.disabled = true;
    $("dataMsg").textContent = "";
    var result;
    try {
      result = await db.from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id");
    } catch (error) {
      showError($("dataMsg"), "刪除紀錄失敗，請檢查網路連線後重試。", error);
      button.disabled = false;
      return;
    }
    button.disabled = false;
    if (!currentUser || currentUser.id !== userId) {
      return;
    }
    if (result.error) {
      showError($("dataMsg"), "刪除紀錄失敗，請稍後再試。", result.error);
      return;
    }
    if (!result.data || !result.data.length) {
      $("dataMsg").textContent = "刪除失敗：找不到這筆紀錄，或目前帳號沒有刪除權限。";
      return;
    }
    items = items.filter(function (item) {
      return item.id !== id;
    });
    render();
  };
  $("m").onchange = render;

  $("date").value = today();
  $("m").value = today().slice(0, 7);
  fillCats();
  render();

  if (!window.supabase || !window.supabase.createClient) {
    $("authMsg").textContent = "無法載入 Supabase 用戶端，請確認網路連線後重新整理。";
    $("login").disabled = true;
    return;
  }

  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  db.auth.onAuthStateChange(function (_event, session) {
    window.setTimeout(function () {
      applySession(session);
    }, 0);
  });
  db.auth.getSession().then(function (result) {
    if (result.error) {
      showError($("authMsg"), "無法確認登入狀態，請重新整理頁面。", result.error);
      return;
    }
    applySession(result.data.session);
  }).catch(function (error) {
    showError($("authMsg"), "無法確認登入狀態，請檢查網路連線後重試。", error);
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      var appScope = new URL("./", document.baseURI);
      var workerUrl = new URL("./service-worker.js", document.baseURI);
      navigator.serviceWorker.register(workerUrl.href, { scope: appScope.pathname })
        .catch(function (error) {
          console.error("Service Worker 註冊失敗：", error);
        });
    });
  }
})();
