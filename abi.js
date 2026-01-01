// InternalGuessGame 最小可用 ABI（讀題目）
const GUESS_ABI = [
  {
    "type": "function",
    "name": "questionsCount",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getQuestion",
    "inputs": [{ "name": "questionId", "type": "uint256" }],
    "outputs": [
      { "name": "text", "type": "string" },
      { "name": "options", "type": "string[]" },
      { "name": "status", "type": "uint8" },
      { "name": "winningOption", "type": "uint256" },
      { "name": "totalPool", "type": "uint256" }
    ],
    "stateMutability": "view"
  }
];
