const std = @import("std");
pub export fn trade_ed_verify(pubkey: [*]const u8, signature: [*]const u8, message: [*]const u8) callconv(.c) c_int {
    const E = std.crypto.sign.Ed25519;
    const pk = E.PublicKey.fromBytes(pubkey[0..32].*) catch return 1;
    const sig = E.Signature.fromBytes(signature[0..64].*);
    sig.verify(message[0..32], pk) catch return 2;
    return 0;
}
pub fn panic(_: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn { while (true) {} }
