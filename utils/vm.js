const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../../src')
const compileHuff = require(path.join(src, 'lib/easy-huff'))

const vmPath = path.join(src, 'huff_modules');

const getSetupMacro = () => compileHuff(vmPath, 'setup.huff', 'PREPARE_HYPERVISOR');
const getHypervisorMacro = () => compileHuff(vmPath, 'hypervisor.huff', 'INITIALIZE_HYPERVISOR');

// const compile = (file, ) => compileHuff(vmPath, 'hypervisor.huff', 'INITIALIZE_HYPERVISOR');

module.exports = {
  getHypervisorMacro,
  getSetupMacro
};
