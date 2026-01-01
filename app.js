async function connect() {
  try {
    if (!window.ethereum) {
      alert("請先安裝 MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const addr = accounts[0];

    // 讀 chainId（hex）
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });

    // ethers provider
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork(); // 有些錢包會回傳數字 chainId

    document.getElementById("msg").textContent = "✅ 已連線錢包：" + addr;
    document.getElementById("chain").textContent =
      `目前 chainId：${chainIdHex}（ethers 看到的是 ${network.chainId.toString()}）`;

  } catch (err) {
    document.getElementById("msg").textContent = "❌ 連線失敗：" + err.message;
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
});
