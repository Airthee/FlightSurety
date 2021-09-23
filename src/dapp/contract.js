import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(
      Web3.givenProvider || new Web3.providers.HttpProvider(config.url)
    );
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.flightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataAddress
    );
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    return this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];
      console.log(`Account : ${this.owner}`);

      let counter = 1;

      while (this.airlines.length < 5) {
        this.airlines.push(accts[counter++]);
      }

      while (this.passengers.length < 5) {
        this.passengers.push(accts[counter++]);
      }

      callback();
    });
  }

  isOperational(callback) {
    return this.flightSuretyApp.methods
      .isOperational()
      .call({ from: this.owner }, callback);
  }

  fetchFlightStatus(flightKey, callback) {
    return this.flightSuretyApp.methods
      .fetchFlightStatus(flightKey)
      .send({ from: this.owner }, (error, result) => {
        callback(error, flightKey);
      });
  }

  buy(amount, unit, flightKey) {
    return new Promise((resolve, reject) => {
      const weiAmount = this.web3.utils.toWei(amount, unit);

      this.flightSuretyData.methods
        .buy(flightKey)
        .send({ from: this.owner, value: weiAmount }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
    });
  }

  pay() {
    return new Promise((resolve, reject) => {
      this.flightSuretyData.methods
        .pay()
        .send({ from: this.owner }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
    });
  }

  onAppEvent(eventName, callback) {
    if (!this.flightSuretyApp.events[eventName]) {
      throw new Error(`flightSuretyApp has no event ${eventName}`);
    }

    this.flightSuretyApp.events[eventName](
      {
        fromBlock: 0,
      },
      function (error, event) {
        if (error) console.error(error);
        if (callback) {
          callback(event.returnValues);
        }
      }
    );
  }

  onDataEvent(eventName, callback) {
    if (!this.flightSuretyData.events[eventName]) {
      throw new Error(`flightSuretyData has no event ${eventName}`);
    }

    this.flightSuretyData.events[eventName](
      {
        fromBlock: 0,
      },
      function (error, event) {
        if (error) console.error(error);
        if (callback) {
          callback(event.returnValues);
        }
      }
    );
  }
}
