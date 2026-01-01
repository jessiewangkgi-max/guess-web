const GUESS_ADDRESS = "0x483aee89c55737eceaab61c4ffe0e74b0f88e4a8";

let provider, signer, me, guessSigner, guessRead;
let currentQid = 0;

function set(id, text) {
  document.getElementById(id).textContent = text;
}
function show(id, yes) {
  document.getElementById(id).style.display = yes ? "" : "none";
}

async function connect() {
  try {
    if (!window.ethereum) {
      alert("請先安裝 MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    me = accounts[0];

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const network = await provider.getNetwork();

    set("msg", "✅ 已連線錢包：" + me);
    set("chain", `目前 chainId：${chainIdHex}（ethers 看到的是 ${network.chainId.toString()}）`);

    if (chainIdHex !== "0xaa36a7") {
      set("qc", "❌ 請切到 Sepolia 再讀合約");
      return;
    }

    // read & signer contract
    guessRead = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, provider);
    guessSigner = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, signer);

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

  const count = await guessRead.questionsCount();
  set("qc", `✅ 合約題目數量 questionsCount = ${count.toString()}`);

  if (count === 0n) {
    document.getElementById("ui").innerHTML = "（目前沒有題目）";
    return;
  }

  // 先固定顯示第 0 題（後面再做列表）
  currentQid = 0;
  const q = await guessRead.getQuestion(currentQid);

  const text = q[0];
  const options = q[1];
  const status = Number(q[2]); // 0 Open, 1 Resolved
  const win = Number(q[3]);
  const totalPoolRaw = q[4].toString();

  const statusText = status === 0 ? "Open（可下注）" : "Resolved（已公布，不可下注）";

  // UI 顯示
  const lines = [];
  lines.push(`<h2>Q${currentQid}: ${text}</h2>`);
  lines.push(`<div>狀態：<b>${statusText}</b></div>`);
  lines.push(`<div>總池（raw）：${totalPoolRaw}</div>`);
  lines.push(`<div style="margin-top:8px;"><b>選項：</b></div>`);
  lines.push(`<ol>` + options.map((o, i) => `<li>${i}: ${o}</li>`).join("") + `</ol>`);

  if (status === 1) {
    lines.push(`<div><b>答案：</b>${win}（${options[win]}）</div>`);

    const alreadyClaimed = await guessRead.claimed(currentQid, me);

    if (alreadyClaimed) {
      lines.push(`<div style="color:green;">你已經領過（claimed=true）</div>`);
    } else {
      const myWinStake = await guessRead.userStake(currentQid, me, win);
      if (myWinStake > 0n) {
        lines.push(`<div style="color:green;">你押中答案，stake(raw)=${myWinStake.toString()}，可以 Claim</div>`);
        show("btnClaim", true);
      } else {
        lines.push(`<div style="color:#999;">你沒有押中答案（或未下注）</div>`);
        // refund 只有「無人中獎」才會成功；先給你按鈕也行，但我先保守顯示
        show("btnRefund", true);
      }
    }
  } else {
    lines.push(`<div style="color:#999;">（Open 題目：下注 UI 下一步加）</div>`);
  }

  document.getElementById("ui").innerHTML = lines.join("\n");
}

async function claimNow() {
  try {
    set("txmsg", "送出 Claim 交易中…");
    const tx = await guessSigner.claim(currentQid);
    set("txmsg", "等待鏈上確認… tx=" + tx.hash);
    await tx.wait();
    set("txmsg", "✅ Claim 成功");
    await render();
  } catch (err) {
    set("txmsg", "❌ Claim 失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

async function refundNow() {
  try {
    set("txmsg", "送出 Refund 交易中…");
    const tx = await guessSigner.refund(currentQid);
    set("txmsg", "等待鏈上確認… tx=" + tx.hash);
    await tx.wait();
    set("txmsg", "✅ Refund 成功");
    await render();
  } catch (err) {
    set("txmsg", "❌ Refund 失敗：" + (err.shortMessage || err.message || err));
    console.error(err);
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
  document.getElementById("btnClaim").onclick = claimNow;
  document.getElementById("btnRefund").onclick = refundNow;
});
