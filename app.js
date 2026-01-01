const GUESS_ADDRESS = "0x483aee89c55737eceaab61c4ffe0e74b0f88e4a8";

async function connect() {
  try {
    if (!window.ethereum) {
      alert("請先安裝 MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const addr = accounts[0];

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    document.getElementById("msg").textContent = "✅ 已連線錢包：" + addr;
    document.getElementById("chain").textContent =
      `目前 chainId：${chainIdHex}（ethers 看到的是 ${network.chainId.toString()}）`;

    if (chainIdHex !== "0xaa36a7") {
      document.getElementById("qc").textContent = "❌ 請切到 Sepolia 再讀合約";
      return;
    }

    const guess = new ethers.Contract(GUESS_ADDRESS, GUESS_ABI, provider);

    const count = await guess.questionsCount();
    document.getElementById("qc").textContent =
      `✅ 合約題目數量 questionsCount = ${count.toString()}`;

    if (count === 0n) {
      document.getElementById("q0").textContent = "（目前沒有題目）";
      return;
    }

    // 先讀第 0 題
    const q = await guess.getQuestion(0);

    const text = q[0];
    const options = q[1];
    const status = Number(q[2]); // 0 Open, 1 Resolved
    const winningOption = q[3].toString();
    const totalPool = q[4].toString();

    const statusText = status === 0 ? "Open（可下注）" : "Resolved（已公布，不可下注）";

    const lines = [];
    lines.push(`questionId: 0`);
    lines.push(`text: ${text}`);
    lines.push(`status: ${statusText}`);
    lines.push(`winningOptionId: ${winningOption}`);
    lines.push(`totalPool(raw): ${totalPool}`);
    lines.push(`options:`);
    options.forEach((o, i) => lines.push(`  ${i}: ${o}`));

    document.getElementById("q0").textContent = lines.join("\n");

  } catch (err) {
    document.getElementById("q0").textContent = "❌ 讀合約失敗：" + (err.message || err);
    console.error(err);
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
});
