/* global ethers */

const CONFIG = {
  // 你的下注合約（InternalGuessGame）
  guessAddress: "0x483aee89c55737eceaab61c4ffe0e74b0f88e4a8",

  // A方案：不要從 guess.betToken() 讀，直接固定用你自己知道的 KGIT token address
  tokenAddress: "0x07e7AF255D6e349a9E8fDC2D5ecB0479C6641945",

  // 只接受 Sepolia
  requiredChainId: 11155111,
};

const GuessABI = [
  // views
  "function questionsCount() view returns (uint256)",
  "function getQuestion(uint256 questionId) view returns (string text, string[] options, uint8 status, uint256 winningOption, uint256 totalPool)",
  "function optionsCount(uint256 questionId) view returns (uint256)",

  // user/admin actions (我們不做 owner 檢核，直接讓你按就送交易)
  "function createQuestion(string text, string[] options) returns (uint256)",
  "function resolve(uint256 questionId, uint256 winningOptionId)",
  "function bet(uint256 questionId, uint256 optionId, uint256 amount)",
  "function claim(uint256 questionId)",
  "function refund(uint256 questionId)",

  // helpful public mappings (optional, 有就讀)
  "function totalStakedPerOption(uint256 questionId, uint256 optionId) view returns (uint256)",
  "function userStake(uint256 questionId, address user, uint256 optionId) view returns (uint256)",
];

const ERC20ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
];

let provider, signer, userAddress;
let guessRead, guessWrite, tokenRead, tokenWrite;

const $ = (id) => document.getElementById(id);

function setText(id, text, cls) {
  const el = $(id);
  el.className = cls || "";
  el.textContent = text;
}

function fmtAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function parseOptionsCSV(s) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function statusLabel(statusU8) {
  // 你的合約 enum Status { Open=0, Resolved=1 }
  if (Number(statusU8) === 0) return "Open";
  if (Number(statusU8) === 1) return "Resolved";
  return `Unknown(${statusU8})`;
}

async function requireEvm() {
  if (!window.ethereum) throw new Error("MetaMask 未安裝或未啟用");
}

async function connect() {
  try {
    await requireEvm();
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    userAddress = ethers.getAddress(accounts[0]);
    signer = await provider.getSigner();

    const net = await provider.getNetwork();
    setText("connStatus", `✅ 已連線錢包：${userAddress}`, "ok");
    setText("chainStatus", `chainId: 0x${net.chainId.toString(16)}（${Number(net.chainId)}）`, "muted");

    if (Number(net.chainId) !== CONFIG.requiredChainId) {
      setText("chainStatus", `❌ 請切到 Sepolia（11155111），目前是 ${Number(net.chainId)}`, "err");
      return;
    }

    // contracts
    guessRead = new ethers.Contract(CONFIG.guessAddress, GuessABI, provider);
    guessWrite = new ethers.Contract(CONFIG.guessAddress, GuessABI, signer);

    tokenRead = new ethers.Contract(CONFIG.tokenAddress, ERC20ABI, provider);
    tokenWrite = new ethers.Contract(CONFIG.tokenAddress, ERC20ABI, signer);

    await loadQuestions();
  } catch (e) {
    setText("connStatus", `❌ ${e.message || e}`, "err");
  }
}

async function loadQuestions() {
  try {
    const count = await guessRead.questionsCount();
    setText("qCount", `questionsCount = ${count}`, "muted");

    const qList = $("qList");
    qList.innerHTML = "";

    const n = Number(count);
    for (let i = 0; i < n; i++) {
      const [text, options, statusU8, winningOptionId, totalPool] = await guessRead.getQuestion(i);

      const btn = document.createElement("button");
      btn.onclick = () => showQuestion(i);

      const st = statusLabel(statusU8);
      btn.innerHTML = `<div><b>Q${i}</b> <span class="pill">${st}</span></div><div class="muted small">${text}</div>`;
      qList.appendChild(btn);
    }

    if (n === 0) {
      qList.innerHTML = `<div class="muted" style="padding:12px;">目前沒有題目（可以用右側出題新增）</div>`;
    } else {
      // 預設顯示第一題
      await showQuestion(0);
    }
  } catch (e) {
    $("qList").innerHTML = `<div class="err" style="padding:12px;">❌ 讀取題目失敗：${e.message || e}</div>`;
  }
}

async function showQuestion(questionId) {
  const wrap = $("qDetail");
  wrap.innerHTML = "載入中…";

  try {
    const [text, options, statusU8, winningOptionId, totalPool] = await guessRead.getQuestion(questionId);
    const st = statusLabel(statusU8);

    // token symbol（拿得到就顯示，拿不到也不影響）
    let sym = "TOKEN";
    try { sym = await tokenRead.symbol(); } catch (_) {}

    const optionsHtml = options
      .map((opt, idx) => `<div>${idx}: ${opt}</div>`)
      .join("");

    let answerHtml = "";
    if (st === "Resolved") {
      const w = Number(winningOptionId);
      const wText = options[w] ?? "";
      answerHtml = `<div style="margin-top:10px;"><b>答案：</b>${w}（${wText}）</div>`;
    }

    // --- betting UI ---
    const canBet = (st === "Open");

    const betUI = canBet
      ? `
        <hr />
        <h3 style="margin:10px 0;">下注</h3>
        <div class="grid2">
          <div>
            <div class="muted small">選項（輸入 optionId）</div>
            <input id="betOptionId" type="number" min="0" step="1" value="0" />
          </div>
          <div>
            <div class="muted small">下注金額（A方案：直接用 raw，不管 decimals）</div>
            <input id="betAmount" type="number" min="1" step="1" value="100" />
          </div>
        </div>

        <div class="actions">
          <button id="btnApprove">1) Approve</button>
          <button id="btnBet">2) Bet</button>
        </div>

        <div id="betStatus" class="muted small" style="margin-top:10px;"></div>
      `
      : `
        <hr />
        <h3 style="margin:10px 0;">已公布（不可下注）</h3>
        <div class="actions">
          <button id="btnClaim">Claim（如果你押中）</button>
          <button id="btnRefund">Refund（如果無人中獎）</button>
        </div>
        <div id="settleStatus" class="muted small" style="margin-top:10px;"></div>
      `;

    wrap.innerHTML = `
      <div style="font-size:36px; font-weight:900;">${text}</div>

      <div class="kv" style="margin-top:12px;">
        <div class="muted">questionId</div><div>${questionId}</div>
        <div class="muted">狀態</div><div><b>${st}</b></div>
        <div class="muted">總池（raw）</div><div><b>${totalPool.toString()}</b> ${sym}</div>
      </div>

      <div style="margin-top:12px;">
        <div class="muted"><b>選項</b></div>
        <div style="margin-top:6px;">${optionsHtml}</div>
        ${answerHtml}
      </div>

      ${betUI}
    `;

    // bind buttons
    if (canBet) {
      $("btnApprove").onclick = async () => approveThenStatus(questionId);
      $("btnBet").onclick = async () => doBet(questionId);
    } else {
      $("btnClaim").onclick = async () => doClaim(questionId);
      $("btnRefund").onclick = async () => doRefund(questionId);
    }
  } catch (e) {
    wrap.innerHTML = `<div class="err">❌ 題目載入失敗：${e.message || e}</div>`;
  }
}

async function approveThenStatus(questionId) {
  try {
    const amount = BigInt($("betAmount").value || "0");
    if (amount <= 0n) throw new Error("amount 必須 > 0");

    setText("betStatus", "送出 approve 交易中…", "muted");
    const tx = await tokenWrite.approve(CONFIG.guessAddress, amount);
    setText("betStatus", `approve tx: ${tx.hash}（等待確認…）`, "muted");
    await tx.wait();
    setText("betStatus", "✅ approve 完成，現在可以按 Bet", "ok");
  } catch (e) {
    setText("betStatus", `❌ approve 失敗：${e.message || e}`, "err");
  }
}

async function doBet(questionId) {
  try {
    const optionId = BigInt($("betOptionId").value || "0");
    const amount = BigInt($("betAmount").value || "0");
    if (amount <= 0n) throw new Error("amount 必須 > 0");

    setText("betStatus", "送出 bet 交易中…", "muted");
    const tx = await guessWrite.bet(BigInt(questionId), optionId, amount);
    setText("betStatus", `bet tx: ${tx.hash}（等待確認…）`, "muted");
    await tx.wait();
    setText("betStatus", "✅ bet 完成", "ok");

    // refresh
    await showQuestion(questionId);
    await loadQuestions();
  } catch (e) {
    setText("betStatus", `❌ bet 失敗：${e.message || e}`, "err");
  }
}

async function doClaim(questionId) {
  try {
    setText("settleStatus", "送出 claim 交易中…", "muted");
    const tx = await guessWrite.claim(BigInt(questionId));
    setText("settleStatus", `claim tx: ${tx.hash}（等待確認…）`, "muted");
    await tx.wait();
    setText("settleStatus", "✅ claim 完成", "ok");
  } catch (e) {
    setText("settleStatus", `❌ claim 失敗：${e.message || e}`, "err");
  }
}

async function doRefund(questionId) {
  try {
    setText("settleStatus", "送出 refund 交易中…", "muted");
    const tx = await guessWrite.refund(BigInt(questionId));
    setText("settleStatus", `refund tx: ${tx.hash}（等待確認…）`, "muted");
    await tx.wait();
    setText("settleStatus", "✅ refund 完成", "ok");
  } catch (e) {
    setText("settleStatus", `❌ refund 失敗：${e.message || e}`, "err");
  }
}

async function createQuestion() {
  try {
    const text = $("newText").value.trim();
    const options = parseOptionsCSV($("newOptions").value);

    if (!text) throw new Error("題目文字不能空");
    if (options.length < 2) throw new Error("選項至少 2 個（用逗號分隔）");

    setText("createStatus", "送出 createQuestion 交易中…", "muted");
    const tx = await guessWrite.createQuestion(text, options);
    setText("createStatus", `createQuestion tx: ${tx.hash}（等待確認…）`, "muted");
    await tx.wait();

    setText("createStatus", "✅ 出題成功（已上鏈）", "ok");

    // refresh
    $("newText").value = "";
    $("newOptions").value = "";
    await loadQuestions();
  } catch (e) {
    // 這裡如果看到 missing revert data，通常是「合約 ABI/函式簽名不一致」或「合約本身 revert 沒理由」
    setText("createStatus", `❌ 出題失敗：${e.shortMessage || e.message || e}`, "err");
  }
}

// UI bind
$("btnConnect").onclick = connect;
$("btnCreate").onclick = createQuestion;
