async function connect() {
  try {
    if (!window.ethereum) {
      alert("請先安裝 MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    const addr = accounts[0];
    document.getElementById("msg").textContent =
      "✅ 已連線錢包：" + addr;
  } catch (err) {
    document.getElementById("msg").textContent =
      "❌ 連線失敗：" + err.message;
  }
}

window.addEventListener("load", () => {
  document.getElementById("connectBtn").onclick = connect;
});
