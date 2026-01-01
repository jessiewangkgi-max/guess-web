/* global ethers */

const CONFIG = {
  chainIdDec: 11155111, // Sepolia
  chainIdHex: "0xaa36a7",
  guessAddress: "0x9673251fb579945642170c86c2AD731Db2b87d9b", // ✅你的新下注合約
};

// ===== Guess Contract ABI (對應你貼的合約) =====
const GUESS_ABI = [
  // Ownable
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // views
  {
    inputs: [],
    name: "questionsCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "questionId", type: "uint256" }],
    name: "getQuestion",
    outputs: [
      { internalType: "string", name: "text", type: "string" },
      { internalType: "string[]", name: "options", type: "string[]" },
      { internalType: "uint8", name: "status", type: "uint8" }, // enum Status
      { internalType: "uint256", name: "winningOption", type: "uint256" },
      { internalType: "uint256", name: "totalPool", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // admin
  {
    inputs: [
      { internalType: "string", name: "text", type: "string" },
      { internalType: "string[]", name: "options", type: "string[]" },
    ],
    name: "createQuestion",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "questionId", type: "uint256" },
      { internalType: "uint256", name: "winningOptionId", type: "uint256" },
    ],
    name: "resolve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // users
  {
    inputs: [
      { internalType: "uint256", name: "questionId", type: "uint256" },
      { internalType: "uint256", name: "optionId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "bet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "questionId", type: "uint256" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "questionId", type: "uint256" }],
    name: "refund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

let provider;
let signer;
let account;
let guessRead;
let guessWrite;
let ownerAddress;
let isOwner = false;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function log(msg) {
  const el = $("log");
  if (!el) return;
  el.textContent = (el.textContent || "") + msg + "\n";
}

function clearLog() {
  const el = $("log");
  if (!el) return;
  el.textContent = "";
}

function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function statusText(status) {
  // enum Status { Open, Resolved }
  return Number(status) === 0 ? "Open（可下注）" : "Resolved（已公布，不可下注）";
}

function requireEls() {
  const need = [
    "btnConnect",
    "wallet",
    "chain",
    "questions",
    "detail",
    "adminBox",
    "qText",
    "qOptions",
    "btnCreate",
    "resolveQid",
    "resolveWin",
    "btnResolve",
    "log",
  ];
  const missing = need.filter((id) => !$(id));
  if (missing.length) {
    console.error("Missing elements:", missing);
    throw new Error("index.html 缺少必要的元素：" + missing.join(", "));
  }
}

// ---------- connect ----------
async function connect() {
  clearLog();
  try {
    requireEls();

    if (!window.ethereum) {
      alert("MetaMask not found");
      return;
    }
    if (!window.ethers) {
      alert("ethers not found (請確認 index.html 已載入 ethers.umd.min.js)");
      return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);

    // request accounts
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    $("wallet").textContent = `✅ 已連線錢包：${account}`;
    $("chain").textContent = `chainId：${"0x" + chainId.toString(16)}（ethers: ${chainId}）`;

    if (chainId !== CONFIG.chainIdDec) {
      log(`❌ 請切到 Sepolia（chainId ${CONFIG.chainIdDec} / ${CONFIG.chainIdHex}）`);
      alert("請切到 Sepolia 再重整頁面");
      return;
    }

    guessRead = new ethers.Contract(CONFIG.guessAddress, GUESS_ABI, provider);
    guessWrite = new ethers.Contract(CONFIG.guessAddress, GUESS_ABI, signer);

    ownerAddress = await guessRead.owner();
    isOwner = ownerAddress.toLowerCase() === account.toLowerCase();

    log(`✅ Guess 合約：${CONFIG.guessAddress}`);
    log(`✅ owner = ${ownerAddress}`);
    log(isOwner ? "✅ 你是 owner（可出題/公布答案）" : "ℹ️ 你不是 owner（只能下注/claim/refund）");

    // show/hide admin box
    $("adminBox").style.display = isOwner ? "block" : "none";

    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ connect 失敗：" + (e?.message || e));
  }
}

// ---------- load list ----------
async function loadQuestions() {
  try {
    const count = await guessRead.questionsCount();
    log(`✅ 合約題目數量 questionsCount = ${count.toString()}`);

    const list = $("questions");
    list.innerHTML = "";

    const n = Number(count);
    if (n === 0) {
      list.innerHTML = `<div style="opacity:.7;">目前沒有題目</div>`;
      $("detail").innerHTML = "";
      return;
    }

    for (let i = 0; i < n; i++) {
      const q = await guessRead.getQuestion(i);
      const text = q.text;
      const status = q.status;
      const row = document.createElement("div");
      row.className = "qrow";
      row.style.cursor = "pointer";
      row.style.padding = "10px";
      row.style.border = "1px solid #ddd";
      row.style.marginBottom = "8px";
      row.textContent = `Q${i} | ${Number(status) === 0 ? "Open" : "Resolved"} | ${text}`;
      row.onclick = () => showQuestion(i);
      list.appendChild(row);
    }

    await showQuestion(n - 1);
  } catch (e) {
    console.error(e);
    log("❌ 讀題目失敗：" + (e?.message || e));
  }
}

// ---------- render detail ----------
async function showQuestion(qid) {
  try {
    const q = await guessRead.getQuestion(qid);
    const text = q.text;
    const options = q.options;
    const status = Number(q.status);
    const winningOption = q.winningOption;
    const totalPool = q.totalPool;

    let html = `
      <h2 style="margin-top:0;">${text}</h2>
      <div>狀態：<b>${statusText(status)}</b></div>
      <div>總池（raw）：<b>${totalPool.toString()}</b></div>
      <hr/>
      <div style="margin-bottom:8px;"><b>選項</b></div>
      <ol>
        ${options.map((o, idx) => `<li>${idx}: ${escapeHtml(o)}</li>`).join("")}
      </ol>
    `;

    if (status === 1) {
      html += `<div style="margin-top:10px;">答案：<b>${winningOption.toString()}</b>（${escapeHtml(options[Number(winningOption)] || "")}）</div>`;
      html += `
        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
          <button id="btnClaim">Claim（中獎領獎）</button>
          <button id="btnRefund">Refund（無人中獎退款）</button>
        </div>
      `;
    } else {
      // Open
      html += `
        <hr/>
        <div style="margin-bottom:6px;"><b>下注</b></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <label>選項ID</label>
          <input id="betOption" type="number" min="0" step="1" style="width:90px;" value="0"/>
          <label>金額（raw）</label>
          <input id="betAmount" type="number" min="1" step="1" style="width:140px;" value="100"/>
          <button id="btnBet">Bet</button>
        </div>
        <div style="opacity:.75; margin-top:6px;">
          ※ 這裡的金額是 raw（不處理 decimals），你之前的合約行為就是這樣。
        </div>
      `;
    }

    if (isOwner) {
      html += `
        <hr/>
        <div style="opacity:.85;">
          <b>Owner 操作</b><br/>
          你也可以用上方「公布答案」區塊操作，這裡只是提醒：Open 才能 resolve。
        </div>
      `;
      $("resolveQid").value = String(qid);
    }

    $("detail").innerHTML = html;

    // bind buttons
    if (status === 1) {
      $("btnClaim").onclick = () => claim(qid);
      $("btnRefund").onclick = () => refund(qid);
    } else {
      $("btnBet").onclick = () => bet(qid);
    }
  } catch (e) {
    console.error(e);
    log("❌ 顯示題目失敗：" + (e?.message || e));
  }
}

async function bet(qid) {
  try {
    const optionId = Number($("betOption").value);
    const amount = BigInt($("betAmount").value || "0");
    if (amount <= 0n) {
      alert("金額要 > 0");
      return;
    }
    log(`➡️ bet(qid=${qid}, option=${optionId}, amount=${amount.toString()})`);
    const tx = await guessWrite.bet(qid, optionId, amount);
    log(`⏳ tx sent: ${tx.hash}`);
    await tx.wait();
    log("✅ 下注成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ 下注失敗：" + (e?.shortMessage || e?.message || e));
  }
}

async function claim(qid) {
  try {
    log(`➡️ claim(qid=${qid})`);
    const tx = await guessWrite.claim(qid);
    log(`⏳ tx sent: ${tx.hash}`);
    await tx.wait();
    log("✅ Claim 成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ Claim 失敗：" + (e?.shortMessage || e?.message || e));
  }
}

async function refund(qid) {
  try {
    log(`➡️ refund(qid=${qid})`);
    const tx = await guessWrite.refund(qid);
    log(`⏳ tx sent: ${tx.hash}`);
    await tx.wait();
    log("✅ Refund 成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ Refund 失敗：" + (e?.shortMessage || e?.message || e));
  }
}

// ---------- admin actions ----------
async function createQuestionFromUI() {
  try {
    const text = $("qText").value.trim();
    const raw = $("qOptions").value.trim();
    if (!text) return alert("題目不可空白");
    if (!raw) return alert("選項不可空白（用逗號分隔）");

    // 支援：A,B,C 或 ["A","B","C"]
    let options;
    if (raw.startsWith("[")) {
      options = JSON.parse(raw);
    } else {
      options = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(options) || options.length < 2) {
      return alert("選項至少 2 個");
    }

    log(`➡️ createQuestion(text="${text}", options=${JSON.stringify(options)})`);
    const tx = await guessWrite.createQuestion(text, options);
    log(`⏳ tx sent: ${tx.hash}`);
    await tx.wait();
    log("✅ 出題成功");
    $("qText").value = "";
    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ 出題失敗：" + (e?.shortMessage || e?.message || e));
  }
}

async function resolveFromUI() {
  try {
    const qid = Number($("resolveQid").value);
    const win = Number($("resolveWin").value);
    log(`➡️ resolve(qid=${qid}, win=${win})`);
    const tx = await guessWrite.resolve(qid, win);
    log(`⏳ tx sent: ${tx.hash}`);
    await tx.wait();
    log("✅ 公布答案成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ 公布答案失敗：" + (e?.shortMessage || e?.message || e));
  }
}

// ---------- ui bootstrap ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("DOMContentLoaded", () => {
  // bind
  if ($("btnConnect")) $("btnConnect").onclick = connect;
  if ($("btnCreate")) $("btnCreate").onclick = createQuestionFromUI;
  if ($("btnResolve")) $("btnResolve").onclick = resolveFromUI;

  // default admin box hidden until verified
  if ($("adminBox")) $("adminBox").style.display = "none";
});
