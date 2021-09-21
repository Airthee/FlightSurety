import Web3 from "web3";

class OracleRepository {
  constructor(flightSuretyApp) {
    this.flightSuretyApp = flightSuretyApp;
    this.accounts = new Map();
  }

  registerMultipleOracles(accounts) {
    return Promise.all(accounts.map((account) => this.registerOracle(account)));

    // const registerOraclesFrom = (index) => {
    //   this.registerOracle(accounts[index]).then(() => {
    //     if (accounts[index + 1]) {
    //       registerOraclesFrom(index + 1);
    //     }
    //   });
    // };

    // registerOraclesFrom(0);
  }

  registerOracle(account) {
    if (!account.address) {
      throw new Error(`Account needs an address : ${account}`);
    }
    this.accounts.set(account.address, account);
    return this.flightSuretyApp.methods
      .registerOracle()
      .send({
        from: account.address,
        value: Web3.utils.toWei("1.5", "ether"),
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

  submitRandomResponses(values) {
    const promises = [];
    this.accounts.forEach((account) => {
      promises.push(this.submitRandomResponse(values, account));
    });
    return Promise.all(promises);
  }

  submitRandomResponse({ index, airline, flight, timestamp }, account) {
    // Check that current oracle have matching index
    return this.flightSuretyApp.methods
      .getMyIndexes()
      .call({ from: account.address })
      .then((indexes) => {
        if (indexes.indexOf(index) !== -1) {
          const availableResponses = [10, 20, 30, 40, 50];
          const randomIndex = Math.floor(
            Math.random() * availableResponses.length
          );
          const statusCode = availableResponses[randomIndex];

          console.log(`Oracle ${account.address} is submitting ${statusCode}`);
          return this.flightSuretyApp.methods
            .submitOracleResponse(index, airline, flight, timestamp, statusCode)
            .send({ from: account.address });
        }
      });
  }
}

export default OracleRepository;
