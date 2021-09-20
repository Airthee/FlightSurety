import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
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

  fetchFlightStatus(flight, callback) {
    let payload = {
      airline: this.airlines[0],
      flight: flight,
      timestamp: Math.floor(Date.now() / 1000),
    };
    this.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: this.owner }, (error, result) => {
        callback(error, payload);
      });
  }

  onFlightStatusInfo(callback) {
    this.flightSuretyApp.events.FlightStatusInfo(
      {
        fromBlock: 0,
      },
      function (error, event) {
        if (error) console.log(error);
        console.log(event);
        if (callback) {
          callback(event.returnValues);
        }
      }
    );
  }
}
