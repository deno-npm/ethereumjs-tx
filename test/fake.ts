import { Buffer, Common, util } from "../deps.js";
import { FakeTransaction } from "../mod.ts";
import { FakeTxData } from "./types.ts";
import {
  assert,
  assertEquals,
  assertNotEquals,
  assertThrows,
} from "./testing.js";

// Use private key 0x0000000000000000000000000000000000000000000000000000000000000001 as 'from' Account
const txData: FakeTxData = {
  data:
    "0x7cf5dab00000000000000000000000000000000000000000000000000000000000000005",
  gasLimit: "0x15f90",
  gasPrice: "0x1",
  nonce: "0x01",
  to: "0xd9024df085d09398ec76fbed18cac0e1149f50dc",
  value: "0x0",
  from: "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
  v: "0x1c",
  r: "0x25641558260ac737ea6d800906c6d085a801e5e0f0952bf93978d6fa468fbdfe",
  s: "0x5d0904b8f9cfc092805df0cde2574d25e2c5fc28907a9a4741b3e857b68b0778",
};

Deno.test("instantiate with from / create a hash", function () {
  // This test doesn't use EIP155
  const tx = new FakeTransaction(
    txData,
    { chain: "mainnet", hardfork: "homestead" },
  );
  const hash = tx.hash();
  const cmpHash = Buffer.from(
    "f74b039f6361c4351a99a7c6a10867369fe6701731d85dc07c15671ac1c1b648",
    "hex",
  );
  assertEquals(
    hash,
    cmpHash,
    "should create hash with includeSignature=true (default)",
  );
  const hash2 = tx.hash(false);
  const cmpHash2 = Buffer.from(
    "0401bf740d698674be321d0064f92cd6ebba5d73d1e5e5189c0bebbda33a85fe",
    "hex",
  );
  assertEquals(
    hash2,
    cmpHash2,
    "should create hash with includeSignature=false",
  );
  assertNotEquals(hash, hash2, "previous hashes should be different");
});

Deno.test("instantiate without from / create a hash", function () {
  const txDataNoFrom = Object.assign({}, txData);
  delete txDataNoFrom["from"];
  const tx = new FakeTransaction(txDataNoFrom);
  const hash = tx.hash();
  const cmpHash = Buffer.from(
    "80a2ca70509414908881f718502e6bbb3bc67f416abdf972ea7c0888579be7b9",
    "hex",
  );
  assertEquals(
    hash,
    cmpHash,
    "should create hash with includeSignature=true (default)",
  );
  const hash2 = tx.hash(false);
  const cmpHash2 = Buffer.from(
    "0401bf740d698674be321d0064f92cd6ebba5d73d1e5e5189c0bebbda33a85fe",
    "hex",
  );
  assertEquals(
    hash2,
    cmpHash2,
    "should create hash with includeSignature=false",
  );
  assertNotEquals(hash, hash2, "previous hashes should be different");
});

Deno.test("should not produce hash collsions for different senders", function () {
  const txDataModFrom = Object.assign({}, txData, {
    from: "0x2222222222222222222222222222222222222222",
  });
  const tx = new FakeTransaction(txData);
  const txModFrom = new FakeTransaction(txDataModFrom);
  const hash = util.bufferToHex(tx.hash());
  const hashModFrom = util.bufferToHex(txModFrom.hash());
  assertNotEquals(
    hash,
    hashModFrom,
    "FakeTransactions with different `from` addresses but otherwise identical data should have different hashes",
  );
});

Deno.test('should retrieve "from" from signature if transaction is signed', function () {
  const txDataNoFrom = Object.assign({}, txData);
  delete txDataNoFrom["from"];

  const tx = new FakeTransaction(txDataNoFrom);
  assertEquals(util.bufferToHex(tx.from), txData.from);
});

Deno.test("should throw if common and chain options are passed to constructor", function () {
  const txOptsInvalid = {
    chain: "mainnet",
    common: new Common("mainnet", "chainstart"),
  };
  assertThrows(() => new FakeTransaction(txData, txOptsInvalid));
});

Deno.test("should return toCreationAddress", () => {
  const tx = new FakeTransaction(txData);
  const txNoTo = new FakeTransaction({ ...txData, to: undefined });
  assertEquals(
    tx.toCreationAddress(),
    false,
    'tx is not "to" creation address',
  );
  assertEquals(txNoTo.toCreationAddress(), true, 'tx is "to" creation address');
});

Deno.test("should return getChainId", () => {
  const tx = new FakeTransaction(txData);
  const txWithChain = new FakeTransaction(txData, { chain: 3 });
  assertEquals(tx.getChainId(), 1, "should return correct chainId");
  assertEquals(txWithChain.getChainId(), 3, "should return correct chainId");
});

Deno.test("should getSenderAddress and getSenderPublicKey", () => {
  const tx = new FakeTransaction(txData);

  assertEquals(
    tx.from.toString("hex"),
    "7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    "this._from is set in FakeTransaction",
  );
  assertEquals(
    tx.getSenderAddress().toString("hex"),
    "7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    "should return correct address",
  );
});

Deno.test("should verifySignature", () => {
  const tx = new FakeTransaction(txData);
  const txWithWrongSignature = new FakeTransaction({
    ...txData,
    r: Buffer.from(
      "abcd1558260ac737ea6d800906c6d085a801e5e0f0952bf93978d6fa468fbdff",
      "hex",
    ),
  });

  assert(tx.verifySignature(), "signature is valid");
  assert(!txWithWrongSignature.verifySignature(), "signature is not valid");
});

Deno.test("should sign", () => {
  const tx = new FakeTransaction(txData, { hardfork: "tangerineWhistle" });
  tx.sign(
    Buffer.from(
      "164122e5d39e9814ca723a749253663bafb07f6af91704d9754c361eb315f0c1",
      "hex",
    ),
  );
  assertEquals(
    tx.r.toString("hex"),
    "c10062450d68caa5a688e2b6930f34f8302064afe6e1ba7f6ca459115a31d3b8",
    "r should be valid",
  );
  assertEquals(
    tx.s.toString("hex"),
    "31718e6bf821a98d35b0d9cd66ea86f91f420c3c4658f60c607222de925d222a",
    "s should be valid",
  );
  assertEquals(tx.v.toString("hex"), "1c", "v should be valid");
});

Deno.test("should getDataFee", () => {
  const tx = new FakeTransaction({ ...txData, data: "0x00000001" });

  assertEquals(tx.getDataFee().toString(), "80", "data fee should be correct");
});

Deno.test("should getBaseFee", () => {
  const tx = new FakeTransaction({ ...txData, data: "0x00000001" });

  assertEquals(
    tx.getBaseFee().toString(),
    "21080",
    "base fee should be correct",
  );
});

Deno.test("should getUpfrontCost", () => {
  const tx = new FakeTransaction(
    { ...txData, gasLimit: "0x6464", gasPrice: "0x2" },
  );

  assertEquals(
    tx.getUpfrontCost().toString(),
    "51400",
    "base fee should be correct",
  );
});

Deno.test("should validate", () => {
  const tx = new FakeTransaction(txData);
  const txWithWrongSignature = new FakeTransaction({
    ...txData,
    r: Buffer.from(
      "abcd1558260ac737ea6d800906c6d085a801e5e0f0952bf93978d6fa468fbdff",
      "hex",
    ),
  });
  const txWithLowLimit = new FakeTransaction({
    ...txData,
    gasLimit: "0x1",
  });
  assert(tx.validate(), "tx should be valid");
  assert(!txWithWrongSignature.validate(), "tx should be invalid");
  assert(!txWithLowLimit.validate(), "tx should be invalid");
  assertEquals(tx.validate(true), "", "tx should return no errors");
  assertEquals(
    txWithWrongSignature.validate(true),
    "Invalid Signature",
    "tx should return correct error",
  );
  assertEquals(
    txWithLowLimit.validate(true),
    "gas limit is too low. Need at least 21464",
    "tx should return correct error",
  );
});
