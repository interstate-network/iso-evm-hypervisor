const msgWitness = require('./message-witness.json')

const { Runtime: { getNewVM, Runtime } } = require('@aztec/huff');
const BN = require('bn.js')
const { toBuffer } = require('ethereumjs-util')
const path = require('path')

const DebugVM = require('../utils/debug-vm')
const vm = new DebugVM()
const prettyPrintWords = (abiEncodedString) =>
  abiEncodedString.slice(2).match(/.{64}/g)
    .map((word, index) => console.log(
      `0x${(index * 32).toString(16)} | ${word}`
    ))

const { bytecode } = require('./contracts/easy-huff')(path.join(__dirname, 'contracts'), 'test.huff', 'TEST')

async function test() {
  await vm.setup()
  // const bytecodea = require('./test-code.json')
  const address = await vm.deploy(bytecode)
  console.log(address)
  const res = await vm.send({ to: address, gas: 6e6 })
  // console.log(res)
  console.log(res.witness)
  const calldata = res.witness.encode()
  prettyPrintWords(calldata)
  const res2 = await vm.callHypervisor(calldata)
  const { returnValue, stack, opCode, programCounter } = res2;
  console.log({ returnValue, stack, opCode, programCounter })
  prettyPrintWords('0x' + returnValue.toString('hex'))
  // console.log(res2)
  // const main = Runtime('test.huff', path.join(__dirname, 'contracts'));
  // const resa = await main(vm.vm, 'TEST', [], [], calldata, 0);
  // console.log(resa)
  // console.log(returnValue)
  // const calldata = toBuffer(require('./message-witness.json'))
  // console.log(calldata)
  // let inStack = ['20', '00', '20', '00', 'ffff', 'ffffffffffffffffffffffffffffffffffffffff', '00']
  // const main = Runtime('hypervisor.huff', path.join(__dirname, '..', 'src', 'huff_modules'));
  // const { stack, memory, bytecode, returnValue } = await main(vm, 'INITIALIZE_HYPERVISOR', [], [], calldata, 0);
  // console.log(stack)
  // console.log(returnValue)
}

test()