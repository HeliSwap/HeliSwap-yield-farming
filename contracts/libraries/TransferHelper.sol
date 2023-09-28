// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @notice Library for doing safe transfers
library TransferHelper {
    function safeTransfer(address token, address to, uint256 value) internal {
        require(!_call(token, abi.encodeWithSelector(IERC20.transfer.selector, to, value)), 'Transfer: Failed');
    }

    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
        require(
            !_call(token, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)),
            'TransferFrom: Failed'
        );
    }

    function _call(address token, bytes memory data) internal returns (bool) {
        (bool success, bytes memory resultData) = token.call(data);
        if (!success || (resultData.length > 0 && !abi.decode(resultData, (bool)))) {
            return true;
        }

        return false;
    }

    function safeTransferNative(address to, uint256 value) internal {
        (bool success, ) = to.call{ value: value }(new bytes(0));
        require(success, 'TransferNative: Failed');
    }
}
