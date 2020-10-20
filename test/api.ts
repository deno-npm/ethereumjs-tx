import {
  Common,
  Buffer,
  util,
} from '../deps.js';
import { Transaction, TxData } from '../mod.ts';
import { TxsJsonEntry, VitaliksTestsDataEntry } from "./types.ts";
import {
  assert,
  assertEquals,
  assertThrows,
} from "./testing.js";

const { rlp, zeros, privateToPublic, toBuffer } = util;

const txFixtures: TxsJsonEntry[] = await Deno.readTextFile(
  new URL('./txs.json', import.meta.url),
)
  .then(JSON.parse);

const txFixturesEip155: VitaliksTestsDataEntry[] = await Deno.readTextFile(
  new URL('./ttTransactionTestEip155VitaliksTests.json', import.meta.url),
)
  .then(JSON.parse);

// tape('[Transaction]: Basic functions', function(t) {
  const transactions: Transaction[] = []

  Deno.test('Transaction should decode transactions', function() {
    txFixtures.slice(0, 4).forEach(function(tx: TxsJsonEntry) {
      const pt = new Transaction(tx.raw)
      assertEquals('0x' + pt.nonce.toString('hex'), tx.raw[0])
      assertEquals('0x' + pt.gasPrice.toString('hex'), tx.raw[1])
      assertEquals('0x' + pt.gasLimit.toString('hex'), tx.raw[2])
      assertEquals('0x' + pt.to.toString('hex'), tx.raw[3])
      assertEquals('0x' + pt.value.toString('hex'), tx.raw[4])
      assertEquals('0x' + pt.v.toString('hex'), tx.raw[6])
      assertEquals('0x' + pt.r.toString('hex'), tx.raw[7])
      assertEquals('0x' + pt.s.toString('hex'), tx.raw[8])
      assertEquals('0x' + pt.data.toString('hex'), tx.raw[5])
      transactions.push(pt)
    });
  })

  Deno.test('Transaction should serialize', function() {
    transactions.forEach(function(tx) {
      assertEquals(tx.serialize(), rlp.encode(tx.raw))
    })
  })

  Deno.test('Transaction should hash', function() {
    const tx = new Transaction(txFixtures[3].raw)
    assertEquals(
      tx.hash(),
      Buffer.from('375a8983c9fc56d7cfd118254a80a8d7403d590a6c9e105532b67aca1efb97aa', 'hex'),
    )
    assertEquals(
      tx.hash(false),
      Buffer.from('61e1ec33764304dddb55348e7883d4437426f44ab3ef65e6da1e025734c03ff0', 'hex'),
    )
    assertEquals(
      tx.hash(true),
      Buffer.from('375a8983c9fc56d7cfd118254a80a8d7403d590a6c9e105532b67aca1efb97aa', 'hex'),
    )
  })

  Deno.test('Transaction should hash with defined chainId', function() {
    const tx = new Transaction(txFixtures[4].raw)
    assertEquals(
      tx.hash().toString('hex'),
      '0f09dc98ea85b7872f4409131a790b91e7540953992886fc268b7ba5c96820e4',
    )
    assertEquals(
      tx.hash(true).toString('hex'),
      '0f09dc98ea85b7872f4409131a790b91e7540953992886fc268b7ba5c96820e4',
    )
    assertEquals(
      tx.hash(false).toString('hex'),
      'f97c73fdca079da7652dbc61a46cd5aeef804008e057be3e712c43eac389aaf0',
    )
  })

  Deno.test('should verify Signatures', function() {
    transactions.forEach(function(tx) {
      assertEquals(tx.verifySignature(), true)
    })
  })

  Deno.test('should not verify Signatures', function() {
    transactions.forEach(function(tx) {
      tx.s = zeros(32)
      assertEquals(tx.verifySignature(), false)
    })
  })

  Deno.test('should give a string about not verifing Signatures', function() {
    transactions.forEach(function(tx) {
      assertEquals(
        tx.validate(true).slice(0, 54),
        'Invalid Signature gas limit is too low. Need at least ',
      )
    })
  })

  Deno.test('should validate', function() {
    transactions.forEach(function(tx) {
      assertEquals(tx.validate(), false)
    })
  })

  Deno.test('should sign tx', function() {
    transactions.forEach(function(tx, i) {
      if (txFixtures[i].privateKey) {
        const privKey = Buffer.from(txFixtures[i].privateKey, 'hex')
        tx.sign(privKey)
      }
    })
  })

  Deno.test("should get sender's address after signing it", function() {
    transactions.forEach(function(tx, i) {
      if (txFixtures[i].privateKey) {
        assertEquals(tx.getSenderAddress().toString('hex'), txFixtures[i].sendersAddress)
      }
    })
  })

  Deno.test("should get sender's public key after signing it", function() {
    transactions.forEach(function(tx, i) {
      if (txFixtures[i].privateKey) {
        assertEquals(
          tx.getSenderPublicKey().toString('hex'),
          privateToPublic(Buffer.from(txFixtures[i].privateKey, 'hex')).toString('hex'),
        )
      }
    })
  })

  Deno.test("should get sender's address after signing it (second call should be cached)", function() {
    transactions.forEach(function(tx, i) {
      if (txFixtures[i].privateKey) {
        assertEquals(tx.getSenderAddress().toString('hex'), txFixtures[i].sendersAddress)
        assertEquals(tx.getSenderAddress().toString('hex'), txFixtures[i].sendersAddress)
      }
    })
  })

  Deno.test('should verify signing it', function() {
    transactions.forEach(function(tx, i) {
      if (txFixtures[i].privateKey) {
        assertEquals(tx.verifySignature(), true)
      }
    })
  })

  Deno.test('should validate with string option', function() {
    transactions.forEach(function(tx) {
      tx.gasLimit = toBuffer(30000)
      assertEquals(tx.validate(true), '')
    })
  })

  Deno.test('should round trip decode a tx', function() {
    const tx = new Transaction()
    tx.value = toBuffer(5000)
    const s1 = tx.serialize().toString('hex')
    const tx2 = new Transaction(s1)
    const s2 = tx2.serialize().toString('hex')
    assertEquals(s1, s2)
  })

  Deno.test('should accept lesser r values', function() {
    const tx = new Transaction()
    tx.r = toBuffer('0x0005')
    assertEquals(tx.r.toString('hex'), '05')
  })

  Deno.test('should return data fee', function() {
    let tx = new Transaction()
    assertEquals(tx.getDataFee().toNumber(), 0)

    tx = new Transaction(txFixtures[3].raw)
    assertEquals(tx.getDataFee().toNumber(), 2496)

  })

  Deno.test('should return base fee', function() {
    const tx = new Transaction()
    assertEquals(tx.getBaseFee().toNumber(), 53000)
  })

  Deno.test('should return upfront cost', function() {
    const tx = new Transaction({
      gasPrice: 1000,
      gasLimit: 10000000,
      value: 42,
    })
    assertEquals(tx.getUpfrontCost().toNumber(), 10000000042)
  })

  Deno.test("Verify EIP155 Signature based on Vitalik's tests", function() {
    txFixturesEip155.forEach(function(tx) {
      const pt = new Transaction(tx.rlp)
      assertEquals(pt.hash(false).toString('hex'), tx.hash)
      assertEquals('0x' + pt.serialize().toString('hex'), tx.rlp)
      assertEquals(pt.getSenderAddress().toString('hex'), tx.sender)
    })
  })

  Deno.test('Verify EIP155 Signature before and after signing with private key', function() {
    // Inputs and expected results for this test are taken directly from the example in https://eips.ethereum.org/EIPS/eip-155
    const txRaw = [
      '0x09',
      '0x4a817c800',
      '0x5208',
      '0x3535353535353535353535353535353535353535',
      '0x0de0b6b3a7640000',
      '0x',
    ]
    const privateKey = Buffer.from(
      '4646464646464646464646464646464646464646464646464646464646464646',
      'hex',
    )
    const pt = new Transaction(txRaw)

    // Note that Vitalik's example has a very similar value denoted "signing data". It's not the
    // output of `serialize()`, but the pre-image of the hash returned by `tx.hash(false)`.
    // We don't have a getter for such a value in Transaction.
    assertEquals(
      pt.serialize().toString('hex'),
      'ec098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a764000080808080',
    )
    pt.sign(privateKey)
    assertEquals(
      pt.hash(false).toString('hex'),
      'daf5a779ae972f972197303d7b574746c7ef83eadac0f2791ad23db92e4c8e53',
    )
    assertEquals(
      pt.serialize().toString('hex'),
      'f86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83',
    )
  })

  Deno.test(
    'Serialize correctly after being signed with EIP155 Signature for tx created on ropsten',
    function() {
      const txRaw = [
        '0x1',
        '0x02540be400',
        '0x5208',
        '0xd7250824390ec5c8b71d856b5de895e271170d9d',
        '0x0de0b6b3a7640000',
        '0x',
      ]

      const privateKey = Buffer.from(
        'DE3128752F183E8930D7F00A2AAA302DCB5E700B2CBA2D8CA5795660F07DEFD5',
        'hex',
      )
      const pt = new Transaction(txRaw, { chain: 3 })
      pt.sign(privateKey)
      assertEquals(
        pt.serialize().toString('hex'),
        'f86c018502540be40082520894d7250824390ec5c8b71d856b5de895e271170d9d880de0b6b3a76400008029a0d3512c68099d184ccf54f44d9d6905bff303128574b663dcf10b4c726ddd8133a0628acc8f481dea593f13309dfc5f0340f83fdd40cf9fbe47f782668f6f3aec74',
      )
    },
  )

  Deno.test('sign tx with chainId specified in params', function() {
    const tx = new Transaction({}, { chain: 42 })
    assertEquals(tx.getChainId(), 42)
    const privKey = Buffer.from(txFixtures[0].privateKey, 'hex')
    tx.sign(privKey)
    const serialized = tx.serialize()
    const reTx = new Transaction(serialized, { chain: 42 })
    assert(reTx.verifySignature())
    assertEquals(reTx.getChainId(), 42)
  })

  Deno.test('throws when creating a a transaction with incompatible chainid and v value', function() {
    const tx = new Transaction({}, { chain: 42 })
    assertEquals(tx.getChainId(), 42)
    const privKey = Buffer.from(txFixtures[0].privateKey, 'hex')
    tx.sign(privKey)
    const serialized = tx.serialize()
    assertThrows(() => new Transaction(serialized))
  })

  Deno.test('Throws if chain/hardfork and commmon options are given', function() {
    assertThrows(
      () => new Transaction({}, { common: new Common('mainnet', 'petersburg'), chain: 'mainnet' }),
    )
    assertThrows(
      () => new Transaction({}, { common: new Common('mainnet', 'petersburg'), chain: 'ropsten' }),
    )
    assertThrows(
      () =>
        new Transaction(
          {},
          { common: new Common('mainnet', 'petersburg'), hardfork: 'petersburg' },
        ),
    )
  })

  Deno.test('Throws if v is set to an EIP155-encoded value incompatible with the chain id', function() {
    const tx = new Transaction({}, { chain: 42 })
    const privKey = Buffer.from(txFixtures[0].privateKey, 'hex')
    tx.sign(privKey)

    assertThrows(() => (tx.v = toBuffer(1)))

    const unsignedTx = new Transaction(tx.raw.slice(0, 6))
    assertThrows(() => (unsignedTx.v = tx.v))

  })

  Deno.test('EIP155 hashing when singing', function() {
    txFixtures.slice(0, 3).forEach(function(txData) {
      const tx = new Transaction(txData.raw.slice(0, 6), { chain: 1 })

      const privKey = Buffer.from(txData.privateKey, 'hex')
      tx.sign(privKey)

      assertEquals(
        tx.getSenderAddress().toString('hex'),
        txData.sendersAddress,
        "computed sender address should equal the fixture's one",
      )
    })

  })

  Deno.test(
    'Should ignore any previous signature when decided if EIP155 should be used in a new one',
    function() {
      const privateKey = Buffer.from(
        '4646464646464646464646464646464646464646464646464646464646464646',
        'hex',
      )

      const txData: TxData = {
        data: '0x7cf5dab00000000000000000000000000000000000000000000000000000000000000005',
        gasLimit: '0x15f90',
        gasPrice: '0x1',
        nonce: '0x01',
        to: '0xd9024df085d09398ec76fbed18cac0e1149f50dc',
        value: '0x0',
      }

      const fixtureTxSignedWithEIP155 = new Transaction(txData)
      fixtureTxSignedWithEIP155.sign(privateKey)

      const fixtureTxSignedWithoutEIP155 = new Transaction(txData, { hardfork: 'tangerineWhistle' })
      fixtureTxSignedWithoutEIP155.sign(privateKey)

      let signedWithEIP155 = new Transaction(fixtureTxSignedWithEIP155.toJSON(true))
      signedWithEIP155.sign(privateKey)
      assert(signedWithEIP155.verifySignature())
      assert(signedWithEIP155.v.toString('hex') !== '1c')
      assert(signedWithEIP155.v.toString('hex') !== '1b')

      signedWithEIP155 = new Transaction(fixtureTxSignedWithoutEIP155.toJSON(true))
      signedWithEIP155.sign(privateKey)
      assert(signedWithEIP155.verifySignature())
      assert(signedWithEIP155.v.toString('hex') !== '1c')
      assert(signedWithEIP155.v.toString('hex') !== '1b')

      let signedWithoutEIP155 = new Transaction(fixtureTxSignedWithEIP155.toJSON(true), {
        hardfork: 'tangerineWhistle',
      })
      signedWithoutEIP155.sign(privateKey)
      assert(signedWithoutEIP155.verifySignature())
      assert(
        signedWithoutEIP155.v.toString('hex') == '1c' ||
          signedWithoutEIP155.v.toString('hex') == '1b',
        "v shouldn' be EIP155 encoded",
      )

      signedWithoutEIP155 = new Transaction(fixtureTxSignedWithoutEIP155.toJSON(true), {
        hardfork: 'tangerineWhistle',
      })
      signedWithoutEIP155.sign(privateKey)
      assert(signedWithoutEIP155.verifySignature())
      assert(
        signedWithoutEIP155.v.toString('hex') == '1c' ||
          signedWithoutEIP155.v.toString('hex') == '1b',
        "v shouldn' be EIP155 encoded",
      )
    },
  )

  Deno.test('should return correct data fee for istanbul', function() {
    let tx = new Transaction({}, { hardfork: 'istanbul' })
    assertEquals(tx.getDataFee().toNumber(), 0)

    tx = new Transaction(txFixtures[3].raw, { hardfork: 'istanbul' })
    assertEquals(tx.getDataFee().toNumber(), 1716)

  })
