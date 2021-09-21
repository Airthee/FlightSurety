import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
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
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
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
    this.flightSuretyApp.methods
      .isOperational()
      .call({ from: this.owner }, callback);
  }

  fetchFlightStatus(flight, airline, callback) {
    let payload = {
      airline,
      flight,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: this.owner }, (error, result) => {
        callback(error, payload);
      });
  }

  on(eventName, callback) {
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
}
