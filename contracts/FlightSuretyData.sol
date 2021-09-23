// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// SafeMath is no longer needed starting with Solidity 0.8
// import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./FlightSuretyDataInterface.sol";

contract FlightSuretyData is FlightSuretyDataInterface {
  /********************************************************************************************/
  /*                                       DATA VARIABLES                                     */
  /********************************************************************************************/

  address private contractOwner; // Account used to deploy contract
  bool private operational = true; // Blocks all state changes throughout the contract if false
  mapping(address => bool) private authorizedCallers; // Addresses authorized to call the contract methods
  mapping(address => bool) private airlines; // Registered airlines

  struct FlightInsurance {
    address[] insurees;
    mapping(address => uint256) amounts;
  }
  mapping(bytes32 => FlightInsurance) flightInsurances;

  mapping(address => uint256) private balances; // balance for all type of users

  event InsureeCredited(address insuree, bytes32 flightKey, uint256 amount);
  event InsureePaid(address insuree, uint256 amount);
  event FlightInsuranceBought(
    bytes32 flightKey,
    address insuree,
    uint256 amount
  );

  /********************************************************************************************/
  /*                                       EVENT DEFINITIONS                                  */
  /********************************************************************************************/

  /**
   * @dev Constructor
   *      The deploying account becomes contractOwner
   */
  constructor() {
    contractOwner = msg.sender;
  }

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
    require(operational, "Contract is currently not operational");
    _; // All modifiers require an "_" which indicates where the function body will be added
  }

  /**
   * @dev Modifier that requires the "ContractOwner" account to be the function caller
   */
  modifier requireContractOwner() {
    require(msg.sender == contractOwner, "Caller is not contract owner");
    _;
  }

  modifier requireCallerAuthorized() {
    require(authorizedCallers[msg.sender] == true, "Caller is not authorized");
    _;
  }

  modifier requireAirline() {
    require(airlines[msg.sender] == true, "Caller is not a registered airline");
    _;
  }

  /********************************************************************************************/
  /*                                       UTILITY FUNCTIONS                                  */
  /********************************************************************************************/

  /**
   * @dev Get operating status of contract
   *
   * @return A bool that is the current operating status
   */
  function isOperational() public view returns (bool) {
    return operational;
  }

  /**
   * @dev Sets contract operations on/off
   *
   * When operational mode is disabled, all write transactions except for this one will fail
   */
  function setOperatingStatus(bool mode) public requireContractOwner {
    operational = mode;
  }

  function getAddressBalance(address account)
    external
    view
    override
    requireCallerAuthorized
    returns (uint256)
  {
    return _getAddressBalance(account);
  }

  function getBalance() public view returns (uint256) {
    return _getAddressBalance(msg.sender);
  }

  function _getAddressBalance(address account) private view returns (uint256) {
    return balances[account];
  }

  /********************************************************************************************/
  /*                                     SMART CONTRACT FUNCTIONS                             */
  /********************************************************************************************/

  function authorizeCaller(address account) public requireContractOwner {
    authorizedCallers[account] = true;
  }

  function unauthorizeCaller(address account) public requireContractOwner {
    authorizedCallers[account] = false;
  }

  /**
   * @dev Add an airline to the registration queue
   *      Can only be called from FlightSuretyApp contract
   *
   */
  function registerAirline(address account)
    external
    override
    requireCallerAuthorized
  {
    airlines[account] = true;
  }

  function isAirline(address account) public view override returns (bool) {
    return airlines[account];
  }

  /**
   * @dev Buy insurance for a flight
   *
   */
  function buy(bytes32 flightKey) public payable override {
    require(msg.value > 0, "You must provide positive amount");
    require(msg.value <= 1 ether, "You cannot pay more than 1 ether");
    require(
      flightInsurances[flightKey].amounts[msg.sender] == 0,
      "You already buyed an insurance for this flight"
    );

    flightInsurances[flightKey].amounts[msg.sender] = msg.value;
    flightInsurances[flightKey].insurees.push(msg.sender);
    emit FlightInsuranceBought(flightKey, msg.sender, msg.value);
  }

  function getInsuranceAmount(bytes32 flightKey) public view returns (uint256) {
    return flightInsurances[flightKey].amounts[msg.sender];
  }

  /**
   *  @dev Credits payouts to insurees
   */
  function creditInsurees(bytes32 flightKey)
    external
    override
    requireCallerAuthorized
  {
    FlightInsurance storage flightInsurance = flightInsurances[flightKey];

    for (
      uint256 insureeIndex = 0;
      insureeIndex < flightInsurance.insurees.length;
      insureeIndex++
    ) {
      address insureeAddress = flightInsurance.insurees[insureeIndex];
      uint256 amountToRefund = (flightInsurance.amounts[insureeAddress] * 3) /
        2;

      // debit before credit
      flightInsurance.amounts[insureeAddress] = 0;
      balances[insureeAddress] += amountToRefund;
      emit InsureeCredited(insureeAddress, flightKey, amountToRefund);
    }
  }

  /**
   *  @dev Transfers eligible payout funds to insuree
   *
   */
  function pay() public {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "You don't have balance");

    // Debit before credit
    balances[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
    emit InsureePaid(msg.sender, amount);
  }

  /**
   * @dev Initial funding for the insurance. Unless there are too many delayed flights
   *      resulting in insurance payouts, the contract should be self-sustaining
   *
   */
  function fund() public payable requireAirline {
    require(msg.value > 0, "Fund should be a positive number");
    balances[msg.sender] += msg.value;
  }

  // function getFlightKey(
  //   address airline,
  //   string memory flight,
  //   uint256 timestamp
  // ) internal pure returns (bytes32) {
  //   return keccak256(abi.encodePacked(airline, flight, timestamp));
  // }

  /**
   * @dev Fallback function for funding smart contract.
   *
   */
  receive() external payable override {
    fund();
  }
}
