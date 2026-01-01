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

  } catch (err) {
    document.getElementById("qc").textContent = "❌ 讀合約失敗：" + (err.message || err);
    console.error(err);
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
});
