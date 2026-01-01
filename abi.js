const GUESS_ABI = [
  {
  "type": "function",
  "name": "owner",
  "inputs": [],
  "outputs": [{ "type": "address" }],
  "stateMutability": "view"
},
{
  "type": "function",
  "name": "createQuestion",
  "inputs": [
    { "name": "text", "type": "string" },
    { "name": "options", "type": "string[]" }
  ],
  "outputs": [{ "type": "uint256" }],
  "stateMutability": "nonpayable"
},
  // ✅ 新增：betToken() getter
  {
    "type": "function",
    "name": "betToken",
    "inputs": [],
    "outputs": [{ "type": "address" }],
    "stateMutability": "view"
  },

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
    "name": "bet",
    "inputs": [
      { "name": "questionId", "type": "uint256" },
      { "name": "optionId", "type": "uint256" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
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

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];
