import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";
import oraclesPrivateKeys from "./oracles.json";

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
registerOracles(oracleAccounts);

function registerOracles(accounts) {
  Promise.all(accounts.map(registerOracle));
}

function registerOracle(account) {
  return flightSuretyApp.methods
    .registerOracle()
    .send({
      from: account.address,
      value: web3.utils.toWei("1.5", "ether"),
      gas: 6721975,
    })
    .then(() =>
      console.log(`Oracle ${account.address} registered successfully`)
    )
    .catch((error) =>
      console.error(
        `Error while registering oracle ${account.address}`,
        error.message
      )
    );
}

flightSuretyApp.events.OracleRequest(
  {
    fromBlock: 0,
  },
  function (error, event) {
    if (error) console.log(error);
    console.log(event);

    submitRandomResponses(event.returnValues);
  }
);

function submitRandomResponses(values) {
  return Promise.all(
    oracleAccounts.map((oracleAccount) =>
      submitRandomResponse(values, oracleAccount)
    )
  );
}

function submitRandomResponse(
  { index, airline, flight, timestamp },
  oracleAccount
) {
  // Check that current oracle have matching index
  return flightSuretyApp.methods
    .getMyIndexes()
    .call({ from: oracleAccount.address })
    .then((indexes) => {
      if (indexes.indexOf(index) !== -1) {
        const availableResponses = [10, 20, 30, 40, 50];
        const randomIndex = Math.floor(
          Math.random() * availableResponses.length
        );
        const statusCode = availableResponses[randomIndex];

        console.log(
          `Oracle ${oracleAccount.address} is submitting ${statusCode}`
        );
        return flightSuretyApp.methods.submitOracleResponse(
          index,
          airline,
          flight,
          timestamp,
          statusCode
        );
      }
    });
}

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
