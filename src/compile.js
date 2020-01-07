const path = require('path');
const compileHuff = require('./lib/easy-huff')
const vmPath = path.join(__dirname, 'huff_modules');

module.exports = compileHuff(vmPath, 'hypervisor.huff', 'INITIALIZE_HYPERVISOR');;
