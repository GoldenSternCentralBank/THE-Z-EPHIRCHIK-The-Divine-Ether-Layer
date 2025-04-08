// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ZephyrWrapper
 * @dev Wrapper contract to interact with any BEP20/ERC20 token
 * Light as Zephyr, the god of the west wind
 */
contract ZephyrWrapper is Pausable, Ownable, ReentrancyGuard {
    // Events
    event Offering(address indexed mortal, address indexed tokenAddress, uint256 amount, string txHash);
    event Blessing(address indexed mortal, address indexed tokenAddress, uint256 amount, string referenceId);
    
    // Mapping to prevent transaction hash reuse
    mapping(string => bool) private _processedOfferings;
    
    // Authorized messenger address (Hermes)
    address private _hermesAddress;
    
    // Divine tokens mapping (approved by Olympus)
    mapping(address => bool) private _divineTokens;
    
    /**
     * @dev Constructor
     */
    constructor(address hermesAddress) Ownable(msg.sender) {
        require(hermesAddress != address(0), "Hermes address cannot be zero");
        _hermesAddress = hermesAddress;
    }
    
    /**
     * @dev Modifier to check if caller is the authorized messenger
     */
    modifier onlyHermes() {
        require(msg.sender == _hermesAddress, "Only Hermes may deliver this message");
        _;
    }
    
    /**
     * @dev Modifier to check if token is divine
     */
    modifier onlyDivineToken(address tokenAddress) {
        require(_divineTokens[tokenAddress], "This token is not blessed by Olympus");
        _;
    }
    
    /**
     * @dev Add a divine token
     * @param tokenAddress The address of the token to bless
     */
    function blessToken(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Cannot bless the void");
        _divineTokens[tokenAddress] = true;
    }
    
    /**
     * @dev Remove a divine token
     * @param tokenAddress The address of the token to unbless
     */
    function unBlessToken(address tokenAddress) external onlyOwner {
        _divineTokens[tokenAddress] = false;
    }
    
    /**
     * @dev Check if a token is divine
     * @param tokenAddress The address of the token to check
     */
    function isTokenDivine(address tokenAddress) external view returns (bool) {
        return _divineTokens[tokenAddress];
    }
    
    /**
     * @dev Update the Hermes address
     * @param newHermesAddress The address of the new messenger
     */
    function appointNewHermes(address newHermesAddress) external onlyOwner {
        require(newHermesAddress != address(0), "Cannot appoint the void as Hermes");
        _hermesAddress = newHermesAddress;
    }
    
    /**
     * @dev Pause contract functions
     */
    function sleepOfZeus() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract functions
     */
    function awakeningOfZeus() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Check if Zeus is sleeping
     */
    function isZeusSleeping() external view returns (bool) {
        return paused();
    }
    
    /**
     * @dev Receive tokens as an offering and emit an event for Hermes to pick up
     * @param tokenAddress The address of the token
     * @param amount Amount of tokens to offer
     * @param txHash Transaction hash for reference
     */
    function offerTokens(
        address tokenAddress, 
        uint256 amount, 
        string calldata txHash
    ) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyDivineToken(tokenAddress) 
    {
        require(amount > 0, "Offerings must have value");
        require(!_processedOfferings[txHash], "This offering has already been recorded");
        
        // Mark offering as processed
        _processedOfferings[txHash] = true;
        
        // Get token contract
        IERC20 token = IERC20(tokenAddress);
        
        // Transfer tokens from mortal to divine realm
        uint256 balanceBefore = token.balanceOf(address(this));
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "The offering was rejected");
        
        // Verify the transfer actually happened
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter >= balanceBefore + amount, "The offering amount is suspicious");
        
        // Emit event for Hermes to pick up
        emit Offering(msg.sender, tokenAddress, amount, txHash);
    }
    
    /**
     * @dev Bless a mortal with tokens (only callable by Hermes)
     * @param tokenAddress The address of the token
     * @param mortal Address to receive tokens
     * @param amount Amount of tokens to bestow
     * @param referenceId Divine reference for the blessing
     */
    function blessWithTokens(
        address tokenAddress,
        address mortal, 
        uint256 amount, 
        string calldata referenceId
    ) 
        external 
        onlyHermes 
        whenNotPaused 
        nonReentrant 
        onlyDivineToken(tokenAddress)
    {
        require(mortal != address(0), "Cannot bless the void");
        require(amount > 0, "Blessings must have value");
        
        // Get token contract
        IERC20 token = IERC20(tokenAddress);
        
        // Check divine reserves
        require(token.balanceOf(address(this)) >= amount, "Not enough divine power for this blessing");
        
        // Transfer tokens from divine realm to mortal
        bool success = token.transfer(mortal, amount);
        require(success, "The blessing was interrupted");
        
        // Emit event
        emit Blessing(mortal, tokenAddress, amount, referenceId);
    }
    
    /**
     * @dev Recover any tokens accidentally sent to this contract
     * @param tokenAddress The address of the token to recover
     * @param amount The amount to recover
     */
    function recoverLostOfferings(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        token.transfer(owner(), amount);
    }
}
