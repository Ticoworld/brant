// Single-hart replacement for bytes 1.11.1 atomics in a CKB-VM contract build.
// This file is only suitable for single-threaded CKB-VM execution. It deliberately
// does not implement Send or Sync, and it must not be reused in a host application.
use core::{cell::UnsafeCell, ptr::{read_volatile, write_volatile}, sync::atomic::Ordering};

#[repr(transparent)]
pub(crate) struct AtomicUsize(UnsafeCell<usize>);

impl AtomicUsize {
    pub(crate) const fn new(value: usize) -> Self { Self(UnsafeCell::new(value)) }
    pub(crate) fn load(&self, _order: Ordering) -> usize { unsafe { read_volatile(self.0.get()) } }
    pub(crate) fn fetch_add(&self, value: usize, _order: Ordering) -> usize {
        unsafe { let old = read_volatile(self.0.get()); write_volatile(self.0.get(), old.wrapping_add(value)); old }
    }
    pub(crate) fn fetch_sub(&self, value: usize, _order: Ordering) -> usize {
        unsafe { let old = read_volatile(self.0.get()); write_volatile(self.0.get(), old.wrapping_sub(value)); old }
    }
    pub(crate) fn compare_exchange(&self, current: usize, new: usize, _success: Ordering, _failure: Ordering) -> Result<usize, usize> {
        unsafe { let old = read_volatile(self.0.get()); if old == current { write_volatile(self.0.get(), new); Ok(old) } else { Err(old) } }
    }
}

#[repr(transparent)]
pub(crate) struct AtomicPtr<T>(UnsafeCell<*mut T>);

impl<T> AtomicPtr<T> {
    pub(crate) const fn new(value: *mut T) -> Self { Self(UnsafeCell::new(value)) }
    pub(crate) fn load(&self, _order: Ordering) -> *mut T { unsafe { read_volatile(self.0.get()) } }
    pub(crate) fn compare_exchange(&self, current: *mut T, new: *mut T, _success: Ordering, _failure: Ordering) -> Result<*mut T, *mut T> {
        unsafe { let old = read_volatile(self.0.get()); if old == current { write_volatile(self.0.get(), new); Ok(old) } else { Err(old) } }
    }
    pub(crate) fn get_mut(&mut self) -> &mut *mut T { self.0.get_mut() }
}
