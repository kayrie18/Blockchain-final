const { expect } = require("chai");

describe("DocumentIntegrity", function () {
  let documentIntegrity;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    const DocumentIntegrity = await ethers.getContractFactory("DocumentIntegrity");
    documentIntegrity = await DocumentIntegrity.deploy();
    await documentIntegrity.waitForDeployment();
  });

  it("Should store and retrieve a document hash", async function () {
    const documentId = "doc-001";
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));

    // Store hash
    const tx = await documentIntegrity.storeDocumentHash(documentId, hash);
    await tx.wait();

    // Retrieve and verify
    const record = await documentIntegrity.getDocumentHash(documentId);
    expect(record.sha256Hash).to.equal(hash);
    expect(record.submitter).to.equal(owner.address);
  });

  it("Should verify a document hash", async function () {
    const documentId = "doc-002";
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));

    // Store hash
    const storeTx = await documentIntegrity.storeDocumentHash(documentId, hash);
    await storeTx.wait();

    // Verify
    const verifyTx = await documentIntegrity.verifyDocumentHash(documentId, hash);
    await verifyTx.wait();
    expect(verifyTx.hash).to.exist;
  });

  it("Should reject attempts to overwrite a registered document hash", async function () {
    const documentId = "doc-immutable";
    const originalHash = ethers.keccak256(ethers.toUtf8Bytes("original-content"));
    const replacementHash = ethers.keccak256(ethers.toUtf8Bytes("replacement-content"));

    await documentIntegrity.storeDocumentHash(documentId, originalHash);

    await expect(
      documentIntegrity.connect(addr1).storeDocumentHash(documentId, replacementHash)
    ).to.be.revertedWith("Document hash already registered");

    const record = await documentIntegrity.getDocumentHash(documentId);
    expect(record.sha256Hash).to.equal(originalHash);
  });

  it("Should return false for invalid hash", async function () {
    const documentId = "doc-003";
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));
    const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong-content"));

    // Store hash
    const storeTx = await documentIntegrity.storeDocumentHash(documentId, hash);
    await storeTx.wait();

    // Verify with wrong hash
    const verifyTx = await documentIntegrity.verifyDocumentHash(documentId, wrongHash);
    await verifyTx.wait();
    expect(verifyTx.hash).to.exist;
  });

  it("Should check if document exists", async function () {
    const documentId = "doc-004";
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-content"));

    expect(await documentIntegrity.hasDocument(documentId)).to.be.false;

    const tx = await documentIntegrity.storeDocumentHash(documentId, hash);
    await tx.wait();

    expect(await documentIntegrity.hasDocument(documentId)).to.be.true;
  });
});
