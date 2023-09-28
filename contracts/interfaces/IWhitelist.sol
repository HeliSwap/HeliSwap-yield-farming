// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWhitelist {
    event TokenAdded(address token, string ipfsHash);

    event TokenRemoved(address token);

    function whbar() external view returns (address);

    function poolsFactory() external view returns (address);

    function whitelistedTokens(address) external view returns (string memory);

    function addToWhitelist(address _token, string memory ipfsHash) external;

    function removeFromWhitelist(address _token) external;
}
