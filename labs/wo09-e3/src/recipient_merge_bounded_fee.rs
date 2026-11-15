// Experimental Trade extension, not an upstream Liquid Cells capability.
// Whole-transaction secp authorization is enforced by CKB on the matched recipient input.
fn has_recipient_merge(b160: &[u8; 20], amount: u64) -> bool {
    let mut recipient = None;
    let mut i = 0;
    loop {
        match load_cell_lock(i, Source::Input) {
            Ok(lock) => {
                if lock.code_hash().as_slice() == &SECP_CODE_HASH[..]
                    && lock.hash_type().as_slice()[0] == 1
                    && lock.args().raw_data().as_ref() == &b160[..] {
                    if recipient.is_some() { return false; }
                    if !matches!(load_cell_type_hash(i, Source::Input), Ok(None))
                        || !matches!(load_cell_data(i, Source::Input), Ok(d) if d.is_empty()) {
                        return false;
                    }
                    let capacity = match load_cell_capacity(i, Source::Input) { Ok(c) => c, Err(_) => return false };
                    recipient = Some((lock, capacity));
                }
                i += 1;
            }
            Err(SysError::IndexOutOfBound) => break,
            Err(_) => return false,
        }
    }
    let (lock, capacity) = match recipient { Some(r) => r, None => return false };
    let expected = match capacity.checked_add(amount) { Some(c) => c, None => return false };
    let mut matches = 0;
    i = 0;
    loop {
        match load_cell_lock(i, Source::Output) {
            Ok(out_lock) => {
                if out_lock.as_slice() == lock.as_slice() {
                    matches += 1;
                    if !matches!(load_cell_type_hash(i, Source::Output), Ok(None))
                        || !matches!(load_cell_data(i, Source::Output), Ok(d) if d.is_empty())
                        || !matches!(load_cell_capacity(i, Source::Output), Ok(c) if c == expected || recipient_pays_bounded_fee(capacity, amount, c)) {
                        return false;
                    }
                }
                i += 1;
            }
            Err(SysError::IndexOutOfBound) => return matches == 1,
            Err(_) => return false,
        }
    }
}

// Narrow self-paid mode: only anchor + one owner input, only continuing anchor + owner output.
// Full-transaction secp signature authorizes the exact fee. A fixed policy also caps deductions.
const MAX_RECIPIENT_EXIT_FEE: u128 = 1_000_000; // 0.01 CKB, research policy, not a fee-market quote.
fn recipient_pays_bounded_fee(original: u64, amount: u64, replacement: u64) -> bool {
    if !matches!(load_cell_capacity(2, Source::Input), Err(SysError::IndexOutOfBound))
        || !matches!(load_cell_capacity(2, Source::Output), Err(SysError::IndexOutOfBound)) {
        return false;
    }
    let mut inputs = 0u128;
    let mut outputs = 0u128;
    for index in 0..2 {
        inputs += match load_cell_capacity(index, Source::Input) { Ok(c) => c as u128, Err(_) => return false };
        outputs += match load_cell_capacity(index, Source::Output) { Ok(c) => c as u128, Err(_) => return false };
    }
    let fee = match inputs.checked_sub(outputs) { Some(fee) => fee, None => return false };
    fee <= MAX_RECIPIENT_EXIT_FEE && fee <= amount as u128
        && original as u128 + amount as u128 - fee == replacement as u128
}
