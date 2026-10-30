"""Finite exhaustive transition model. Not a cryptographic/consensus proof."""
from collections import deque
from pathlib import Path
import json,itertools
ROOT=Path(__file__).resolve().parents[1]
# (time, (status,version,deadline)X, (...)Y, public-v1-time); status0 unopened,1 disputing,2 closed
# Global ticks are an explicit finite abstraction, not real chain clocks.
def explore(restart,window,horizon,eager=False):
 start=(0,(1,0,window),(0,-1,-1),-1);q=deque([start]);seen={start:[]};finals={};edges=0
 while q:
  s=q.popleft();t,x,y,pub=s;legs=[x,y];actions=[]
  if x[0]==y[0]==2:finals.setdefault((x[1],y[1]),seen[s]);continue
  if t<horizon:
   ll=list(legs)
   # Honest replacement watcher reacts within one tick if newer certificate is public.
   if eager and ll[1][0]==0:ll[1]=(1,0,t+1+window)
   if pub>=0:
    for i,(status,v,d) in enumerate(ll):
     if status==0:ll[i]=(1,1,t+1+window)
     elif status==1 and v==0 and t+1<d:ll[i]=(1,1,t+1+window if restart else d)
   actions.append(('tick+bounded_watcher',(t+1,*ll,pub)))
  for i,(status,v,d) in enumerate(legs):
   if status==1 and t>=d:
    ll=list(legs);ll[i]=(2,v,d);actions.append((f'finalize_{i}_v{v}',(t,*ll,pub)))
   for new in [0,1]:
    if status==0 or status==1 and t<d and new>v:
     ll=list(legs);ll[i]=(1,new,t+window if status==0 or restart else d)
     pp=t if new==1 and pub<0 else pub
     actions.append((f'publish_{i}_v{new}',(t,*ll,pp)))
  for label,n in actions:
   edges+=1
   if n not in seen:seen[n]=seen[s]+[{'action':label,'state':n}];q.append(n)
 return {'eagerAllLegDispute':eager,'restart':restart,'window':window,'horizon':horizon,'states':len(seen),'edges':edges,'terminal_versions':list(map(list,sorted(finals))),'counterexample':next((v for (a,b),v in finals.items() if a!=b),None)}
def anchor_model():
 # All possible anchor outcomes and arbitrary finite proof delays. Sound follower has no fallback.
 good=[];bad=[]
 for anchor,delay,proof,refund in itertools.product([0,1],range(9),[False,True],[False,True]):
  # If refund enabled it returns the old allocation at t3, independent of the anchor.
  follower=0 if refund and (not proof or delay>=3) else anchor if proof else None
  row={'anchor':anchor,'proofDelay':delay,'proofAvailable':proof,'independentRefund':refund,'follower':follower}
  (bad if follower is not None and follower!=anchor else good).append(row)
 assert all(r['independentRefund'] for r in bad)
 assert all(r['follower']==r['anchor'] for r in good if not r['independentRefund'] and r['follower'] is not None)
 return {'cases':len(good)+len(bad),'mismatchesWithIndependentRefund':bad,'soundProofNoRefundMismatches':0,'proofAbsentOutcome':'locked, not unilateral recovery','limitation':'transition relation assumes sound finalized proof; verifier and chain not implemented'}
res={'abstraction':'finite, synchronous global ticks, bounded one-tick honest relay, no reorg or signature forgery','independent':[explore(r,w,12) for r in [False,True] for w in [2,3,4]],'eagerIndependent':[explore(r,w,12,True) for r in [False,True] for w in [2,3,4]],'anchor':anchor_model()}
assert all(x['counterexample'] for x in res['independent']+res['eagerIndependent'])
(ROOT/'evidence/model-results.json').write_text(json.dumps(res,indent=2)+'\n')
print(json.dumps({'modelStates':sum(x['states'] for x in res['independent']+res['eagerIndependent']),'modelEdges':sum(x['edges'] for x in res['independent']+res['eagerIndependent']),'independentCounterexamples':len(res['independent'])+len(res['eagerIndependent']),'anchorCases':res['anchor']['cases']}))
