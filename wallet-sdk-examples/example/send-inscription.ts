import { AddressType } from "@unisat/wallet-sdk";
import { NetworkType } from "@unisat/wallet-sdk/lib/network";
import { getAddressUtxoDust } from "@unisat/wallet-sdk/lib/transaction";
import { sendInscription } from "@unisat/wallet-sdk/lib/tx-helpers";
import { LocalWallet } from "@unisat/wallet-sdk/lib/wallet";
import { MempoolApi } from "./mempool-api";
import { OpenApi } from "./open-api";

const runSendInscription = async () => {
  const openapi = new OpenApi({
    baseUrl: "https://open-api-testnet.unisat.io",
    apiKey: "xxxx",
  });

  const wallet = new LocalWallet(
    "xxxxx",
    AddressType.P2WPKH,
    NetworkType.TESTNET
  );

  const inscriptionId = "xxxx";
  const toAddress = "xxxxx";
  const inscriptionInfo = await openapi.getInscriptionInfo(inscriptionId);
  const btcUtxos = await openapi.getAddressUtxoData(wallet.address);

  if (wallet.addressType === AddressType.P2PKH) {
    const mempoolApi = new MempoolApi({
      baseUrl: "https://mempool.space/testnet/api",
    });
    for (let i = 0; i < btcUtxos.utxo.length; i++) {
      btcUtxos.utxo[i].rawtx = await mempoolApi.getRawTx(btcUtxos.utxo[i].txid);
    }

    inscriptionInfo.utxo.rawtx = await mempoolApi.getRawTx(
      inscriptionInfo.utxo.txid
    );
  }

  const { psbt, toSignInputs } = await sendInscription({
    assetUtxo: {
      txid: inscriptionInfo.utxo.txid,
      vout: inscriptionInfo.utxo.vout,
      satoshis: inscriptionInfo.utxo.satoshi,
      scriptPk: inscriptionInfo.utxo.scriptPk,
      pubkey: wallet.pubkey,
      addressType: wallet.addressType,
      inscriptions: inscriptionInfo.utxo.inscriptions,
      atomicals: [],
      rawtx: inscriptionInfo.utxo.rawtx, // only for p2pkh
    },
    btcUtxos: btcUtxos.utxo.map((v) => ({
      txid: v.txid,
      vout: v.vout,
      satoshis: v.satoshi,
      scriptPk: v.scriptPk,
      pubkey: wallet.pubkey,
      addressType: wallet.addressType,
      inscriptions: v.inscriptions,
      atomicals: [],
      rawtx: v.rawtx, // only for p2pkh
    })),
    toAddress,
    networkType: wallet.networkType,
    changeAddress: wallet.address,
    feeRate: 1,
    outputValue: getAddressUtxoDust(toAddress),
  });

  let signWithLocalWallet = true;
  if (signWithLocalWallet) {
    // sign with local wallet
    await wallet.signPsbt(psbt, {
      autoFinalized: true,
      toSignInputs,
    });
    const rawtx = psbt.extractTransaction().toHex();

    const txid = await openapi.pushtx(rawtx);
    console.log("txid:", txid);
  } else {
    const psbtHex = psbt.toHex();
    console.log("psbtHex:", psbtHex);
    // copy this hex to a wallet that can sign it
    // unisat.signPsbt(psbtHex).then(result=>{
    //   unisat.pushPsbt(result).then(txid=>{ console.log('push success',txid) })
    //});
  }
};
runSendInscription();
