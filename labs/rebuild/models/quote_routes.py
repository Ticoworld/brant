"""Exact provenance-aware quote routes, independent of on-chain expiry claims."""
from fractions import Fraction as F
from datetime import datetime,timezone
from pathlib import Path
import json,tempfile

def load(path):
    obj=json.loads(Path(path).read_text(),parse_float=F)
    if not isinstance(obj.get('synthetic'),bool) or not obj.get('source'):raise ValueError('PROVENANCE')
    if not obj['synthetic']:
        if not obj.get('observed_at'):raise ValueError('OBSERVATION_TIME')
        if datetime.fromisoformat(obj['observed_at'].replace('Z','+00:00')).tzinfo is None:raise ValueError('TIMEZONE')
    for edge in obj['edges']:
        if not edge['from'] or not edge['to'] or edge['from']==edge['to']:raise ValueError('ASSET_DOMAIN')
        edge['levels']=[(F(str(p)),F(str(q))) for p,q in edge['levels']]
        if any(p<=0 or q<=0 for p,q in edge['levels']):raise ValueError('DEPTH')
        if edge['levels']!=sorted(edge['levels'],reverse=True):raise ValueError('SORT_ORDER')
        edge['fixed_fee']=None if edge.get('fixed_fee') is None else F(str(edge['fixed_fee']))
        edge['fee_rate']=None if edge.get('fee_rate') is None else F(str(edge['fee_rate']))
        if (edge['fixed_fee'] is not None and edge['fixed_fee']<0) or (edge['fee_rate'] is not None and not 0<=edge['fee_rate']<1):raise ValueError('FEE_RANGE')
        if edge['delay']<0:raise ValueError('DELAY')
    return obj

def execute(edge,quantity):
    if edge['fixed_fee'] is None or edge['fee_rate'] is None:return None,'UNKNOWN_FEE'
    left=quantity;gross=F(0)
    for price,depth in edge['levels']:
        take=min(left,depth);gross+=take*price;left-=take
    if left:return None,'INSUFFICIENT_DEPTH'
    net=gross*(1-edge['fee_rate'])-edge['fixed_fee']
    return (net,'EXECUTABLE_MODEL') if net>=0 else (None,'FEES_EXCEED_OUTPUT')

def route(snapshot,ids,quantity,start,end,max_delay,allow_synthetic=False):
    if snapshot['synthetic'] and not allow_synthetic:return {'status':'SYNTHETIC_NOT_OBSERVATION'}
    current=start;amount=F(quantity);delay=0;seen=set()
    for id in ids:
        if id in seen:return {'status':'ROUTE_CYCLE'}
        seen.add(id);edge=next(e for e in snapshot['edges'] if e['id']==id)
        if edge['from']!=current:return {'status':'ASSET_VENUE_MISMATCH'}
        amount,status=execute(edge,amount)
        if amount is None:return {'status':status}
        delay+=edge['delay'];current=edge['to']
    if current!=end:return {'status':'WRONG_DESTINATION'}
    if delay>max_delay:return {'status':'NOT_DELIVERABLE_IN_TIME','delay':delay}
    return {'status':'SYNTHETIC_PLAN' if snapshot['synthetic'] else 'OBSERVATION_DERIVED_PLAN','output':str(amount),'delay':delay,'source':snapshot['source'],'observed_at':snapshot.get('observed_at'),'limitation':'Depth/fee plan does not guarantee fills or on-chain upper expiry.'}

def run():
    obj={'synthetic':True,'source':'exact independent route fixture','observed_at':None,'edges':[
      {'id':'direct','from':'native:CKB','to':'destination:USD','levels':[['1.02','100']],'fixed_fee':'1','fee_rate':'0','delay':0},
      {'id':'deposit','from':'native:CKB','to':'cex:CKB','levels':[['1','100']],'fixed_fee':'0.1','fee_rate':'0','delay':2},
      {'id':'cex','from':'cex:CKB','to':'cex:USD','levels':[['1.04','100']],'fixed_fee':'0','fee_rate':'0.001','delay':0},
      {'id':'withdraw','from':'cex:USD','to':'destination:USD','levels':[['1','1000']],'fixed_fee':'2','fee_rate':'0','delay':3}]}
    with tempfile.TemporaryDirectory(prefix='trade-quote-') as tmp:
        p=Path(tmp)/'fixture.json';p.write_text(json.dumps(obj));snap=load(p)
        direct=route(snap,['direct'],10,'native:CKB','destination:USD',0,True);assert F(direct['output'])==F('9.2')
        delayed=route(snap,['deposit','cex','withdraw'],10,'native:CKB','destination:USD',0,True);assert delayed['status']=='NOT_DELIVERABLE_IN_TIME'
        planned=route(snap,['deposit','cex','withdraw'],10,'native:CKB','destination:USD',5,True);assert F(planned['output'])==F('8.285704')
        assert route(snap,['cex'],10,'native:CKB','cex:USD',0,True)['status']=='ASSET_VENUE_MISMATCH'
        assert route(snap,['direct'],101,'native:CKB','destination:USD',0,True)['status']=='INSUFFICIENT_DEPTH'
        assert route(snap,['direct'],10,'native:CKB','destination:USD',0)['status']=='SYNTHETIC_NOT_OBSERVATION'
        snap['edges'][0]['fixed_fee']=None;assert route(snap,['direct'],10,'native:CKB','destination:USD',0,True)['status']=='UNKNOWN_FEE'
        obj['synthetic']=False;p.write_text(json.dumps(obj))
        try:load(p)
        except ValueError as e:assert str(e)=='OBSERVATION_TIME'
        else:raise AssertionError('unobserved data accepted')
    return {'status':'PASS','direct':direct,'delayed_route':delayed,'delayed_plan':planned,'source_classification':'All examples synthetic; no executable external observations.','cases':['exact depth/fees','venue-specific assets','withdrawal delay','insufficient depth','unknown fees','synthetic/observed separation','required observation timestamp'],'expiry_limit':'A local plan timestamp is not a consensus-enforced passive quote expiry.'}

if __name__=='__main__':
    r=run();Path(__file__).with_name('quote-route-results.json').write_text(json.dumps(r,indent=2)+'\n');print('exact route/provenance/depth/fee/delay cases PASS')
