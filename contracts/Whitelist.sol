// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/IWhitelist.sol';
import './interfaces/IPoolsFactory.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title Whitelist
 * @dev Contract responsible for keeping the tokens approved in HeliSwap DEX
 * @author HeliSwap
 **/

contract Whitelist is Ownable, IWhitelist {
    address public immutable override whbar;

    // Used to validate if a token for whitelisting has a direct pool with WHBAR
    address public immutable override poolsFactory;

    mapping(address => string) public override whitelistedTokens;

    constructor(address _whbar, address _poolsFactory) {
        whbar = _whbar;
        poolsFactory = _poolsFactory;
    }

    /// @notice Add a token to the whitelist
    /// @param _token Token to be added
    /// @param _ipfsHash IPFS image
    function addToWhitelist(address _token, string calldata _ipfsHash) external override onlyOwner {
        require(
            IPoolsFactory(poolsFactory).getPair(_token, whbar) != address(0),
            'There is no a pool with Token:WHBAR'
        );

        whitelistedTokens[_token] = _ipfsHash;

        emit TokenAdded(_token, _ipfsHash);
    }

    /// @notice Remove a token from the whitelist
    /// @param _token Token to be removed
    function removeFromWhitelist(address _token) external override onlyOwner {
        delete whitelistedTokens[_token];
        emit TokenRemoved(_token);
    }
}
