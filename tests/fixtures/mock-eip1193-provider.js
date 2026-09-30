(() => {
  const ARC_CHAIN_ID = "0x4cef52";
  const ARC_RPC_URL = "https://rpc.testnet.arc.io";
  const WALLET = "0x1234567890abcdef1234567890abcdef12345678";
  const TOKEN_BALANCE = 5_000_000n;
  const GAS_BALANCE = 5_000_000_000_000_000_000n;
  const GAS_PRICE = 1_000_000_000n;
  const SELECTOR_APPROVE = "0x095ea7b3";
  const SELECTOR_BALANCE_OF = "0x70a08231";
  const SELECTOR_ALLOWANCE = "0xdd62ed3e";

  const hex = (value) => `0x${BigInt(value).toString(16)}`;
  const word = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;
  const hashFor = (index) => `0x${index.toString(16).padStart(64, "0")}`;

  class MockArcWalletProvider {
    constructor() {
      this.chainId = "0x1";
      this.arcAdded = false;
      this.allowance = 0n;
      this.transactionIndex = 0;
      this.currentBlock = 100n;
      this.receipts = new Map();
      this.batches = new Map();
      this.requests = [];
      this.listeners = new Map();
    }

    on(eventName, listener) {
      const listeners = this.listeners.get(eventName) ?? new Set();
      listeners.add(listener);
      this.listeners.set(eventName, listeners);
      return this;
    }

    removeListener(eventName, listener) {
      this.listeners.get(eventName)?.delete(listener);
      return this;
    }

    off(eventName, listener) {
      return this.removeListener(eventName, listener);
    }

    emit(eventName, value) {
      for (const listener of this.listeners.get(eventName) ?? []) listener(value);
    }

    recordTransaction(transaction) {
      const selector = String(transaction.data ?? "").slice(0, 10).toLowerCase();
      if (selector === SELECTOR_APPROVE) this.allowance = 10_000_000n;
      this.transactionIndex += 1;
      this.currentBlock += 1n;
      const hash = hashFor(this.transactionIndex);
      const blockHash = `0x${(10_000 + this.transactionIndex).toString(16).padStart(64, "0")}`;
      const receipt = {
        blockHash,
        blockNumber: hex(this.currentBlock),
        contractAddress: null,
        cumulativeGasUsed: hex(90_000n),
        effectiveGasPrice: hex(GAS_PRICE),
        from: WALLET,
        gasUsed: hex(90_000n),
        logs: [],
        logsBloom: `0x${"0".repeat(512)}`,
        status: "0x1",
        to: transaction.to,
        transactionHash: hash,
        transactionIndex: "0x0",
        type: "0x2",
      };
      this.receipts.set(hash, receipt);
      return receipt;
    }

    async request({ method, params = [] }) {
      this.requests.push({ method, params });
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [WALLET];
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts", caveats: [{ type: "restrictReturnedAccounts", value: [WALLET] }] }];
        case "eth_chainId":
          return this.chainId;
        case "wallet_addEthereumChain":
          this.arcAdded = true;
          this.chainId = params[0]?.chainId ?? ARC_CHAIN_ID;
          this.emit("chainChanged", this.chainId);
          return null;
        case "wallet_switchEthereumChain": {
          const requested = params[0]?.chainId;
          if (requested === ARC_CHAIN_ID && !this.arcAdded) {
            const error = new Error("Unrecognized chain");
            error.code = 4902;
            throw error;
          }
          this.chainId = requested;
          this.emit("chainChanged", this.chainId);
          return null;
        }
        case "eth_getBalance":
          return hex(GAS_BALANCE);
        case "eth_gasPrice":
          return hex(GAS_PRICE);
        case "eth_estimateGas":
          return hex(90_000n);
        case "eth_call": {
          const data = String(params[0]?.data ?? "").slice(0, 10).toLowerCase();
          if (data === SELECTOR_BALANCE_OF) return word(TOKEN_BALANCE);
          if (data === SELECTOR_ALLOWANCE) return word(this.allowance);
          return word(0n);
        }
        case "eth_sendTransaction": {
          return this.recordTransaction(params[0] ?? {}).transactionHash;
        }
        case "wallet_sendCalls": {
          const batch = params[0] ?? {};
          if (batch.atomicRequired !== true) throw new Error("mock 只接受原子批量交易");
          const receipts = (batch.calls ?? []).map((call) => this.recordTransaction(call));
          const bundleId = hashFor(10_000 + this.transactionIndex);
          this.batches.set(bundleId, receipts);
          return bundleId;
        }
        case "wallet_getCallsStatus": {
          const receipts = this.batches.get(params[0]);
          if (!receipts) throw new Error("未知的 mock 批量交易");
          return {
            atomic: true,
            chainId: this.chainId,
            receipts,
            status: 200,
            version: "2.0.0",
          };
        }
        case "eth_getTransactionReceipt":
          return this.receipts.get(params[0]) ?? null;
        case "eth_getTransactionByHash": {
          const receipt = this.receipts.get(params[0]);
          if (!receipt) return null;
          return {
            blockHash: receipt.blockHash,
            blockNumber: receipt.blockNumber,
            from: receipt.from,
            gas: receipt.gasUsed,
            gasPrice: receipt.effectiveGasPrice,
            hash: receipt.transactionHash,
            input: "0x",
            nonce: "0x0",
            to: receipt.to,
            transactionIndex: receipt.transactionIndex,
            value: "0x0",
            type: receipt.type,
          };
        }
        case "eth_getBlockByNumber":
          return {
            baseFeePerGas: hex(GAS_PRICE),
            gasLimit: hex(30_000_000n),
            gasUsed: hex(90_000n),
            hash: `0x${"b".repeat(64)}`,
            number: hex(this.currentBlock),
            parentHash: `0x${"a".repeat(64)}`,
            timestamp: hex(BigInt(Math.floor(Date.now() / 1_000))),
            transactions: [],
          };
        case "eth_blockNumber":
          this.currentBlock = this.currentBlock < 111n ? 111n : this.currentBlock + 5_000n;
          return hex(this.currentBlock);
        default:
          throw new Error(`mock 钱包未实现方法：${method}`);
      }
    }
  }

  const provider = new MockArcWalletProvider();
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: provider,
  });
  Object.defineProperty(window, "__mockArcWalletProvider", {
    configurable: true,
    value: provider,
  });

  // RainbowKit 的公开客户端使用 HTTP RPC；浏览器验收也必须拦截它，
  // 否则假交易哈希会被发送到真实 Arc RPC 并永远等不到回执。
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(ARC_RPC_URL)) return nativeFetch(input, init);
    const body = init?.body ?? (input instanceof Request ? await input.clone().text() : "");
    const payload = JSON.parse(String(body));
    const handle = async (request) => {
      try {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: await provider.request({ method: request.method, params: request.params ?? [] }),
        };
      } catch (error) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: error.code ?? -32601, message: error.message },
        };
      }
    };
    const response = Array.isArray(payload)
      ? await Promise.all(payload.map(handle))
      : await handle(payload);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
})();
