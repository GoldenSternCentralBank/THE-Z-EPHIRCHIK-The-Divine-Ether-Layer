import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { zephyrAbi } from './zephyrAbi.js';
import { tokenAbi } from './tokenAbi.js';

const TRDB_PATH = './trdb.json';
const DIVINE_TOKENS_CACHE_PATH = './divineTokensCache.json';

/**
 * Load the transaction database from file.
 */
function loadTransactionDB() {
  if (!fs.existsSync(TRDB_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(TRDB_PATH, 'utf-8'));
  } catch (error) {
    console.error('Error loading transaction DB:', error.message);
    return [];
  }
}

/**
 * Save the transaction database to file.
 */
function saveTransactionDB(data) {
  fs.writeFileSync(TRDB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Check if a transaction already exists in the database.
 */
function transactionExists(txHash, db) {
  return db.some(tx => tx.txHash === txHash);
}

/**
 * Append a new transaction to the file storage.
 */
function appendTransaction(txData) {
  const db = loadTransactionDB();
  // Only add if this tx hash does not exist.
  if (!transactionExists(txData.txHash, db)) {
    db.push(txData);
    saveTransactionDB(db);
    console.log(`[FILE] Saved transaction ${txData.txHash} to ${TRDB_PATH}`);
  } else {
    console.log(`[FILE] Transaction ${txData.txHash} already exists in ${TRDB_PATH}`);
  }
}

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.SERVICE_PORT || 3001;
const MAIN_BACKEND_PORT = process.env.MAIN_BACKEND_PORT || 3000;
const MAIN_BACKEND_URL = `http://127.0.0.1:${MAIN_BACKEND_PORT}`;
const API_KEY = process.env.API_KEY || 'default-secure-api-key';
const PROVIDER_URL = process.env.PROVIDER_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545/';
const WS_PROVIDER_URL = process.env.WS_PROVIDER_URL; // Optional WebSocket provider
const ZEPHYR_CONTRACT_ADDRESS = process.env.ZEPHYR_CONTRACT_ADDRESS;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

// Initialize Express app
const app = express();
app.use(helmet());
app.use(express.json());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const validateApiKey = (req, res, next) => {
  const providedApiKey = req.headers['x-api-key'];
  if (!providedApiKey || providedApiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
};

// Blockchain provider and wallet (JSON-RPC for write operations)
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
const zephyrContract = new ethers.Contract(ZEPHYR_CONTRACT_ADDRESS, zephyrAbi, wallet);

/**
 * Load divine tokens cache from file.
 */
function loadDivineTokensCache() {
  if (!fs.existsSync(DIVINE_TOKENS_CACHE_PATH)) {
    console.warn('Divine tokens cache file not found, initializing empty cache.');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(DIVINE_TOKENS_CACHE_PATH, 'utf-8'));
  } catch (error) {
    console.error('Error loading divine tokens cache:', error.message);
    return {};
  }
}

/**
 * Save divine tokens cache to file with current cache state.
 */
function saveDivineTokensCache() {
  try {
    fs.writeFileSync(DIVINE_TOKENS_CACHE_PATH, JSON.stringify(divineTokensCache, null, 2));
    console.log('Divine tokens cache saved.');
  } catch (error) {
    console.error('Error saving divine tokens cache:', error.message);
  }
}

// Initialize the divine tokens cache on startup
let divineTokensCache = loadDivineTokensCache();

/**
 * Check if a token is divine and update cache.
 */
async function isTokenDivine(tokenAddress) {
  if (divineTokensCache[tokenAddress] !== undefined) {
    return divineTokensCache[tokenAddress];
  }
  try {
    const isDivine = await zephyrContract.isTokenDivine(tokenAddress);
    divineTokensCache[tokenAddress] = isDivine;
    saveDivineTokensCache(); // Save cache after updating
    return isDivine;
  } catch (error) {
    console.error(`Error checking if token ${tokenAddress} is divine:`, error.message);
    return false;
  }
}

/**
 * Get token decimals.
 */
async function getTokenDecimals(tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
    return await tokenContract.decimals();
  } catch (error) {
    console.error(`Error getting decimals for token ${tokenAddress}:`, error.message);
    return 18; // default to 18 decimals
  }
}

/**
 * Function to listen for Offering events (saving transactions upon receipt).
 * Uses a WebSocket provider if available; otherwise, falls back to JSON-RPC.
 */
function listenForOfferings() {
  let eventProvider;
  if (WS_PROVIDER_URL) {
    console.log(`Connecting via WebSocket: ${WS_PROVIDER_URL}`);
    eventProvider = new ethers.WebSocketProvider(WS_PROVIDER_URL);
  } else {
    console.log('No WS_PROVIDER_URL provided, using JSON-RPC provider for events');
    eventProvider = new ethers.JsonRpcProvider(PROVIDER_URL);
  }
  
  // Connect to the zephyr contract using the event provider
  const zephyr = new ethers.Contract(ZEPHYR_CONTRACT_ADDRESS, zephyrAbi, eventProvider);
  
  console.log('Hermes is listening for offerings...');
  
  zephyr.on('Offering', async (mortal, tokenAddress, amount, txHash, event) => {
    console.log(`Offering received: ${amount} of token ${tokenAddress} from ${mortal}, txHash: ${txHash}`);
    
    try {
      // Get token decimals to format the received amount
      const decimals = await getTokenDecimals(tokenAddress);
      const formattedAmount = ethers.formatUnits(amount, decimals);
      
      // Build the transaction data to be saved
      const txData = {
        timestamp: Date.now(),
        from: mortal,
        tokenAddress,
        amount: amount.toString(),
        formattedAmount,
        txHash
      };
      
      // Save the transaction data to file
      appendTransaction(txData);
      
      // Notify the main backend about the received tokens
      await axios.post(`${MAIN_BACKEND_URL}/token-received`, {
        sender: mortal,
        tokenAddress,
        amount: amount.toString(),
        formattedAmount,
        txHash,
        timestamp: new Date().toISOString()
      }, {
        headers: { 'x-api-key': API_KEY }
      });
      
      console.log('Oracle notified successfully');
    } catch (error) {
      console.error('Error in event handling:', error.message);
    }
  });
}

// API endpoints for blessing tokens (omitting unchanged routes for brevity)
app.post('/bless-with-tokens', validateApiKey, async (req, res) => {
  try {
    const { tokenAddress, recipient, amount, reference } = req.body;
    if (!ethers.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    if (!ethers.isAddress(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const isDivine = await isTokenDivine(tokenAddress);
    if (!isDivine) {
      return res.status(400).json({ error: 'Token not blessed by Olympus' });
    }
    const decimals = await getTokenDecimals(tokenAddress);
    const amountInWei = ethers.parseUnits(amount, decimals);
    const tx = await zephyrContract.blessWithTokens(tokenAddress, recipient, amountInWei, reference);
    const receipt = await tx.wait();
    console.log(`Blessing bestowed: ${amount} of token ${tokenAddress} to ${recipient}, txHash: ${receipt.hash}`);
    return res.status(200).json({
      success: true,
      tokenAddress,
      recipient,
      amount,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Error bestowing blessing:', error.message);
    return res.status(500).json({ error: 'Failed to bestow blessing', details: error.message });
  }
});

app.post('/bless-token', validateApiKey, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    if (!ethers.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    const isDivine = await isTokenDivine(tokenAddress);
    if (isDivine) {
      return res.status(400).json({ error: 'Token already blessed' });
    }
    const tx = await zephyrContract.blessToken(tokenAddress);
    const receipt = await tx.wait();
    // Instead of deleting from the cache, add the token as divine.
    divineTokensCache[tokenAddress] = true;
    saveDivineTokensCache();
    console.log(`Token ${tokenAddress} has been blessed, txHash: ${receipt.hash}`);
    return res.status(200).json({
      success: true,
      tokenAddress,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Error blessing token:', error.message);
    return res.status(500).json({ error: 'Failed to bless token', details: error.message });
  }
});

app.post('/unbless-token', validateApiKey, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    if (!ethers.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }
    const isDivine = await isTokenDivine(tokenAddress);
    if (!isDivine) {
      return res.status(400).json({ error: 'Token not blessed' });
    }
    const tx = await zephyrContract.unBlessToken(tokenAddress);
    const receipt = await tx.wait();
    // Remove token from cache to force re-check on next operation
    delete divineTokensCache[tokenAddress];
    saveDivineTokensCache();
    console.log(`Token ${tokenAddress} has been unblessed, txHash: ${receipt.hash}`);
    return res.status(200).json({
      success: true,
      tokenAddress,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error('Error unblessing token:', error.message);
    return res.status(500).json({ error: 'Failed to unbless token', details: error.message });
  }
});

app.get('/divine-tokens', validateApiKey, async (req, res) => {
  try {
    const tokens = Object.keys(divineTokensCache).filter(token => divineTokensCache[token]);
    return res.status(200).json({
      success: true,
      divineTokens: tokens,
    });
  } catch (error) {
    console.error('Error getting divine tokens:', error.message);
    return res.status(500).json({ error: 'Failed to get divine tokens', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Olympus is in harmony' });
});

// Start the server and begin listening for events
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Hermes messenger running at http://127.0.0.1:${PORT}`);
  listenForOfferings();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, saving divine tokens cache and shutting down');
  saveDivineTokensCache(); // Save the cache before exiting
  process.exit(0);
});
