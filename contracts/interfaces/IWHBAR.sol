pragma solidity >=0.5.0;

interface IWHBAR {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
    function approve(address to, uint256 amount) external returns (bool);
}
