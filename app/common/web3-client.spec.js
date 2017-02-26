const expect = require('expect.js')
const Web3Client = require('./web3-client')
const geth = require('geth')
const rimraf = require('rimraf')
const Embark = require('embark')
const EmbarkSpec = Embark.initTests()

const ETH_TEST_CHAIN_DIR = '.ethereum-test'
const WEB3_URL = 'http://localhost:8546'
const q = require('q')
const sinon = require('sinon')

describe('web3-client', () => {
  let web3Client = null
  before((done) => {
    const options = {
      port: 30304,
      rpc: null,
      ipcpath: '.ethereum-test/geth.ipc',
      rpcport: 8546,
      datadir: ETH_TEST_CHAIN_DIR,
      rpcapi: 'admin,db,eth,net,web3,personal,web3',
      fast: 'init contracts/genesis.json' // workaround to get this command in here.
    }
    geth.start(options, function (err, proc) {
      if (err) console.log('error starting geth', err)
      web3Client = new Web3Client({
        web3Url: WEB3_URL,
        pollIntervalMs: 1000
      })
      done(err)
    })
  })
  afterEach((done) => {
    rimraf(ETH_TEST_CHAIN_DIR + '/keystore', (e) => { done(e) })
  })
  after((done) => {
    web3Client.stop()
    geth.stop(() => {
      rimraf(ETH_TEST_CHAIN_DIR, (err) => {
        console.log('stopped eth client')
        done(err)
      })
    })
  })
  describe('check connection', () => {
    it('should be connected to a local ethereum node', () => {
      expect(web3Client.isConnected()).to.equal(true)
    })
  })

  describe('_checkConnection', () => {
    it('should trigger peer-update listeners with 0 peers when no peers are connected', (done) => {
      web3Client.once('peer-update', (err, numPeers) => {
        expect(err).to.equal(null)
        expect(numPeers).to.equal(0)

        done()
      })
      web3Client._checkConnection()
    })
  })

  describe('createAccountIfNotExist', () => {
    it('should create an account if none exists', (done) => {
      web3Client.createAccountIfNotExist()
      .then((acc) => {
        expect(acc).not.to.equal(null)
        expect(acc.length).to.equal(42)
        done()
      })
      .catch((err) => {
        done({err})
      })
    })

    it('should not create an account if one already exists', (done) => {
      web3Client.createAccountIfNotExist().then((acc1) => {
        expect(web3Client._web3.personal.listAccounts.length).to.equal(1)
        return web3Client.createAccountIfNotExist().then((acc2) => {
          expect(web3Client._web3.personal.listAccounts.length).to.equal(1)
          expect(acc2).to.equal(acc1)
          done()
        })
      })
      .catch((err) => {
        done({err})
      })
    })
  })

  describe('indexNewFile', () => {
    let pushSpy
    let pushResult
    beforeEach(function () {
      pushSpy = sinon.stub()
      pushResult = q.defer()
      pushSpy.returns(pushResult.promise)
      global.SubmittedPapersIndex = {
        push: pushSpy
      }
    })
    it.only('should index a new file and return its filehash', (done) => {
      pushResult.resolve('TRANSACTION_HASH')

      web3Client.createAccountIfNotExist().then((acc1) => {
        return web3Client.indexNewFile('QmcjsPrt3VhTcBPg5F7eTSfxsnQTnKHtqEt7ZpAQBKumTa')
      }).then((result) => {
        expect(result).to.equal('TRANSACTION_HASH')
        expect(pushSpy.calledOnce).to.equal(true)
        done()
      }).catch((err) => {
        done({err})
      })
    })
    it.only('should return error on failure', (done) => {
      pushResult.reject('invalid')

      web3Client.createAccountIfNotExist().then((acc1) => {
        return web3Client.indexNewFile('')
      }).then((result) => {
        done('should have rejected.')
      }).catch((err) => {
        expect(err).to.equal('invalid')
        done()
      })
    })
  })
})
