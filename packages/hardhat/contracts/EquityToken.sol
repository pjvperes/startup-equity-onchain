// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EquityToken is ERC20Burnable, ReentrancyGuard {
    IERC20 public usdcToken;
    event EquityPurchased(address indexed buyer, uint tokensAmount);
    event DismissProposalCreated(uint proposalId, address proposalTarget);
    event AddProposalCreated(uint proposalId, address proposalTarget);
    event VoteCast(uint proposalId, address voter);

    address[] public partners;
    address public founder;
    mapping(address => PartnerDetails) public partnersDetails;
    mapping(address => SellEquityDetails) public sellEquityDetails;
    mapping(uint => DismissProposal) public dismissProposals;
    mapping(uint => AddProposal) public addProposals;
    mapping(address => uint256) public withdrawnUSDT; // Novo mapeamento para rastrear o valor retirado por cada usuário
    uint public nextProposalId;
    address USDTAddress;

    struct PartnerDetails {
        uint partnershipStartDate;
        uint totalTokensAmount;
        uint claimedTokensAmount;
        uint cliffPeriod;
        uint vestingPeriod;
    }

    struct SellEquityDetails {
        address seller;
        uint tokensAmount;
        uint price;
        address buyer;
        bool active;
    }

    struct DismissProposal {
        address proposalTarget;
        bool executed;
        address[] partnersFor;
        mapping(address => bool) hasVoted;
    }

    struct AddProposal {
        address proposalTarget;
        uint tokensAmount;
        uint cliffPeriod;
        uint vestingPeriod;
        bool executed;
        address[] partnersFor;
        mapping(address => bool) hasVoted;
    }

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        founder = tx.origin;
        usdcToken = IERC20(USDTAddress);
    }

    function decimals() public view virtual override returns (uint8) {
        return 2;
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
    
        // Exige que vestingPeriod seja diferente de 0
        if (partnerDetails.vestingPeriod == 0) {
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

    function sellEquity(uint _tokensAmount, uint _price) external nonReentrant {
        require(_tokensAmount > 0, "Invalid token amount");
        require(_price > 0, "Invalid price");
        require(balanceOf(msg.sender) >= _tokensAmount, "Insufficient balance");

        _transfer(msg.sender, address(this), _tokensAmount);
        sellEquityDetails[msg.sender] = SellEquityDetails(msg.sender, _tokensAmount, _price, address(0), true);
    }

    function buyEquity(address _seller) external nonReentrant {
        SellEquityDetails storage offerDetails = sellEquityDetails[_seller];
        require(offerDetails.active == true, "Invalid token amount");

        uint equivalentUsdcAmount = offerDetails.tokensAmount * offerDetails.price * 100;

        require(usdcToken.transferFrom(msg.sender, offerDetails.seller, equivalentUsdcAmount), "USDC transfer failed");
        transfer(msg.sender, offerDetails.tokensAmount);

        offerDetails.buyer = msg.sender;
        offerDetails.active = false;
        partners.push(msg.sender);
        emit EquityPurchased(msg.sender, offerDetails.tokensAmount);
    }

    function cancelSellEquity() external {
        SellEquityDetails storage offerDetails = sellEquityDetails[msg.sender];
        require(offerDetails.active, "No active sell offer");
        
        _transfer(address(this), msg.sender, offerDetails.tokensAmount);
        
        offerDetails.active = false;
    }

    function createDismissProposal (address _partner) public {
        require(msg.sender == founder || balanceOf(msg.sender) > 0, "Only partners or the founder can create proposals");
        require(_partner != address(0), "Invalid partner address");

        DismissProposal storage proposal = dismissProposals[nextProposalId];
        proposal.proposalTarget = _partner;
        proposal.executed = false;

        emit DismissProposalCreated(nextProposalId, _partner);
        nextProposalId++;
    }

    function voteDismissProposal (uint _id) public {
        require(msg.sender == founder || balanceOf(msg.sender) > 0, "Only partners or the founder can vote");
        require(_id < nextProposalId, "Proposal ID does not exist");
        DismissProposal storage proposal = dismissProposals[_id];
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "You have already voted on this proposal");

        proposal.hasVoted[msg.sender] = true;
        proposal.partnersFor.push(msg.sender);

        // Calculating total tokens voted for the proposal
        uint totalVotesFor = 0;
        for (uint i = 0; i < proposal.partnersFor.length; i++) {
            address voter = proposal.partnersFor[i];
            totalVotesFor += balanceOf(voter);
        }

        // Checking if the total votes for are more than 50% of the total token supply
        if (totalVotesFor > totalSupply() / 2) {
            proposal.executed = true;  // Mark the proposal as executed before dismissal to prevent reentrancy
            dismissPartner(_id);  // Call the function to execute dismissal
        }

        emit VoteCast(_id, msg.sender);
    }

    function dismissPartner(uint _id) internal {
        DismissProposal storage proposal = dismissProposals[_id];
        PartnerDetails storage partnerDetails = partnersDetails[proposal.proposalTarget];

        require(partnerDetails.claimedTokensAmount == 0, "Partner has already claimed tokens");
        _burn(proposal.proposalTarget, balanceOf(proposal.proposalTarget));
        
        delete partnersDetails[proposal.proposalTarget];
        for (uint i = 0; i < partners.length; i++) {
            if (partners[i] == proposal.proposalTarget) {
                partners[i] = partners[partners.length - 1];
                partners.pop();
                break;
            }
        }
    }

    function createAddProposal(address _partner, uint _tokensAmount, uint _cliffPeriod, uint _vestingPeriod) public {
        require(msg.sender == founder || balanceOf(msg.sender) > 0, "Only partners or the founder can create proposals");
        require(_partner != address(0), "Invalid partner address");

        if (partners.length == 0) {
            require(msg.sender == founder, "Only the founder can add the first partner.");

            addPartnerInternal(_partner, _tokensAmount, _cliffPeriod, _vestingPeriod);
        } else {
            AddProposal storage proposal = addProposals[nextProposalId];
            proposal.proposalTarget = _partner;
            proposal.tokensAmount = _tokensAmount;
            proposal.cliffPeriod = _cliffPeriod;
            proposal.vestingPeriod = _vestingPeriod;
            proposal.executed = false;

            emit AddProposalCreated(nextProposalId, _partner);
            nextProposalId++;
        }
    }

    function voteAddProposal (uint _id) public {
        require(msg.sender == founder || balanceOf(msg.sender) > 0, "Only partners or the founder can vote");
        require(_id < nextProposalId, "Proposal ID does not exist");
        AddProposal storage proposal = addProposals[_id];
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "You have already voted on this proposal");
    
        proposal.hasVoted[msg.sender] = true;
        proposal.partnersFor.push(msg.sender);
    
        // Calculating total tokens voted for the proposal
        uint totalVotesFor = 0;
        for (uint i = 0; i < proposal.partnersFor.length; i++) {
            address voter = proposal.partnersFor[i];
            totalVotesFor += balanceOf(voter);
        }
    
        // Checking if the total votes for are more than 50% of the total token supply
        if (totalVotesFor > totalSupply() / 2) {
            proposal.executed = true;  // Mark the proposal as executed before addition to prevent reentrancy
            // Call the function to execute addition
            addPartnerInternal(proposal.proposalTarget, proposal.tokensAmount, proposal.cliffPeriod, proposal.vestingPeriod);
        }
    
        emit VoteCast(_id, msg.sender);
    }

    function addPartnerInternal(address _partner, uint _totalTokensAmount, uint _cliffPeriod, uint _vestingPeriod) internal {
        require(_partner != address(0), "Invalid partner address");
        require(_totalTokensAmount > 0, "Invalid tokens amount");
        require(_cliffPeriod <= _vestingPeriod, "Cliff period must be less than or equal to vesting period");

        partners.push(_partner);
        partnersDetails[_partner] = PartnerDetails(block.timestamp, _totalTokensAmount, 0, _cliffPeriod, _vestingPeriod);

        if (_cliffPeriod == 0 && _vestingPeriod == 0) {
            _mint(_partner, _totalTokensAmount);
        }
    }

    function getPartners() external view returns (address[] memory) {
        return partners;
    }

    function getAllSellEquityDetails() external view returns (SellEquityDetails[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < partners.length; i++) {
            if (sellEquityDetails[partners[i]].active) {
                count++;
            }
        }

        SellEquityDetails[] memory activeSellEquityDetails = new SellEquityDetails[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < partners.length; i++) {
            if (sellEquityDetails[partners[i]].active) {
                activeSellEquityDetails[index] = sellEquityDetails[partners[i]];
                index++;
            }
        }

        return activeSellEquityDetails;
    }

    function withdrawUSDT() external nonReentrant {
        uint256 balance = balanceOf(msg.sender);
        require(balance > 0, "You have no tokens");

        uint256 totalSupply = totalSupply();
        uint256 usdtBalance = usdcToken.balanceOf(address(this));
        uint256 withdrawAmount = (usdtBalance * balance) / totalSupply;
        
        require(withdrawnUSDT[msg.sender] + withdrawAmount <= usdtBalance * balance / totalSupply, "You have already withdrawn your full share");

        withdrawnUSDT[msg.sender] += withdrawAmount;
        require(usdcToken.transfer(msg.sender, withdrawAmount), "USDT transfer failed");
    }
}
