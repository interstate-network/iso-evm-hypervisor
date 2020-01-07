const rpcCall = require('kool-makerpccall');

const call = (method, params = []) => rpcCall('http://localhost:8545', method, params);

const waitOnTx = async (txHash) => {
  while (true) {
		const receipt = await call('eth_getTransactionReceipt', [ txHash ]);
		if (receipt) return receipt;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
};

const getTxo = (receipt) => call('txo_getByPath', [ [ receipt.blockNumber, receipt.transactionIndex ], 's' ])

const gas = 6e6;
const gasPrice = 1;

const send = async ({ from, to, data }) => waitOnTx(await call('eth_sendTransaction', [{ to, data, gasPrice, gas, from }]));
const deploy = ({ from, data }) => send({ from, data });

module.exports = {
  call,
  send,
  deploy,
  waitOnTx,
  getTxo
};