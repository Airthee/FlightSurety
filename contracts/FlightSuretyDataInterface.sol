// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

abstract contract FlightSuretyDataInterface {
  // Authorized caller
  function registerAirline(address account) external virtual;

  function getAddressBalance(address account)
    external
    view
    virtual
    returns (uint256);

  // Airline
  function creditInsurees(bytes32 flightKey) external virtual;

  // Insuree
  function buy(bytes32 flightKey) public payable virtual;

  receive() external payable virtual;

  // All
  function isAirline(address account) external view virtual returns (bool);
}
