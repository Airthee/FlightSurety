const Test = require("../config/testConfig.js");
const BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  let config,
    flightKeys = [];

  before("setup contract", async () => {
    config = await Test.Config(accounts);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/
  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    const status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;
    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) should register the first airline", async () => {
    // ACT
    await config.flightSuretyApp.registerAirline(config.firstAirline);
    const result = await config.flightSuretyData.isAirline.call(
      config.firstAirline
    );

    // ASSERT
    assert.equal(
      result,
      true,
      "contract owner should be able to register a new airline"
    );
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch (e) {}
    let result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  it("(airline) can fund airline", async () => {
    // ARRANGE
    const amount = web3.utils.toWei("11.5", "ether");

    // ACT
    await config.flightSuretyData.fund({
      from: config.firstAirline,
      value: amount,
    });

    // ASSERT
    const result = await config.flightSuretyApp.getBalance.call({
      from: config.firstAirline,
    });
    assert.equal(
      Number(result),
      Number(amount),
      "Amount is not correct after funding"
    );
  });

  it("(airline) can register an Airline using registerAirline()", async () => {
    // ARRANGE
    const newAirline = accounts[2];

    // ACT
    await config.flightSuretyApp.registerAirline(newAirline, {
      from: config.firstAirline,
    });
    const result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      true,
      "Airline should be able to register another airline if it has provided funding"
    );
  });

  it("(airline) can not register a new airline if it has less than 10 ether in balance", async () => {
    // ARRANGE
    let newAirline = accounts[3];
    await config.flightSuretyData.fund({
      from: accounts[2],
      value: web3.utils.toWei("9.999999", "ether"),
    });

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: accounts[2],
      });
    } catch (e) {}
    let result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't enought fund"
    );
  });

  it("(airline) can register 2 more airlines without consensus", async () => {
    // ARRANGE
    await config.flightSuretyData.fund({
      value: web3.utils.toWei("1", "ether"), // to have more than 10 ether in the balance
      from: accounts[2],
    });

    // ACT
    await config.flightSuretyApp.registerAirline(accounts[3], {
      from: accounts[2],
    });
    await config.flightSuretyData.fund({
      value: web3.utils.toWei("13", "ether"),
      from: accounts[3],
    });
    await config.flightSuretyApp.registerAirline(accounts[4], {
      from: accounts[3],
    });
    await config.flightSuretyData.fund({
      value: web3.utils.toWei("14", "ether"),
      from: accounts[4],
    });
    const resultAirline3 = await config.flightSuretyData.isAirline.call(
      accounts[3]
    );
    const resultAirline4 = await config.flightSuretyData.isAirline.call(
      accounts[4]
    );

    // ASSERT
    assert.equal(resultAirline3, true, "Airline 3 should be registered");
    assert.equal(resultAirline4, true, "Airline 4 should be registered");
  });

  it("(airline) should need two votes to register the fifth airline", async () => {
    // ARRANGE
    const newAirline = accounts[5];
    assert.equal(
      await config.flightSuretyData.isAirline.call(newAirline),
      false
    );

    // ACT
    await config.flightSuretyApp.registerAirline(newAirline, {
      from: accounts[3],
    });
    assert.equal(
      await config.flightSuretyData.isAirline.call(newAirline),
      false
    );
    await config.flightSuretyApp.registerAirline(newAirline, {
      from: accounts[4],
    });

    // ASSERT
    assert.equal(
      await config.flightSuretyData.isAirline.call(newAirline),
      true
    );
  });

  it("(airline) should register multiple flights", async () => {
    // ARRANGE
    const airlines = [config.firstAirline, accounts[2]];
    const FLIGHTS_PER_AIRLINE = 3;
    let flightCreated = 0;

    // ACT
    for (let airlineIndex = 0; airlineIndex < airlines.length; airlineIndex++) {
      for (
        let flightIndex = 0;
        flightIndex < FLIGHTS_PER_AIRLINE;
        flightIndex++
      ) {
        const flight = `FLIGHT_${airlineIndex}_${flightIndex}`;
        const result = await config.flightSuretyApp.registerFlight(flight, {
          from: airlines[airlineIndex],
        });
        const flightKey = result.logs.find(
          (log) => log.event === "FlightRegistered"
        ).args[0];

        assert.equal(
          web3.utils.isHex(flightKey),
          true,
          "Flight key must be a hex number"
        );

        flightKeys.push(flightKey);
        flightCreated++;
      }
    }

    // ASSERT
    assert.equal(
      flightCreated,
      airlines.length * FLIGHTS_PER_AIRLINE,
      "Not all flights were created"
    );
  });

  // creditInsurees
  // pay

  it("(user) can buy an insurance for a flight", async () => {
    // ARRANGE
    const insuree = accounts[3];
    const flightKey = flightKeys[0];
    const value = web3.utils.toWei("0.5", "ether");

    // ACT
    await config.flightSuretyData.buy(flightKey, { from: insuree, value });
    const result = await config.flightSuretyData.getInsuranceAmount.call(
      flightKey,
      { from: insuree }
    );

    // ASSERT
    assert.equal(
      Number(result),
      Number(value),
      "Insurance value is incorrect after buy"
    );
  });

  it("(user) should not be able to buy a flight insurance for more than 1 ether", async () => {
    // ARRANGE
    const insuree = accounts[3];
    const flightKey = flightKeys[1];
    const value = web3.utils.toWei("1.00000001", "ether");
    let error = false;

    // ACT
    try {
      await config.flightSuretyData.buy(flightKey, { from: insuree, value });
    } catch (e) {
      error = true;
    }

    // ASSERT
    assert.equal(
      error,
      true,
      "User should not buy an insurance flight for more than 1 ether"
    );
  });
});
