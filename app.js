/* global ethers */

// ===== 你要確認這裡是新合約 =====
const CONFIG = {
  chainIdDec: 11155111, // Sepolia
  chainIdHex: "0xaa36a7",
  guessAddress: "0x9673251fb579945642170c86c2AD731Db2b87d9b",
  approveAmountRaw: "1000000000" // 一次授權 10 億 raw（你可改大/改小）
};

// ===== Guess ABI：要多加 betToken() 這個 getter =====
const GUESS_ABI = [
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "betToken", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },

  { "inputs": [], "name": "questionsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "questionId", "type": "uint256" }],
    "name": "getQuestion",
    "outputs": [
      { "internalType": "string", "name": "text", "type": "string" },
      { "internalType": "string[]", "name": "options", "type": "string[]" },
      { "internalType": "uint8", "name": "status", "type": "uint8" },
      { "internalType": "uint256", "name": "winningOption", "type": "uint256" },
      { "internalType": "uint256", "name": "totalPool", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  {
    "inputs": [
      { "internalType": "string", "name": "text", "type": "string" },
      { "internalType": "string[]", "name": "options", "type": "string[]" }
    ],
    "name": "createQuestion",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "questionId", "type": "uint256" },
      { "internalType": "uint256", "name": "winningOptionId", "type": "uint256" }
    ],
    "name": "resolve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  {
    "inputs": [
      { "internalType": "uint256", "name": "questionId", "type": "uint256" },
      { "internalType": "uint256", "name": "optionId", "type": "uint256" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "bet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "uint256", "name": "questionId", "type": "uint256" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "questionId", "type": "uint256" }], "name": "refund", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

// ===== ERC20 ABI（只用到 allowance/approve/balanceOf）=====
const ERC20_ABI = [
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

let provider, signer, account;
let guessRead, guessWrite;
let tokenRead, tokenWrite;
let tokenAddress;
let ownerAddress, isOwner = false;

const $ = (id) => document.getElementById(id);
function log(msg) { $("log").textContent = ($("log").textContent || "") + msg + "\n"; }
function clearLog() { $("log").textContent = ""; }
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function statusText(status){ return Number(status)===0 ? "Open（可下注）" : "Resolved（已公布，不可下注）"; }

async function connect() {
  clearLog();
  try {
    if (!window.ethereum) return alert("MetaMask not found");
    if (!window.ethers) return alert("ethers not found (請確認 index.html 已載入 ethers.umd.min.js)");

    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    $("wallet").textContent = `✅ 已連線錢包：${account}`;
    $("chain").textContent = `chainId：0x${chainId.toString(16)}（ethers: ${chainId}）`;

    if (chainId !== CONFIG.chainIdDec) {
      log(`❌ 請切到 Sepolia（${CONFIG.chainIdDec} / ${CONFIG.chainIdHex}）`);
      alert("請切到 Sepolia 再重整頁面");
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
    log(`✅ owner = ${ownerAddress}`);
    log(`✅ betToken = ${tokenAddress}`);
    log(isOwner ? "✅ 你是 owner（可出題/公布答案）" : "ℹ️ 你不是 owner（只能下注/claim/refund）");

    $("adminBox").style.display = isOwner ? "block" : "none";

    await loadQuestions();
  } catch (e) {
    console.error(e);
    log("❌ connect 失敗：" + (e?.message || e));
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
    $("detail").innerHTML = "";
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
    row.textContent = `Q${i} | ${Number(q.status)===0 ? "Open" : "Resolved"} | ${q.text}`;
    row.onclick = () => showQuestion(i);
    list.appendChild(row);
  }

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
    <div style="opacity:.75;">下注用 Token：${tokenAddress}</div>
    <hr/>
    <div style="margin-bottom:8px;"><b>選項</b></div>
    <ol>${options.map((o, idx) => `<li>${idx}: ${escapeHtml(o)}</li>`).join("")}</ol>
  `;

  if (status === 1) {
    html += `<div style="margin-top:10px;">答案：<b>${winningOption.toString()}</b>（${escapeHtml(options[Number(winningOption)]||"")}）</div>`;
    html += `
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnClaim">Claim（中獎領獎）</button>
        <button id="btnRefund">Refund（無人中獎退款）</button>
      </div>
    `;
  } else {
    // Open：下注區（含 Approve）
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
        ｜ Approve 會一次授權 <b>${CONFIG.approveAmountRaw}</b> raw
      </div>
    `;

    $("detail").innerHTML = html;

    // bind
    $("btnApprove").onclick = async () => approve();
    $("btnBet").onclick = async () => bet(qid);

    // 預設：如果 allowance > 0 就可以直接 bet（仍然會在 bet() 再檢查一次）
    return;
  }

  $("detail").innerHTML = html;

  if (status === 1) {
    $("btnClaim").onclick = () => claim(qid);
    $("btnRefund").onclick = () => refund(qid);
  }

  if (isOwner) $("resolveQid").value = String(qid);
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
    log("❌ Approve 失敗：" + (e?.shortMessage || e?.message || e));
    alert("Approve 失敗：" + (e?.shortMessage || e?.message || e));
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
    if (amount <= 0n) return alert("金額要 > 0");

    // 先檢查 allowance
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
    log("❌ 下注失敗：" + (e?.shortMessage || e?.message || e));
    alert("下注失敗：" + (e?.shortMessage || e?.message || e));
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
    log("❌ Claim 失敗：" + (e?.shortMessage || e?.message || e));
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
    log("❌ Refund 失敗：" + (e?.shortMessage || e?.message || e));
  }
}

// 你原本的 createQuestion / resolve 綁定保持不變（或你已經有）
window.addEventListener("DOMContentLoaded", () => {
  $("btnConnect").onclick = connect;

  // 若你原本已有 createQuestion/resolve 的 function，保持原本即可
  if ($("btnCreate")) $("btnCreate").onclick = window.createQuestionFromUI || (() => alert("請確認 app.js 有 createQuestionFromUI()"));
  if ($("btnResolve")) $("btnResolve").onclick = window.resolveFromUI || (() => alert("請確認 app.js 有 resolveFromUI()"));

  $("adminBox").style.display = "none";
});
