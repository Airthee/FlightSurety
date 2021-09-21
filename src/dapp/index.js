import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  let result = null;

  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      console.log(error, result);
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result },
      ]);
    });

    // Read flight status
    contract.on("FlightStatusInfo", (event) => {
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
          label: `Flight ${event.flight}`,
          error: false,
          value: statusLabel[event.status],
        },
      ]);
    });

    contract.on("OracleReport", (event) => {
      console.log("OracleReport", event);
    });

    // Read registered airlines
    contract.on("AirlineRegistered", ({ airline }) => {
      const formattedText = airline.slice(0, 6) + "..." + airline.slice(-3);

      DOM.elid("airlines-selector").innerHTML += `
        <option value="${airline}">${formattedText}</option>
      `;
    });

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      const flight = DOM.elid("flight-number").value;
      const airline = DOM.elid("airlines-selector").value;
      console.log(`Fetching flight status ${flight} for airline ${airline}`);
      // Write transaction
      contract.fetchFlightStatus(flight, airline, (error, result) => {
        display("Oracles", "Trigger oracles", [
          {
            label: "Fetch Flight Status",
            error: error,
            value: result.flight + " " + result.timestamp,
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
