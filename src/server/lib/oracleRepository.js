import Web3 from "web3";

function log(message, account, error = false) {
  const method = error ? "error" : "log";
  let text = "";
  if (account) {
    text += `(oracle ${account.address}) `;
  }
  text += message;
  console[method](text);
}

class OracleRepository {
  constructor(flightSuretyApp) {
    this.flightSuretyApp = flightSuretyApp;
  }

  async registerMultipleOracles(accounts) {
    const tryRegisterOracle = async (account, nbTry = 0) => {
      if (!account.address) {
        throw new Error(`Account needs an address : ${account}`);
      }

      const isRegistered = await this.isOracleRegisterd(account);
      if (isRegistered) {
        log("already registered", account);
        return;
      }

      try {
        log("trying to register...", account);
        await this.registerOracle(account);
        log("successfully registered", account);
      } catch (error) {
        log(`error while registering oracle : ${error.message}`, account, true);
        if (nbTry < 10) {
          log(`trying to register in 1 seconds...`, account);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await tryRegisterOracle(account, ++nbTry);
        }
      }
    };

    this.accounts = accounts;
    log("[START] registering oracles");
    for (const account of accounts) {
      await tryRegisterOracle(account);
    }
    log("[END] registering oracles");
  }

  isOracleRegisterd(account) {
    return this.flightSuretyApp.methods
      .isRegistered(account.address)
      .call({ from: account.address });
  }

  async registerOracle(account) {
    await this.flightSuretyApp.methods.registerOracle().send({
      from: account.address,
      value: Web3.utils.toWei("1.5", "ether"),
      gas: 6721975,
    });
  }

  async submitRandomResponses(values) {
    for (const account of this.accounts) {
      try {
        await this.submitRandomResponse(values, account);
      } catch (error) {
        log(
          `error while submitting response : ${error.message}`,
          account,
          true
        );
      }
    }
  }

  async submitRandomResponse({ index, airline, flight, timestamp }, account) {
    // Check if oracle is registered
    const isRegistered = await this.isOracleRegisterd(account);
    if (!isRegistered) {
      return;
    }

    // Check if response is open
    const isResponseOpen = await this.flightSuretyApp.methods
      .isResponseOpen(index, airline, flight, timestamp)
      .call({ from: account.address });
    if (!isResponseOpen) {
      return;
    }

    // Check that current oracle have matching index
    const indexes = await this.flightSuretyApp.methods
      .getMyIndexes()
      .call({ from: account.address });
    if (indexes.indexOf(index) === -1) {
      return;
    }

    const statusCode = this.getRandomStatusCode();
    log(`submitting response for flight "${flight}": ${statusCode}`, account);

    await this.flightSuretyApp.methods
      .submitOracleResponse(index, airline, flight, timestamp, statusCode)
      .send({ from: account.address, gas: 6721975 });
  }

  getRandomStatusCode() {
    const availableResponses = [/**0, 10,**/ 20 /** , 30, 40, 50*/];
    const randomIndex = Math.floor(Math.random() * availableResponses.length);
    return availableResponses[randomIndex];
  }
}

export default OracleRepository;
