const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = async function (deployer) {
  const firstAirline = "0xf17f52151EbEF6C7334FAD080c5704D77216b732";
  await deployer.deploy(FlightSuretyData);
  const flightSuretyDataInstance = await FlightSuretyData.deployed();
  await deployer.deploy(FlightSuretyApp, flightSuretyDataInstance.address);
  const flightSuretyAppInstance = await FlightSuretyApp.deployed();
  await flightSuretyDataInstance.authorizeCaller(
    flightSuretyAppInstance.address
  );
  await flightSuretyAppInstance.registerAirline(firstAirline);

  const config = {
    localhost: {
      url: "http://localhost:8545",
      dataAddress: FlightSuretyData.address,
      appAddress: FlightSuretyApp.address,
    },
  };
  fs.writeFileSync(
    __dirname + "/../src/dapp/config.json",
    JSON.stringify(config, null, "\t"),
    "utf-8"
  );
  fs.writeFileSync(
    __dirname + "/../src/server/config.json",
    JSON.stringify(config, null, "\t"),
    "utf-8"
  );
};
