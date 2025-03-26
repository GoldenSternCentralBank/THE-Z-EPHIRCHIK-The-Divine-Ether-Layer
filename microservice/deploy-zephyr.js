import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function main() {
  // Configuration
  const PROVIDER_URL = process.env.PROVIDER_URL;
  const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
  
  if (!PROVIDER_URL || !WALLET_PRIVATE_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
  }
  
  // Initialize provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
  const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
  
  console.log(`Summoning Zephyr with the power of: ${wallet.address}`);
  
  // Get contract factory
  const contractJson = JSON.parse(fs.readFileSync('./artifacts/contracts/ZephyrWrapper.sol/ZephyrWrapper.json', 'utf8'));
  const ContractFactory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
  
  // Deploy contract
  const hermesAddress = wallet.address; // Initially set to deployer, can be changed later
  
  const contract = await ContractFactory.deploy(hermesAddress);
  
  console.log(`Zephyr has manifested at: ${contract.address}`);
  console.log('Waiting for the divine winds to settle...');
  
  await contract.deployed();
  
  console.log('Zephyr is now ready to serve!');
  console.log(`Hermes Address: ${hermesAddress}`);
  
  // Update .env file with contract address
  const envContent = fs.readFileSync('./.env', 'utf8');
  const updatedEnvContent = envContent.replace(
    /ZEPHYR_CONTRACT_ADDRESS=.*/,
    `ZEPHYR_CONTRACT_ADDRESS=${contract.address}`
  );
  fs.writeFileSync('./.env', updatedEnvContent);
  
  console.log('The sacred scrolls (.env) have been updated with Zephyr\'s address');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Divine error:', error);
    process.exit(1);
  });
