// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IForwarder.sol";

contract FlexibleNonceForwarder is IForwarder, EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant _TYPEHASH =
    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    struct SigsForNonce {
        mapping(bytes => bool) sigs;
    }

    struct FlexibleNonce {
        uint256 currentNonce;
        uint256 block; // when this nonce was first used - used to age transactions
        mapping(uint256 => SigsForNonce) sigsForNonce;
    }
    mapping(address => FlexibleNonce) private _nonces;

    uint256 blockAgeTolerance;

    constructor(uint256 _blockAgeTolerance) EIP712("FlexibleNonceForwarder", "0.0.1") {
        blockAgeTolerance = _blockAgeTolerance;
    }

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from].currentNonce;
    }

    function verifyFlexibleNonce(ForwardRequest calldata req, bytes calldata signature) internal {
        address signer = _hashTypedDataV4(
            keccak256(abi.encode(_TYPEHASH, req.from, req.to, req.value, req.gas, req.nonce, keccak256(req.data)))
        ).recover(signature);

        require(signer == req.from, "FlexibleNonceForwarder: tx to be forwarded is not signed by the request sender");


        if (_nonces[req.from].currentNonce == req.nonce) {
            // request nonce is expected next nonce - increment the nonce, and we are done
            _nonces[req.from].currentNonce = req.nonce + 1;
            _nonces[req.from].block = block.number;
        } else {
            // request nonce is not expected next nonce - check if we have seen this signature before
            require(!_nonces[req.from].sigsForNonce[req.nonce].sigs[signature], "FlexibleNonceForwarder: tx to be forwarded has already been seen");

            // check if the nonce is too old
            require(block.number <= _nonces[req.from].block + blockAgeTolerance, "FlexibleNonceForwarder: tx to be forwarded is too old");
        }

        // store the signature for this nonce to ensure no replay attacks
        _nonces[req.from].sigsForNonce[req.nonce].sigs[signature] = true;
    }

    function execute(ForwardRequest calldata req, bytes calldata signature)
    public
    payable
    returns (bool, bytes memory)
    {
        verifyFlexibleNonce(req, signature);

        (bool success, bytes memory returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Validate that the relayer has sent enough gas for the call.
        // See https://ronan.eth.limo/blog/ethereum-gas-dangers/
        if (gasleft() <= req.gas / 63) {
            // We explicitly trigger invalid opcode to consume all gas and bubble-up the effects, since
            // neither revert or assert consume all gas since Solidity 0.8.0
            // https://docs.soliditylang.org/en/v0.8.0/control-structures.html#panic-via-assert-and-error-via-require
            /// @solidity memory-safe-assembly
            assembly {
                invalid()
            }
        }

        return (success, returndata);
    }
}