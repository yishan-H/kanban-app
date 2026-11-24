(function () {
  var CATS = {
    out: ["餐飲", "交通", "購物", "居住", "娛樂", "其他"],
    in: ["薪資", "獎金", "其他"]
  };
  var KEY = "ledger-v1";
  var type = "out";
  var items = [];
  var $ = function (id) {
    return document.getElementById(id);
  };

  function load() {
    try {
      items = JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      items = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {}
  }

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
      return "<option>" + category + "</option>";
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
      return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
    });
    var income = 0;
    var expenses = 0;
    var byCategory = {};

    rows.forEach(function (item) {
      if (item.type === "in") {
        income += item.amount;
      } else {
        expenses += item.amount;
        byCategory[item.cat] = (byCategory[item.cat] || 0) + item.amount;
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
    }).join("") : '<div class="empty">這個月還沒有支出</div>';

    $("list").innerHTML = rows.length ? rows.map(function (item) {
      return '<li><span class="d">' + item.date.slice(5).replace("-", "/") + '</span><span class="n">' + esc(item.cat) + (item.note ? "<small>" + esc(item.note) + "</small>" : "") + '</span><span class="amt ' + item.type + '">' + (item.type === "in" ? "+" : "-") + money(item.amount) + '</span><button class="del" data-id="' + item.id + '" aria-label="刪除這一筆">×</button></li>';
    }).join("") : '<li class="empty" style="display:block">還沒有記錄，從上方新增第一筆吧。</li>';
  }

  $("tOut").onclick = function () {
    setType("out");
  };
  $("tIn").onclick = function () {
    setType("in");
  };
  $("add").onclick = function () {
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
    items.push({
      id: Date.now(),
      type: type,
      amount: amount,
      cat: $("cat").value,
      date: date,
      note: $("note").value.trim()
    });
    save();
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
  $("list").onclick = function (event) {
    var button = event.target.closest(".del");
    if (!button) {
      return;
    }
    var id = +button.dataset.id;
    items = items.filter(function (item) {
      return item.id !== id;
    });
    save();
    render();
  };
  $("m").onchange = render;

  load();
  $("date").value = today();
  $("m").value = today().slice(0, 7);
  fillCats();
  render();
})();
