"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = exports.setProvider = exports.AnchorProvider = void 0;
const web3_js_1 = require("@solana/web3.js");
const index_js_1 = require("./utils/bytes/index.js");
const common_js_1 = require("./utils/common.js");
const rpc_js_1 = require("./utils/rpc.js");
/**
 * The network and wallet context used to send transactions paid for and signed
 * by the provider.
 */
class AnchorProvider {
    /**
     * @param connection The cluster connection where the program is deployed.
     * @param wallet     The wallet used to pay for and sign all transactions.
     * @param opts       Transaction confirmation options to use by default.
     */
    constructor(connection, wallet, opts) {
        this.connection = connection;
        this.wallet = wallet;
        this.opts = opts;
        this.publicKey = wallet.publicKey;
    }
    static defaultOptions() {
        return {
            preflightCommitment: "processed",
            commitment: "processed",
        };
    }
    /**
     * Returns a `Provider` with a wallet read from the local filesystem.
     *
     * @param url  The network cluster url.
     * @param opts The default transaction confirmation options.
     *
     * (This api is for Node only.)
     */
    static local(url, opts) {
        if (common_js_1.isBrowser) {
            throw new Error(`Provider local is not available on browser.`);
        }
        opts = opts !== null && opts !== void 0 ? opts : AnchorProvider.defaultOptions();
        const connection = new web3_js_1.Connection(url !== null && url !== void 0 ? url : "http://localhost:8899", opts.preflightCommitment);
        const NodeWallet = require("./nodewallet.js").default;
        const wallet = NodeWallet.local();
        return new AnchorProvider(connection, wallet, opts);
    }
    /**
     * Returns a `Provider` read from the `ANCHOR_PROVIDER_URL` environment
     * variable
     *
     * (This api is for Node only.)
     */
    static env() {
        if (common_js_1.isBrowser) {
            throw new Error(`Provider env is not available on browser.`);
        }
        const process = require("process");
        const url = process.env.ANCHOR_PROVIDER_URL;
        if (url === undefined) {
            throw new Error("ANCHOR_PROVIDER_URL is not defined");
        }
        const options = AnchorProvider.defaultOptions();
        const connection = new web3_js_1.Connection(url, options.commitment);
        const NodeWallet = require("./nodewallet.js").default;
        const wallet = NodeWallet.local();
        return new AnchorProvider(connection, wallet, options);
    }
    /**
     * Sends the given transaction, paid for and signed by the provider's wallet.
     *
     * @param tx      The transaction to send.
     * @param signers The signers of the transaction.
     * @param opts    Transaction confirmation options.
     */
    async sendAndConfirm(tx, signers, opts) {
        var _a;
        if (opts === undefined) {
            opts = this.opts;
        }
        tx.feePayer = this.wallet.publicKey;
        tx.recentBlockhash = (await this.connection.getRecentBlockhash(opts.preflightCommitment)).blockhash;
        tx = await this.wallet.signTransaction(tx);
        (signers !== null && signers !== void 0 ? signers : []).forEach((kp) => {
            tx.partialSign(kp);
        });
        const rawTx = tx.serialize();
        try {
            return await sendAndConfirmRawTransaction(this.connection, rawTx, opts);
        }
        catch (err) {
            // thrown if the underlying 'confirmTransaction' encounters a failed tx
            // the 'confirmTransaction' error does not return logs so we make another rpc call to get them
            if (err instanceof ConfirmError) {
                // choose the shortest available commitment for 'getTransaction'
                // (the json RPC does not support any shorter than "confirmed" for 'getTransaction')
                // because that will see the tx sent with `sendAndConfirmRawTransaction` no matter which
                // commitment `sendAndConfirmRawTransaction` used
                const failedTx = await this.connection.getTransaction(index_js_1.bs58.encode(tx.signature), { commitment: "confirmed" });
                if (!failedTx) {
                    throw err;
                }
                else {
                    const logs = (_a = failedTx.meta) === null || _a === void 0 ? void 0 : _a.logMessages;
                    throw !logs ? err : new web3_js_1.SendTransactionError(err.message, logs);
                }
            }
            else {
                throw err;
            }
        }
    }
    /**
     * Registers a transaction signature upstream then upon success sends the given transaction, paid for and signed by the provider's wallet.
     *
     * @param tx          The transaction to send.
     * @param register    The register callback.
     * @param signers     The signers of the transaction.
     * @param opts        Transaction confirmation options.
     */
    async registerSendAndConfirm(tx, register, signers, opts) {
        var _a;
        if (opts === undefined) {
            opts = this.opts;
        }
        tx.feePayer = this.wallet.publicKey;
        tx.recentBlockhash = (await this.connection.getRecentBlockhash(opts.preflightCommitment)).blockhash;
        tx = await this.wallet.signTransaction(tx);
        (signers !== null && signers !== void 0 ? signers : []).forEach((kp) => {
            tx.partialSign(kp);
        });
        if (!await register(tx.signature)) {
            throw new Error("Signature registration failed");
        }
        const rawTx = tx.serialize();
        try {
            return await sendAndConfirmRawTransaction(this.connection, rawTx, opts);
        }
        catch (err) {
            // thrown if the underlying 'confirmTransaction' encounters a failed tx
            // the 'confirmTransaction' error does not return logs so we make another rpc call to get them
            if (err instanceof ConfirmError) {
                // choose the shortest available commitment for 'getTransaction'
                // (the json RPC does not support any shorter than "confirmed" for 'getTransaction')
                // because that will see the tx sent with `sendAndConfirmRawTransaction` no matter which
                // commitment `sendAndConfirmRawTransaction` used
                const failedTx = await this.connection.getTransaction(index_js_1.bs58.encode(tx.signature), { commitment: "confirmed" });
                if (!failedTx) {
                    throw err;
                }
                else {
                    const logs = (_a = failedTx.meta) === null || _a === void 0 ? void 0 : _a.logMessages;
                    throw !logs ? err : new web3_js_1.SendTransactionError(err.message, logs);
                }
            }
            else {
                throw err;
            }
        }
    }
    /**
     * Registers a transaction signature upstream then upon success sends the given transaction without confirming the transaction immediately.
     *
     * @param tx          The transaction to send.
     * @param register    The register callback.
     * @param signers     The signers of the transaction.
     * @param opts        Transaction confirmation options.
     */
    async registerAndSend(tx, register, signers, opts) {
        if (opts === undefined) {
            opts = this.opts;
        }
        tx.feePayer = this.wallet.publicKey;
        tx.recentBlockhash = (await this.connection.getRecentBlockhash(opts.preflightCommitment)).blockhash;
        tx = await this.wallet.signTransaction(tx);
        (signers !== null && signers !== void 0 ? signers : []).forEach((kp) => {
            tx.partialSign(kp);
        });
        if (!await register(tx.signature)) {
            throw new Error("Signature registration failed");
        }
        const rawTx = tx.serialize();
        return await sendRawTransaction(this.connection, rawTx, opts);
    }
    /**
     * Similar to `send`, but for an array of transactions and signers.
     */
    async sendAll(txWithSigners, opts) {
        if (opts === undefined) {
            opts = this.opts;
        }
        const blockhash = await this.connection.getRecentBlockhash(opts.preflightCommitment);
        let txs = txWithSigners.map((r) => {
            var _a;
            let tx = r.tx;
            let signers = (_a = r.signers) !== null && _a !== void 0 ? _a : [];
            tx.feePayer = this.wallet.publicKey;
            tx.recentBlockhash = blockhash.blockhash;
            signers.forEach((kp) => {
                tx.partialSign(kp);
            });
            return tx;
        });
        const signedTxs = await this.wallet.signAllTransactions(txs);
        const sigs = [];
        for (let k = 0; k < txs.length; k += 1) {
            const tx = signedTxs[k];
            const rawTx = tx.serialize();
            sigs.push(await sendAndConfirmRawTransaction(this.connection, rawTx, opts));
        }
        return sigs;
    }
    /**
     * Similar to `send`, but for an array of transactions and signers.
     */
    async registerAndSendAll(txWithSigners, register, skipConfirm = false, opts) {
        if (opts === undefined) {
            opts = this.opts;
        }
        const blockhash = await this.connection.getRecentBlockhash(opts.preflightCommitment);
        let txs = txWithSigners.map((r) => {
            var _a;
            let tx = r.tx;
            let signers = (_a = r.signers) !== null && _a !== void 0 ? _a : [];
            tx.feePayer = this.wallet.publicKey;
            tx.recentBlockhash = blockhash.blockhash;
            signers.forEach((kp) => {
                tx.partialSign(kp);
            });
            return tx;
        });
        const signedTxs = await this.wallet.signAllTransactions(txs);
        const sigs = [];
        for (let j = 0; j < signedTxs.length; j += 1) {
            let st = signedTxs[j];
            if (!await register(st.signature)) {
                throw new Error("Signature registration failed");
            }
        }
        for (let k = 0; k < txs.length; k += 1) {
            const tx = signedTxs[k];
            const rawTx = tx.serialize();
            if (skipConfirm) {
                sigs.push(await sendRawTransaction(this.connection, rawTx, opts));
            }
            else {
                sigs.push(await sendAndConfirmRawTransaction(this.connection, rawTx, opts));
            }
        }
        return sigs;
    }
    /**
     * Simulates the given transaction, returning emitted logs from execution.
     *
     * @param tx      The transaction to send.
     * @param signers The signers of the transaction.
     * @param opts    Transaction confirmation options.
     */
    async simulate(tx, signers, commitment, includeAccounts) {
        tx.feePayer = this.wallet.publicKey;
        tx.recentBlockhash = (await this.connection.getLatestBlockhash(commitment !== null && commitment !== void 0 ? commitment : this.connection.commitment)).blockhash;
        tx = await this.wallet.signTransaction(tx);
        const result = await (0, rpc_js_1.simulateTransaction)(this.connection, tx, signers, commitment, includeAccounts);
        if (result.value.err) {
            throw new SimulateError(result.value);
        }
        return result.value;
    }
}
exports.AnchorProvider = AnchorProvider;
class SimulateError extends Error {
    constructor(simulationResponse, message) {
        super(message);
        this.simulationResponse = simulationResponse;
    }
}
// Copy of Connection.sendAndConfirmRawTransaction that throws
// a better error if 'confirmTransaction` returns an error status
async function sendAndConfirmRawTransaction(connection, rawTransaction, options) {
    const sendOptions = options && {
        skipPreflight: options.skipPreflight,
        preflightCommitment: options.preflightCommitment || options.commitment,
    };
    const signature = await connection.sendRawTransaction(rawTransaction, sendOptions);
    const status = (await connection.confirmTransaction(signature, options && options.commitment)).value;
    if (status.err) {
        throw new ConfirmError(`Raw transaction ${signature} failed (${JSON.stringify(status)})`);
    }
    return signature;
}
// Copy of Connection.sendAndConfirmRawTransaction that just sends
async function sendRawTransaction(connection, rawTransaction, options) {
    const sendOptions = options && {
        skipPreflight: options.skipPreflight,
        preflightCommitment: options.preflightCommitment || options.commitment,
    };
    const signature = await connection.sendRawTransaction(rawTransaction, sendOptions);
    return signature;
}
class ConfirmError extends Error {
    constructor(message) {
        super(message);
    }
}
/**
 * Sets the default provider on the client.
 */
function setProvider(provider) {
    _provider = provider;
}
exports.setProvider = setProvider;
/**
 * Returns the default provider being used by the client.
 */
function getProvider() {
    if (_provider === null) {
        return AnchorProvider.local();
    }
    return _provider;
}
exports.getProvider = getProvider;
// Global provider used as the default when a provider is not given.
let _provider = null;
//# sourceMappingURL=provider.js.map