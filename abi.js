const GUESS_ABI = [
  // views
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
  },
  {
    "type": "function",
    "name": "totalStakedPerOption",
    "inputs": [
      { "name": "questionId", "type": "uint256" },
      { "name": "optionId", "type": "uint256" }
    ],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "userStake",
    "inputs": [
      { "name": "questionId", "type": "uint256" },
      { "name": "user", "type": "address" },
      { "name": "optionId", "type": "uint256" }
    ],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimed",
    "inputs": [
      { "name": "questionId", "type": "uint256" },
      { "name": "user", "type": "address" }
    ],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "view"
  },

  // tx
  {
    "type": "function",
    "name": "claim",
    "inputs": [{ "name": "questionId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "refund",
    "inputs": [{ "name": "questionId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];
