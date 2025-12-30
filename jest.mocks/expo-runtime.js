// Mock for expo/src/winter/runtime.native
module.exports = {
  require: jest.fn((id) => require(id)),
};

