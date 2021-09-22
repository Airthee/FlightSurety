// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "./FlightSuretyDataInterface.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
  /********************************************************************************************/
  /*                                       DATA VARIABLES                                     */
  /********************************************************************************************/

  // Flight status codees
  uint8 private constant STATUS_CODE_UNKNOWN = 0;
  uint8 private constant STATUS_CODE_ON_TIME = 10;
  uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
  uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
  uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
  uint8 private constant STATUS_CODE_LATE_OTHER = 50;

  bool operational = true;
  address private contractOwner; // Account used to deploy contract
  FlightSuretyDataInterface private dataContract; // Address of the data contract
  uint256 numberOfAirlines;

  mapping(address => address[]) private votes;

  struct Flight {
    bool isRegistered;
    uint8 statusCode;
    uint256 updatedTimestamp;
    address airline;
  }
  mapping(bytes32 => Flight) private flights;

  event AirlineRegistered(address airline);
  event FlightRegistered(address airline, string flight, bytes32 flightKey);

  /********************************************************************************************/
  /*                                       FUNCTION MODIFIERS                                 */
  /********************************************************************************************/

  // Modifiers help avoid duplication of code. They are typically used to validate something
  // before a function is allowed to be executed.

  /**
   * @dev Modifier that requires the "operational" boolean variable to be "true"
   *      This is used on all state changing functions to pause the contract in
   *      the event there is an issue that needs to be fixed
   */
  modifier requireIsOperational() {
    require(isOperational(), "Contract is currently not operational");
    _;
  }

  /**
   * @dev Modifier that requires the "ContractOwner" account to be the function caller
   */
  modifier requireContractOwner() {
    require(msg.sender == contractOwner, "Caller is not contract owner");
    _;
  }

  modifier requireEnoughtBalance() {
    require(hasEnoughtBalance() == true, "Not enought balance");
    _;
  }

  modifier requireIsAirline() {
    require(isAirline() == true, "Caller is not an airline");
    _;
  }

  /********************************************************************************************/
  /*                                       CONSTRUCTOR                                        */
  /********************************************************************************************/

  /**
   * @dev Contract constructor
   *
   */
  constructor(FlightSuretyDataInterface _dataContract) {
    contractOwner = msg.sender;
    dataContract = _dataContract;
  }

  /********************************************************************************************/
  /*                                       UTILITY FUNCTIONS                                  */
  /********************************************************************************************/

  function isOperational() public view returns (bool) {
    return operational == true;
  }

  function getBalance() public view returns (uint256) {
    return dataContract.getAddressBalance(msg.sender);
  }

  function isAirline() public view returns (bool) {
    return dataContract.isAirline(msg.sender);
  }

  function hasEnoughtBalance() internal view returns (bool) {
    return getBalance() > 10 ether;
  }

  /********************************************************************************************/
  /*                                     SMART CONTRACT FUNCTIONS                             */
  /********************************************************************************************/

  /**
   * @dev Add an airline to the registration queue
   *
   */
  function registerAirline(address account)
    public
    requireIsOperational
    returns (bool success, uint256)
  {
    require(
      msg.sender == contractOwner || (isAirline() && hasEnoughtBalance()),
      "You must be the contract owner or have a sufficient balance to do this"
    );

    uint256 requiredVotes = Math.ceilDiv(numberOfAirlines, 2);

    // Do we need to vote
    if (
      numberOfAirlines >= 4 &&
      votes[account].length < requiredVotes &&
      !hasVotedForAirline(account)
    ) {
      votes[account].push(msg.sender);
    }

    // Is the consensus respected
    if (numberOfAirlines < 4 || votes[account].length >= requiredVotes) {
      _registerAirline(account);
      success = true;
    } else {
      success = false;
    }
    return (success, votes[account].length);
  }

  function hasVotedForAirline(address account) internal view returns (bool) {
    address[] storage votesForAccount = votes[account];

    for (uint256 i = 0; i < votesForAccount.length; i++) {
      if (votesForAccount[i] == msg.sender) {
        return true;
      }
    }
    return false;
  }

  function _registerAirline(address account) internal {
    numberOfAirlines++;
    votes[account] = new address[](0);
    dataContract.registerAirline(account);

    emit AirlineRegistered(account);
  }

  /**
   * @dev Register a future flight for insuring.
   *
   */
  function registerFlight(string memory flight)
    public
    requireIsOperational
    requireIsAirline
  {
    uint256 timestamp = block.timestamp;
    bytes32 flightKey = getFlightKey(msg.sender, flight, timestamp);

    // Get the flight
    // Check that it's not already registered
    Flight storage flightInStorage = flights[flightKey];
    require(
      flightInStorage.isRegistered == false,
      "Flight is already registered"
    );

    // Register the flight
    flightInStorage.isRegistered = true;
    flightInStorage.statusCode = STATUS_CODE_UNKNOWN;
    flightInStorage.updatedTimestamp = timestamp;
    flightInStorage.airline = msg.sender;

    emit FlightRegistered(msg.sender, flight, flightKey);
  }

  /**
   * @dev Called after oracle has updated flight status
   *
   */
  function processFlightStatus(
    address airline,
    string memory flight,
    uint256 timestamp,
    uint8 statusCode
  ) internal requireIsOperational {
    bytes32 flightKey = getFlightKey(airline, flight, timestamp);
    flights[flightKey].statusCode = statusCode;
    if (statusCode == STATUS_CODE_LATE_AIRLINE) {
      dataContract.creditInsurees(flightKey);
    }
  }

  // Generate a request for oracles to fetch flight information
  function fetchFlightStatus(
    address airline,
    string memory flight,
    uint256 timestamp
  ) external requireIsOperational {
    uint8 index = getRandomIndex(msg.sender);

    // Generate a unique key for storing the request
    bytes32 key = keccak256(
      abi.encodePacked(index, airline, flight, timestamp)
    );
    oracleResponses[key].requester = msg.sender;
    oracleResponses[key].isOpen = true;

    emit OracleRequest(index, airline, flight, timestamp);
  }

  // region ORACLE MANAGEMENT

  // Incremented to add pseudo-randomness at various points
  uint8 private nonce = 0;

  // Fee to be paid when registering oracle
  uint256 public constant REGISTRATION_FEE = 1 ether;

  // Number of oracles that must respond for valid status
  uint256 private constant MIN_RESPONSES = 3;

  struct Oracle {
    bool isRegistered;
    uint8[3] indexes;
  }

  // Track all registered oracles
  mapping(address => Oracle) private oracles;

  // Model for responses from oracles
  struct ResponseInfo {
    address requester; // Account that requested status
    bool isOpen; // If open, oracle responses are accepted
    mapping(uint8 => address[]) responses; // Mapping key is the status code reported
    // This lets us group responses and identify
    // the response that majority of the oracles
  }

  // Track all oracle responses
  // Key = hash(index, flight, timestamp)
  mapping(bytes32 => ResponseInfo) private oracleResponses;

  // Event fired each time an oracle submits a response
  event FlightStatusInfo(
    address airline,
    string flight,
    uint256 timestamp,
    uint8 status
  );

  event OracleReport(
    address airline,
    string flight,
    uint256 timestamp,
    uint8 status
  );

  // Event fired when flight status request is submitted
  // Oracles track this and if they have a matching index
  // they fetch data and submit a response
  event OracleRequest(
    uint8 index,
    address airline,
    string flight,
    uint256 timestamp
  );

  // Register an oracle with the contract
  function registerOracle() public payable {
    // Require registration fee
    require(
      oracles[msg.sender].isRegistered == false,
      "Oracle already registered"
    );
    require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

    uint8[3] memory indexes = generateIndexes(msg.sender);
    oracles[msg.sender] = Oracle({ isRegistered: true, indexes: indexes });
  }

  function isRegistered(address account) public view returns (bool) {
    return oracles[account].isRegistered;
  }

  function getMyIndexes() external view returns (uint8[3] memory) {
    require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

    return oracles[msg.sender].indexes;
  }

  // Called by oracle when a response is available to an outstanding request
  // For the response to be accepted, there must be a pending request that is open
  // and matches one of the three Indexes randomly assigned to the oracle at the
  // time of registration (i.e. uninvited oracles are not welcome)
  function submitOracleResponse(
    uint8 index,
    address airline,
    string memory flight,
    uint256 timestamp,
    uint8 statusCode
  ) external {
    require(
      (oracles[msg.sender].indexes[0] == index) ||
        (oracles[msg.sender].indexes[1] == index) ||
        (oracles[msg.sender].indexes[2] == index),
      "Index does not match oracle request"
    );

    ResponseInfo storage response = getResponse(
      index,
      airline,
      flight,
      timestamp
    );
    require(response.isOpen, "Flight or timestamp do not match oracle request");

    response.responses[statusCode].push(msg.sender);

    // Information isn't considered verified until at least MIN_RESPONSES
    // oracles respond with the *** same *** information
    emit OracleReport(airline, flight, timestamp, statusCode);
    if (response.responses[statusCode].length >= MIN_RESPONSES) {
      // Close request
      response.isOpen = false;

      // Handle flight status as appropriate
      processFlightStatus(airline, flight, timestamp, statusCode);
      emit FlightStatusInfo(airline, flight, timestamp, statusCode);
    }
  }

  function getResponse(
    uint8 index,
    address airline,
    string memory flight,
    uint256 timestamp
  ) internal view returns (ResponseInfo storage) {
    bytes32 key = keccak256(
      abi.encodePacked(index, airline, flight, timestamp)
    );
    return oracleResponses[key];
  }

  function isResponseOpen(
    uint8 index,
    address airline,
    string memory flight,
    uint256 timestamp
  ) public view returns (bool) {
    ResponseInfo storage response = getResponse(
      index,
      airline,
      flight,
      timestamp
    );

    return response.isOpen;
  }

  function getFlightKey(
    address airline,
    string memory flight,
    uint256 timestamp
  ) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(airline, flight, timestamp));
  }

  // Returns array of three non-duplicating integers from 0-9
  function generateIndexes(address account) internal returns (uint8[3] memory) {
    uint8[3] memory indexes;
    indexes[0] = getRandomIndex(account);

    indexes[1] = indexes[0];
    while (indexes[1] == indexes[0]) {
      indexes[1] = getRandomIndex(account);
    }

    indexes[2] = indexes[1];
    while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
      indexes[2] = getRandomIndex(account);
    }

    return indexes;
  }

  // Returns array of three non-duplicating integers from 0-9
  function getRandomIndex(address account) internal returns (uint8) {
    uint8 maxValue = 10;

    // Pseudo random number...the incrementing nonce adds variation
    uint8 random = uint8(
      uint256(
        keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))
      ) % maxValue
    );

    if (nonce > 250) {
      nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
    }

    return random;
  }

  // endregion
}
