import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";
import Web3 from "web3";

(async () => {
  const contract = new Contract("localhost", () => {
    function simpleFormatAddress(address) {
      return address.slice(0, 6) + "..." + address.slice(-3);
    }

    function getSelectedFlight() {
      const element = DOM.elid("flights-selector");
      return {
        key: element.value,
        name: element.selectedOptions[0].innerText,
      };
    }

    function formatAmount(amount) {
      return Web3.utils.fromWei(amount, "ether") + " ether";
    }

    // Read flight status
    contract.onAppEvent("FlightStatusInfo", (event) => {
      const statusLabel = {
        0: "UNKNOWN",
        10: "ON_TIME",
        20: "LATE_AIRLINE",
        30: "LATE_WEATHER",
        40: "LATE_TECHNICAL",
        50: "LATE_OTHER",
      };

      console.log("onFlightStatusInfo", event);
      display("Oracles", "Flight Status Info", [
        {
          label: "Flight",
          value: event.flight,
        },
        {
          label: "Airline",
          value: simpleFormatAddress(event.airline),
        },
        {
          label: "Status",
          value: statusLabel[event.status],
        },
      ]);
    });

    // Read registered flights
    contract.onAppEvent(
      "FlightRegistered",
      ({ airline, flight, flightKey }) => {
        const formattedAirline = simpleFormatAddress(airline);
        const formattedFlightKey = simpleFormatAddress(flightKey);

        DOM.elid("flights-selector").innerHTML += `
        <option value="${flightKey}">${flight} (airline: ${formattedAirline} / flightKey: ${formattedFlightKey})</option>
      `;
      }
    );

    contract.onDataEvent(
      "FlightInsuranceBought",
      ({ flightKey, insuree, amount }) => {
        display("Insurance", "Insuree bought insurance ticket", [
          {
            label: "Insuree",
            value: simpleFormatAddress(insuree),
          },
          {
            label: "FlightKey",
            value: simpleFormatAddress(flightKey),
          },
          {
            label: "Amount",
            error: false,
            value: formatAmount(amount),
          },
        ]);
      }
    );

    contract.onDataEvent(
      "InsureeCredited",
      ({ insuree, amount, flightKey }) => {
        display("Insurance", `Insuree has been credited`, [
          {
            label: "Insuree",
            value: simpleFormatAddress(insuree),
          },
          {
            label: "Flight key",
            value: simpleFormatAddress(flightKey),
          },
          {
            label: "Amount",
            error: false,
            value: formatAmount(amount),
          },
        ]);
      }
    );

    contract.onDataEvent("InsureePaid", ({ insuree, amount }) => {
      display("Insurance", `Insuree has been paid`, [
        {
          label: "Insuree",
          value: simpleFormatAddress(insuree),
        },
        {
          label: "Amount",
          value: formatAmount(amount),
        },
      ]);
    });

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      const selectedFlight = getSelectedFlight();

      console.log(`Fetching flight status ${selectedFlight.name}`);

      // Write transaction
      contract.fetchFlightStatus(selectedFlight.key, (error, result) => {
        console.log("fetchFlightStatus", result);
        display("Oracles", "Trigger oracles to fetch flight status", [
          {
            label: "Flight key",
            value: simpleFormatAddress(result),
            error,
          },
          {
            label: "Flight name",
            value: selectedFlight.name,
            error,
          },
        ]);
      });
    });

    // Buy insurance
    DOM.elid("buy-insurance").addEventListener("click", () => {
      const flight = getSelectedFlight();
      if (!flight.key) {
        return window.alert("Flight and airline should be selected");
      }

      // Ask insurance amount
      const amount = window.prompt("Insurance amount (in ether, max 1)");
      if (Number.isNaN(amount)) {
        return window.alert("Insurance amount is incorrect");
      }

      // Buy
      contract.buy(amount, "ether", flight.key).then(() => {
        display("Insurance", "Buy flight insurance", [
          {
            label: "Flight key",
            value: simpleFormatAddress(flight.key),
          },
          {
            label: "Flight name",
            value: flight.name,
          },
          {
            label: `Value`,
            error: false,
            value: `${amount} ether`,
          },
        ]);
      });
    });

    // Refund
    DOM.elid("refund").addEventListener("click", () => {
      contract.pay().then(() => {
        display("Insurance", "Refund", [
          {
            label: "Status",
            error: false,
            value: "Waiting for refunding to be done",
          },
        ]);
      });
    });
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
