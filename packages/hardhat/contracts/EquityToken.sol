// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract EquityToken is ERC20Burnable {

    function decimals() public view virtual override returns (uint8) {
        return 2;
    }

    address[] public partners;
    address public founder;
    mapping(address => PartnerDetails) public partnersDetails;

    struct PartnerDetails {
        uint partnershipStartDate;
        uint totalTokensAmount;
        uint claimedTokensAmount;
        uint cliffPeriod;
        uint vestingPeriod;
    }

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        founder = tx.origin;
    }

    function addPartner(address _partner, uint _totalTokensAmount, uint _cliffPeriod, uint _vestingPeriod) external {
        if (partners.length == 0) {
            require(msg.sender == founder, "Only the founder can add the first partner.");
        }
        require(_partner != address(0), "Invalid partner address");
        require(_totalTokensAmount > 0, "Invalid tokens amount");
        require(_cliffPeriod <= _vestingPeriod, "Cliff period must be less than or equal to vesting period");

        partners.push(_partner);
        partnersDetails[_partner] = PartnerDetails(block.timestamp, _totalTokensAmount, _cliffPeriod, _vestingPeriod);

        if (_cliffPeriod == 0 && _vestingPeriod == 0) {
            _mint(_partner, _totalTokensAmount);
        }
    }

    function claimEquity() external {
        PartnerDetails storage partnerDetails = partnersDetails[msg.sender];
        require(partnerDetails.totalTokensAmount > 0, "You are not a partner");
        require(partnerDetails.claimedTokensAmount < partnerDetails.totalTokensAmount, "You have already claimed all your tokens");

        uint tokensToClaim = calculateClaimableTokens(msg.sender) - partnerDetails.claimedTokensAmount;
        partnerDetails.claimedTokensAmount += tokensToClaim;
        _mint(msg.sender, tokensToClaim);
    }

    function calculateClaimableTokens(address _partner) public view returns (uint) {
        PartnerDetails storage partnerDetails = partnersDetails[_partner];
        if (partnerDetails.claimedTokensAmount == partnerDetails.totalTokensAmount) {
            return 0;
        }

        uint tokensToClaim = 0;
        uint vestingPeriod = partnerDetails.vestingPeriod;
        uint cliffPeriod = partnerDetails.cliffPeriod;
        uint totalTokensAmount = partnerDetails.totalTokensAmount;
        uint partnershipStartDate = partnerDetails.partnershipStartDate;

        if (block.timestamp >= partnershipStartDate + cliffPeriod) {
            uint elapsedPeriods = ((block.timestamp - partnershipStartDate - cliffPeriod) * 10000) / vestingPeriod; //Razao entre o tempo decorrido e o tempo total para receber 100% do equity. Valor de 0 a 10.000 em que indica a % de tokens que você tem direito a receber
            tokensToClaim = totalTokensAmount * elapsedPeriods / 10000;
        }

        return tokensToClaim;
    }
}
