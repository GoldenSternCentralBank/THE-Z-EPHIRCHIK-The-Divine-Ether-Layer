# THE (Z) EFIRCHIK: The Divine Ether Layer

A mythological bridge between mortal backends and the divine blockchain realm.

## Divine Architecture

This protocol consists of:

1. **Zephyr Contract**: The divine wind that carries tokens between realms  
2. **Hermes Microservice**: The messenger that delivers news between gods and mortals

## Sacred Security Features

- Olympian communication only through the sacred localhost  
- Divine API keys for authentication  
- Rate limiting to prevent mortal DoS attacks  
- Input validation on all offerings  
- Reentrancy protection against trickster titans  
- Secure key management for the divine treasury

## Summoning Instructions

### Prerequisites

- Node.js v16+ (blessed by Apollo)  
- npm or yarn (woven by Athena)  
- Hardhat (forged by Hephaestus)  
- Access to Ethereum or Binance Smart Chain (realms of the gods)

### Divine Configuration

Copy the sacred scroll template and inscribe your divine secrets:

```bash
cp microservice/.env.example microservice/.env
```

Required inscriptions:
- `SERVICE_PORT`: Portal for Hermes  
- `MAIN_BACKEND_PORT`: Portal for the Oracle  
- `API_KEY`: Sacred words for authentication  
- `PROVIDER_URL`: Path to the divine realm  
- `ZEPHYR_CONTRACT_ADDRESS`: Where Zephyr dwells  
- `WALLET_PRIVATE_KEY`: Key to the divine treasury

### Summoning Zephyr

1. Summon Zephyr  
2. Record Zephyr's location in the sacred scrolls (.env)

### Awakening Hermes

1. Prepare the messenger's tools:
```bash
cd microservice
npm install
```

2. Awaken the messenger:
```bash
node index.js
```

## Divine Endpoints

### Hermes Endpoints

| Method | Path                  | Description                            |
|--------|-----------------------|----------------------------------------|
| `GET`  | `/health`             | Check if Olympus is in harmony         |
| `POST` | `/bless-with-tokens`  | Bestow tokens upon a mortal            |
| `POST` | `/bless-token`        | Add a token to the divine registry     |
| `POST` | `/unbless-token`      | Remove a token from the divine registry|
| `GET`  | `/divine-tokens`      | View the tokens blessed by Olympus     |

All endpoints (except `/health`) require a divine API key in the `x-api-key` header.

### Zephyr Contract Functions

- `offerTokens(address tokenAddress, uint256 amount, string calldata txHash)`: Mortals offer tokens to the gods (Do not forget to increaseAllowance of custom token for Zephyr Contract) 
- `blessWithTokens(address tokenAddress, address mortal, uint256 amount, string calldata reference)`: Gods bless mortals with tokens  
- `blessToken(address tokenAddress)`: Zeus blesses a new token  
- `unBlessToken(address tokenAddress)`: Zeus removes blessing from a token

## Integration with the Oracle (Main Backend)

The Oracle should:

1. Listen for offerings at `POST /token-received`  
2. Command Hermes to bestow blessings when appropriate

## Working with Divine Tokens

To use a token with this divine system:

1. Bless the token:
```bash
curl -X POST http://127.0.0.1:3001/bless-token   -H "Content-Type: application/json"   -H "x-api-key: your-divine-key"   -d '{"tokenAddress": "0x..."}'
```

2. For mortals to make offerings:
   - They must first seek approval from the token  
   - Then make an offering to Zephyr

3. To bestow blessings upon mortals:
```bash
curl -X POST http://127.0.0.1:3001/bless-with-tokens   -H "Content-Type: application/json"   -H "x-api-key: your-divine-key"   -d '{"tokenAddress": "0x...", "recipient": "0x...", "amount": "100", "reference": "divine123"}'
```

## Divine Warnings

- Never expose Hermes to the mortal internet  
- Rotate divine keys with the phases of the moon  
- Only bless tokens forged by trusted deities  
- Watch for unusual patterns in the divine flow  
- Guard the keys to Olympus with your life
