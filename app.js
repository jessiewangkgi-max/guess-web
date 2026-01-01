const GUESS_ADDRESS = "0x483aee89c55737eceaab61c4ffe0e74b0f88e4a8";

let provider, signer, me;
let guessRead, guessSigner, token;
let tokenDecimals = 0;
let currentQid = 0;

function set(id, text) { document.getElementById(id).textContent = text; }
function show(id, yes) { document.getElementById(id).style.display = yes ? "" : "none"; }

async function connect() {
  try {
    if (!window.ethereum) { alert("請先安裝 MetaMask"); return; }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    me = accounts[0];

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    set("msg", "✅ 已連線錢包：" + me);
    set("chain", "chainId: " + chainIdHex);

    if (chainIdHex !== "0xaa36a7") {
      set("qc", "❌ 請切到 Sepolia");
      return;
    }

    guessRead = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, provider);
    guessSigner = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, signer);

    // 讀 betToken
    const tokenAddr = await guessRead.betToken();
    token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
    tokenDecimals = await token.decimals();

    await render();

  } catch (err) {
    set("txmsg", "❌ " + (err.message || err));
    console.error(err);
  }
}

async function render() {
  set("txmsg", "");
  show("btnClaim", false);
  show("btnRefund", false);
  show("betUI", false);

  const count = await guessRead.questionsCount();
  set("qc", `題目數量 = ${count.toString()}`);

  if (count === 0n) return;

  currentQid = 0;
  const q = await guessRead.getQuestion(currentQid);

  const text = q[0];
  const options = q[1];
  const status = Number(q[2]);
  const win = Number(q[3]);

  const lines = [];
  lines.push(`<h2>${text}</h2>`);
  lines.push(`<div>狀態：${status === 0 ? "Open" : "Resolved"}</div>`);
  lines.push(`<ol>` + options.map((o,i)=>`<li>${i}: ${o}</li>`).join("") + `</ol>`);

  document.getElementById("ui").innerHTML = lines.join("");

  if (status === 0) {
    // Open：顯示下注 UI
    const sel = document.getElementById("betOpt");
    sel.innerHTML = options.map((o,i)=>`<option value="${i}">${i}: ${o}</option>`).join("");
    show("betUI", true);
  } else {
    // Resolved
    lines.push(`<div>答案：${win}（${options[win]}）</div>`);
    document.getElementById("ui").innerHTML = lines.join("");
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
    await render();

  } catch (err) {
    set("txmsg", "❌ 下注失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
  document.getElementById("btnBet").onclick = betNow;
});
