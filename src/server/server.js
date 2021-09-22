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

// Register flights
const airlineAccount = web3.eth.accounts.privateKeyToAccount(
  "0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f"
);
for (let flightIndex = 1; flightIndex <= 10; flightIndex++) {
  const airlineId = airlineAccount.address.slice(2, 6);
  const flightKey = `F_${airlineId}_${flightIndex}`;
  flightSuretyApp.methods
    .registerFlight(flightKey)
    .send({ from: airlineAccount.address, gas: 6721975 })
    .then(() => {
      console.log(`(airline) flight registered : ${flightKey}`);
    })
    .catch((error) => {
      console.error(
        `(airline) failed to register flight ${flightKey} : ${error.message}`
      );
    });
}

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
