const VM = require('interstate-js-vm').default;
const getTxOpts = require('./tx');
const hypervisorMacro = require('../src/compile');



const txDataZero = 4;
const txDataNonZero = 16;

const dataFee = (data) => Buffer.from(data.slice(2), 'hex').reduce(
  (fee, nibble) => fee + (nibble == 0 ? txDataZero : txDataNonZero),
  0
)

/* function getDataFee(tx) {
  const _tx = getTxOpts({ ...tx }).tx.serialize()
  var data = _tx;
  var cost = new BN(0);
  for (var i = 0; i < data.length; i++) {
      data[i] === 0
          ? cost.iaddn(4)
          : cost.iaddn(16);
  }
  return cost;
} */

class DebugVM {
  constructor(privateKey) {
    this.vm = new VM({
      hardfork: 'istanbul',
      produceWitness: true
    });
    this.hypervisor;
    this.privateKey = privateKey;
  }

  async deploy(bytecode) {
    const { createdAddress } = await this.send({ data: bytecode });
    return `0x${createdAddress.toString('hex')}`;
  }

  async setup() {
    this.hypervisor = await this.deploy(hypervisorMacro.bytecode);
  }

  async call(tx) {
    return this.vm.runCall(tx);
  }

  async callHypervisor(calldata) {
    return this.send({
      data: calldata,
      to: this.hypervisor
    })
  }

  async send(tx, includeSteps) {
    let steps = [];
    
    if (includeSteps) this.vm.on('step', ({ pc, opcode, stack, depth }) => depth == 0 && steps.push({
      pc,
      opcode: opcode.name,
      stack: [...stack].reverse()
    }));

    const {
      createdAddress,
      execResult: { runState, witnesses },
      amountSpent
    } = await this.vm.runTx(getTxOpts(tx));
    const witness = witnesses[0];
    // console.log(runState)
    
    return {
      ...runState,
      amountSpent,
      createdAddress,
      witness,
      witnesses,
      steps
    };
  }

  async benchmark(tx) {
    const { gasUsed, witness } = await this.send(tx);
    const encodedWitness = witness.encode();
    const { gasUsed: gasUsed2 } = await this.callHypervisor(encodedWitness)

  }

  /* async compare(tx, priceOnly, getSteps) {
    const nativeResult = await this.send(tx, getSteps);
    let { txo, amountSpent: nativePrice } = nativeResult;
    nativePrice = nativePrice.toNumber();
    const virtualResult = await this.send({ from: tx.from, to: this.hypervisor, data: txo }, getSteps)
    let virtualPrice = virtualResult.amountSpent.toNumber();
    const { txo: txo2 } = virtualResult;
    const priceDifference = virtualPrice - nativePrice;
    return {
      nativePrice,
      virtualPrice,
      priceDifference,
      txo,
      txo2,
      ...(priceOnly ? {} : {
        nativeResult,
        virtualResult
      })
    };
  } */

/*   stepsToFile(steps) {
    let stepInfo = ({ pc, opcode, stack }) => `PC 0x${pc.toString(16)} | [${stack.map(x => x.toString(16))}] ${opcode}`;
    let isOp = (i, op) => steps[i].opcode == op;
    let isSequence = (start, seq) => {
      for (let i = 0; i < seq.length; i++) if (!isOp(start+i, seq[i])) return false;
      return true;
    }
    let virtualSteps = [];
    let stepRows = [];
    const opcodes = require('./opcodes')
    for (let i = 0; i < steps.length; i++) {
      let rowStr;
      if (isSequence(i, [
        'PUSH2', 'DUP1', 'MLOAD', 'PUSH1', 'ADD', 'DUP1', 
        'SWAP2', 'MSTORE', 'MLOAD', 'PUSH1', 'SHR', 'PUSH1',
        'MUL', 'MLOAD', 'JUMP'
      ])) {
        const vPc = (steps[i+3].stack[0].toNumber() + 1 - 0x20a0).toString(16)
        const vOp = (steps[i+11].stack[0])
        const vOpcode = opcodes[vOp]
        rowStr = `\n|| VIRTUAL PC: 0x${vPc} | VIRTUAL OP: 0x${vOp.toString(16)} ${vOpcode && vOpcode.name} ||`
        virtualSteps.push({
          pc: vPc,
          opcode: vOpcode.name,
          stack: steps[i+16].stack
        })
        i += 15;
      } else if (isSequence(i, ['MLOAD', 'PUSH1', 'SHR', 'PUSH1', 'MUL', 'MLOAD', 'JUMP'])) {
        const vPc = (steps[i].stack[0].toNumber() - 0x20a0).toString(16)
        const vOp = (steps[i+3].stack[0])
        const vOpcode = opcodes[vOp]
        rowStr = `\n|| VIRTUAL PC: 0x${vPc} | VIRTUAL OP: 0x${vOp.toString(16)} ${vOpcode && vOpcode.name} ||`
        virtualSteps.push({
          pc: vPc,
          opcode: vOpcode.name,
          stack: steps[i+8].stack
        })
        i += 7;
      } else rowStr = stepInfo(steps[i])
      stepRows.push(rowStr)
    }
    return {
      virtualSteps,
      stepFile: stepRows.join('\n')
    }
  }

  writeLogs(steps, steps2, txo, txo2) {
    let stepInfo = ({ pc, opcode, stack }) => `PC 0x${pc.toString(16)} | [${stack.map(x => x.toString(16))}] ${opcode}`;
    const calldata = txo2.callData.slice(2).match(/.{1,64}/g);
    const labels = {
      0: 'offset',
      32: 'origin',
      64: 'caller',
      96: 'to',
      128: 'context',
      160: 'stateRootEnter',
      192: 'stateRootLeave',
      224: 'value',
      256: 'sio offset',
      288: 'success',
      320: 'returndata offset',
      352: 'calldata offset'
    }
    const fs = require('fs')
    const cdStr = [];
    for (let i in calldata) {
      const str = calldata[i];
      const offset = i * 32;
      let label = labels[offset];
      cdStr.push(`0x${offset.toString(16)} | ${str} | ${label}`)
    }
    let stepComp = [];
    let { stepFile, virtualSteps } = this.stepsToFile(steps2);
    for (let i = 0; i < steps.length; i++) {
      if (virtualSteps[i]) {
        let real = steps[i]
        let virtual = virtualSteps[i];
        let stack1 = real.stack.map(x => x.toString(16))
        let stack2 = virtual.stack.map(x => x.toString(16))
        stepComp.push([
          `STEP ${i}`,
          `PC : REAL ${real.pc.toString(16)} VIRTUAL ${virtual.pc}`,
          `OP : REAL ${real.opcode} VIRTUAL ${virtual.opcode}`,
          `STACK : REAL    [${stack1}]`,
          `STACK : VIRTUAL [${stack2}]`
        ].join('\n'));
      }
    }
    
    fs.writeFileSync('./calldata-breakdown.txt', cdStr.join('\n'))
    fs.writeFileSync('./steps-real.txt', steps.map(stepInfo).join('\n'))
    fs.writeFileSync('./steps-virtual.txt', stepFile)
    fs.writeFileSync('./steps-compare.txt', stepComp.join('\n\n'))
    fs.writeFileSync('./txo.json', JSON.stringify(txo, null, 2))
    fs.writeFileSync('./txo2.json', JSON.stringify(txo2, null, 2))
  } */
}

module.exports = DebugVM;