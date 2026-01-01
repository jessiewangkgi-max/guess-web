const GUESS_ADDRESS = "0x483aee89c55737eceaab61c4ffe0e74b0f88e4a8";
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

let provider, signer, me;
let guessRead, guessSigner, token;
let tokenDecimals = 0;
let tokenSymbol = "";
let currentQid = 0;

function set(id, text) { document.getElementById(id).textContent = text; }
function show(id, yes) { document.getElementById(id).style.display = yes ? "" : "none"; }
function setHTML(id, html) { document.getElementById(id).innerHTML = html; }

async function connect() {
  try {
    if (!window.ethereum) { alert("請先安裝 MetaMask"); return; }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    me = accounts[0];

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    set("msg", "✅ 已連線錢包：" + me);
    set("chain", "chainId: " + chainIdHex);

    set("hint", "✅ 已連線（不檢核 owner，直接允許出題；若鏈上不允許會交易失敗）");

    if (chainIdHex !== SEPOLIA_CHAIN_ID_HEX) {
      setHTML("list", "❌ 請切到 Sepolia");
      setHTML("detail", "<div class='muted'>請切到 Sepolia 才能使用出題/下注</div>");
      return;
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    guessRead = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, provider);
    guessSigner = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, signer);

    // token
    const tokenAddr = await guessRead.betToken();
    token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
    tokenDecimals = await token.decimals();
    tokenSymbol = await token.symbol();
    document.getElementById("tokenSym").textContent = tokenSymbol ? `(${tokenSymbol})` : "";

    await loadList();
    const cnt = Number(await guessRead.questionsCount());
    if (cnt > 0) await renderDetail(0);

  } catch (err) {
    set("txmsg", "❌ " + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

async function loadList() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const count = Number(await guessRead.questionsCount());

  if (count === 0) {
    list.innerHTML = `<div class="muted">目前沒有題目</div>`;
    setHTML("detail", `<div class="muted">目前沒有題目，你可以直接出題</div>`);
    show("betUI", false);
    show("btnClaim", false);
    show("btnRefund", false);
    return;
  }

  for (let i = 0; i < count; i++) {
    const q = await guessRead.getQuestion(i);
    const statusText = Number(q[2]) === 0 ? "Open" : "Resolved";

    const div = document.createElement("div");
    div.className = "item" + (i === currentQid ? " active" : "");
    div.textContent = `Q${i} | ${statusText} | ${q[0]}`;
    div.onclick = () => renderDetail(i);
    list.appendChild(div);
  }
}

async function renderDetail(qid) {
  try {
    currentQid = qid;
    set("txmsg", "");

    show("betUI", false);
    show("btnClaim", false);
    show("btnRefund", false);

    await loadList();

    const q = await guessRead.getQuestion(qid);
    const text = q[0];
    const options = q[1];
    const status = Number(q[2]);
    const win = Number(q[3]);
    const totalPool = q[4];

    let html = `<h2>${text}</h2>`;
    html += `<div>狀態：<b>${status === 0 ? "Open" : "Resolved"}</b></div>`;
    html += `<div class="muted">總池（raw）：${totalPool.toString()}</div>`;
    html += `<ol>` + options.map((o,i)=>`<li>${i}: ${o}</li>`).join("") + `</ol>`;

    if (status === 0) {
      const sel = document.getElementById("betOpt");
      sel.innerHTML = options.map((o,i)=>`<option value="${i}">${i}: ${o}</option>`).join("");
      show("betUI", true);
    } else {
      html += `<div><b>答案：</b>${win}（${options[win]}）</div>`;

      const alreadyClaimed = await guessRead.claimed(qid, me);
      const totalWinStake = await guessRead.totalStakedPerOption(qid, win);

      if (alreadyClaimed) {
        html += `<div style="color:green;">你已經領過（claimed=true）</div>`;
      } else {
        const myWinStake = await guessRead.userStake(qid, me, win);
        if (myWinStake > 0n) {
          html += `<div style="color:green;">你押中答案，可 Claim</div>`;
          show("btnClaim", true);
        } else if (totalWinStake === 0n) {
          html += `<div class="muted">無人押中答案，可以 Refund</div>`;
          show("btnRefund", true);
        } else {
          html += `<div class="muted">你沒有押中（或未下注），且有人押中，因此不能 Refund</div>`;
        }
      }
    }

    setHTML("detail", html);
  } catch (err) {
    set("txmsg", "❌ render 失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

async function createQuestionNow() {
  try {
    const text = document.getElementById("newQText").value.trim();
    const raw = document.getElementById("newQOpts").value.trim();

    if (!text) { alert("請填題目"); return; }
    if (!raw) { alert("請填選項"); return; }

    const options = raw.split(",").map(s => s.trim()).filter(Boolean);
    if (options.length < 2) { alert("至少要 2 個選項"); return; }

    set("txmsg", "送出 createQuestion 交易中…");
    const tx = await guessSigner.createQuestion(text, options);
    set("txmsg", "等待確認… tx=" + tx.hash);
    await tx.wait();

    set("txmsg", "✅ 出題成功");

    const count = Number(await guessRead.questionsCount());
    await loadList();
    await renderDetail(count - 1);

  } catch (err) {
    set("txmsg", "❌ 出題失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

async function betNow() {
  try {
    const opt = Number(document.getElementById("betOpt").value);
    const amt = Number(document.getElementById("betAmt").value);
    if (!amt || amt <= 0) { alert("請輸入下注金額"); return; }

    const amount = BigInt(amt) * 10n ** BigInt(tokenDecimals);

    const allowance = await token.allowance(me, GUESS_ADDRESS);
    if (allowance < amount) {
      set("txmsg", "送出 approve…");
      const tx1 = await token.approve(GUESS_ADDRESS, amount);
      await tx1.wait();
    }

    set("txmsg", "送出 bet…");
    const tx2 = await guessSigner.bet(currentQid, opt, amount);
    await tx2.wait();

    set("txmsg", "✅ 下注成功");
    await renderDetail(currentQid);
  } catch (err) {
    set("txmsg", "❌ 下注失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

async function claimNow() {
  try {
    set("txmsg", "送出 claim…");
    const tx = await guessSigner.claim(currentQid);
    await tx.wait();
    set("txmsg", "✅ Claim 成功");
    await renderDetail(currentQid);
  } catch (err) {
    set("txmsg", "❌ Claim 失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

async function refundNow() {
  try {
    set("txmsg", "送出 refund…");
    const tx = await guessSigner.refund(currentQid);
    await tx.wait();
    set("txmsg", "✅ Refund 成功");
    await renderDetail(currentQid);
  } catch (err) {
    set("txmsg", "❌ Refund 失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
  document.getElementById("btnCreate").onclick = createQuestionNow;
  document.getElementById("btnBet").onclick = betNow;
  document.getElementById("btnClaim").onclick = claimNow;
  document.getElementById("btnRefund").onclick = refundNow;
});
