"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EquityTokenFactoryJSON from "../utils/EquityTokenFactory.json";
import { ethers } from "ethers";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [startupId, setStartupId] = useState<number | null>(null);
  const [companyAddress, setCompanyAddress] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<number | null>(null);

  const equityTokenFactoryAddress = "0x46398e0aB12cd978b998D10E44592406a2a4EAC9"; // Replace with your deployed contract address
  const equityTokenFactoryABI = EquityTokenFactoryJSON.abi;

  useEffect(() => {
    const getSigner = async () => {
      if (window.ethereum && connectedAddress) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        setSigner(signer);
      }
    };

    getSigner();
  }, [connectedAddress]);

  const handleCreateStartup = async () => {
    if (!signer) {
      console.error("Signer is not available");
      return;
    }

    const equityTokenFactory = new ethers.Contract(equityTokenFactoryAddress, equityTokenFactoryABI, signer);

    try {
      const tx = await equityTokenFactory.foundCompany(name, symbol);
      await tx.wait();

      // Retrieve the new startup ID directly from the contract
      const currentNextId = await equityTokenFactory.getNextId();
      setStartupId(currentNextId.toNumber() - 1); // The ID of the newly created startup is nextId - 1

      console.log("Startup created successfully with ID:", currentNextId.toNumber() - 1);
    } catch (error) {
      console.error("Error creating startup:", error);
    }
  };

  const handleGetCompanyAddress = async () => {
    if (!signer || searchId === null) {
      console.error("Signer or searchId is not available");
      return;
    }

    const equityTokenFactory = new ethers.Contract(equityTokenFactoryAddress, equityTokenFactoryABI, signer);

    try {
      const address = await equityTokenFactory.getCompanyAddress(searchId);
      setCompanyAddress(address);
      console.log("Company address retrieved successfully:", address);
    } catch (error) {
      console.error("Error retrieving company address:", error);
    }
  };

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">Startup Equity On-Chain</span>
          </h1>
          <div className="flex justify-center items-center space-x-2">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} />
          </div>
        </div>

        {/* Add the new section for startup equity */}
        <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <h2 className="text-2xl font-bold">Create Your Startup</h2>
              <input
                type="text"
                placeholder="Name"
                className="input input-bordered my-2"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Symbol"
                className="input input-bordered my-2"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
              />
              <button className="btn btn-primary my-2" onClick={handleCreateStartup}>
                Create Startup
              </button>
              {startupId !== null && <p className="mt-4">Startup Created with ID: {startupId}</p>}
              <p className="mt-4">
                If you already have a startup, click{" "}
                <Link href="/existing-startup" className="text-blue-500">
                  here
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl mt-8">
              <h2 className="text-2xl font-bold">Get Company Address</h2>
              <input
                type="number"
                placeholder="Startup ID"
                className="input input-bordered my-2"
                value={searchId ?? ""}
                onChange={e => setSearchId(Number(e.target.value))}
              />
              <button className="btn btn-primary my-2" onClick={handleGetCompanyAddress}>
                Get Address
              </button>
              {companyAddress && <p className="mt-4">Company Address: {companyAddress}</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
