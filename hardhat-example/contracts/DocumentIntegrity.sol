// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DocumentIntegrity
 * @dev Stores and verifies document SHA-256 hashes on the blockchain
 */
contract DocumentIntegrity {
    // Mapping from documentId to hash record
    struct HashRecord {
        bytes32 sha256Hash;
        uint256 timestamp;
        address submitter;
    }

    mapping(string => HashRecord) public documentHashes;
    mapping(string => bool) public documentExists;

    event DocumentHashStored(
        string indexed documentId,
        bytes32 sha256Hash,
        uint256 timestamp,
        address indexed submitter
    );

    event DocumentHashRetrieved(
        string indexed documentId,
        bytes32 sha256Hash,
        uint256 timestamp
    );

    /**
     * @dev Store a document hash on the blockchain
     * @param documentId Unique identifier for the document
     * @param sha256Hash The SHA-256 hash of the document
     */
    function storeDocumentHash(string memory documentId, bytes32 sha256Hash)
        public
    {
        require(bytes(documentId).length > 0, "Document ID cannot be empty");
        require(sha256Hash != bytes32(0), "Hash cannot be zero");
        require(!documentExists[documentId], "Document hash already registered");

        documentHashes[documentId] = HashRecord(
            sha256Hash,
            block.timestamp,
            msg.sender
        );
        documentExists[documentId] = true;

        emit DocumentHashStored(documentId, sha256Hash, block.timestamp, msg.sender);
    }

    /**
     * @dev Retrieve a stored document hash
     * @param documentId Unique identifier for the document
     * @return The stored hash record
     */
    function getDocumentHash(string memory documentId)
        public
        view
        returns (HashRecord memory)
    {
        require(documentExists[documentId], "Document not found");
        return documentHashes[documentId];
    }

    /**
     * @dev Verify if a document hash matches the stored hash
     * @param documentId Unique identifier for the document
     * @param sha256Hash The SHA-256 hash to verify
     * @return true if the hash matches, false otherwise
     */
    function verifyDocumentHash(string memory documentId, bytes32 sha256Hash)
        public
        returns (bool)
    {
        require(documentExists[documentId], "Document not found");
        
        HashRecord memory record = documentHashes[documentId];
        bool isValid = record.sha256Hash == sha256Hash;
        
        if (isValid) {
            emit DocumentHashRetrieved(documentId, sha256Hash, record.timestamp);
        }
        
        return isValid;
    }

    /**
     * @dev Check if a document exists on the blockchain
     * @param documentId Unique identifier for the document
     * @return true if the document exists, false otherwise
     */
    function hasDocument(string memory documentId)
        public
        view
        returns (bool)
    {
        return documentExists[documentId];
    }
}
