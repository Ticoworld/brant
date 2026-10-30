import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from reference import Store, load, ROOT, GENESIS

class FinalityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base=Store(load('bootstrap'))
        cls.first=load('updates')[0]
        cls.rotated=copy.deepcopy(cls.base)
        cls.rotated.update(cls.first,int(cls.first['signature_slot']))

    def reject(self,store,u,reason):
        before=copy.deepcopy(store.__dict__)
        with self.assertRaisesRegex(ValueError,reason):
            store.update(u,int(u['signature_slot']))
        self.assertEqual(before,store.__dict__,'invalid update mutated trust state')

    def test_full_mainnet_chain(self):
        s=copy.deepcopy(self.base)
        for u in load('updates')+[load('finality')]:
            s.update(u,int(u['signature_slot']))
        self.assertEqual(int(s.finalized['beacon']['slot']),7109344)
        self.assertEqual(s.finalized['execution']['state_root'],
          '0x226f5ff47ab3725b5a4a3afc74b1e79e4aa3a29704561eccce590e58900baec3')

    def test_wrong_checkpoint(self):
        with self.assertRaisesRegex(ValueError,'trusted checkpoint'):
            Store(load('bootstrap'),checkpoint='00'*32)

    def test_bootstrap_committee_tamper(self):
        b=load('bootstrap');b['current_sync_committee']['pubkeys'][0]='0x'+'00'*48
        with self.assertRaisesRegex(ValueError,'merkle branch'):Store(b)

    def test_invalid_updates(self):
        cases=[]
        def add(name,mutate,reason):
            u=copy.deepcopy(self.first);mutate(u);cases.append((name,u,reason))
        add('signature',lambda u:u['sync_aggregate'].__setitem__('sync_committee_signature','0x'+'00'*96),'BLS signature')
        add('low participation',lambda u:u['sync_aggregate'].__setitem__('sync_committee_bits','0x'+'01'+'00'*63),'supermajority')
        add('finality branch',lambda u:u['finality_branch'].__setitem__(0,'0x'+'00'*32),'merkle branch')
        add('missing finality node',lambda u:u['finality_branch'].pop(),'branch depth')
        add('execution root',lambda u:u['finalized_header']['execution'].__setitem__('state_root','0x'+'00'*32),'merkle branch')
        add('execution branch',lambda u:u['finalized_header']['execution_branch'].__setitem__(0,'0x'+'00'*32),'merkle branch')
        add('wrong next committee',lambda u:u['next_sync_committee']['pubkeys'].__setitem__(0,'0x'+'00'*48),'merkle branch')
        add('future period',lambda u:u.__setitem__('signature_slot',str(int(u['signature_slot'])+8192*3)),'committee period')
        add('fork',lambda u:u.__setitem__('signature_slot',str(269568*32+2)),'unsupported signing fork')
        add('slot ordering',lambda u:u.__setitem__('signature_slot',u['attested_header']['beacon']['slot']),'slot ordering')
        add('malformed bits',lambda u:u['sync_aggregate'].__setitem__('sync_committee_bits','0x00'),'hex length')
        for name,u,reason in cases:
            with self.subTest(name=name):self.reject(copy.deepcopy(self.base),u,reason)

    def test_wrong_chain_domain(self):
        s=Store(load('bootstrap'),genesis='00'*32)
        self.reject(s,copy.deepcopy(self.first),'BLS signature')

    def test_replay(self):
        self.reject(copy.deepcopy(self.rotated),copy.deepcopy(self.first),'replay')

    def test_unknown_rotated_committee(self):
        self.reject(copy.deepcopy(self.base),load('updates')[1],'committee period')

    def test_future_signature(self):
        with self.assertRaisesRegex(ValueError,'slot ordering'):
            copy.deepcopy(self.base).update(self.first,int(self.first['signature_slot'])-1)

if __name__=='__main__':unittest.main(verbosity=2)
