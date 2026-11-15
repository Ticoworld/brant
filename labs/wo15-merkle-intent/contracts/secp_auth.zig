// Experimental adapter: Zig 0.14.1 stdlib ECDSA over secp256k1 and SHA-256.
// message32 is the 32-byte canonical intent digest, hashed once by the library.
const std = @import("std");
const E = std.crypto.sign.ecdsa.EcdsaSecp256k1Sha256;
pub export fn trade_secp_verify(pubkey: [*]const u8, signature: [*]const u8, message: [*]const u8) callconv(.c) c_int {
    const pk = E.PublicKey.fromSec1(pubkey[0..33]) catch return 1;
    const sig = E.Signature.fromBytes(signature[0..64].*);
    sig.verify(message[0..32], pk) catch return 2;
    return 0;
}
pub fn panic(_: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn { while (true) {} }

test "valid, modified, malformed" {
    const kp = E.KeyPair.generate();
    const m = [_]u8{0x42} ** 32;
    const pk = kp.public_key.toCompressedSec1();
    const sig = (try kp.sign(&m, null)).toBytes();
    try std.testing.expectEqual(@as(c_int, 0), trade_secp_verify(&pk, &sig, &m));
    var altered = m; altered[0] ^= 1;
    try std.testing.expect(trade_secp_verify(&pk, &sig, &altered) != 0);
    const invalid = [_]u8{0} ** 64;
    try std.testing.expect(trade_secp_verify(&pk, &invalid, &m) != 0);
    const bad_pk = [_]u8{0} ** 33;
    try std.testing.expect(trade_secp_verify(&bad_pk, &sig, &m) != 0);
}

test "interop with noble-curves compact SHA256 signature" {
    var pk_buf: [33]u8 = undefined;
    const pk = try std.fmt.hexToBytes(&pk_buf, "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
    var sig_buf: [64]u8 = undefined;
    const sig = try std.fmt.hexToBytes(&sig_buf, "743ff9279aa726d81a5728999c77fce47e5c6a7cef688e54180b381f00e9722c4c3ce31b4baa7e44f1288d8df3d681548db6658149520b8e2b71b46b3b668ab8");
    const m = [_]u8{0x42} ** 32;
    try std.testing.expectEqual(@as(c_int, 0), trade_secp_verify(pk.ptr, sig.ptr, &m));
}
