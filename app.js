/* global ethers */

const CONFIG = {
  // Sepolia
  chainIdDec: 11155111,
  chainIdHex: "0xaa36a7",

  // 你的新下注合約
  guessAddress: "0x9673251fb579945642170c86c2AD731Db2b87d9b",

  // 一次授權大額度，避免同事每次下注都要 approve
  approveAmountRaw: "1000000000", // 10 億 raw
};

// ===== Guess ABI =====
const GUESS_ABI = [
  // Ownable
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  // IERC20 public immutable betToken; => auto getter betToken()
  {
    inputs: [],
    name: "betToken",
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

// ===== ERC20 ABI（只需要 allowance/approve/balanceOf）=====
const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// ===== runtime state =====
let provider, signer, account;
let guessRead, guessWrite;
let tokenRead, tokenWrite;
let tokenAddress;
let ownerAddress;
let isOwner = false;

const $ = (id) => document.getElementById(id);

function log(msg) {
  const el = $("log");
  if (!el) return;
  el.textContent = (el.textContent || "") + msg + "\n";
  el.scrollTop = el.scrollHeight;
}

function clearLog() {
  const el = $("log");
  if (!el) return;
  el.textContent = "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusText(status) {
  return Number(status) === 0 ? "Open（可下注）" : "Resolved（已公布，不可下注）";
}

function mustHaveDom() {
  const required = [
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
  const missing = required.filter((id) => !$(id));
  if (missing.length) {
    throw new Error("index.html 缺少元素 id：" + missing.join(", "));
  }
}

async function connect() {
  clearLog();

  try {
    mustHaveDom();

    if (!window.ethereum) {
      alert("找不到 MetaMask（window.ethereum 不存在）");
      return;
    }
    if (!window.ethers) {
      alert("找不到 ethers（請確認 index.html 已載入 ethers.umd.min.js）");
      return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    $("wallet").textContent = `✅ 已連線錢包：${account}`;
    $("chain").textContent = `chainId：0x${chainId.toString(16)}（ethers: ${chainId}）`;

    if (chainId !== CONFIG.chainIdDec) {
      log(`❌ 你目前不是 Sepolia（需要 ${CONFIG.chainIdDec} / ${CONFIG.chainIdHex}）`);
      alert("請把 MetaMask 切到 Sepolia 後再重整頁面");
      return;
    }

    guessRead = new ethers.Contract(CONFIG.guessAddress, GUESS_ABI, provider);
    guessWrite = new ethers.Contract(CONFIG.guessAddress, GUESS_ABI, signer);

    ownerAddress = await guessRead.owner();
    isOwner = ownerAddress.toLowerCase() === account.toLowerCase();

    tokenAddress = await guessRead.betToken();
    tokenRead = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    tokenWrite = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    log(`✅ Guess 合約：${CONFIG.guessAddress}`);
    log(`✅ owner：${ownerAddress}`);
    log(`✅ betToken：${tokenAddress}`);
    log(isOwner ? "✅ 你是 owner（顯示管理區）" : "ℹ️ 你不是 owner（只能下注/領獎/退款）");

    $("adminBox").style.display = isOwner ? "block" : "none";

    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ connect 失敗：" + msg);
    alert("connect 失敗：" + msg);
  }
}

async function loadQuestions() {
  const list = $("questions");
  list.innerHTML = "";

  const count = await guessRead.questionsCount();
  log(`✅ 題目數量 questionsCount = ${count.toString()}`);

  const n = Number(count);
  if (n === 0) {
    list.innerHTML = `<div style="opacity:.7;">目前沒有題目</div>`;
    $("detail").innerHTML = `<div style="opacity:.7;">尚無題目</div>`;
    return;
  }

  for (let i = 0; i < n; i++) {
    const q = await guessRead.getQuestion(i);
    const row = document.createElement("div");
    row.className = "qrow";
    row.style.cursor = "pointer";
    row.style.padding = "10px";
    row.style.border = "1px solid #ddd";
    row.style.marginBottom = "8px";
    row.textContent = `Q${i} | ${Number(q.status) === 0 ? "Open" : "Resolved"} | ${q.text}`;
    row.onclick = () => showQuestion(i);
    list.appendChild(row);
  }

  // 預設顯示最後一題
  await showQuestion(n - 1);
}

async function getAllowanceRaw() {
  const a = await tokenRead.allowance(account, CONFIG.guessAddress);
  return BigInt(a.toString());
}

async function showQuestion(qid) {
  const q = await guessRead.getQuestion(qid);

  const text = q.text;
  const options = q.options;
  const status = Number(q.status);
  const winningOption = q.winningOption;
  const totalPool = q.totalPool;

  let html = `
    <h2 style="margin-top:0;">${escapeHtml(text)}</h2>
    <div>狀態：<b>${statusText(status)}</b></div>
    <div>總池（raw）：<b>${totalPool.toString()}</b></div>
    <div style="opacity:.75;">下注 Token：${tokenAddress}</div>
    <hr/>
    <div style="margin-bottom:8px;"><b>選項</b></div>
    <ol>${options.map((o, idx) => `<li>${idx}: ${escapeHtml(o)}</li>`).join("")}</ol>
  `;

  // 管理區：方便你直接填當前題目ID
  if (isOwner && $("resolveQid")) $("resolveQid").value = String(qid);

  if (status === 1) {
    html += `<div style="margin-top:10px;">答案：<b>${winningOption.toString()}</b>（${escapeHtml(options[Number(winningOption)] || "")}）</div>`;
    html += `
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnClaim">Claim（中獎領獎）</button>
        <button id="btnRefund">Refund（無人中獎退款）</button>
      </div>
    `;
    $("detail").innerHTML = html;

    $("btnClaim").onclick = () => claim(qid);
    $("btnRefund").onclick = () => refund(qid);
    return;
  }

  // Open：下注區（含 allowance/approve）
  const allowance = await getAllowanceRaw();

  html += `
    <hr/>
    <div style="margin-bottom:6px;"><b>下注</b></div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <label>選項ID</label>
      <input id="betOption" type="number" min="0" step="1" style="width:90px;" value="0"/>
      <label>金額（raw）</label>
      <input id="betAmount" type="number" min="1" step="1" style="width:140px;" value="100"/>
      <button id="btnApprove">Approve</button>
      <button id="btnBet">Bet</button>
    </div>
    <div style="opacity:.75; margin-top:6px;">
      allowance(raw)：<b>${allowance.toString()}</b>
      ｜ Approve 會授權 <b>${CONFIG.approveAmountRaw}</b> raw
    </div>
  `;

  $("detail").innerHTML = html;

  $("btnApprove").onclick = approve;
  $("btnBet").onclick = () => bet(qid);
}

async function approve() {
  const btn = $("btnApprove");
  const old = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = "授權中...";

    const amount = BigInt(CONFIG.approveAmountRaw);
    log(`➡️ approve(spender=${CONFIG.guessAddress}, amount=${amount.toString()})`);

    const tx = await tokenWrite.approve(CONFIG.guessAddress, amount);
    log(`⏳ approve tx: ${tx.hash}`);
    await tx.wait();

    log("✅ Approve 成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ Approve 失敗：" + msg);
    alert("Approve 失敗：" + msg);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

async function bet(qid) {
  const btn = $("btnBet");
  const old = btn.textContent;

  try {
    const optionId = Number($("betOption").value);
    const amount = BigInt($("betAmount").value || "0");
    if (amount <= 0n) return alert("金額必須 > 0");

    const allowance = await getAllowanceRaw();
    if (allowance < amount) {
      log(`❌ allowance 不足（${allowance.toString()} < ${amount.toString()}），請先 Approve`);
      alert("Allowance 不足，請先按 Approve 再下注。");
      return;
    }

    btn.disabled = true;
    btn.textContent = "送出交易中...";

    log(`➡️ bet(qid=${qid}, option=${optionId}, amount=${amount.toString()})`);
    const tx = await guessWrite.bet(qid, optionId, amount);
    log(`⏳ bet tx: ${tx.hash}`);
    await tx.wait();

    log("✅ 下注成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ 下注失敗：" + msg);
    alert("下注失敗：" + msg);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

async function claim(qid) {
  try {
    log(`➡️ claim(qid=${qid})`);
    const tx = await guessWrite.claim(qid);
    log(`⏳ claim tx: ${tx.hash}`);
    await tx.wait();
    log("✅ Claim 成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ Claim 失敗：" + msg);
    alert("Claim 失敗：" + msg);
  }
}

async function refund(qid) {
  try {
    log(`➡️ refund(qid=${qid})`);
    const tx = await guessWrite.refund(qid);
    log(`⏳ refund tx: ${tx.hash}`);
    await tx.wait();
    log("✅ Refund 成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ Refund 失敗：" + msg);
    alert("Refund 失敗：" + msg);
  }
}

// ====== Admin: 出題 ======
async function createQuestionFromUI() {
  try {
    if (!isOwner) return alert("你不是 owner，不能出題");

    const text = $("qText").value.trim();
    const raw = $("qOptions").value.trim();

    if (!text) return alert("題目不可空白");
    if (!raw) return alert("選項不可空白（例如 A,B,C 或 [\"A\",\"B\"]）");

    // 支援兩種輸入：A,B,C 或 JSON array
    let options;
    if (raw.startsWith("[")) {
      options = JSON.parse(raw);
    } else {
      options = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (!Array.isArray(options) || options.length < 2) {
      return alert("選項至少需要 2 個");
    }

    log(`➡️ createQuestion(text="${text}", options=${JSON.stringify(options)})`);
    const tx = await guessWrite.createQuestion(text, options);
    log(`⏳ createQuestion tx: ${tx.hash}`);
    await tx.wait();

    log("✅ 出題成功");
    $("qText").value = "";
    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ 出題失敗：" + msg);
    alert("出題失敗：" + msg);
  }
}

// ====== Admin: 公布答案 ======
async function resolveFromUI() {
  try {
    if (!isOwner) return alert("你不是 owner，不能公布答案");

    const qid = Number($("resolveQid").value);
    const win = Number($("resolveWin").value);

    if (!Number.isFinite(qid) || qid < 0) return alert("Question ID 不正確");
    if (!Number.isFinite(win) || win < 0) return alert("Winning Option ID 不正確");

    log(`➡️ resolve(qid=${qid}, win=${win})`);
    const tx = await guessWrite.resolve(qid, win);
    log(`⏳ resolve tx: ${tx.hash}`);
    await tx.wait();

    log("✅ 公布答案成功");
    await loadQuestions();
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || String(e);
    log("❌ 公布答案失敗：" + msg);
    alert("公布答案失敗：" + msg);
  }
}

// ===== bind =====
window.addEventListener("DOMContentLoaded", () => {
  // connect 之前先隱藏 adminBox
  if ($("adminBox")) $("adminBox").style.display = "none";

  if ($("btnConnect")) $("btnConnect").onclick = connect;

  // ✅ 直接綁定（不再用 window.xxx || alert(...)）
  if ($("btnCreate")) $("btnCreate").onclick = createQuestionFromUI;
  if ($("btnResolve")) $("btnResolve").onclick = resolveFromUI;
});
