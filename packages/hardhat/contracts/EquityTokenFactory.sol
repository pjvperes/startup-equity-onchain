// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EquityToken.sol";

contract EquityTokenFactory {
    event EquityTokenCreated(address indexed tokenAddress, address indexed founder);
    EquityToken[] public companyTokens;

    function foundCompany(string memory _name, string memory _symbol, address _usdcToken) external {
        EquityToken newToken = new EquityToken(_name, _symbol, _usdcToken);
        emit EquityTokenCreated(address(newToken), msg.sender);

        companyTokens.push(newToken);
    }

}
