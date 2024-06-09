// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EquityToken.sol";

contract EquityTokenFactory {
    event EquityTokenCreated(address indexed tokenAddress, address indexed founder, uint256 id);
    EquityToken[] public companyTokens;
    uint256 public nextId;

    function foundCompany(string memory _name, string memory _symbol) external returns(uint256) {
        EquityToken newToken = new EquityToken(_name, _symbol);
        companyTokens.push(newToken);
        uint256 newId = nextId;
        nextId++;

        emit EquityTokenCreated(address(newToken), msg.sender, newId);
        return newId;
    }

    function getNextId() external view returns (uint256) {
        return nextId;
    }

    function getCompanyAddress(uint256 _id) external view returns (address) {
        require(_id < companyTokens.length, "Company does not exist");
        return address(companyTokens[_id]);
    }
}
