const GUESS_ADDRESS = "0x483aee89c55737eceaab61c4ffe0e74b0f88e4a8";

let provider, signer, me;
let guessRead, guessSigner, token;
let tokenDecimals = 0;

let currentQid = 0;

function set(id, text) { document.getElementById(id).textContent = text; }
function show(id, yes) { document.getElementById(id).style.display = yes ? "" : "none"; }

async function connect() {
  if (!window.ethereum) { alert("請先安裝 MetaMask"); return; }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  me = accounts[0];

  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  set("msg", "✅ 已連線錢包：" + me);
  set("chain", "chainId: " + chainIdHex);

  if (chainIdHex !== "0xaa36a7") {
    set("list", "❌ 請切到 Sepolia");
    return;
  }

  guessRead = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, provider);
  guessSigner = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, signer);

  const tokenAddr = await guessRead.betToken();
  token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
  tokenDecimals = await token.decimals();

  await loadList();
  await renderDetail(0);
}

async function loadList() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const count = Number(await guessRead.questionsCount());

  for (let i = 0; i < count; i++) {
    const q = await guessRead.getQuestion(i);
    const status = Number(q[2]) === 0 ? "Open" : "Resolved";

    const div = document.createElement("div");
    div.className = "item" + (i === currentQid ? " active" : "");
    div.textContent = `Q${i}｜${status}｜${q[0]}`;
    div.onclick = () => renderDetail(i);

    list.appendChild(div);
  }
}

async function renderDetail(qid) {
  currentQid = qid;
  show("betUI", false);
  show("btnClaim", false);
  show("btnRefund", false);
  set("txmsg", "");

  await loadList();

  const q = await guessRead.getQuestion(qid);
  const text = q[0];
  const options = q[1];
  const status = Number(q[2]);
  const win = Number(q[3]);

  let html = `<h2>${text}</h2>`;
  html += `<div>狀態：${status === 0 ? "Open" : "Resolved"}</div>`;
  html += `<ol>` + options.map((o,i)=>`<li>${i}: ${o}</li>`).join("") + `</ol>`;

  if (status === 0) {
    // Open → 下注
    const sel = document.getElementById("betOpt");
    sel.innerHTML = options.map((o,i)=>`<option value="${i}">${i}: ${o}</option>`).join("");
    show("betUI", true);
  } else {
    // Resolved → 顯示答案 / claim / refund
    html += `<div>答案：${win}（${options[win]}）</div>`;

    const claimed = await guessRead.claimed(qid, me);
    const totalWinStake = await guessRead.totalStakedPerOption(qid, win);

    if (!claimed) {
      const myWinStake = await guessRead.userStake(qid, me, win);
      if (myWinStake > 0n) {
        show("btnClaim", true);
      } else if (totalWinStake === 0n) {
        show("btnRefund", true);
      }
    }
  }

  document.getElementById("detail").innerHTML = html;
}

async function betNow() {
  const opt = Number(document.getElementById("betOpt").value);
  const amt = Number(document.getElementById("betAmt").value);
  if (!amt || amt <= 0) { alert("請輸入金額"); return; }

  const amount = BigInt(amt) * 10n ** BigInt(tokenDecimals);

  const allowance = await token.allowance(me, GUESS_ADDRESS);
  if (allowance < amount) {
    const tx1 = await token.approve(GUESS_ADDRESS, amount);
    await tx1.wait();
  }

  const tx2 = await guessSigner.bet(currentQid, opt, amount);
  await tx2.wait();

  await renderDetail(currentQid);
}

async function claimNow() {
  const tx = await guessSigner.claim(currentQid);
  await tx.wait();
  await renderDetail(currentQid);
}

async function refundNow() {
  const tx = await guessSigner.refund(currentQid);
  await tx.wait();
  await renderDetail(currentQid);
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
  document.getElementById("btnBet").onclick = betNow;
  document.getElementById("btnClaim").onclick = claimNow;
  document.getElementById("btnRefund").onclick = refundNow;
});
