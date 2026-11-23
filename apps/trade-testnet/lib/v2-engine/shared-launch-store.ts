import type {normalizeLaunchMetadata} from './launch-metadata.ts';
import {DatabaseSync} from 'node:sqlite';
import {isAbsolute} from 'node:path';
import {readSharedLaunchJournal, sharedLaunchJournalKey, sharedLaunchStages} from './shared-launch.ts';

type Scope = Parameters<typeof readSharedLaunchJournal>[1];
type Hashes = Parameters<typeof readSharedLaunchJournal>[2];
type Journal = ReturnType<typeof readSharedLaunchJournal>;
type Stage = typeof sharedLaunchStages[number];

export function openSharedLaunchStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS shared_launch (
      market_key TEXT PRIMARY KEY,
      anchor_key TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      journal TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_launch_publication (
      market_key TEXT PRIMARY KEY REFERENCES shared_launch(market_key),
      publication TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_launch_snapshot (
      market_key TEXT PRIMARY KEY REFERENCES shared_launch(market_key),
      snapshot TEXT NOT NULL
    );
  `);
  const load = db.prepare('SELECT plan, journal FROM shared_launch WHERE market_key = ?');
  const update = db.prepare('UPDATE shared_launch SET journal = ? WHERE market_key = ? AND journal = ?');
  const insert = db.prepare('INSERT OR IGNORE INTO shared_launch VALUES (?, ?, ?, ?)');
  const saveSnapshot = db.prepare('INSERT INTO shared_launch_snapshot VALUES (?, ?)');
  const loadSnapshot = db.prepare('SELECT snapshot FROM shared_launch_snapshot WHERE market_key = ?');

  function loadPlan(scope: Scope, hashes: Hashes) {
    const key = sharedLaunchJournalKey(scope).toLowerCase();
    const row = load.get(key) as {plan: string; journal: string} | undefined;
    const plan = JSON.stringify(sharedLaunchStages.map(stage => hashes[stage]));
    if (!row || row.plan !== plan) throw Error('Launch reservation or immutable plan differs');
    return {key, raw: row.journal, journal: readSharedLaunchJournal(row.journal, scope, hashes)};
  }

  function save(scope: Scope, hashes: Hashes, change: (journal: Journal) => Journal) {
    const {key, raw, journal} = loadPlan(scope, hashes);
    const next = JSON.stringify(change(journal));
    readSharedLaunchJournal(next, scope, hashes);
    if (update.run(next, key, raw).changes !== 1) throw Error('Launch journal advanced concurrently');
    return next;
  }

  return {
    close: () => db.close(),
    listSessions(genesis: string, owner: string) {
      const rows = db.prepare(`
        SELECT journal FROM shared_launch
        WHERE json_extract(journal, '$.genesis') = ? AND json_extract(journal, '$.owner') = ?
        ORDER BY rowid DESC LIMIT 50
      `).all(genesis, owner);
      return rows.map(row => {
        const {market, entries} = JSON.parse(String(row.journal)) as Journal;
        return {market, entries};
      });
    },
    readLogo(genesis: string, market: string) {
      const row = db.prepare("SELECT json_extract(publication, '$.logo') AS logo FROM shared_launch_publication WHERE market_key = ?")
        .get(`brant-launch-v2:${genesis}:${market}`);
      return typeof row?.logo === 'string' && row.logo.length <= 100_000 ? Buffer.from(row.logo, 'base64') : null;
    },
    isPublished(scope: Scope, hashes: Hashes) {
      const {key} = loadPlan(scope, hashes);
      return Boolean(db.prepare('SELECT 1 FROM shared_launch_publication WHERE market_key = ?').get(key));
    },
    publish(scope: Scope, hashes: Hashes, token: string, metadata: ReturnType<typeof normalizeLaunchMetadata>, logo?: string) {
      const {key, raw, journal} = loadPlan(scope, hashes);
      if (journal.entries.length !== sharedLaunchStages.length || journal.entries.some(entry => entry.state !== 'confirmed')) {
        throw Error('Launch is not confirmed');
      }
      const publication = {...scope, token, receipts: journal.entries, metadata};
      const encoded = JSON.stringify({...publication, ...(logo ? {logo} : {})});
      db.prepare('INSERT OR IGNORE INTO shared_launch_publication SELECT market_key, ? FROM shared_launch WHERE market_key = ? AND journal = ?')
        .run(encoded, key, raw);
      const row = db.prepare('SELECT publication FROM shared_launch_publication WHERE market_key = ?').get(key);
      if (row?.publication !== encoded) throw Error('Launch publication differs or journal changed');
      return publication;
    },
    find(genesis: string, market: string, owner: string) {
      const row = load.get(`brant-launch-v2:${genesis}:${market}`.toLowerCase()) as {plan: string; journal: string} | undefined;
      if (!row) return null;
      const {anchor, owner: storedOwner} = JSON.parse(row.journal);
      if (storedOwner !== owner) return null;
      const hashes = Object.fromEntries(sharedLaunchStages.map((stage, index) => [stage, JSON.parse(row.plan)[index]])) as Hashes;
      const scope: Scope = {genesis, market: market as Scope['market'], owner: owner as Scope['owner'], anchor};
      return {scope, hashes, journal: readSharedLaunchJournal(row.journal, scope, hashes)};
    },
    reserve(scope: Scope, hashes: Hashes, snapshot?: string, setupSubmitted = false) {
      const validHash = /^0x[\da-f]{64}$/i;
      if (![scope.genesis, scope.owner, scope.market, scope.anchor.txHash,
        ...sharedLaunchStages.map(stage => hashes[stage])].every(value => validHash.test(value)) ||
        !/^0x[\da-f]+$/i.test(scope.anchor.index) || BigInt(scope.anchor.index) > 0xffffffffn) {
        throw Error('Invalid launch reservation identity');
      }
      if (setupSubmitted && snapshot === undefined) throw Error('Submitted Setup requires a launch snapshot');
      const entries = setupSubmitted ? [{stage: 'setup', txHash: hashes.setup, state: 'submitted'}] : [];
      const raw = JSON.stringify({version: 2, ...scope, entries});
      readSharedLaunchJournal(raw, scope, hashes);
      const key = sharedLaunchJournalKey(scope).toLowerCase();
      const anchor = `${scope.genesis.toLowerCase()}:${scope.anchor.txHash.toLowerCase()}:${BigInt(scope.anchor.index)}`;
      const plan = JSON.stringify(sharedLaunchStages.map(stage => hashes[stage]));
      db.exec('BEGIN IMMEDIATE');
      try {
        if (insert.run(key, anchor, plan, raw).changes !== 1) throw Error('Launch anchor or market already reserved');
        if (snapshot !== undefined) saveSnapshot.run(key, snapshot);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return raw;
    },
    readSnapshot(scope: Scope, hashes: Hashes) {
      const {key} = loadPlan(scope, hashes);
      const row = loadSnapshot.get(key) as {snapshot: string} | undefined;
      if (!row) throw Error('Launch snapshot unavailable');
      return row.snapshot;
    },
    read(scope: Scope, hashes: Hashes) {
      return loadPlan(scope, hashes).raw;
    },
    /** Persist the planned hash before sending. Timeouts leave this entry pending. */
    recordSubmission(scope: Scope, hashes: Hashes, stage: Stage) {
      return save(scope, hashes, journal => {
        if (sharedLaunchStages[journal.entries.length] !== stage ||
            journal.entries.some(entry => entry.state !== 'confirmed')) throw Error('Launch stage requires reconciliation');
        return {...journal, entries: [...journal.entries, {stage, txHash: hashes[stage], state: 'submitted'}]};
      });
    },
    /** The caller obtains this receipt from the native canonical stage verifier. */
    confirm(scope: Scope, hashes: Hashes, receipt: {stage: Stage; txHash: string; blockHash: string}) {
      return save(scope, hashes, journal => {
        const prior = journal.entries.at(-1);
        if (!prior || prior.state !== 'submitted' || prior.stage !== receipt.stage ||
          prior.txHash !== receipt.txHash) throw Error('Receipt does not match the pending launch stage');
        return {...journal, entries: [...journal.entries.slice(0, -1), {...receipt, state: 'confirmed'}]};
      });
    },
  };
}

export function openConfiguredSharedLaunchStore() {
  const path = process.env.BRANT_LAUNCH_SQLITE_PATH;
  if (!path || !isAbsolute(path)) throw Error('Configure an absolute persistent BRANT_LAUNCH_SQLITE_PATH');
  return openSharedLaunchStore(path);
}
