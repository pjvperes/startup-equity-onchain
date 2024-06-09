"use client";

import React, { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import EquityTokenABI from "../utils/EquityToken.json";
import EquityTokenFactoryABI from "../utils/EquityTokenFactory.json";
import { ethers } from "ethers";

const ExistingStartup: React.FC = () => {
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [equityTokenContract, setEquityTokenContract] = useState<ethers.Contract | null>(null);
  const [usdtContract, setUsdtContract] = useState<ethers.Contract | null>(null);
  const [factoryAddress] = useState<string>("0x5fCE1B63c9A7a9d07D52a01b6260Ba390e3d84de");
  const [usdtAddress] = useState<string>("0x6972577bCE333b688385f278E76F026bBF904D13");
  const [startupId, setStartupId] = useState<number | null>(null);
  const [equityTokenAddress, setEquityTokenAddress] = useState<string | null>(null);
  const [partners, setPartners] = useState<{ address: string; equity: number }[]>([]);
  const [proposals, setProposals] = useState<{ id: number; description: string }[]>([]);
  const [equityOffers, setEquityOffers] = useState<{ address: string; tokens: string; price: string }[]>([]);
  const [sellTokensAmount, setSellTokensAmount] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [proposalIdToVote, setProposalIdToVote] = useState<number | null>(null);
  const [proposalTypeToVote, setProposalTypeToVote] = useState<string>("dismiss");
  const [buySellerAddress, setBuySellerAddress] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(true);
  const [startupName, setStartupName] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [userTokens, setUserTokens] = useState<number>(0);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [usdtBalance, setUsdtBalance] = useState<number>(0);
  const [newPartnerAddress, setNewPartnerAddress] = useState<string>("");
  const [newPartnerTokens, setNewPartnerTokens] = useState<number>(0);
  const [newPartnerCliff, setNewPartnerCliff] = useState<number>(0);
  const [newPartnerVesting, setNewPartnerVesting] = useState<number>(0);
  const [dismissPartnerAddress, setDismissPartnerAddress] = useState<string>("");

  useEffect(() => {
    const connectWallet = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        setSigner(signer);

        const factoryContract = new ethers.Contract(factoryAddress, EquityTokenFactoryABI.abi, signer);
        const usdtContract = new ethers.Contract(
          usdtAddress,
          ["function balanceOf(address) view returns (uint256)"],
          signer,
        );
        setFactoryContract(factoryContract);
        setUsdtContract(usdtContract);
      } else {
        setMessage("Please install MetaMask");
      }
    };

    connectWallet();
  }, []);

  const connectContract = async () => {
    if (factoryContract && startupId !== null && signer) {
      try {
        const equityTokenAddress = await factoryContract.getCompanyAddress(startupId);
        const equityTokenContract = new ethers.Contract(equityTokenAddress, EquityTokenABI.abi, signer);
        setEquityTokenContract(equityTokenContract);
        setEquityTokenAddress(equityTokenAddress);

        const startupName = await equityTokenContract.name();
        const tokenSymbol = await equityTokenContract.symbol();
        setStartupName(startupName);
        setTokenSymbol(tokenSymbol);

        const address = await signer.getAddress();
        const userTokens = await equityTokenContract.balanceOf(address);
        const totalSupply = await equityTokenContract.totalSupply();

        const decimals = await equityTokenContract.decimals();
        setUserTokens(Number(ethers.utils.formatUnits(userTokens, decimals)));
        setTotalSupply(Number(ethers.utils.formatUnits(totalSupply, decimals)));

        await getPartners(equityTokenContract, decimals, totalSupply);
        await getEquityOffers(equityTokenContract, decimals);
        await getProposals(equityTokenContract);
        await getUsdtBalance(equityTokenAddress);

        setShowModal(false);
      } catch (error) {
        if (error instanceof Error) {
          setMessage("Error connecting to contract: " + error.message);
        } else {
          setMessage("Error connecting to contract");
        }
      }
    } else {
      setMessage("Please enter a valid startup ID and connect your wallet first");
    }
  };

  const getPartners = async (equityTokenContract: ethers.Contract, decimals: number, totalSupply: ethers.BigNumber) => {
    try {
      const partnersAddresses = await equityTokenContract.getPartners();
      const formattedTotalSupply = Number(ethers.utils.formatUnits(totalSupply, decimals));

      const partnersWithEquity = await Promise.all(
        partnersAddresses.map(async (address: string) => {
          const balance = await equityTokenContract.balanceOf(address);
          const formattedBalance = Number(ethers.utils.formatUnits(balance, decimals));
          const equity = (formattedBalance / formattedTotalSupply) * 100;
          return { address, equity };
        }),
      );

      setPartners(partnersWithEquity);
    } catch (error) {
      console.error("Error retrieving partners:", error);
    }
  };

  const getEquityOffers = async (equityTokenContract: ethers.Contract, decimals: number) => {
    try {
      const offers = await equityTokenContract.getAllSellEquityDetails();
      const formattedOffers = offers.map((offer: any) => ({
        address: offer.seller,
        tokens: ethers.utils.formatUnits(offer.tokensAmount, decimals),
        price: ethers.utils.formatUnits(offer.price, decimals) + " USDT",
      }));

      setEquityOffers(formattedOffers);
    } catch (error) {
      console.error("Error retrieving equity offers:", error);
    }
  };

  const getProposals = async (equityTokenContract: ethers.Contract) => {
    try {
      const nextProposalId = await equityTokenContract.nextProposalId();
      const proposalsList = [];

      for (let i = 0; i < nextProposalId; i++) {
        const dismissProposal = await equityTokenContract.dismissProposals(i);
        const addProposal = await equityTokenContract.addProposals(i);
        if (dismissProposal.proposalTarget !== ethers.constants.AddressZero) {
          proposalsList.push({ id: i, description: `Dismiss Proposal for: ${dismissProposal.proposalTarget}` });
        } else if (addProposal.proposalTarget !== ethers.constants.AddressZero) {
          proposalsList.push({ id: i, description: `Add Proposal for: ${addProposal.proposalTarget}` });
        }
      }

      setProposals(proposalsList);
    } catch (error) {
      console.error("Error retrieving proposals:", error);
    }
  };

  const getUsdtBalance = async (equityTokenAddress: string) => {
    try {
      const balance = await usdtContract!.balanceOf(equityTokenAddress);
      setUsdtBalance(Number(ethers.utils.formatUnits(balance, 6)));
    } catch (error) {
      console.error("Error retrieving USDT balance:", error);
    }
  };

  const claimEquity = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const tx = await equityTokenContract.claimEquity();
      await tx.wait();
      setMessage("Equity claimed successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error claiming equity: " + error.message);
      } else {
        setMessage("Error claiming equity");
      }
    }
  };

  const claimRealYields = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const tx = await equityTokenContract.withdrawUSDT();
      await tx.wait();
      setMessage("Real yields claimed successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error claiming real yields: " + error.message);
      } else {
        setMessage("Error claiming real yields");
      }
    }
  };

  const voteForProposal = async () => {
    if (!equityTokenContract || proposalIdToVote === null) {
      setMessage("Please connect to the contract and enter a proposal ID to vote");
      return;
    }
    try {
      let tx;
      if (proposalTypeToVote === "dismiss") {
        tx = await equityTokenContract.voteDismissProposal(proposalIdToVote);
      } else {
        tx = await equityTokenContract.voteAddProposal(proposalIdToVote);
      }
      await tx.wait();
      setMessage(`Vote cast for proposal ${proposalIdToVote} successfully`);
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error voting for proposal: " + error.message);
      } else {
        setMessage("Error voting for proposal");
      }
    }
  };

  const sellEquity = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const tx = await equityTokenContract.sellEquity(
        ethers.utils.parseUnits(sellTokensAmount.toString(), 2),
        ethers.utils.parseUnits(sellPrice.toString(), 2),
      );
      await tx.wait();
      setMessage("Equity offer created successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error creating equity offer: " + error.message);
      } else {
        setMessage("Error creating equity offer");
      }
    }
  };

  const createAddProposal = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const tx = await equityTokenContract.createAddProposal(
        newPartnerAddress,
        ethers.utils.parseUnits(newPartnerTokens.toString(), 2),
        newPartnerCliff,
        newPartnerVesting,
      );
      await tx.wait();
      setMessage("Add proposal created successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error creating add proposal: " + error.message);
      } else {
        setMessage("Error creating add proposal");
      }
    }
  };

  const createDismissProposal = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const tx = await equityTokenContract.createDismissProposal(dismissPartnerAddress);
      await tx.wait();
      setMessage("Dismiss proposal created successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error creating dismiss proposal: " + error.message);
      } else {
        setMessage("Error creating dismiss proposal");
      }
    }
  };

  const buyEquity = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const tx = await equityTokenContract.buyEquity(buySellerAddress);
      await tx.wait();
      setMessage("Equity purchased successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error purchasing equity: " + error.message);
      } else {
        setMessage("Error purchasing equity");
      }
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-base-100 p-6 rounded-lg shadow-md w-96">
              <h2 className="font-bold text-lg mb-4">Connect to Startup</h2>
              <input
                type="number"
                placeholder="Startup ID"
                value={startupId ?? ""}
                onChange={e => setStartupId(Number(e.target.value))}
                className="input input-bordered w-full mb-4"
              />
              <button onClick={connectContract} className="btn btn-primary w-full">
                Connect Contract
              </button>
              <p className="mt-4 text-red-500">{message}</p>
            </div>
          </div>
        )}
        {!showModal && (
          <>
            {equityTokenAddress && (
              <div className="card bg-base-100 p-6 rounded-lg shadow-md my-6">
                <h2 className="font-bold text-lg mb-4">About the startup</h2>
                <div className="mb-2">
                  <span className="font-bold">Startup Name:</span> {startupName}
                </div>
                <div className="mb-2">
                  <span className="font-bold">Token Symbol:</span> {tokenSymbol}
                </div>
                <div className="flex items-center mb-2">
                  <span className="text-green-500 mr-2">&#x25CF;</span>
                  <span className="font-bold">Contract Address:</span>
                </div>
                <div>
                  <span>{equityTokenAddress}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card bg-base-100 p-6 rounded-lg shadow-md">
                <h2 className="font-bold text-lg mb-4">Partners</h2>
                <table className="table-auto w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Partner Address</th>
                      <th className="px-4 py-2">% Equity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((partner, index) => (
                      <tr key={index}>
                        <td className="border px-4 py-2">{partner.address}</td>
                        <td className="border px-4 py-2">{partner.equity.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card bg-base-100 p-6 rounded-lg shadow-md">
                <h2 className="font-bold text-lg mb-4">My Equity</h2>
                <div className="mb-2">
                  <span className="font-bold">Your Tokens:</span> {userTokens.toFixed(2)}
                </div>
                <div className="mb-2">
                  <span className="font-bold">Your Equity:</span> {((userTokens / totalSupply) * 100).toFixed(2)}%
                </div>
                <div className="mb-4">
                  <span className="font-bold">USDT Balance in Contract:</span> {usdtBalance.toFixed(2)} USDT
                </div>
                <button onClick={claimEquity} className="btn btn-primary mb-2 w-full">
                  Claim Equity
                </button>
                <button onClick={claimRealYields} className="btn btn-primary w-full">
                  Claim Real Yields
                </button>
              </div>
              <div className="card bg-base-100 p-6 rounded-lg shadow-md">
                <h2 className="font-bold text-lg mb-4">Proposals</h2>
                <table className="table-auto w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">ID</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map(proposal => (
                      <tr key={proposal.id}>
                        <td className="border px-4 py-2">{proposal.id}</td>
                        <td className="border px-4 py-2">{proposal.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4">
                  <h3 className="font-bold text-lg mb-4">Vote for a Proposal</h3>
                  <label className="block mb-2">Proposal Type</label>
                  <select
                    value={proposalTypeToVote}
                    onChange={e => setProposalTypeToVote(e.target.value)}
                    className="select select-bordered w-full mb-2"
                  >
                    <option value="dismiss">Dismiss Proposal</option>
                    <option value="add">Add Proposal</option>
                  </select>
                  <label className="block mb-2">Proposal ID</label>
                  <input
                    type="number"
                    placeholder="Proposal ID"
                    value={proposalIdToVote ?? ""}
                    onChange={e => setProposalIdToVote(Number(e.target.value))}
                    className="input input-bordered w-full mb-2"
                  />
                  <button onClick={voteForProposal} className="btn btn-primary w-full">
                    Vote
                  </button>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-lg mb-4">Create Add Proposal</h3>
                  <label className="block mb-2">New Partner Address</label>
                  <input
                    type="text"
                    placeholder="Partner Address"
                    value={newPartnerAddress}
                    onChange={e => setNewPartnerAddress(e.target.value)}
                    className="input input-bordered w-full mb-2"
                  />
                  <label className="block mb-2">Tokens Amount</label>
                  <input
                    type="number"
                    placeholder="Tokens Amount"
                    value={newPartnerTokens}
                    onChange={e => setNewPartnerTokens(Number(e.target.value))}
                    className="input input-bordered w-full mb-2"
                  />
                  <label className="block mb-2">Cliff Period (in seconds)</label>
                  <input
                    type="number"
                    placeholder="Cliff Period"
                    value={newPartnerCliff}
                    onChange={e => setNewPartnerCliff(Number(e.target.value))}
                    className="input input-bordered w-full mb-2"
                  />
                  <label className="block mb-2">Vesting Period (in seconds)</label>
                  <input
                    type="number"
                    placeholder="Vesting Period"
                    value={newPartnerVesting}
                    onChange={e => setNewPartnerVesting(Number(e.target.value))}
                    className="input input-bordered w-full mb-2"
                  />
                  <button onClick={createAddProposal} className="btn btn-primary w-full">
                    Create Add Proposal
                  </button>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-lg mb-4">Create Dismiss Proposal</h3>
                  <label className="block mb-2">Partner Address to Dismiss</label>
                  <input
                    type="text"
                    placeholder="Partner Address"
                    value={dismissPartnerAddress}
                    onChange={e => setDismissPartnerAddress(e.target.value)}
                    className="input input-bordered w-full mb-2"
                  />
                  <button onClick={createDismissProposal} className="btn btn-primary w-full">
                    Create Dismiss Proposal
                  </button>
                </div>
              </div>
              <div className="card bg-base-100 p-6 rounded-lg shadow-md">
                <h2 className="font-bold text-lg mb-4">Equity Offers</h2>
                <table className="table-auto w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Address</th>
                      <th className="px-4 py-2">Tokens for Sale</th>
                      <th className="px-4 py-2">Price (USDT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equityOffers.map((offer, index) => (
                      <tr key={index}>
                        <td className="border px-4 py-2">{offer.address}</td>
                        <td className="border px-4 py-2">{offer.tokens}</td>
                        <td className="border px-4 py-2">{offer.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4">
                  <h3 className="font-bold text-lg mb-4">Sell Your Equity</h3>
                  <label className="block mb-2">Tokens Amount</label>
                  <input
                    type="number"
                    placeholder="Tokens Amount"
                    value={sellTokensAmount}
                    onChange={e => setSellTokensAmount(Number(e.target.value))}
                    className="input input-bordered w-full mb-2"
                  />
                  <label className="block mb-2">Price in USDT</label>
                  <input
                    type="number"
                    placeholder="Price in USDT"
                    value={sellPrice}
                    onChange={e => setSellPrice(Number(e.target.value))}
                    className="input input-bordered w-full mb-2"
                  />
                  <button onClick={sellEquity} className="btn btn-primary w-full">
                    Sell Equity
                  </button>
                </div>
                <div className="mt-4">
                  <h3 className="font-bold text-lg mb-4">Buy Equity</h3>
                  <label className="block mb-2">Seller Address</label>
                  <input
                    type="text"
                    placeholder="Seller Address"
                    value={buySellerAddress}
                    onChange={e => setBuySellerAddress(e.target.value)}
                    className="input input-bordered w-full mb-2"
                  />
                  <button onClick={buyEquity} className="btn btn-primary w-full">
                    Buy Equity
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        <p>{message}</p>
      </main>
    </div>
  );
};

export default ExistingStartup;
