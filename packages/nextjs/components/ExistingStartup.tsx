"use client";

import React, { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
// ABI do contrato EquityTokenFactory
import EquityTokenABI from "../utils/EquityToken.json";
import EquityTokenFactoryABI from "../utils/EquityTokenFactory.json";
import { ethers } from "ethers";

// ABI do contrato EquityToken

const ExistingStartup: React.FC = () => {
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [equityTokenContract, setEquityTokenContract] = useState<ethers.Contract | null>(null);
  const [factoryAddress] = useState<string>("0x344fD6ebC3a87F5127965059a89887B6ca78f83f"); // Endereço do contrato EquityTokenFactory
  const [startupId, setStartupId] = useState<number | null>(null);
  const [equityTokenAddress, setEquityTokenAddress] = useState<string | null>(null);
  const [partners, setPartners] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const connectWallet = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        setSigner(signer);

        // Connect to the factory contract
        const factoryContract = new ethers.Contract(factoryAddress, EquityTokenFactoryABI.abi, signer);
        setFactoryContract(factoryContract);
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
        console.log("Equity Token Address:", equityTokenAddress); // Adiciona o console.log aqui
        const equityTokenContract = new ethers.Contract(equityTokenAddress, EquityTokenABI.abi, signer);
        setEquityTokenContract(equityTokenContract);
        setEquityTokenAddress(equityTokenAddress);
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

  const listPartners = async () => {
    if (!equityTokenContract) {
      setMessage("Please connect to the contract first");
      return;
    }
    try {
      const partners = await equityTokenContract.partners();
      setPartners(partners);
      setMessage("Partners listed successfully");
    } catch (error) {
      if (error instanceof Error) {
        setMessage("Error listing partners: " + error.message);
      } else {
        setMessage("Error listing partners");
      }
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {!equityTokenAddress && (
          <div>
            <input
              type="number"
              placeholder="Startup ID"
              value={startupId ?? ""}
              onChange={e => setStartupId(Number(e.target.value))}
              className="input input-bordered my-2"
            />
            <button onClick={connectContract} className="btn btn-primary">
              Connect Contract
            </button>
          </div>
        )}
        {equityTokenAddress && (
          <div className="card bg-white p-6 rounded-lg shadow-md my-6">
            <div className="flex items-center">
              <span className="text-green-500 mr-2">&#x25CF;</span> {/* Bolinha verde */}
              <span className="font-bold">Startup Contract Address:</span>
            </div>
            <div className="mt-2">
              <span>{equityTokenAddress}</span>
            </div>
          </div>
        )}
        <div className="card bg-white p-6 rounded-lg shadow-md my-6">
          <button onClick={listPartners} className="btn btn-primary mb-4">
            List Partners
          </button>
          {partners.length > 0 && (
            <table className="table-auto w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2">Partner Address</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner, index) => (
                  <tr key={index}>
                    <td className="border px-4 py-2">{partner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p>{message}</p>
      </main>
    </div>
  );
};

export default ExistingStartup;
