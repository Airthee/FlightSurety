import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";
import oraclesPrivateKeys from "./oracles.json";

import OracleRepository from "./lib/oracleRepository";

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

// Register oracles
const oracleAccounts = oraclesPrivateKeys.map((privateKey) =>
  web3.eth.accounts.privateKeyToAccount(privateKey)
);
const oracleRepository = new OracleRepository(flightSuretyApp);
oracleRepository.registerMultipleOracles(oracleAccounts);

flightSuretyApp.events.OracleRequest(
  {
    fromBlock: 0,
  },
  function (error, event) {
    if (error) console.log(error);
    console.log(event);

    oracleRepository.submitRandomResponses(event.returnValues);
  }
);

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
