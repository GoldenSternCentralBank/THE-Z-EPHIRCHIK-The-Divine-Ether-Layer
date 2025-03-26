// ABI for the Zephyr wrapper contract
export const zephyrAbi = [
  // Events
  "event Offering(address indexed mortal, address indexed tokenAddress, uint256 amount, string txHash)",
  "event Blessing(address indexed mortal, address indexed tokenAddress, uint256 amount, string reference)",
  
  // Functions
  "function offerTokens(address tokenAddress, uint256 amount, string calldata txHash) external",
  "function blessWithTokens(address tokenAddress, address mortal, uint256 amount, string calldata reference) external",
  "function blessToken(address tokenAddress) external",
  "function unBlessToken(address tokenAddress) external",
  "function isTokenDivine(address tokenAddress) external view returns (bool)",
  "function appointNewHermes(address newHermesAddress) external",
  "function sleepOfZeus() external",
  "function awakeningOfZeus() external",
  "function isZeusSleeping() external view returns (bool)"
];
