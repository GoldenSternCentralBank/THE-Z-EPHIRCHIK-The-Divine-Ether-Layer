import express from 'express';
import { ethers } from 'ethers';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.SERVICE_PORT || 3001;
const MAIN_BACKEND_PORT = process.env.MAIN_BACKEND_PORT || 3000;
const MAIN_BACKEND_URL = `http://127.0.0.1:${MAIN_BACKEND_PORT}`;
const API_KEY = process.env.API_KEY || 'default-secure-api-key';
const PROVIDER_URL = process.env.PROVIDER_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/'; // BNB Testnet
const ZEPHYR_CONTRACT_ADDRESS = process.env.ZEPHYR_CONTRACT_ADDRESS;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Validate API key middleware
const validateApiKey = (req, res, next) => {
  const providedApiKey = req.headers['x-api-key'];
  
  if (!providedApiKey || providedApiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  next();
};

// Initialize blockchain provider and wallet
const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);

// Import ABI
import { zephyrAbi } from './zephyrAbi.js';
import { tokenAbi } from './tokenAbi.js';

const zephyrContract = new ethers.Contract(ZEPHYR_CONTRACT_ADDRESS, zephyrAbi, wallet);

// Divine tokens cache
let divineTokensCache = {};

// Function to check if a token is divine
async function isTokenDivine(tokenAddress) {
  if (divineTokensCache[tokenAddress] !== undefined) {
    return divineTokensCache[tokenAddress];
  }
  
  try {
    const isDivine = await zephyrContract.isTokenDivine(tokenAddress);
    divineTokensCache[tokenAddress] = isDivine;
    return isDivine;
  } catch (error) {
    console.error(`Error checking if token ${tokenAddress} is divine:`, error);
    return false;
  }
}

// Function to get token decimals
async function getTokenDecimals(tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
    return await tokenContract.decimals();
  } catch (error) {
    console.error(`Error getting decimals for token ${tokenAddress}:`, error);
    return 18; // Default to 18 decimals
  }
}

// Listen for token offering events from the Zephyr contract
async function listenForOfferings() {
  console.log('Hermes is listening for offerings...');
  
  zephyrContract.on('Offering', async (mortal, tokenAddress, amount, txHash, event) => {
    console.log(`Offering received: ${amount} of token ${tokenAddress} from ${mortal}, txHash: ${txHash}`);
    
    try {
      // Get token decimals
      const decimals = await getTokenDecimals(tokenAddress);
      const formattedAmount = ethers.utils.formatUnits(amount, decimals);
      
      // Notify main backend about the received tokens
      await axios.post(`${MAIN_BACKEND_URL}/token-received`, {
        sender: mortal,
        tokenAddress,
        amount: amount.toString(),
        formattedAmount,
        txHash,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      
      console.log('Oracle notified successfully');
    } catch (error) {
      console.error('Failed to notify Oracle:', error.message);
    }
  });
}

// API endpoint to bless mortals with tokens (called by main backend)
app.post('/bless-with-tokens', validateApiKey, async (req, res) => {
  try {
    const { tokenAddress, recipient, amount, reference } = req.body;
    
    // Validate inputs
    if (!ethers.utils.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    
    if (!ethers.utils.isAddress(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Check if token is divine
    const isDivine = await isTokenDivine(tokenAddress);
    if (!isDivine) {
      return res.status(400).json({ error: 'Token not blessed by Olympus' });
    }
    
    // Get token decimals
    const decimals = await getTokenDecimals(tokenAddress);
    
    // Convert amount to wei (or the appropriate denomination for the token)
    const amountInWei = ethers.utils.parseUnits(amount, decimals);
    
    // Call the Zephyr contract to bless with tokens
    const tx = await zephyrContract.blessWithTokens(tokenAddress, recipient, amountInWei, reference);
    const receipt = await tx.wait();
    
    console.log(`Blessing bestowed: ${amount} of token ${tokenAddress} to ${recipient}, txHash: ${receipt.transactionHash}`);
    
    return res.status(200).json({
      success: true,
      tokenAddress,
      recipient,
      amount,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Error bestowing blessing:', error);
    return res.status(500).json({ error: 'Failed to bestow blessing', details: error.message });
  }
});

// API endpoint to bless a token (admin only)
app.post('/bless-token', validateApiKey, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    
    // Validate inputs
    if (!ethers.utils.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    
    // Check if token is already divine
    const isDivine = await isTokenDivine(tokenAddress);
    if (isDivine) {
      return res.status(400).json({ error: 'Token already blessed' });
    }
    
    // Bless the token
    const tx = await zephyrContract.blessToken(tokenAddress);
    const receipt = await tx.wait();
    
    // Clear cache for this token
    delete divineTokensCache[tokenAddress];
    
    console.log(`Token ${tokenAddress} has been blessed, txHash: ${receipt.transactionHash}`);
    
    return res.status(200).json({
      success: true,
      tokenAddress,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Error blessing token:', error);
    return res.status(500).json({ error: 'Failed to bless token', details: error.message });
  }
});

// API endpoint to unbless a token (admin only)
app.post('/unbless-token', validateApiKey, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    
    // Validate inputs
    if (!ethers.utils.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    
    // Check if token is divine
    const isDivine = await isTokenDivine(tokenAddress);
    if (!isDivine) {
      return res.status(400).json({ error: 'Token not blessed' });
    }
    
    // Unbless the token
    const tx = await zephyrContract.unBlessToken(tokenAddress);
    const receipt = await tx.wait();
    
    // Clear cache for this token
    delete divineTokensCache[tokenAddress];
    
    console.log(`Token ${tokenAddress} has been unblessed, txHash: ${receipt.transactionHash}`);
    
    return res.status(200).json({
      success: true,
      tokenAddress,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Error unblessing token:', error);
    return res.status(500).json({ error: 'Failed to unbless token', details: error.message });
  }
});

// API endpoint to get divine tokens
app.get('/divine-tokens', validateApiKey, async (req, res) => {
  try {
    // This is a simplified implementation
    // In a production environment, you would need to implement a way to get all divine tokens
    return res.status(200).json({
      success: true,
      message: "This endpoint would return all divine tokens. Implementation depends on how you track divine tokens."
    });
  } catch (error) {
    console.error('Error getting divine tokens:', error);
    return res.status(500).json({ error: 'Failed to get divine tokens', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Olympus is in harmony' });
});

// Start the server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Hermes messenger running at http://127.0.0.1:${PORT}`);
  listenForOfferings().catch(console.error);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, Hermes is returning to Olympus');
  // Close any open connections, etc.
  process.exit(0);
});
